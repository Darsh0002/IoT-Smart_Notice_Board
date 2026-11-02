/*
 * ===================================================================================
 *  Bluetooth SMART NOTICE BOARD - ESP32 Firmware (SSD1306 OLED 128x64 I2C)
 *  + Green/Red LED Indicators + Active Buzzer Alert
 * ===================================================================================
 *  Hardware:
 *    - ESP32-WROOM-32 / NodeMCU ESP32
 *    - 0.96" SSD1306 OLED 128×64  (I2C 0x3C, SDA=GPIO21, SCL=GPIO22)
 *    - Green LED  (GPIO 25 → 330Ω resistor → LED → GND)  : BLE Connected
 *    - Red   LED  (GPIO 26 → 330Ω resistor → LED → GND)  : Urgent Notice
 *    - Active Buzzer (GPIO 27 → Buzzer+ , Buzzer- → GND)  : Urgent one-shot alert
 *
 *  [OPTIONAL – 16x2 LCD integration, see note at bottom of file]
 *
 *  Libraries (install via Arduino Library Manager):
 *    - Adafruit SSD1306      (by Adafruit, ≥2.5)
 *    - Adafruit GFX Library  (by Adafruit, ≥1.11)
 *    - ArduinoJson           (by Benoit Blanchon, 6.x / 7.x)
 *    - ESP32 BLE Arduino     (bundled with esp32 board package)
 * ===================================================================================
 */

#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>
#include <ArduinoJson.h>

// ═══════════════════════════════════════════════════════════
//  PIN DEFINITIONS
// ═══════════════════════════════════════════════════════════
#define PIN_LED_GREEN  25   // Green LED  — BLE connected indicator
#define PIN_LED_RED    26   // Red LED    — Urgent notice active
#define PIN_BUZZER     27   // Active buzzer (HIGH = ON)

// ═══════════════════════════════════════════════════════════
//  OLED CONFIGURATION
// ═══════════════════════════════════════════════════════════
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT  64
#define OLED_RESET     -1        // No dedicated reset pin
#define OLED_ADDRESS   0x3C      // Standard SSD1306 I2C address

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ═══════════════════════════════════════════════════════════
//  BLE UUIDS  (must match Web Bluetooth frontend)
// ═══════════════════════════════════════════════════════════
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ═══════════════════════════════════════════════════════════
//  GLOBAL INSTANCES
// ═══════════════════════════════════════════════════════════
Preferences        preferences;
BLEServer*         pServer         = NULL;
BLECharacteristic* pCharacteristic = NULL;

// ═══════════════════════════════════════════════════════════
//  SYSTEM STATE
// ═══════════════════════════════════════════════════════════
bool deviceConnected    = false;
bool oldDeviceConnected = false;
bool hasNotice          = false;
bool urgentActive       = false;  // tracks if current notice is Urgent
bool buzzerFired        = false;  // ensures buzzer fires only ONCE per urgent notice

// ═══════════════════════════════════════════════════════════
//  NOTICE DATA STRUCTURE
// ═══════════════════════════════════════════════════════════
struct NoticeData {
  String title;
  String message;
  String priority;    // "Normal" | "Important" | "Urgent"
  String category;
  int    scrollSpeed; // pixel-shift delay in ms
};

NoticeData currentNotice;

// ═══════════════════════════════════════════════════════════
//  SCROLLING / ANIMATION STATE
// ═══════════════════════════════════════════════════════════
int           scrollX        = SCREEN_WIDTH;
int           textPixelWidth = 0;
unsigned long lastScrollTime = 0;
unsigned long lastBlinkTime  = 0;
bool          urgentBlink    = false;

// -----------------------------------------------------------------------
//  BUZZER — "Triple-Ascending Tone" pattern for PASSIVE buzzer
//  Uses tone() which generates PWM — required for passive buzzers.
//
//  Pattern (musical feel):
//    Beep 1 : 800 Hz  · 150 ms  — low warning tone
//    Beep 2 : 1200 Hz · 150 ms  — mid alert tone
//    Beep 3 : 1600 Hz · 350 ms  — high urgent crescendo
//
//  Total duration ≈ 1050 ms, plays exactly ONCE per urgent notice.
//  tone(pin, freq, duration_ms) is supported on ESP32 core ≥ 3.x
// -----------------------------------------------------------------------
void playUrgentBuzzerOnce() {
  // Beep 1 — low tone (warning)
  tone(PIN_BUZZER, 800, 150);
  delay(230);   // tone duration + gap

  // Beep 2 — mid tone (alert)
  tone(PIN_BUZZER, 1200, 150);
  delay(230);

  // Beep 3 — high tone, longer (urgent crescendo)
  tone(PIN_BUZZER, 1600, 350);
  delay(430);

  noTone(PIN_BUZZER);   // ensure buzzer is silent after pattern
  Serial.println("[BUZZER] Passive buzzer alert pattern fired (one-shot).");
}

// -----------------------------------------------------------------------
//  LED helpers
// -----------------------------------------------------------------------
inline void greenLedOn()  { digitalWrite(PIN_LED_GREEN, HIGH); }
inline void greenLedOff() { digitalWrite(PIN_LED_GREEN, LOW);  }
inline void redLedOn()    { digitalWrite(PIN_LED_RED,   HIGH); }
inline void redLedOff()   { digitalWrite(PIN_LED_RED,   LOW);  }

// -----------------------------------------------------------------------
//  NVS pixel-width helper
// -----------------------------------------------------------------------
int strPixelWidth(const String& s) { return s.length() * 6; }

void prepareScroll() {
  scrollX        = SCREEN_WIDTH;
  textPixelWidth = strPixelWidth(currentNotice.message);
}

// ═══════════════════════════════════════════════════════════
//  NVS (Preferences) helpers
// ═══════════════════════════════════════════════════════════
void saveNoticeToNVS() {
  preferences.begin("noticeboard", false);
  preferences.putString("title",     currentNotice.title);
  preferences.putString("message",   currentNotice.message);
  preferences.putString("priority",  currentNotice.priority);
  preferences.putString("category",  currentNotice.category);
  preferences.putInt   ("speed",     currentNotice.scrollSpeed);
  preferences.putBool  ("hasNotice", true);
  preferences.end();
  Serial.println("[NVS] Notice saved to flash.");
}

void loadNoticeFromNVS() {
  preferences.begin("noticeboard", true);
  hasNotice = preferences.getBool("hasNotice", false);
  if (hasNotice) {
    currentNotice.title       = preferences.getString("title",    "Smart Notice Board");
    currentNotice.message     = preferences.getString("message",  "Welcome!");
    currentNotice.priority    = preferences.getString("priority", "Normal");
    currentNotice.category    = preferences.getString("category", "General");
    currentNotice.scrollSpeed = preferences.getInt   ("speed",    30);
    Serial.println("[NVS] Loaded notice: " + currentNotice.title);
  } else {
    currentNotice.title       = "SMART NOTICE BD";
    currentNotice.message     = "Awaiting BLE connection from Admin Web Portal...";
    currentNotice.priority    = "Normal";
    currentNotice.category    = "System";
    currentNotice.scrollSpeed = 30;
  }
  preferences.end();

  // Restore LED + buzzer state from persisted priority
  if (currentNotice.priority == "Urgent") {
    urgentActive = true;
    redLedOn();
    // Don't re-fire buzzer on boot — it already fired when notice was received
    buzzerFired = true;
  }

  prepareScroll();
}

void clearNoticeFromNVS() {
  preferences.begin("noticeboard", false);
  preferences.clear();
  preferences.end();

  hasNotice                 = false;
  urgentActive              = false;
  buzzerFired               = false;
  currentNotice.title       = "SMART NOTICE BD";
  currentNotice.message     = "No active notices. Board is ready.";
  currentNotice.priority    = "Normal";
  currentNotice.category    = "System";
  currentNotice.scrollSpeed = 30;

  redLedOff();  // clear red LED on notice clear
  prepareScroll();
  display.clearDisplay();
  display.display();
}

// ═══════════════════════════════════════════════════════════
//  BLE SERVER CALLBACKS
// ═══════════════════════════════════════════════════════════
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    greenLedOn();   // ← Green LED ON when BLE connected
    Serial.println("[BLE] Admin connected — Green LED ON.");
  }
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    greenLedOff();  // ← Green LED OFF on disconnect
    Serial.println("[BLE] Admin disconnected — Green LED OFF.");
  }
};

// ═══════════════════════════════════════════════════════════
//  BLE CHARACTERISTIC WRITE CALLBACK
// ═══════════════════════════════════════════════════════════
class NoticeCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) {
    String rxValue = pChar->getValue().c_str();
    if (rxValue.length() == 0) return;

    Serial.println("[BLE RX] " + rxValue);

    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, rxValue);

    if (!err) {
      // ── CLEAR command ────────────────────────────────────
      if (doc["action"] == "clear") {
        clearNoticeFromNVS();
        pChar->setValue("ACK:CLEARED");
        pChar->notify();
        Serial.println("[BLE] ACK:CLEARED sent.");
        return;
      }

      // ── NEW / UPDATE notice ──────────────────────────────
      String prevPriority = currentNotice.priority;

      currentNotice.title    = doc["title"].as<String>();
      currentNotice.message  = doc["content"].as<String>();
      currentNotice.priority = doc["priority"] | "Normal";
      currentNotice.category = doc["category"] | "General";

      String spd = doc["scrollSpeed"] | "Medium";
      if      (spd == "Fast") currentNotice.scrollSpeed = 15;
      else if (spd == "Slow") currentNotice.scrollSpeed = 50;
      else                    currentNotice.scrollSpeed = 30;

      hasNotice = true;
      prepareScroll();
      saveNoticeToNVS();

      // ── LED + Buzzer logic ───────────────────────────────
      if (currentNotice.priority == "Urgent") {
        redLedOn();  // Red LED ON for urgent
        if (!urgentActive || !buzzerFired) {
          // Fire buzzer ONCE — only if this is a new urgent notice
          playUrgentBuzzerOnce();
          buzzerFired  = true;
        }
        urgentActive = true;
        Serial.println("[ALERT] Urgent notice — Red LED ON.");
      } else {
        redLedOff();  // Red LED OFF for non-urgent
        urgentActive = false;
        buzzerFired  = false;
        Serial.println("[ALERT] Non-urgent notice — Red LED OFF.");
      }

      pChar->setValue("ACK:NOTICE_UPDATED");
      pChar->notify();
      Serial.println("[BLE] ACK:NOTICE_UPDATED sent.");

    } else {
      // Fallback: raw text string (treat as Normal)
      currentNotice.title       = "NEW NOTICE";
      currentNotice.message     = rxValue;
      currentNotice.priority    = "Normal";
      currentNotice.category    = "General";
      currentNotice.scrollSpeed = 30;
      hasNotice = true;
      redLedOff();
      urgentActive = false;
      buzzerFired  = false;
      prepareScroll();
      saveNoticeToNVS();
    }
  }
};

// ═══════════════════════════════════════════════════════════
//  OLED RENDERING HELPERS
// ═══════════════════════════════════════════════════════════
void drawHRule(int y) {
  display.drawFastHLine(0, y, SCREEN_WIDTH, WHITE);
}

String fitString(const String& s, int maxPixels) {
  int maxChars = maxPixels / 6;
  if ((int)s.length() <= maxChars) return s;
  return s.substring(0, maxChars);
}

// -----------------------------------------------------------------------
//  renderOLED — full-frame compositing, called every loop tick
// -----------------------------------------------------------------------
void renderOLED() {
  display.clearDisplay();

  // ── Zone 0 : Header bar (inverted) ────────────────────────────────────
  display.fillRect(0, 0, SCREEN_WIDTH, 10, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);

  String priLabel;
  if      (currentNotice.priority == "Urgent")    priLabel = "[!URGENT]";
  else if (currentNotice.priority == "Important") priLabel = "[IMP]";
  else                                            priLabel = "[INFO]";
  display.setCursor(1, 1);
  display.print(priLabel);

  String bleStatus = deviceConnected ? "BLE:ON" : "BLE:ADV";
  int bleX = SCREEN_WIDTH - (bleStatus.length() * 6) - 1;
  display.setCursor(bleX, 1);
  display.print(bleStatus);

  display.setTextColor(WHITE);

  // ── Zone 1 : Title row ────────────────────────────────────────────────
  if (currentNotice.priority == "Urgent") {
    unsigned long now = millis();
    if (now - lastBlinkTime >= 600) {
      lastBlinkTime = now;
      urgentBlink   = !urgentBlink;
    }
    if (urgentBlink) {
      display.setCursor(0, 12);
      display.setTextSize(1);
      display.print(fitString("!! " + currentNotice.title + " !!", SCREEN_WIDTH));
    }
  } else {
    display.setCursor(0, 12);
    display.setTextSize(1);
    display.print(fitString(currentNotice.title, SCREEN_WIDTH));
  }

  // ── Zone 2 : Horizontal divider ───────────────────────────────────────
  drawHRule(23);

  // ── Zone 3 : Pixel-scroll marquee ─────────────────────────────────────
  display.setTextSize(1);

  if (textPixelWidth <= SCREEN_WIDTH) {
    int cx = (SCREEN_WIDTH - textPixelWidth) / 2;
    display.setCursor(cx, 33);
    display.print(currentNotice.message);
  } else {
    unsigned long now2 = millis();
    if (now2 - lastScrollTime >= (unsigned long)currentNotice.scrollSpeed) {
      lastScrollTime = now2;
      scrollX--;
      if (scrollX < -textPixelWidth) scrollX = SCREEN_WIDTH;
    }
    display.setCursor(scrollX, 33);
    display.print(currentNotice.message);
  }

  // ── Zone 4 : Status footer ────────────────────────────────────────────
  drawHRule(52);
  display.setTextSize(1);
  display.setCursor(0, 55);
  display.print(fitString(currentNotice.category.length() > 0 ? currentNotice.category : "General", 72));

  String spd = (currentNotice.scrollSpeed <= 15) ? "SPD:F"
             : (currentNotice.scrollSpeed >= 50) ? "SPD:S" : "SPD:M";
  int spdX = SCREEN_WIDTH - (spd.length() * 6) - 1;
  display.setCursor(spdX, 55);
  display.print(spd);

  display.display();
}

// ═══════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n=== BLE Smart Notice Board (OLED + LED + Buzzer) ===");

  // ── GPIO Init ─────────────────────────────────────────────────────────
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED,   OUTPUT);
  pinMode(PIN_BUZZER,    OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);
  digitalWrite(PIN_BUZZER,    LOW);
  Serial.println("[GPIO] LEDs and Buzzer initialized.");

  // ── Self-test: flash both LEDs + short beep on boot ───────────────────
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED,   HIGH);
  tone(PIN_BUZZER, 1000, 100);   // 1000 Hz, 100ms — passive buzzer friendly
  delay(500);
  noTone(PIN_BUZZER);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);
  Serial.println("[GPIO] Boot self-test complete.");

  // ── I2C + OLED Init ───────────────────────────────────────────────────
  Wire.begin(21, 22);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("[OLED] ERROR: SSD1306 not found at 0x3C! Check wiring.");
    while (true) {
      Serial.println("[OLED] Halted.");
      delay(3000);
    }
  }
  Serial.println("[OLED] SSD1306 128×64 initialized at 0x3C.");

  // ── Splash Screen ─────────────────────────────────────────────────────
  display.clearDisplay();
  display.setTextColor(WHITE);
  display.fillRect(0, 0, SCREEN_WIDTH, 12, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);
  display.setCursor(14, 2);
  display.print("BLE NOTICE BOARD");
  display.setTextColor(WHITE);
  display.setCursor(28, 18);  display.print("PDEU IoT Project");
  display.setCursor(34, 30);  display.print("ESP32 + OLED");
  display.drawFastHLine(0, 43, SCREEN_WIDTH, WHITE);
  display.setCursor(22, 47);  display.print("Initializing...");
  display.setCursor(10, 57);  display.print("SSD1306 128x64 I2C");
  display.display();
  delay(2000);

  // ── Load NVS ──────────────────────────────────────────────────────────
  loadNoticeFromNVS();

  // ── BLE Init ──────────────────────────────────────────────────────────
  BLEDevice::init("ESP32-Smart-Notice-Board");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pService = pServer->createService(SERVICE_UUID);
  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ   |
                      BLECharacteristic::PROPERTY_WRITE  |
                      BLECharacteristic::PROPERTY_NOTIFY |
                      BLECharacteristic::PROPERTY_INDICATE
                    );
  pCharacteristic->setCallbacks(new NoticeCharacteristicCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());
  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising as 'ESP32-Smart-Notice-Board'.");

  // ── Ready Frame ───────────────────────────────────────────────────────
  display.clearDisplay();
  display.fillRect(0, 0, SCREEN_WIDTH, 12, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);
  display.setCursor(22, 2);   display.print("BLE NOTICE BOARD");
  display.setTextColor(WHITE);
  display.setCursor(8, 20);   display.print("BLE Advertising...");
  display.setCursor(2, 34);   display.print("Waiting for Admin");
  display.setCursor(8, 46);   display.print("Web Portal conn.");
  display.display();
  delay(800);
}

// ═══════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════
void loop() {
  // Restart BLE advertising after disconnect
  if (!deviceConnected && oldDeviceConnected) {
    delay(300);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising.");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  renderOLED();
}

/*
 * ═══════════════════════════════════════════════════════════
 *  OPTIONAL: ADDING A 16x2 LCD ALONGSIDE THE OLED
 * ═══════════════════════════════════════════════════════════
 *
 *  Since both SSD1306 OLED (0x3C) and 16x2 LCD I2C backpack (0x27)
 *  use the same 2-wire I2C bus (SDA=GPIO21, SCL=GPIO22), they can
 *  run simultaneously without any hardware conflict — just different
 *  I2C addresses.
 *
 *  WIRING (add these alongside existing OLED connections):
 *    ESP32 VIN (5V)  -->  LCD VCC      ← LCD needs 5V, not 3.3V
 *    ESP32 GND       -->  LCD GND
 *    ESP32 GPIO 21   -->  LCD SDA      ← same wire as OLED SDA
 *    ESP32 GPIO 22   -->  LCD SCL      ← same wire as OLED SCL
 *
 *  LIBRARY: Add to top of sketch
 *    #include <LiquidCrystal_I2C.h>
 *    LiquidCrystal_I2C lcd(0x27, 16, 2);
 *
 *  ROLE DIVISION (suggested):
 *    OLED (128×64) = Primary scrolling notice display (marquee zone)
 *    LCD  (16×2)   = Secondary status panel:
 *                     Line 1: "BLE: CONN  [!URG]"   ← connection + priority
 *                     Line 2: "Academic  ↺ MED"     ← category + scroll speed
 *
 *  INIT (inside setup(), after Wire.begin()):
 *    lcd.init();
 *    lcd.backlight();
 *    lcd.setCursor(0, 0); lcd.print("BLE NOTICE BOARD");
 *    lcd.setCursor(0, 1); lcd.print("Initializing...  ");
 *
 *  UPDATE (call from loop() or when notice changes):
 *    void updateLCD() {
 *      lcd.clear();
 *      // Line 1: BLE status + priority
 *      String l1 = deviceConnected ? "BLE:CONN " : "BLE:ADV  ";
 *      if      (currentNotice.priority == "Urgent")    l1 += "[!URG]";
 *      else if (currentNotice.priority == "Important") l1 += "[IMP] ";
 *      else                                            l1 += "[INFO]";
 *      lcd.setCursor(0, 0); lcd.print(l1.substring(0, 16));
 *      // Line 2: category + speed
 *      String l2 = currentNotice.category + " SPD:" +
 *                  (currentNotice.scrollSpeed <= 15 ? "F" :
 *                   currentNotice.scrollSpeed >= 50 ? "S" : "M");
 *      while (l2.length() < 16) l2 += " ";
 *      lcd.setCursor(0, 1); lcd.print(l2.substring(0, 16));
 *    }
 *
 *  NOTE: Call lcd.init() AFTER Wire.begin(21, 22) — both share the same bus.
 * ═══════════════════════════════════════════════════════════
 */

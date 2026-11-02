/*
 * ===================================================================================
 *  Bluetooth SMART NOTICE BOARD - ESP32 Firmware (SSD1306 OLED 128x64 I2C)
 *  + Green/Red LED Indicators + High-Pitch Passive Buzzer Alert (Every 5s)
 *  + Multi-Line Priority Stack Display (Urgent -> Important -> Normal)
 * ===================================================================================
 *  Hardware:
 *    - ESP32-WROOM-32 / NodeMCU ESP32
 *    - 0.96" SSD1306 OLED 128×64  (I2C 0x3C, SDA=GPIO21, SCL=GPIO22)
 *    - Green LED  (GPIO 25 → 330Ω resistor → LED → GND)  : BLE Connected
 *    - Red   LED  (GPIO 26 → 330Ω resistor → LED → GND)  : Urgent Notice Active
 *    - Passive Buzzer (GPIO 27 → Buzzer+ , Buzzer- → GND) : 2500Hz Double-Beep (5s interval)
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
#define PIN_LED_RED    26   // Red LED    — Urgent notice indicator
#define PIN_BUZZER     27   // Passive buzzer (frequency tone output)

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
//  GLOBAL INSTANCES & STATE
// ═══════════════════════════════════════════════════════════
Preferences        preferences;
BLEServer*         pServer         = NULL;
BLECharacteristic* pCharacteristic = NULL;

bool deviceConnected    = false;
bool oldDeviceConnected = false;
bool urgentActive       = false;  // true if at least one active notice is "Urgent"

// ═══════════════════════════════════════════════════════════
//  MULTI-NOTICE DATA STRUCTURE
// ═══════════════════════════════════════════════════════════
#define MAX_NOTICES 4

struct NoticeItem {
  String        title;
  String        message;
  String        priority;    // "Urgent" | "Important" | "Normal"
  String        category;
  int           scrollSpeed; // ms per pixel shift
  int           scrollX;     // horizontal offset for side scrolling
  int           textPixelWidth;
  unsigned long lastScrollTime;
};

NoticeItem notices[MAX_NOTICES];
int noticeCount = 0;

// Blink timer for urgent alert badges
unsigned long lastBlinkTime = 0;
bool          urgentBlink   = false;

// ═══════════════════════════════════════════════════════════
//  PASSIVE BUZZER ENGINE (Non-blocking, 5s Repeat for Urgent)
// ═══════════════════════════════════════════════════════════
//  Frequency: 2500 Hz (Resonant peak of passive piezo buzzer -> crisp, loud warning)
//  Pattern:   Double Warning Beep (120ms ON, 80ms OFF, 120ms ON) every 5000 ms
// ═══════════════════════════════════════════════════════════
const int           BUZZER_FREQ         = 2500;
const unsigned long BUZZER_INTERVAL_MS  = 5000;
unsigned long       lastBuzzerCycleTime = 0;
int                 buzzerPhase         = 0; // 0=wait, 1=beep1, 2=gap, 3=beep2

void updateBuzzer() {
  if (!urgentActive) {
    if (buzzerPhase != 0) {
      noTone(PIN_BUZZER);
      buzzerPhase = 0;
    }
    return;
  }

  unsigned long now = millis();

  if (buzzerPhase == 0) {
    // Waiting for next 5-second interval
    if (now - lastBuzzerCycleTime >= BUZZER_INTERVAL_MS) {
      lastBuzzerCycleTime = now;
      tone(PIN_BUZZER, BUZZER_FREQ); // Beep 1 START
      buzzerPhase = 1;
    }
  } else if (buzzerPhase == 1) {
    // Beep 1 duration: 120ms
    if (now - lastBuzzerCycleTime >= 120) {
      noTone(PIN_BUZZER);            // Beep 1 END (pause)
      buzzerPhase = 2;
    }
  } else if (buzzerPhase == 2) {
    // Pause between beeps: 80ms (total offset: 120 + 80 = 200ms)
    if (now - lastBuzzerCycleTime >= 200) {
      tone(PIN_BUZZER, BUZZER_FREQ); // Beep 2 START
      buzzerPhase = 3;
    }
  } else if (buzzerPhase == 3) {
    // Beep 2 duration: 120ms (total offset: 200 + 120 = 320ms)
    if (now - lastBuzzerCycleTime >= 320) {
      noTone(PIN_BUZZER);            // Beep 2 END
      buzzerPhase = 0;               // Wait for next 5000ms cycle
    }
  }
}

// -----------------------------------------------------------------------
//  LED helpers
// -----------------------------------------------------------------------
inline void greenLedOn()  { digitalWrite(PIN_LED_GREEN, HIGH); }
inline void greenLedOff() { digitalWrite(PIN_LED_GREEN, LOW);  }
inline void redLedOn()    { digitalWrite(PIN_LED_RED,   HIGH); }
inline void redLedOff()   { digitalWrite(PIN_LED_RED,   LOW);  }

// ═══════════════════════════════════════════════════════════
//  PRIORITY SORTING & STATE MANAGEMENT
// ═══════════════════════════════════════════════════════════
int getPriorityRank(const String& p) {
  if (p == "Urgent")    return 3;
  if (p == "Important") return 2;
  return 1; // "Normal"
}

// Forward declarations
void saveNoticesToNVS();

void sortNotices() {
  // Bubble sort: Highest priority (Urgent) at top (index 0)
  for (int i = 0; i < noticeCount - 1; i++) {
    for (int j = i + 1; j < noticeCount; j++) {
      if (getPriorityRank(notices[j].priority) > getPriorityRank(notices[i].priority)) {
        NoticeItem temp = notices[i];
        notices[i]      = notices[j];
        notices[j]      = temp;
      }
    }
  }

  // Check if any active notice is Urgent
  bool wasUrgent = urgentActive;
  urgentActive = false;
  for (int i = 0; i < noticeCount; i++) {
    if (notices[i].priority == "Urgent") {
      urgentActive = true;
      break;
    }
  }

  if (urgentActive) {
    redLedOn();
    if (!wasUrgent) {
      // Fire buzzer immediately on new urgent notice arrival
      lastBuzzerCycleTime = millis() - BUZZER_INTERVAL_MS;
      buzzerPhase = 0;
      Serial.println("[ALERT] Urgent notice detected! 5s Buzzer loop active.");
    }
  } else {
    redLedOff();
    noTone(PIN_BUZZER);
    buzzerPhase = 0;
    Serial.println("[ALERT] No urgent notices active. Buzzer & Red LED off.");
  }
}

void addOrUpdateNotice(const String& title, const String& content, const String& priority, const String& category, int speed) {
  int foundIdx = -1;
  for (int i = 0; i < noticeCount; i++) {
    if (notices[i].title == title) {
      foundIdx = i;
      break;
    }
  }

  int targetIdx;
  if (foundIdx != -1) {
    targetIdx = foundIdx;
  } else if (noticeCount < MAX_NOTICES) {
    targetIdx = noticeCount;
    noticeCount++;
  } else {
    // Replace the lowest priority (last) notice
    targetIdx = MAX_NOTICES - 1;
  }

  notices[targetIdx].title          = title;
  notices[targetIdx].message        = content;
  notices[targetIdx].priority       = priority;
  notices[targetIdx].category       = category;
  notices[targetIdx].scrollSpeed    = speed;
  notices[targetIdx].scrollX        = 0;
  notices[targetIdx].lastScrollTime = millis();

  String fullText = title + ": " + content;
  notices[targetIdx].textPixelWidth = fullText.length() * 6;

  sortNotices();
  saveNoticesToNVS();
}

void clearAllNotices() {
  noticeCount  = 0;
  urgentActive = false;
  redLedOff();
  noTone(PIN_BUZZER);
  buzzerPhase  = 0;

  preferences.begin("noticeboard", false);
  preferences.clear();
  preferences.end();

  display.clearDisplay();
  display.display();
  Serial.println("[NVS] All notices cleared from board.");
}

// ═══════════════════════════════════════════════════════════
//  NVS (Preferences) Flash Persistence
// ═══════════════════════════════════════════════════════════
void saveNoticesToNVS() {
  preferences.begin("noticeboard", false);
  preferences.putInt("count", noticeCount);

  for (int i = 0; i < noticeCount; i++) {
    String prefix = "n" + String(i) + "_";
    preferences.putString((prefix + "t").c_str(), notices[i].title);
    preferences.putString((prefix + "m").c_str(), notices[i].message);
    preferences.putString((prefix + "p").c_str(), notices[i].priority);
    preferences.putString((prefix + "c").c_str(), notices[i].category);
    preferences.putInt   ((prefix + "s").c_str(), notices[i].scrollSpeed);
  }
  preferences.end();
  Serial.println("[NVS] Saved " + String(noticeCount) + " notices to flash.");
}

void loadNoticesFromNVS() {
  preferences.begin("noticeboard", true);
  noticeCount = preferences.getInt("count", 0);
  if (noticeCount > MAX_NOTICES) noticeCount = MAX_NOTICES;

  for (int i = 0; i < noticeCount; i++) {
    String prefix = "n" + String(i) + "_";
    notices[i].title          = preferences.getString((prefix + "t").c_str(), "Notice");
    notices[i].message        = preferences.getString((prefix + "m").c_str(), "Welcome");
    notices[i].priority       = preferences.getString((prefix + "p").c_str(), "Normal");
    notices[i].category       = preferences.getString((prefix + "c").c_str(), "General");
    notices[i].scrollSpeed    = preferences.getInt   ((prefix + "s").c_str(), 30);
    notices[i].scrollX        = 0;
    notices[i].lastScrollTime = millis();
    String fullText           = notices[i].title + ": " + notices[i].message;
    notices[i].textPixelWidth = fullText.length() * 6;
  }
  preferences.end();

  if (noticeCount == 0) {
    // Default boot notice
    notices[0].title          = "SMART NOTICE BD";
    notices[0].message        = "Awaiting BLE notices from Admin Web Portal...";
    notices[0].priority       = "Normal";
    notices[0].category       = "System";
    notices[0].scrollSpeed    = 30;
    notices[0].scrollX        = 0;
    notices[0].lastScrollTime = millis();
    notices[0].textPixelWidth = (notices[0].title + ": " + notices[0].message).length() * 6;
    noticeCount = 1;
  }

  sortNotices();
}

// ═══════════════════════════════════════════════════════════
//  BLE SERVER CALLBACKS
// ═══════════════════════════════════════════════════════════
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    greenLedOn();
    Serial.println("[BLE] Admin connected — Green LED ON.");
  }
  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    greenLedOff();
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

    DynamicJsonDocument doc(2048);
    DeserializationError err = deserializeJson(doc, rxValue);

    if (!err) {
      // ── CLEAR command ────────────────────────────────────
      if (doc["action"] == "clear") {
        clearAllNotices();
        pChar->setValue("ACK:CLEARED");
        pChar->notify();
        Serial.println("[BLE] ACK:CLEARED sent.");
        return;
      }

      // ── BATCH SYNC of multiple notices ────────────────────
      if (doc.containsKey("notices") && doc["notices"].is<JsonArray>()) {
        noticeCount = 0;
        JsonArray arr = doc["notices"].as<JsonArray>();
        for (JsonObject n : arr) {
          if (noticeCount >= MAX_NOTICES) break;
          String t   = n["title"]       | n["t"] | "Notice";
          String c   = n["content"]     | n["c"] | "";
          String p   = n["priority"]    | n["p"] | "Normal";
          String cat = n["category"]    | "General";
          int    spd = 30;
          String spdStr = n["scrollSpeed"] | "Medium";
          if      (spdStr == "Fast") spd = 18;
          else if (spdStr == "Slow") spd = 45;

          notices[noticeCount].title          = t;
          notices[noticeCount].message        = c;
          notices[noticeCount].priority       = p;
          notices[noticeCount].category       = cat;
          notices[noticeCount].scrollSpeed    = spd;
          notices[noticeCount].scrollX        = 0;
          notices[noticeCount].lastScrollTime = millis();
          String fullText = t + ": " + c;
          notices[noticeCount].textPixelWidth = fullText.length() * 6;
          noticeCount++;
        }
        sortNotices();
        saveNoticesToNVS();
        pChar->setValue("ACK:SYNC_COMPLETE");
        pChar->notify();
        Serial.println("[BLE] ACK:SYNC_COMPLETE sent. Loaded " + String(noticeCount) + " notices.");
        return;
      }

      // ── SINGLE NOTICE add / update ───────────────────────
      String title    = doc["title"].as<String>();
      String content  = doc["content"].as<String>();
      String priority = doc["priority"] | "Normal";
      String category = doc["category"] | "General";
      int    spd      = 30;
      String spdStr   = doc["scrollSpeed"] | "Medium";
      if      (spdStr == "Fast") spd = 18;
      else if (spdStr == "Slow") spd = 45;

      addOrUpdateNotice(title, content, priority, category, spd);
      pChar->setValue("ACK:NOTICE_UPDATED");
      pChar->notify();
      Serial.println("[BLE] ACK:NOTICE_UPDATED sent. Added/Updated: " + title);

    } else {
      // Fallback: raw text string
      addOrUpdateNotice("NOTICE", rxValue, "Normal", "General", 30);
      pChar->setValue("ACK:RAW_TEXT");
      pChar->notify();
    }
  }
};

// ═══════════════════════════════════════════════════════════
//  OLED RENDERING — MULTI-LINE PRIORITY STACK (128x64)
// ═══════════════════════════════════════════════════════════
void drawHRule(int y) {
  display.drawFastHLine(0, y, SCREEN_WIDTH, WHITE);
}

void renderOLED() {
  display.clearDisplay();
  display.setTextWrap(false); // CRITICAL: prevents scrolling text from wrapping down

  // ── Zone 0: Inverted Header Bar (Y: 0..9) ─────────────────
  display.fillRect(0, 0, SCREEN_WIDTH, 10, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);

  // Urgent header blink (every 500ms)
  unsigned long now = millis();
  if (now - lastBlinkTime >= 500) {
    lastBlinkTime = now;
    urgentBlink   = !urgentBlink;
  }

  if (urgentActive) {
    display.setCursor(2, 1);
    display.print(urgentBlink ? "[!URGENT ALERT!]" : "[! URGENT !]");
  } else {
    display.setCursor(2, 1);
    display.print("SMART NOTICE BD");
  }

  // Right status: BLE + Notice count
  String statusRight = (deviceConnected ? "BLE:ON" : "BLE:ADV") + String(" [") + String(noticeCount) + String("]");
  int rightX = SCREEN_WIDTH - (statusRight.length() * 6) - 1;
  display.setCursor(rightX, 1);
  display.print(statusRight);

  display.setTextColor(WHITE);

  // Divider under header
  drawHRule(10);

  // ── Zone 1: Multi-Line Notice Stack (Y: 12..63) ───────────
  if (noticeCount == 0) {
    display.setCursor(12, 26);
    display.print("No Active Notices");
    display.setCursor(6, 42);
    display.print("Ready for BLE Sync...");
  } else {
    // Up to 4 rows stacked vertically by priority
    int maxRows = (noticeCount < MAX_NOTICES) ? noticeCount : MAX_NOTICES;

    for (int i = 0; i < maxRows; i++) {
      int rowY = 12 + (i * 13); // Rows at Y = 12, 25, 38, 51

      String fullText = notices[i].title + ": " + notices[i].message;
      int fullTextPx  = notices[i].textPixelWidth;
      const int textStartX  = 18;
      const int visibleArea = SCREEN_WIDTH - textStartX; // 110 px (~18 chars)

      // ── Side Scrolling Animation ─────────────────────────
      if (fullTextPx <= visibleArea) {
        // Fits statically without scrolling
        display.setCursor(textStartX, rowY);
        display.print(fullText);
      } else {
        // Text is longer than 110px: scroll horizontally
        if (now - notices[i].lastScrollTime >= (unsigned long)notices[i].scrollSpeed) {
          notices[i].lastScrollTime = now;
          notices[i].scrollX--;
          // Wrap around after full text + spacer scrolls past
          if (notices[i].scrollX < -(fullTextPx + 24)) {
            notices[i].scrollX = 0;
          }
        }
        display.setCursor(textStartX + notices[i].scrollX, rowY);
        display.print(fullText + "    ***    " + fullText);
      }

      // ── Left Badge Masking & Drawing ──────────────────────
      // Mask X: 0..17 with BLACK so scrolled characters don't bleed behind badge
      display.fillRect(0, rowY - 1, textStartX, 11, BLACK);

      // Draw Priority Badge on the left
      if (notices[i].priority == "Urgent") {
        if (!urgentBlink) {
          display.fillRect(0, rowY - 1, 15, 9, WHITE);
          display.setTextColor(BLACK);
          display.setCursor(5, rowY);
          display.print("!");
          display.setTextColor(WHITE);
        } else {
          display.drawRect(0, rowY - 1, 15, 9, WHITE);
          display.setCursor(5, rowY);
          display.print("!");
        }
      } else if (notices[i].priority == "Important") {
        display.drawRect(0, rowY - 1, 15, 9, WHITE);
        display.setCursor(5, rowY);
        display.print("*");
      } else {
        display.setCursor(5, rowY);
        display.print("-");
      }

      // Divider line between notices
      if (i < maxRows - 1) {
        display.drawFastHLine(0, rowY + 11, SCREEN_WIDTH, WHITE);
      }
    }
  }

  display.display();
}

// ═══════════════════════════════════════════════════════════
//  SETUP
// ═══════════════════════════════════════════════════════════
void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println("\n=== BLE SMART NOTICE BOARD (OLED Priority Stack + Passive Buzzer) ===");

  // ── GPIO Init ─────────────────────────────────────────────
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED,   OUTPUT);
  pinMode(PIN_BUZZER,    OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);
  noTone(PIN_BUZZER);
  Serial.println("[GPIO] LEDs and Passive Buzzer initialized.");

  // ── Hardware Self-test: High-pitch chirp + LED flash ──────
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED,   HIGH);
  tone(PIN_BUZZER, BUZZER_FREQ, 100); // 2500Hz chirp
  delay(160);
  noTone(PIN_BUZZER);
  delay(60);
  tone(PIN_BUZZER, BUZZER_FREQ, 100); // Second chirp
  delay(160);
  noTone(PIN_BUZZER);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);
  Serial.println("[GPIO] Boot chirp test complete.");

  // ── I2C + OLED Init ───────────────────────────────────────
  Wire.begin(21, 22);

  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("[OLED] ERROR: SSD1306 not found at 0x3C! Check SDA/SCL wiring.");
    while (true) {
      delay(3000);
    }
  }
  display.setTextWrap(false);
  Serial.println("[OLED] SSD1306 128×64 initialized at 0x3C.");

  // ── Splash Screen ─────────────────────────────────────────
  display.clearDisplay();
  display.fillRect(0, 0, SCREEN_WIDTH, 12, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);
  display.setCursor(14, 2);
  display.print("BLE NOTICE BOARD");
  display.setTextColor(WHITE);
  display.setCursor(20, 18); display.print("Priority Stack UI");
  display.setCursor(12, 30); display.print("Urgent Beep: 5s Int");
  drawHRule(43);
  display.setCursor(22, 47); display.print("Initializing...");
  display.setCursor(10, 56); display.print("SSD1306 128x64 I2C");
  display.display();
  delay(1600);

  // ── Load Persisted Notices from Flash NVS ─────────────────
  loadNoticesFromNVS();

  // ── BLE Init ──────────────────────────────────────────────
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
  Serial.println("[BLE] Advertising started as 'ESP32-Smart-Notice-Board'.");
}

// ═══════════════════════════════════════════════════════════
//  MAIN LOOP
// ═══════════════════════════════════════════════════════════
void loop() {
  // Restart BLE advertising if disconnected
  if (!deviceConnected && oldDeviceConnected) {
    delay(200);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising.");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // Non-blocking Urgent Warning Buzzer (Double Beep every 5 seconds)
  updateBuzzer();

  // Full OLED Render with per-line side-scrolling
  renderOLED();
}

/*
 * ═══════════════════════════════════════════════════════════
 *  OPTIONAL: ADDING A 16x2 LCD ALONGSIDE THE OLED
 * ═══════════════════════════════════════════════════════════
 *  Both SSD1306 OLED (0x3C) and 16x2 LCD I2C backpack (0x27)
 *  share SDA (GPIO 21) & SCL (GPIO 22) without bus conflicts.
 * ═══════════════════════════════════════════════════════════
 */

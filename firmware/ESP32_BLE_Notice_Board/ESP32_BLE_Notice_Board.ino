/*
 * ===================================================================================
 *  Bluetooth SMART NOTICE BOARD - ESP32 Firmware v3
 *  SSD1306 OLED 128x64 | Multi-Line Priority Stack | Active Buzzer (Low-Level Trigger)
 *  Green/Red LEDs | Delete-aware BLE sync | NVS Persistence on disconnect
 * ===================================================================================
 *  Hardware:
 *    - ESP32-WROOM-32 / NodeMCU ESP32
 *    - 0.96" SSD1306 OLED 128×64  (I2C 0x3C, SDA=GPIO21, SCL=GPIO22)
 *    - Green LED  (GPIO 25 → 330Ω → LED → GND)  : BLE Connected
 *    - Red   LED  (GPIO 26 → 330Ω → LED → GND)  : Urgent Notice Active
 *    - Active Buzzer Module  (GPIO 27 → Signal, GND → GND, VCC → 5V or 3.3V)
 *      *** LOW-LEVEL TRIGGER MODULE: LOW = BEEP ON, HIGH = SILENT ***
 *      *** DO NOT USE tone() — just digitalWrite(LOW) / digitalWrite(HIGH) ***
 *
 *  Buzzer Behaviour:
 *    - Urgent notice active  → Double beep (120ms ON, 80ms OFF, 120ms ON) every 5 sec
 *    - Notice deleted or cleared via BLE → Buzzer silenced immediately
 *    - BLE disconnected → Board keeps showing persisted notices (from NVS flash)
 *    - Board re-synced when BLE reconnects (portal sends updated list)
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
#define PIN_LED_GREEN  25
#define PIN_LED_RED    26
#define PIN_BUZZER     27   // LOW-LEVEL TRIGGER active buzzer module

// LOW = buzzer ON (beeping),  HIGH = buzzer OFF (silent)
#define BUZZER_ON()   digitalWrite(PIN_BUZZER, LOW)
#define BUZZER_OFF()  digitalWrite(PIN_BUZZER, HIGH)

// ═══════════════════════════════════════════════════════════
//  OLED CONFIGURATION
// ═══════════════════════════════════════════════════════════
#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT  64
#define OLED_RESET     -1
#define OLED_ADDRESS   0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ═══════════════════════════════════════════════════════════
//  BLE UUIDS
// ═══════════════════════════════════════════════════════════
#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

// ═══════════════════════════════════════════════════════════
//  GLOBAL STATE
// ═══════════════════════════════════════════════════════════
Preferences        preferences;
BLEServer*         pServer         = NULL;
BLECharacteristic* pCharacteristic = NULL;

bool deviceConnected    = false;
bool oldDeviceConnected = false;
bool urgentActive       = false;

// ═══════════════════════════════════════════════════════════
//  MULTI-NOTICE DATA (up to 4 on-screen)
// ═══════════════════════════════════════════════════════════
#define MAX_NOTICES 4

struct NoticeItem {
  String        title;
  String        message;
  String        priority;    // "Urgent" | "Important" | "Normal"
  String        category;
  int           scrollSpeed; // ms per pixel shift (lower = faster)
  int           scrollX;
  int           textPixelWidth;
  unsigned long lastScrollTime;
};

NoticeItem notices[MAX_NOTICES];
int noticeCount = 0;

unsigned long lastBlinkTime = 0;
bool          urgentBlink   = false;

// ═══════════════════════════════════════════════════════════
//  ACTIVE BUZZER ENGINE — Low-level trigger, non-blocking
//  Pattern: 120ms ON → 80ms OFF → 120ms ON, every 5 sec while urgent
// ═══════════════════════════════════════════════════════════
const unsigned long BUZZER_INTERVAL_MS = 5000;
unsigned long       lastBuzzerCycle    = 0;
int                 buzzerPhase        = 0;
// Phase: 0 = wait for next cycle
//        1 = beep-1 ON  (start: 0ms)
//        2 = gap SILENT (start: 120ms)
//        3 = beep-2 ON  (start: 200ms)
//        4 = done SILENT (start: 320ms) → back to 0 next cycle

void buzzerOff() {
  BUZZER_OFF();
  buzzerPhase = 0;
}

void updateBuzzer() {
  if (!urgentActive) {
    if (buzzerPhase != 0) {
      BUZZER_OFF();
      buzzerPhase = 0;
    }
    return;
  }

  unsigned long now     = millis();
  unsigned long elapsed = now - lastBuzzerCycle;

  switch (buzzerPhase) {
    case 0:
      // Idle — wait for 5-sec interval
      if (elapsed >= BUZZER_INTERVAL_MS) {
        lastBuzzerCycle = now;
        BUZZER_ON();      // Beep 1 starts
        buzzerPhase = 1;
      }
      break;

    case 1:
      // Beep-1 ON for 120 ms
      if (now - lastBuzzerCycle >= 120) {
        BUZZER_OFF();     // Beep 1 ends → gap
        buzzerPhase = 2;
      }
      break;

    case 2:
      // Gap for 80 ms (total 200 ms since cycle start)
      if (now - lastBuzzerCycle >= 200) {
        BUZZER_ON();      // Beep 2 starts
        buzzerPhase = 3;
      }
      break;

    case 3:
      // Beep-2 ON for 120 ms (total 320 ms since cycle start)
      if (now - lastBuzzerCycle >= 320) {
        BUZZER_OFF();     // Beep 2 ends
        buzzerPhase = 4;
      }
      break;

    case 4:
      // Silence remainder of 5-sec window → reset
      if (now - lastBuzzerCycle >= BUZZER_INTERVAL_MS) {
        lastBuzzerCycle = now;
        BUZZER_ON();      // Immediately start next beep-1
        buzzerPhase = 1;
      }
      break;
  }
}

// ═══════════════════════════════════════════════════════════
//  LED HELPERS
// ═══════════════════════════════════════════════════════════
inline void greenLedOn()  { digitalWrite(PIN_LED_GREEN, HIGH); }
inline void greenLedOff() { digitalWrite(PIN_LED_GREEN, LOW);  }
inline void redLedOn()    { digitalWrite(PIN_LED_RED,   HIGH); }
inline void redLedOff()   { digitalWrite(PIN_LED_RED,   LOW);  }

// ═══════════════════════════════════════════════════════════
//  PRIORITY HELPERS
// ═══════════════════════════════════════════════════════════
int getPriorityRank(const String& p) {
  if (p == "Urgent")    return 3;
  if (p == "Important") return 2;
  return 1;
}

// Forward declaration
void saveNoticesToNVS();

// Re-evaluate urgentActive and update LED + buzzer accordingly
void refreshUrgentState() {
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
      // Kick off buzzer immediately (don't wait 5 s)
      lastBuzzerCycle = millis() - BUZZER_INTERVAL_MS;
      buzzerPhase     = 0;
      Serial.println("[ALERT] Urgent notice detected — buzzer loop started.");
    }
  } else {
    redLedOff();
    BUZZER_OFF();
    buzzerPhase = 0;
    Serial.println("[ALERT] No urgent notices — buzzer and Red LED off.");
  }
}

void sortNotices() {
  for (int i = 0; i < noticeCount - 1; i++) {
    for (int j = i + 1; j < noticeCount; j++) {
      if (getPriorityRank(notices[j].priority) > getPriorityRank(notices[i].priority)) {
        NoticeItem tmp = notices[i];
        notices[i]     = notices[j];
        notices[j]     = tmp;
      }
    }
  }
  refreshUrgentState();
}

// ═══════════════════════════════════════════════════════════
//  NOTICE CRUD
// ═══════════════════════════════════════════════════════════
void addOrUpdateNotice(const String& title, const String& content,
                       const String& priority, const String& category, int speed) {
  int idx = -1;
  for (int i = 0; i < noticeCount; i++) {
    if (notices[i].title == title) { idx = i; break; }
  }

  if      (idx != -1)             { /* update in-place */ }
  else if (noticeCount < MAX_NOTICES) { idx = noticeCount++; }
  else                            { idx = MAX_NOTICES - 1; }   // replace lowest

  notices[idx].title          = title;
  notices[idx].message        = content;
  notices[idx].priority       = priority;
  notices[idx].category       = category;
  notices[idx].scrollSpeed    = speed;
  notices[idx].scrollX        = 0;
  notices[idx].lastScrollTime = millis();
  notices[idx].textPixelWidth = (title + ": " + content).length() * 6;

  sortNotices();
  saveNoticesToNVS();
}

// Remove a single notice by title (used when portal deletes one)
bool removeNoticeByTitle(const String& title) {
  for (int i = 0; i < noticeCount; i++) {
    if (notices[i].title == title) {
      // Shift remaining entries left
      for (int j = i; j < noticeCount - 1; j++) {
        notices[j] = notices[j + 1];
      }
      noticeCount--;
      sortNotices();
      saveNoticesToNVS();
      Serial.println("[NOTICE] Removed: " + title);
      return true;
    }
  }
  return false;
}

// Replace board contents with an exact list from portal (delete-aware full sync)
// If the incoming list is empty, clears all notices from OLED + NVS.
// Persists to NVS so notices survive a disconnect.
void replaceAllNotices(JsonArray& arr) {
  noticeCount = 0;

  for (JsonObject n : arr) {
    if (noticeCount >= MAX_NOTICES) break;

    String t   = n["title"]    | "Notice";
    String c   = n["content"]  | "";
    String p   = n["priority"] | "Normal";
    String cat = n["category"] | "General";
    int    spd = 30;
    const char* spdStr = n["scrollSpeed"] | "Medium";
    if      (strcmp(spdStr, "Fast") == 0) spd = 18;
    else if (strcmp(spdStr, "Slow") == 0) spd = 45;

    notices[noticeCount].title          = t;
    notices[noticeCount].message        = c;
    notices[noticeCount].priority       = p;
    notices[noticeCount].category       = cat;
    notices[noticeCount].scrollSpeed    = spd;
    notices[noticeCount].scrollX        = 0;
    notices[noticeCount].lastScrollTime = millis();
    notices[noticeCount].textPixelWidth = (t + ": " + c).length() * 6;
    noticeCount++;
  }

  sortNotices();       // also calls refreshUrgentState()
  saveNoticesToNVS();  // persist so disconnect doesn't lose them
  Serial.println("[BLE] replaceAllNotices: board now has " + String(noticeCount) + " notice(s).");
}

void clearAllNotices() {
  noticeCount = 0;
  BUZZER_OFF();
  buzzerPhase  = 0;
  urgentActive = false;
  redLedOff();

  preferences.begin("noticeboard", false);
  preferences.clear();
  preferences.end();

  display.clearDisplay();
  display.display();
  Serial.println("[NVS] All notices cleared.");
}

// ═══════════════════════════════════════════════════════════
//  NVS PERSISTENCE — notices survive power-cycle AND disconnect
// ═══════════════════════════════════════════════════════════
void saveNoticesToNVS() {
  preferences.begin("noticeboard", false);
  preferences.putInt("count", noticeCount);
  for (int i = 0; i < noticeCount; i++) {
    String pfx = "n" + String(i) + "_";
    preferences.putString((pfx + "t").c_str(), notices[i].title);
    preferences.putString((pfx + "m").c_str(), notices[i].message);
    preferences.putString((pfx + "p").c_str(), notices[i].priority);
    preferences.putString((pfx + "c").c_str(), notices[i].category);
    preferences.putInt   ((pfx + "s").c_str(), notices[i].scrollSpeed);
  }
  preferences.end();
  Serial.println("[NVS] Saved " + String(noticeCount) + " notice(s) to flash.");
}

void loadNoticesFromNVS() {
  preferences.begin("noticeboard", true);
  noticeCount = preferences.getInt("count", 0);
  if (noticeCount > MAX_NOTICES) noticeCount = MAX_NOTICES;

  for (int i = 0; i < noticeCount; i++) {
    String pfx = "n" + String(i) + "_";
    notices[i].title          = preferences.getString((pfx + "t").c_str(), "Notice");
    notices[i].message        = preferences.getString((pfx + "m").c_str(), "Welcome");
    notices[i].priority       = preferences.getString((pfx + "p").c_str(), "Normal");
    notices[i].category       = preferences.getString((pfx + "c").c_str(), "General");
    notices[i].scrollSpeed    = preferences.getInt   ((pfx + "s").c_str(), 30);
    notices[i].scrollX        = 0;
    notices[i].lastScrollTime = millis();
    notices[i].textPixelWidth = (notices[i].title + ": " + notices[i].message).length() * 6;
  }
  preferences.end();

  if (noticeCount == 0) {
    // Show default boot message when no persisted notices exist
    notices[0].title          = "SMART NOTICE BD";
    notices[0].message        = "Awaiting BLE from Admin Portal...";
    notices[0].priority       = "Normal";
    notices[0].category       = "System";
    notices[0].scrollSpeed    = 30;
    notices[0].scrollX        = 0;
    notices[0].lastScrollTime = millis();
    notices[0].textPixelWidth = (notices[0].title + ": " + notices[0].message).length() * 6;
    noticeCount = 1;
  }

  sortNotices();
  Serial.println("[NVS] Loaded " + String(noticeCount) + " notice(s) from flash.");
}

// ═══════════════════════════════════════════════════════════
//  BLE SERVER CALLBACKS
// ═══════════════════════════════════════════════════════════
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pSrv) override {
    deviceConnected = true;
    greenLedOn();
    Serial.println("[BLE] Admin connected — Green LED ON.");
    // NOTE: Board continues showing whatever notices are in RAM (loaded from NVS).
    // The portal should send a full sync payload immediately after connecting.
  }
  void onDisconnect(BLEServer* pSrv) override {
    deviceConnected = false;
    greenLedOff();
    // *** Do NOT clear notices on disconnect — keep displaying persisted notices ***
    Serial.println("[BLE] Admin disconnected — Green LED OFF. Notices remain on screen.");
  }
};

// ═══════════════════════════════════════════════════════════
//  BLE CHARACTERISTIC WRITE CALLBACK
// ═══════════════════════════════════════════════════════════
class NoticeCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String rxValue = pChar->getValue().c_str();
    if (rxValue.length() == 0) return;

    Serial.println("[BLE RX] " + rxValue.substring(0, min((int)rxValue.length(), 80)));

    DynamicJsonDocument doc(4096);
    DeserializationError err = deserializeJson(doc, rxValue);
    if (err) {
      // Fallback: plain text → add as Normal notice
      addOrUpdateNotice("NOTICE", rxValue, "Normal", "General", 30);
      pChar->setValue("ACK:RAW_TEXT");
      pChar->notify();
      return;
    }

    const char* action = doc["action"] | "";

    // ── CLEAR ALL ─────────────────────────────────────────
    if (strcmp(action, "clear") == 0) {
      clearAllNotices();
      pChar->setValue("ACK:CLEARED");
      pChar->notify();
      Serial.println("[BLE] ACK:CLEARED");
      return;
    }

    // ── DELETE ONE by title ───────────────────────────────
    // Portal sends: {"action":"delete","title":"Notice Title"}
    if (strcmp(action, "delete") == 0) {
      String delTitle = doc["title"] | "";
      if (delTitle.length() > 0) {
        bool removed = removeNoticeByTitle(delTitle);
        pChar->setValue(removed ? "ACK:DELETED" : "ACK:NOT_FOUND");
      } else {
        pChar->setValue("ACK:ERR_NO_TITLE");
      }
      pChar->notify();
      Serial.println("[BLE] ACK:DELETED");
      return;
    }

    // ── FULL REPLACE SYNC (delete-aware) ─────────────────
    // Portal sends the ENTIRE current active notice list.
    // The board replaces its contents exactly — deleted notices disappear,
    // new/updated ones appear. Persisted to NVS for disconnect survival.
    // Payload: {"action":"sync","notices":[{...}, ...]}
    if (strcmp(action, "sync") == 0 && doc.containsKey("notices")) {
      JsonArray arr = doc["notices"].as<JsonArray>();
      replaceAllNotices(arr);
      pChar->setValue("ACK:SYNC_OK");
      pChar->notify();
      Serial.println("[BLE] ACK:SYNC_OK — board synced with portal.");
      return;
    }

    // ── SINGLE ADD / UPDATE ───────────────────────────────
    String title    = doc["title"]    | "Notice";
    String content  = doc["content"]  | "";
    String priority = doc["priority"] | "Normal";
    String category = doc["category"] | "General";
    int    spd      = 30;
    const char* spdStr = doc["scrollSpeed"] | "Medium";
    if      (strcmp(spdStr, "Fast") == 0) spd = 18;
    else if (strcmp(spdStr, "Slow") == 0) spd = 45;

    addOrUpdateNotice(title, content, priority, category, spd);
    pChar->setValue("ACK:NOTICE_UPDATED");
    pChar->notify();
    Serial.println("[BLE] ACK:NOTICE_UPDATED: " + title);
  }
};

// ═══════════════════════════════════════════════════════════
//  OLED RENDERING — 128×64 Priority Stack, per-row marquee
// ═══════════════════════════════════════════════════════════
void drawHRule(int y) { display.drawFastHLine(0, y, SCREEN_WIDTH, WHITE); }

void renderOLED() {
  display.clearDisplay();
  display.setTextWrap(false);

  unsigned long now = millis();

  // Blink toggle every 500 ms (for urgent header + badge)
  if (now - lastBlinkTime >= 500) {
    lastBlinkTime = now;
    urgentBlink   = !urgentBlink;
  }

  // ── Zone 0: Inverted Header Bar (Y 0–9) ───────────────────
  display.fillRect(0, 0, SCREEN_WIDTH, 10, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);

  if (urgentActive) {
    display.setCursor(2, 1);
    display.print(urgentBlink ? "[! URGENT ALERT]" : "[!! URGENT !!]");
  } else {
    display.setCursor(2, 1);
    display.print("SMART NOTICE BD");
  }

  // Right: BLE status + notice count (shrunk to fit)
  String ble = deviceConnected ? "ON" : "ADV";
  String hdr = "BLE:" + ble + " [" + String(noticeCount) + "]";
  int hdrX   = SCREEN_WIDTH - (int)(hdr.length()) * 6 - 1;
  if (hdrX > 90) {          // only print if it fits without overlap
    display.setCursor(hdrX, 1);
    display.print(hdr);
  }

  display.setTextColor(WHITE);
  drawHRule(10);

  // ── Zone 1: Multi-Line Stack (Y 12–63) ────────────────────
  if (noticeCount == 0) {
    display.setCursor(4, 24);  display.print("No Active Notices");
    display.setCursor(4, 40);  display.print("Waiting for Admin...");
  } else {
    int rows   = min(noticeCount, MAX_NOTICES);
    int rowH   = (SCREEN_HEIGHT - 12) / rows;   // adaptive row height
    int badgeW = 14;
    int textX  = badgeW + 2;
    int textW  = SCREEN_WIDTH - textX;

    for (int i = 0; i < rows; i++) {
      int rowY = 12 + i * rowH + (rowH - 8) / 2;   // vertically centred within row

      String fullText = notices[i].title + ": " + notices[i].message;
      int    fPx      = notices[i].textPixelWidth;

      // Side scrolling
      if (fPx <= textW) {
        display.setCursor(textX, rowY);
        display.print(fullText);
      } else {
        if (now - notices[i].lastScrollTime >= (unsigned long)notices[i].scrollSpeed) {
          notices[i].lastScrollTime = now;
          notices[i].scrollX--;
          if (notices[i].scrollX < -(fPx + 20)) notices[i].scrollX = 0;
        }
        display.setCursor(textX + notices[i].scrollX, rowY);
        display.print(fullText + "  *  " + fullText);
      }

      // Mask badge area so scrolling text doesn't bleed behind it
      display.fillRect(0, rowY - 2, badgeW, rowH - 1, BLACK);

      // Draw badge
      if (notices[i].priority == "Urgent") {
        if (urgentBlink) {
          display.fillRect(0, rowY - 2, badgeW - 1, 10, WHITE);
          display.setTextColor(BLACK);
        }
        display.setCursor(4, rowY);
        display.print("!");
        display.setTextColor(WHITE);
      } else if (notices[i].priority == "Important") {
        display.drawRect(0, rowY - 2, badgeW - 1, 10, WHITE);
        display.setCursor(4, rowY);
        display.print("*");
      } else {
        display.setCursor(4, rowY);
        display.print("-");
      }

      // Row divider (except after last row)
      if (i < rows - 1) {
        drawHRule(12 + (i + 1) * rowH - 1);
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
  delay(300);
  Serial.println("\n=== BLE Smart Notice Board v3 ===");

  // GPIO init
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED,   OUTPUT);
  pinMode(PIN_BUZZER,    OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);
  BUZZER_OFF();   // module is LOW-trigger → HIGH = silent
  Serial.println("[GPIO] Pins initialized. Buzzer = HIGH (silent).");

  // Boot self-test — two short beeps + LED flash
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED,   HIGH);
  BUZZER_ON();  delay(120);  BUZZER_OFF();
  delay(80);
  BUZZER_ON();  delay(120);  BUZZER_OFF();
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);
  Serial.println("[GPIO] Boot self-test complete (2 beeps).");

  // I2C + OLED
  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("[OLED] ERROR: SSD1306 not found at 0x3C!");
    while (true) delay(3000);
  }
  display.setTextWrap(false);
  Serial.println("[OLED] SSD1306 128×64 ready.");

  // Splash
  display.clearDisplay();
  display.fillRect(0, 0, SCREEN_WIDTH, 12, WHITE);
  display.setTextColor(BLACK); display.setTextSize(1);
  display.setCursor(14, 2);    display.print("BLE NOTICE BOARD");
  display.setTextColor(WHITE);
  display.setCursor(10, 18);   display.print("Priority Stack v3");
  display.setCursor(4,  30);   display.print("Buzzer: Low-Trig Module");
  drawHRule(43);
  display.setCursor(22, 47);   display.print("Initializing...");
  display.display();
  delay(1500);

  // Load persisted notices (survives disconnect / power cycle)
  loadNoticesFromNVS();

  // BLE init
  BLEDevice::init("ESP32-Smart-Notice-Board");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pSvc = pServer->createService(SERVICE_UUID);
  pCharacteristic  = pSvc->createCharacteristic(
    CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ   |
    BLECharacteristic::PROPERTY_WRITE  |
    BLECharacteristic::PROPERTY_NOTIFY |
    BLECharacteristic::PROPERTY_INDICATE
  );
  pCharacteristic->setCallbacks(new NoticeCharacteristicCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());
  pSvc->start();

  BLEAdvertising* pAdv = BLEDevice::getAdvertising();
  pAdv->addServiceUUID(SERVICE_UUID);
  pAdv->setScanResponse(true);
  pAdv->setMinPreferred(0x06);
  pAdv->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising as 'ESP32-Smart-Notice-Board'.");
}

// ═══════════════════════════════════════════════════════════
//  LOOP
// ═══════════════════════════════════════════════════════════
void loop() {
  // BLE reconnect advertising
  if (!deviceConnected && oldDeviceConnected) {
    delay(150);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising after disconnect.");
    oldDeviceConnected = false;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = true;
  }

  // Non-blocking low-level-trigger buzzer
  updateBuzzer();

  // Render multi-line priority stack
  renderOLED();
}

/*
 * ═══════════════════════════════════════════════════════════
 *  BLE MESSAGE PROTOCOL (JSON over GATT write)
 * ═══════════════════════════════════════════════════════════
 *  1. CLEAR ALL:
 *       {"action":"clear"}
 *       → ACK:CLEARED
 *
 *  2. DELETE ONE (by title):
 *       {"action":"delete","title":"Exam Notice"}
 *       → ACK:DELETED | ACK:NOT_FOUND
 *
 *  3. FULL SYNC (send entire active list → board replaces):
 *       {"action":"sync","notices":[
 *         {"title":"T","content":"C","priority":"Urgent","category":"Academic","scrollSpeed":"Fast"},
 *         ...
 *       ]}
 *       → ACK:SYNC_OK
 *
 *  4. SINGLE ADD/UPDATE:
 *       {"title":"T","content":"C","priority":"Normal","category":"General","scrollSpeed":"Medium"}
 *       → ACK:NOTICE_UPDATED
 * ═══════════════════════════════════════════════════════════
 */

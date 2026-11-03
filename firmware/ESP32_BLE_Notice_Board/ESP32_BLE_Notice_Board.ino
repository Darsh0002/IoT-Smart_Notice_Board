#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <Preferences.h>
#include <ArduinoJson.h>

#define PIN_LED_GREEN  25
#define PIN_LED_RED    26
#define PIN_BUZZER     27  

#define SCREEN_WIDTH   128
#define SCREEN_HEIGHT  64
#define OLED_RESET     -1
#define OLED_ADDRESS   0x3C

#define HEADER_H       12
#define SEP_Y          12
#define NOTICE_AREA_Y  14
#define NOTICE_AREA_H  (SCREEN_HEIGHT - NOTICE_AREA_Y)

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);


#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"


Preferences        preferences;
BLEServer*         pServer         = NULL;
BLECharacteristic* pCharacteristic = NULL;

bool deviceConnected    = false;
bool oldDeviceConnected = false;
bool urgentActive       = false;


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

const int           BUZZER_FREQ        = 2700;
const unsigned long BUZZER_INTERVAL_MS = 5000;
unsigned long       lastBuzzerCycle    = 0;
int                 buzzerPhase        = 0;

void buzzerStop() {
  ledcWriteTone(PIN_BUZZER, 0);
  buzzerPhase = 0;
}

void updateBuzzer() {
  if (!urgentActive) {
    if (buzzerPhase != 0) buzzerStop();
    return;
  }

  unsigned long now = millis();

  switch (buzzerPhase) {
    case 0:
      if (now - lastBuzzerCycle >= BUZZER_INTERVAL_MS) {
        lastBuzzerCycle = now;
        ledcWriteTone(PIN_BUZZER, BUZZER_FREQ);
        buzzerPhase = 1;
      }
      break;
    case 1:
      if (now - lastBuzzerCycle >= 100) {
        ledcWriteTone(PIN_BUZZER, 0);
        buzzerPhase = 2;
      }
      break;
    case 2:
      if (now - lastBuzzerCycle >= 180) {
        ledcWriteTone(PIN_BUZZER, BUZZER_FREQ);
        buzzerPhase = 3;
      }
      break;
    case 3:
      if (now - lastBuzzerCycle >= 280) {
        ledcWriteTone(PIN_BUZZER, 0);
        buzzerPhase = 4;
      }
      break;
    case 4:
      if (now - lastBuzzerCycle >= BUZZER_INTERVAL_MS) {
        lastBuzzerCycle = now;
        ledcWriteTone(PIN_BUZZER, BUZZER_FREQ);
        buzzerPhase = 1;
      }
      break;
  }
}

inline void greenLedOn()  { digitalWrite(PIN_LED_GREEN, HIGH); }
inline void greenLedOff() { digitalWrite(PIN_LED_GREEN, LOW);  }
inline void redLedOn()    { digitalWrite(PIN_LED_RED,   HIGH); }
inline void redLedOff()   { digitalWrite(PIN_LED_RED,   LOW);  }


int getPriorityRank(const String& p) {
  if (p == "Urgent")    return 3;
  if (p == "Important") return 2;
  return 1;
}

void saveNoticesToNVS();

void refreshUrgentState() {
  bool wasUrgent = urgentActive;
  urgentActive = false;
  for (int i = 0; i < noticeCount; i++) {
    if (notices[i].priority == "Urgent") { urgentActive = true; break; }
  }
  if (urgentActive) {
    redLedOn();
    if (!wasUrgent) {
      lastBuzzerCycle = millis() - BUZZER_INTERVAL_MS;
      buzzerPhase     = 0;
      Serial.println("[ALERT] Urgent notice active — 5s Beep-Beep loop started.");
    }
  } else {
    redLedOff();
    buzzerStop();
    Serial.println("[ALERT] No urgent notices — Buzzer silenced.");
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


void addOrUpdateNotice(const String& title, const String& content,
                       const String& priority, const String& category, int speed) {
  int idx = -1;
  for (int i = 0; i < noticeCount; i++) {
    if (notices[i].title == title) { idx = i; break; }
  }
  if      (idx != -1)                 { /* update in-place */ }
  else if (noticeCount < MAX_NOTICES) { idx = noticeCount++; }
  else                                { idx = MAX_NOTICES - 1; }

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

bool removeNoticeByTitle(const String& title) {
  for (int i = 0; i < noticeCount; i++) {
    if (notices[i].title == title) {
      for (int j = i; j < noticeCount - 1; j++) notices[j] = notices[j + 1];
      noticeCount--;
      sortNotices();
      saveNoticesToNVS();
      Serial.println("[NOTICE] Removed: " + title);
      return true;
    }
  }
  return false;
}

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
  sortNotices();
  saveNoticesToNVS();
  Serial.println("[BLE] replaceAllNotices: board now has " + String(noticeCount) + " notice(s).");
}

void clearAllNotices() {
  noticeCount  = 0;
  urgentActive = false;
  buzzerStop();
  redLedOff();
  preferences.begin("noticeboard", false);
  preferences.clear();
  preferences.end();
  display.clearDisplay();
  display.display();
  Serial.println("[NVS] All notices cleared.");
}


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
    notices[i].message        = preferences.getString((pfx + "m").c_str(), "");
    notices[i].priority       = preferences.getString((pfx + "p").c_str(), "Normal");
    notices[i].category       = preferences.getString((pfx + "c").c_str(), "General");
    notices[i].scrollSpeed    = preferences.getInt   ((pfx + "s").c_str(), 30);
    notices[i].scrollX        = 0;
    notices[i].lastScrollTime = millis();
    notices[i].textPixelWidth = (notices[i].title + ": " + notices[i].message).length() * 6;
  }
  preferences.end();
  sortNotices();
  Serial.println("[NVS] Loaded " + String(noticeCount) + " notice(s) from flash.");
}

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pSrv) override {
    deviceConnected = true;
    greenLedOn();
    Serial.println("[BLE] Admin connected — Green LED ON.");
    // Note: portal will push a full sync shortly after connection;
    // existing NVS notices keep showing until the sync arrives.
  }
  void onDisconnect(BLEServer* pSrv) override {
    deviceConnected = false;
    greenLedOff();
    // Notices remain in RAM + NVS — they keep showing after disconnect
    Serial.println("[BLE] Admin disconnected — notices remain on screen from NVS.");
  }
};


class NoticeCharacteristicCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* pChar) override {
    String rxValue = pChar->getValue().c_str();
    if (rxValue.length() == 0) return;
    Serial.println("[BLE RX] " + rxValue.substring(0, min((int)rxValue.length(), 80)));

    DynamicJsonDocument doc(4096);
    DeserializationError err = deserializeJson(doc, rxValue);
    if (err) {
      addOrUpdateNotice("NOTICE", rxValue, "Normal", "General", 30);
      pChar->setValue("ACK:RAW_TEXT");
      pChar->notify();
      return;
    }

    const char* action = doc["action"] | "";

    if (strcmp(action, "clear") == 0) {
      clearAllNotices();
      pChar->setValue("ACK:CLEARED");
      pChar->notify();
      return;
    }

    if (strcmp(action, "delete") == 0) {
      String delTitle = doc["title"] | "";
      if (delTitle.length() > 0) {
        bool removed = removeNoticeByTitle(delTitle);
        pChar->setValue(removed ? "ACK:DELETED" : "ACK:NOT_FOUND");
      } else {
        pChar->setValue("ACK:ERR_NO_TITLE");
      }
      pChar->notify();
      return;
    }

    if (strcmp(action, "sync") == 0 && doc.containsKey("notices")) {
      JsonArray arr = doc["notices"].as<JsonArray>();
      replaceAllNotices(arr);
      pChar->setValue("ACK:SYNC_OK");
      pChar->notify();
      Serial.println("[BLE] ACK:SYNC_OK — board synced with portal.");
      return;
    }

    // Single add / update
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


void drawHeader() {
  display.fillRect(0, 0, SCREEN_WIDTH, HEADER_H, WHITE);
  display.setTextColor(BLACK);
  display.setTextSize(1);

  int textW = 17 * 6;  // approximate
  int x = (SCREEN_WIDTH - textW) / 2;
  display.setCursor(x < 0 ? 0 : x, 2);
  display.print("Smart Notice Board");

  display.setTextColor(WHITE);

  display.drawFastHLine(0, SEP_Y, SCREEN_WIDTH, WHITE);
}

void renderOLED() {
  display.clearDisplay();
  display.setTextWrap(false);

  unsigned long now = millis();

  drawHeader();

  if (now - lastBlinkTime >= 500) {
    lastBlinkTime = now;
    urgentBlink   = !urgentBlink;
  }

  if (noticeCount == 0) {
    display.setTextColor(WHITE);
    display.setTextSize(1);
    display.setCursor(10, NOTICE_AREA_Y + (NOTICE_AREA_H - 8) / 2 - 4);
    display.print("No Active Notices");
    display.setCursor(28, NOTICE_AREA_Y + (NOTICE_AREA_H - 8) / 2 + 8);
    display.print(deviceConnected ? "BLE Connected" : "BLE Disconnected");
  } else {
    int rows  = min(noticeCount, MAX_NOTICES);
    int rowH  = NOTICE_AREA_H / rows;
    int badgeW = 14;
    int textX  = badgeW + 3;
    int textW  = SCREEN_WIDTH - textX;

    for (int i = 0; i < rows; i++) {
      int rowBaseY = NOTICE_AREA_Y + i * rowH;
      int rowY     = rowBaseY + (rowH - 8) / 2; 

      String fullText = notices[i].title + ": " + notices[i].message;
      int    fPx      = notices[i].textPixelWidth;

      if (fPx <= textW) {
        display.setCursor(textX, rowY);
        display.print(fullText);
      } else {
        if (now - notices[i].lastScrollTime >= (unsigned long)notices[i].scrollSpeed) {
          notices[i].lastScrollTime = now;
          notices[i].scrollX--;
          if (notices[i].scrollX < -(fPx + 24)) notices[i].scrollX = 0;
        }
        display.setCursor(textX + notices[i].scrollX, rowY);
        display.print(fullText + "    ***    " + fullText);
      }

      display.fillRect(0, rowBaseY, badgeW + 1, rowH, BLACK);

      if (notices[i].priority == "Urgent") {
        if (!urgentBlink) {
          display.fillRect(0, rowY - 1, badgeW, 10, WHITE);
          display.setTextColor(BLACK);
          display.setCursor(4, rowY);
          display.print("!");
          display.setTextColor(WHITE);
        } else {
          display.drawRect(0, rowY - 1, badgeW, 10, WHITE);
          display.setCursor(4, rowY);
          display.print("!");
        }
      } else if (notices[i].priority == "Important") {
        display.drawRect(0, rowY - 1, badgeW, 10, WHITE);
        display.setCursor(4, rowY);
        display.print("*");
      } else {
        display.setCursor(4, rowY);
        display.print("-");
      }

      if (i < rows - 1) {
        display.drawFastHLine(0, rowBaseY + rowH - 1, SCREEN_WIDTH, WHITE);
      }
    }
  }

  display.display();
}


void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n=== ESP32 BLE Smart Notice Board v5 ===");

  // GPIO init
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_RED,   OUTPUT);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);

  // Buzzer init — ESP32 LEDC PWM
  ledcAttach(PIN_BUZZER, 2000, 10);
  ledcWriteTone(PIN_BUZZER, 0);
  Serial.println("[GPIO] Buzzer attached to LEDC PWM (Pin 27).");

  // Boot self-test beep + LED flash
  digitalWrite(PIN_LED_GREEN, HIGH);
  digitalWrite(PIN_LED_RED,   HIGH);
  ledcWriteTone(PIN_BUZZER, BUZZER_FREQ); delay(100);
  ledcWriteTone(PIN_BUZZER, 0);           delay(80);
  ledcWriteTone(PIN_BUZZER, BUZZER_FREQ); delay(100);
  ledcWriteTone(PIN_BUZZER, 0);
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_RED,   LOW);
  Serial.println("[GPIO] Boot beep test complete.");

  // I2C + OLED
  Wire.begin(21, 22);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
    Serial.println("[OLED] ERROR: SSD1306 not found at 0x3C!");
    while (true) delay(3000);
  }
  display.setTextWrap(false);
  Serial.println("[OLED] SSD1306 128x64 ready.");

  // Splash screen
  display.clearDisplay();
  display.setTextColor(WHITE);
  display.setTextSize(1);
  display.setCursor(18, 22);
  display.print("System Starting...");
  display.setCursor(12, 38);
  display.print("SSD1306 128x64 OLED");
  display.display();
  delay(1200);

  // Load persisted notices from NVS flash
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

  BLEAdvertisementData oAdvData;
  oAdvData.setFlags(0x06);
  oAdvData.setCompleteServices(BLEUUID(SERVICE_UUID));
  pAdv->setAdvertisementData(oAdvData);

  BLEAdvertisementData oScanRespData;
  oScanRespData.setName("ESP32-Smart-Notice-Board");
  pAdv->setScanResponseData(oScanRespData);

  pAdv->setMinPreferred(0x06);
  pAdv->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("[BLE] Advertising as 'ESP32-Smart-Notice-Board'.");
}


void loop() {
  if (!deviceConnected && oldDeviceConnected) {
    delay(150);
    pServer->startAdvertising();
    Serial.println("[BLE] Restarted advertising after disconnect.");
    oldDeviceConnected = false;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = true;
  }

  updateBuzzer();

  renderOLED();
}

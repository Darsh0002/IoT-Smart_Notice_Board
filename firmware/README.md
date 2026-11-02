# ESP32 BLE Smart Notice Board – Firmware

## Hardware Components

| Component | Details |
|-----------|---------|
| MCU | ESP32-WROOM-32 / NodeMCU ESP32 (240 MHz dual-core) |
| Primary Display | **0.96" SSD1306 OLED 128×64** (I2C, address **0x3C**) |
| Status LED | **Green LED** — BLE Connected indicator |
| Alert LED | **Red LED** — Urgent notice active indicator |
| Alert Sound | **3-Pin Passive Buzzer Module** — PWM one-shot alert pattern via `tone()` |
| Protocol | Bluetooth Low Energy (BLE GATT) |
| Persistence | ESP32 NVS Flash (Preferences library) |

---

## Complete Wiring Diagram

```
ESP32                    OLED SSD1306
──────────────────────────────────────
3.3V       ─────────────  VCC
GND        ─────────────  GND
GPIO 21    ─────────────  SDA
GPIO 22    ─────────────  SCL

ESP32                    Green LED (BLE Connected)
──────────────────────────────────────────────────
GPIO 25    ── 330Ω ──▶|──  GND
                (resistor → LED anode → LED cathode → GND)

ESP32                    Red LED (Urgent Notice)
────────────────────────────────────────────────
GPIO 26    ── 330Ω ──▶|──  GND

ESP32                    Active Buzzer
──────────────────────────────────────
GPIO 27    ─────────────  Buzzer (+)
GND        ─────────────  Buzzer (-)
```

> **Resistor values:** Use **220Ω–330Ω** for both LEDs (standard 3.3V GPIO current limiting)

---

## Pin Summary

| GPIO | Component | Role |
|------|-----------|------|
| 21 | OLED SDA | I2C data |
| 22 | OLED SCL | I2C clock |
| 25 | **Green LED** | ON when BLE admin connected |
| 26 | **Red LED** | ON when Urgent notice is active |
| 27 | **Active Buzzer** | Fires once on new Urgent notice |

---

## LED & Buzzer Behavior

### Green LED (GPIO 25)
| Event | State |
|-------|-------|
| BLE admin connected | **ON** |
| BLE disconnected / advertising | **OFF** |
| Boot self-test | Flashes once briefly |

### Red LED (GPIO 26)
| Event | State |
|-------|-------|
| Notice with `priority: "Urgent"` received | **ON** (stays on) |
| Notice cleared / overwritten with non-urgent | **OFF** |
| Boot self-test | Flashes once briefly |

### Active Buzzer (GPIO 27)
- Fires **exactly once** per new Urgent notice
- Does NOT re-fire if the same urgent notice is still active
- Does NOT fire on boot (NVS-persisted urgent notice restores LED only)

**Alert Pattern — "Triple Ascending Beep":**
```
█████  _  █████████  _  ██████████████████
120ms    180ms           300ms
 ↑ beep1    ↑ beep2         ↑ beep3 (long)
Total duration ≈ 760 ms
```

---

## Optional: 16x2 LCD Integration

The 16x2 LCD with I2C backpack (PCF8574, address `0x27`) can run **on the same I2C bus** as the OLED because they have different addresses.

### Additional Wiring (add to existing)

| LCD Pin | ESP32 Pin | Note |
|---------|-----------|------|
| VCC | **VIN (5V)** | LCD requires 5V — **not 3.3V** |
| GND | GND | Common ground |
| SDA | GPIO 21 | Same wire as OLED |
| SCL | GPIO 22 | Same wire as OLED |

### Suggested Role Division

| Display | Role |
|---------|------|
| **OLED 128×64** | Primary — scrolling notice text, header bar, marquee |
| **LCD 16×2** | Secondary — BLE status + priority on Line 1, category + speed on Line 2 |

### LCD Line Format
```
Line 1:  BLE:CONN [!URG]   ← BLE status + priority
Line 2:  Academic  SPD:M   ← category + scroll speed
```

### Code Addition (see bottom of .ino for full snippet)
```cpp
#include <LiquidCrystal_I2C.h>
LiquidCrystal_I2C lcd(0x27, 16, 2);

// In setup() after Wire.begin(21, 22):
lcd.init();
lcd.backlight();

// In loop() or when notice changes:
void updateLCD() {
  lcd.clear();
  String l1 = deviceConnected ? "BLE:CONN " : "BLE:ADV  ";
  l1 += (currentNotice.priority == "Urgent") ? "[!URG]" : "[INFO]";
  lcd.setCursor(0, 0); lcd.print(l1.substring(0, 16));

  String l2 = currentNotice.category + " SPD:" +
              (currentNotice.scrollSpeed <= 15 ? "F" :
               currentNotice.scrollSpeed >= 50 ? "S" : "M");
  lcd.setCursor(0, 1); lcd.print(l2.substring(0, 16));
}
```

---

## Libraries Required

| Library | Author | Purpose |
|---------|--------|---------|
| **Adafruit SSD1306** | Adafruit | OLED driver |
| **Adafruit GFX Library** | Adafruit | Graphics primitives |
| **ArduinoJson** | Benoit Blanchon | JSON payload parsing |
| **LiquidCrystal I2C** *(optional)* | Frank de Brabander | 16×2 LCD (if added) |

---

## Board Settings (Arduino IDE)

| Setting | Value |
|---------|-------|
| Board | **ESP32 Dev Module** |
| Upload Speed | 921600 |
| CPU Frequency | 240 MHz |
| Partition Scheme | Default 4MB with spiffs |

---

## BLE GATT Profile

| Item | Value |
|------|-------|
| Service UUID | `4fafc201-1fb5-459e-8fcc-c5c9c331914b` |
| Characteristic UUID | `beb5483e-36e1-4688-b7f5-ea07361b26a8` |
| Device Name | `ESP32-Smart-Notice-Board` |

## JSON Payload Format

```json
{
  "title":       "Lab Cancelled",
  "content":     "IoT lab session cancelled today. Reschedule notice follows.",
  "priority":    "Urgent",
  "category":    "Academic",
  "scrollSpeed": "Fast"
}
```

**Clear command:** `{ "action": "clear" }`

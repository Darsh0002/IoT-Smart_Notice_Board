# 📱 Bluetooth SMART NOTICE BOARD (MERN + ESP32 + OLED System)

A wireless digital notice-board system designed to replace traditional paper-based notice boards. An authorized administrator can compose, prioritize, update, and remove notices wirelessly from a laptop using a modern web application. The notice is transmitted to a dedicated **ESP32 microcontroller** via **Bluetooth Low Energy (BLE)** and displayed in real-time on an **OLED screen (SSD1306)** with automatic horizontal scrolling and persistent on-board flash storage.

---

## 🏛️ Dedicated Hardware Architecture (1x ESP32 & 1x OLED)

```text
Admin User (Authenticated via JWT)
   │
   ▼
[ React Web Application (Vite + Vanilla CSS) ]
   │
   ├──▶ REST APIs (Express.js + MongoDB)
   │     • JWT Authentication & Admin RBAC (User model)
   │     • Notice CRUD & Scheduling Logic (Notice model)
   │     • Historical Audit Trail (AuditLog model)
   │
   └──▶ Web Bluetooth API (GATT Central)
         │
         │  Bluetooth Low Energy (BLE)
         ▼
[ Dedicated ESP32 Microcontroller (GATT Peripheral) ]
   │
   ├──▶ Non-Volatile Flash Storage (Preferences / NVS)
   │     • Retains latest notice locally offline & after reboot
   │
   └──▶ I2C Interface (GPIO 21 SDA, GPIO 22 SCL)
         │
         ▼
[ Single 0.96" SSD1306 OLED Display (128x64) ]
   • Priority Header: [!URGENT!] / [*IMPORTANT] / [NOTICE]
   • Dynamic Horizontal Marquee Scrolling for Long Messages
```

---

## 📂 Streamlined Project Structure

```text
Notice_Board/
├── backend/                  # Node.js + Express + MongoDB Backend
│   ├── config/               # Database connection (db.js)
│   ├── middleware/           # JWT auth & admin guard middleware (auth.js)
│   ├── models/               # 3 Core Mongoose Schemas:
│   │   ├── User.js           # Admin users with bcrypt password hashing
│   │   ├── Notice.js         # Notices with priority, scheduling, and expiry
│   │   └── AuditLog.js       # Historical audit trail of notices & BLE actions
│   ├── routes/               # Express API endpoints:
│   │   ├── authRoutes.js     # /api/auth (Login, Register, Demo-login, Me)
│   │   ├── noticeRoutes.js   # /api/notices (CRUD, active notices, sync-ble)
│   │   └── dashboardRoutes.js# /api/dashboard (stats, audit logs)
│   ├── seed.js               # Database seeder with sample admin & notices
│   ├── server.js             # Express server entry point (Port 5000)
│   ├── .env                  # Environment configuration
│   └── package.json
│
├── frontend/                 # React 19 + Vite Web Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx               # Header, BLE connect trigger, device status
│   │   │   ├── DashboardStats.jsx       # Metric cards (Active, Scheduled, Urgent, BLE)
│   │   │   ├── OledDisplaySimulator.jsx # 128x64 SSD1306 realistic OLED live mirror
│   │   │   ├── NoticeList.jsx           # Notices feed with filters (Urgent/Active/Scheduled/All)
│   │   │   ├── NoticeCard.jsx           # Notice card with "Push to Board" BLE trigger
│   │   │   ├── NoticeModal.jsx          # Add/Schedule notice modal with priority & expiry
│   │   │   ├── AuditHistory.jsx         # Historical audit log & re-broadcast drawer
│   │   │   └── AuthModal.jsx            # Admin login & 1-click demo login modal
│   │   ├── services/
│   │   │   └── api.js                   # REST API client with JWT handling
│   │   ├── utils/
│   │   │   └── bleManager.js            # Web Bluetooth API manager + Virtual simulator
│   │   ├── App.jsx                      # Main dashboard assembly & BLE event stream
│   │   ├── index.css                    # Modern glassmorphic dark design system
│   │   └── main.jsx                     # Vite entry point
│   ├── index.html                       # HTML with Google Fonts & BLE metadata
│   └── package.json
│
├── firmware/                 # Production ESP32 Arduino C++ Firmware
│   ├── ESP32_BLE_Notice_Board.ino # Complete ESP32 sketch (BLE + SSD1306 + NVS)
│   └── README.md             # Hardware wiring pinout & Arduino IDE guide
│
└── package.json              # Root package with multi-service scripts
```

---

## ⚡ ESP32 & OLED Hardware Wiring

Only **4 wires** are required:

| ESP32 Pin | OLED Pin (SSD1306 0.96") | Description |
|-----------|--------------------------|-------------|
| **3V3** / **VIN** | **VCC** | 3.3V Power Supply |
| **GND** | **GND** | Ground |
| **GPIO 21** | **SDA** | I2C Serial Data |
| **GPIO 22** | **SCL** | I2C Serial Clock |

Open `firmware/ESP32_BLE_Notice_Board.ino` in Arduino IDE, install `Adafruit SSD1306`, `Adafruit GFX`, and `ArduinoJson`, then upload to your ESP32.

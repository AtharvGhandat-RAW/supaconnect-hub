# ATTENDRO System Architecture & Data Flow

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      ATTENDRO ATTENDANCE SYSTEM                 │
└─────────────────────────────────────────────────────────────────┘

                           SUPABASE
                        (PostgreSQL DB)
                              ▲
                              │
                              │ REST API
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐         ┌──────────┐         ┌──────────┐
    │ ESP32   │         │  WEB APP │         │  PYTHON  │
    │ DEVICE  │         │  (React) │         │   GUI    │
    │         │         │          │         │          │
    │ ┌─────┐ │         │┌────────┐│         │┌────────┐│
    │ │R307 │ │         ││Faculty ││         ││Enroll  ││
    │ │SENSOR│◄─┐       ││Module  ││         ││Module  ││
    │ └─────┘ │ │       ││        ││         ││        ││
    │ ┌─────┐ │ │       │└────────┘│         │└────────┘│
    │ │OLED │ │ │       │          │         │          │
    │ │DISP │ │ │       │┌────────┐│         │ Bridge   │
    │ └─────┘ │ │       ││Attendance         │Mode      │
    │ ┌─────┐ │ │       ││Monitor ││         │(UART)    │
    │ │WiFi │─┼─┼──────►└────────┘│         └────────┘
    │ └─────┘ │ │       │          │             │
    └─────────┘ │       └──────────┘             │
                │           ▲                    │
                │           │                    │
                └───────────┴────────────────────┘
                    USB Serial Connection
                   (at 115200 baud, COM9)
```

---

## 🔄 Data Flow - Enrollment Process

```
STUDENT ENROLLMENT (Using Python GUI)
═════════════════════════════════════════

1. Faculty runs: python fingerprint_gui.py
        ↓
2. Select COM port (COM9)
        ↓
3. Click Connect
        ↓
   Python connects to ESP32 BRIDGE MODE
        ↓
4. Enter Student Enrollment Number (101)
        ↓
5. Click "Verify"
        ↓
   Python queries Supabase: SELECT * FROM students WHERE enrollment_no=101
        ↓
6. System shows: "John Doe - Class A"
        ↓
7. Click "Enroll New Fingerprint"
        ↓
8. Student places finger on R307 sensor (1st scan)
        ↓
   Python sends: CMD_GENIMG, CMD_IMG2TZ, CMD_REGMODEL to R307
        ↓
9. System shows: "First fingerprint recorded"
        ↓
10. Student places finger again (2nd scan)
        ↓
    Python sends: CMD_GENIMG, CMD_IMG2TZ, CMD_STORE to R307
        ↓
11. System shows: "Fingerprint stored at ID 1"
        ↓
12. Python saves to Supabase:
    INSERT INTO fingerprint_templates (student_id, fingerprint_id, ...)
        ↓
13. ✓ Enrollment complete!
```

---

## 🔄 Data Flow - Attendance Process

```
STUDENT ATTENDANCE (Using Web App + ESP32)
═════════════════════════════════════════════

Faculty Side (Web App):
1. Faculty logs in to web app
        ↓
2. Clicks "Take Attendance"
        ↓
3. Selects Class, Subject, Time
        ↓
4. Clicks "Add Device"
        ↓
5. Enters Device Code: DEVICE_001
        ↓
6. Clicks "Select Device"
        ↓
   Web app creates:
   - INSERT INTO device_sessions (device_id, faculty_id, session_id, ...)
   - INSERT INTO attendance_records (session_id, student_id, status='ABSENT', ...)
        ↓
7. Clicks "Submit Attendance"
        ↓
   Web app subscribes to real-time updates on attendance_records

ESP32 Device Side:
8. ESP32 polls device_sessions every 10 seconds
        ↓
9. Finds active session
   SELECT * FROM device_sessions 
   WHERE device_id=X AND session_status='ACTIVE'
        ↓
10. ESP32 updates display:
    Shows: "[Subject Name]" / "Scan finger..."
        ↓
11. Student places finger on R307 sensor
        ↓
12. ESP32 processes:
    - CMD_GENIMG, CMD_IMG2TZ, CMD_SEARCH
    - Gets fingerprint ID from R307
        ↓
13. ESP32 queries Supabase:
    SELECT student_id FROM fingerprint_templates 
    WHERE fingerprint_id = X
        ↓
14. ESP32 updates attendance:
    UPDATE attendance_records 
    SET status='PRESENT', remarks='Fingerprint'
    WHERE session_id=X AND student_id=Y
        ↓
15. ✓ Status updates via real-time subscription
        ↓
16. Faculty sees "PRESENT" in web app (1-2 seconds later)
        ↓
17. Faculty can toggle between PRESENT/ABSENT manually
        ↓
18. Clicks "Submit" to finalize attendance
```

---

## 📊 Database Schema

```
FINGERPRINT_DEVICES
────────────────────
id              UUID PK
device_code     TEXT UNIQUE (DEVICE_001)
device_name     TEXT
status          TEXT (ACTIVE/INACTIVE)
last_seen_at    TIMESTAMP
firmware_version TEXT
created_at      TIMESTAMP
updated_at      TIMESTAMP

↓
DEVICE_SESSIONS
────────────────
id                  UUID PK
device_id           UUID FK → fingerprint_devices
faculty_id          UUID FK → faculty
class_id            UUID FK → classes
subject_id          UUID FK → subjects
attendance_session_id UUID FK → attendance_sessions
session_date        DATE
session_status      TEXT (ACTIVE/INACTIVE)

↓
FINGERPRINT_TEMPLATES
─────────────────────
id              UUID PK
student_id      UUID FK → students (UNIQUE)
fingerprint_id  INTEGER (1-999 on sensor)
template_data   TEXT
is_verified     BOOLEAN
created_at      TIMESTAMP

↓
DEVICE_ATTENDANCE_QUEUE
──────────────────────
id                  UUID PK
device_id           UUID FK → fingerprint_devices
device_session_id   UUID FK → device_sessions
fingerprint_id      INTEGER
scanned_at          TIMESTAMP
synced              BOOLEAN
synced_at           TIMESTAMP

↓
ATTENDANCE_RECORDS
──────────────────
id          UUID PK
session_id  UUID FK → attendance_sessions
student_id  UUID FK → students
status      TEXT (PRESENT/ABSENT)
remarks     TEXT
created_at  TIMESTAMP
```

---

## 🔐 Component Responsibilities

### ESP32 Device
```
✓ Detect fingerprints via R307 sensor
✓ Search fingerprint in local R307 database
✓ Display status on OLED
✓ Manage WiFi connection
✓ Register device with Supabase
✓ Poll for active sessions
✓ Update attendance via REST API
✓ Receive real-time session updates
```

### Python GUI (Enrollment)
```
✓ Detect serial port
✓ Connect to ESP32 in BRIDGE MODE
✓ Communicate with R307 sensor directly
✓ Enroll new fingerprints
✓ Store fingerprint templates in R307
✓ Save fingerprint mappings to Supabase
✓ Verify students exist in database
```

### Web App (Attendance)
```
✓ Let faculty create attendance sessions
✓ Select class, subject, time
✓ Add devices to attendance session
✓ Display student list
✓ Toggle attendance status (PRESENT/ABSENT)
✓ Subscribe to real-time updates
✓ Show live attendance marks
✓ Submit and finalize attendance
```

### Supabase (Backend)
```
✓ Store device information
✓ Store fingerprint templates
✓ Store device sessions
✓ Store attendance records
✓ Provide REST API endpoints
✓ Real-time subscriptions
✓ RLS policy enforcement
```

---

## 📡 Communication Protocols

### ESP32 ↔ R307 Sensor
```
Protocol: UART Serial
Baud Rate: 57600 baud
Packet Format:
  Header (2 bytes): 0xEF 0x01
  Address (4 bytes): 0xFF 0xFF 0xFF 0xFF
  Packet Type (1 byte): 0x01 (command), 0x07 (response)
  Data Length (2 bytes)
  Data (variable): Command/response data
  Checksum (2 bytes): Sum of all data
```

### ESP32 ↔ Web App
```
Protocol: REST API over HTTPS
Base URL: https://gphcfejuurygcetmtpec.supabase.co
Auth: Bearer token (SUPABASE_SERVICE_KEY)
Endpoints:
  GET    /rest/v1/device_sessions
  POST   /rest/v1/attendance_records
  PATCH  /rest/v1/attendance_records
  GET    /rest/v1/fingerprint_templates
  PATCH  /rest/v1/fingerprint_devices
```

### Python GUI ↔ ESP32
```
Protocol: UART Serial
Baud Rate: 57600 baud
Mode: BRIDGE (ESP32 forwards all data to R307)
Data: R307 packets pass through unchanged
```

### Web App ↔ Supabase
```
Protocol: REST API + Real-time Subscriptions
Auth: Anon key or Service role key
Real-time: WebSocket subscriptions on attendance_records
```

---

## ⏱️ Timing & Performance

```
Operation                          Time Required
────────────────────────────────────────────────────
ESP32 Fingerprint Capture          ~3-5 seconds
ESP32 Fingerprint Match            ~2-3 seconds
API Call to Supabase               ~500-1000ms
Real-time Update in Web App        ~500-1500ms
Total: Scan to Attendance Update   ~5-10 seconds

WiFi Reconnect Check               Every 10 seconds
Session Check Poll                 Every 10 seconds
Heartbeat Send                     Every 30 seconds
Fingerprint Sensor Polling         Continuous
```

---

## 🔐 Security

```
Authentication:
- Supabase RLS Policies enforce access control
- Service role key used for privileged operations
- Anon key used for client-side queries

Authorization:
- Faculty can only modify their own attendance
- Admin can view all devices and sessions
- Students cannot directly modify attendance

Data Protection:
- All API calls use HTTPS
- Fingerprint templates stored encrypted
- Device sessions tied to specific faculty

API Keys: (in code)
- SUPABASE_KEY (anon, read-only)
- SUPABASE_SERVICE_KEY (privileged)
```

---

## 🚀 Performance Optimization

```
ESP32:
- Non-blocking WiFi reconnection
- Efficient JSON parsing with ArduinoJson
- Minimal memory usage (DynamicJsonDocument)
- Batched API calls

Web App:
- Real-time subscriptions (no polling needed)
- React memoization for performance
- Lazy loading of components
- Virtualized lists for large datasets

Database:
- Indexes on frequently queried columns
- RLS policies for fast authorization
- Triggers for automatic processing
- Connection pooling on backend
```

---

## 🔄 Example Complete Workflow

```
09:00 AM - Faculty Prepares
┌─────────────────────────────┐
│ Faculty logs in to web app  │
│ Selects: Class 3A, Physics  │
│ Adds Device: DEVICE_001     │
│ Clicks: Submit Attendance   │
└─────────────────────────────┘
         ↓
    Supabase creates:
    - device_sessions record (ACTIVE)
    - attendance_records for all students (ABSENT)

09:02 AM - Student Scans
┌─────────────────────────────────────────┐
│ Student 1 places finger on device      │
│ ESP32: Detects fingerprint             │
│ Matches: Fingerprint ID 5              │
│ Updates: Attendance → PRESENT           │
└─────────────────────────────────────────┘
         ↓
    Supabase updates:
    - attendance_records[student_id] → PRESENT
         ↓
    Web app receives real-time notification
    Faculty sees: "Present" checked ✓

09:15 AM - Class Ends
┌─────────────────────────────┐
│ Faculty finalizes attendance│
│ Saves to database           │
│ Notifies parents            │
└─────────────────────────────┘

Result:
✓ 28 present, 2 absent, 0 on leave
✓ Automatic notification sent
✓ Attendance recorded permanently
```

---

## 📈 Scalability

```
Current Setup (Single Device):
- 1 ESP32 device
- Handles ~30 students per class
- 1 class per time slot
- ~100 fingerprint templates per device

Scaling Options:
- Add more ESP32 devices (one per class)
- Use multiple devices for large venues
- Each device works independently
- All sync to same Supabase backend
- No single point of failure
```

---

That's the complete ATTENDRO system! All components working together seamlessly. 🎯

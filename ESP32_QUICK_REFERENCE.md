# ATTENDRO - Quick Reference Card

## 🚀 5-Minute Setup

### 1. Edit WiFi (Line 28-29 in main.cpp)
```cpp
const char* WIFI_SSID = "Your_WiFi_Name";
const char* WIFI_PASSWORD = "Your_Password";
```

### 2. Upload Code
- Board: ESP32 Dev Module
- Port: Arduino → Tools → Port (select COM port)
- Upload: Ctrl+U

### 3. Monitor Serial (115200 baud)
```
Expected output:
[WIFI] ✓ Connected
[DEVICE] ✓ Registered
[FINGERPRINT] OK at 57600 baud
✓ Device Ready!
```

---

## 📞 Serial Commands

| Command | Purpose | Expected Output |
|---------|---------|-----------------|
| `STATUS` | Check device health | WiFi ✓, Sensor ✓, Session status |
| `CHECK` | Check for active session | Shows subject name if active |
| `VERIFY` | Test fingerprint sensor | ✓ Sensor responsive |
| `REGISTER` | Register device manually | ✓ Updated device |
| `CLEAR` | Delete all fingerprints | ✓ Database cleared |
| `RESET` | Restart ESP32 | Device reboots |
| `BRIDGE` | Enable bridge mode | Ready for Python GUI |

---

## 💡 What to Expect

### Enrollment (Admin)
```
Admin action:        ESP32 shows:           LED/Buzzer:
───────────────────  ──────────────────────  ────────────
Scan finger 1        "Scanning..."          Silent
Finger removed       "Ready" (after 1s)     Silent
Scan finger 2        "Scanning..."          Silent
Finger on DB         Success message        🟢 Green + beep
```

### Attendance (Student)
```
Student action:      ESP32 shows:           LED/Buzzer:
───────────────────  ──────────────────────  ────────────
Scan enrolled        "Scanning..."          Silent
Match found!         "John Doe             🟢 Green + 2 beeps
                      PRESENT ✓"            (FOUND)

Not enrolled         "Not Found             🔴 Red + 3 beeps
                      Please enroll"        (NOT FOUND)
```

### Device Lifecycle
```
Boot:                DISPLAY              LED       SERIAL
──────────────────── ─────────────────────────────  ──────────────────
Initializing         "ATTENDRO"           Off       [INIT] messages
                     "Initializing"

WiFi connecting      "WiFi"               Blinking  [WIFI] Connecting
                     "Connecting..."

WiFi connected       "ATTENDRO"           On (1s)   [WIFI] ✓ Connected
                     "Connected!"

Ready (no session)   "ATTENDRO"           Off       [SESSION] No active
                     "Ready"

Session started      "Physics"            Double    [SESSION] ACTIVE
                     "Scan finger..."     beep      Physics

During scan          "Scanning..."        Off       [FP] Processing
                     "Please wait"

After success        "John Doe"           ON + 2    [SUCCESS] Marked
                     "PRESENT ✓"          beeps     PRESENT

After failure        "Error"              ON + 3    [ERROR] Not found
                     "Try again"          beeps
```

---

## 🎯 Testing Workflow

```
STEP 1: Power-up Device
┌─────────────────────┐
│ Connect USB to PC   │
│ Check Serial output │
│ WiFi should connect │
│ within 10 seconds   │
└─────────────────────┘

STEP 2: Verify Sensor
┌──────────────────────┐
│ Type: VERIFY         │
│ Serial Monitor shows │
│ ✓ Sensor responsive  │
└──────────────────────┘

STEP 3: Register Device
┌─────────────────────────┐
│ Type: REGISTER          │
│ Device registers with   │
│ Supabase database       │
└─────────────────────────┘

STEP 4: Check Status
┌─────────────────────────┐
│ Type: STATUS            │
│ Shows all info:         │
│ ✓ WiFi Connected        │
│ ✓ Device Registered     │
│ ✓ Sensor Ready          │
│ 0 fingerprints enrolled │
└─────────────────────────┘

STEP 5: Enroll Test Student
┌──────────────────────────┐
│ Open: /admin/enrollment  │
│ Connect Sensor via USB   │
│ Enroll student           │
│ Check Serial Monitor     │
│ [SUCCESS] saved to DB    │
└──────────────────────────┘

STEP 6: Start Attendance Session
┌─────────────────────────────┐
│ Faculty: /faculty/attendance│
│ Add device: DEVICE_001      │
│ ESP32 should show           │
│ "[SESSION] ACTIVE: Physics" │
└─────────────────────────────┘

STEP 7: Test Scan
┌───────────────────────┐
│ Student scans finger  │
│ ESP32 shows success   │
│ Web app shows updated │
│ attendance (PRESENT)  │
└───────────────────────┘

PASSED ✓ System working!
```

---

## 🆘 Quick Fixes

| Problem | Check | Fix |
|---------|-------|-----|
| No WiFi | Serial output | Update SSID/password in code |
| No display | Black screen | Check SDA→21, SCL→22 wiring |
| No sensor | Serial says FAILED | Check TX→16, RX→17, 5V power |
| Session not found | Run: CHECK | Faculty must add device to session |
| Attendance not updating | Serial shows [ERROR] | Check WiFi, check session active |
| LED not working | No feedback | Check GPIO2 wiring, verify 3.3V |

---

## 🔌 Wiring Checklist

### R307 Fingerprint (5V)
- [ ] VCC → **VIN** (NOT 3.3V!)
- [ ] GND → GND
- [ ] TX → GPIO16
- [ ] RX → GPIO17

### OLED Display (3.3V)
- [ ] VCC → 3.3V
- [ ] GND → GND
- [ ] SDA → GPIO21
- [ ] SCL → GPIO22

### LED (3.3V)
- [ ] Positive (long) → GPIO2
- [ ] Negative (short) → GND

### Buzzer (3.3V)
- [ ] Positive → GPIO5
- [ ] Negative → GND

---

## ⏱️ Performance Targets

| Task | Time | Notes |
|------|------|-------|
| Boot time | 10-15s | WiFi connection included |
| Device registration | 2-3s | First time only |
| Session detection | 5s | Polled every 5 sec |
| Fingerprint scan | 3-5s | Image capture |
| DB update | 1-2s | API call |
| **Total: Scan to Update** | **8-12s** | Full cycle |

---

## 📊 Database Query

Check if things are working:

```sql
-- Check device registered
SELECT * FROM fingerprint_devices 
WHERE device_code = 'DEVICE_001';

-- Check active session
SELECT * FROM device_sessions 
WHERE device_id = '...' 
AND session_status = 'ACTIVE';

-- Check enrolled fingerprints
SELECT * FROM fingerprint_templates 
ORDER BY created_at DESC;

-- Check attendance updated
SELECT * FROM attendance_records 
ORDER BY created_at DESC;
```

---

## 🎯 Device Code Setup

For **multiple devices**, change one line in code:

```cpp
// Device 1
const char* DEVICE_CODE = "DEVICE_001";

// Device 2  
const char* DEVICE_CODE = "DEVICE_002";

// Device 3
const char* DEVICE_CODE = "DEVICE_003";
```

Then:
1. Compile and upload to each device
2. Faculty adds each device to attendance session
3. Device is now independent

---

## 📝 Example: Complete Enrollment Flow

```
Time: 09:00 AM
───────────────

✓ Device powered on
  Serial: [WIFI] ✓ Connected
  Display: "ATTENDRO Ready"

✓ Admin navigates to /admin/fingerprint-enrollment
  Clicks: Connect Sensor
  Selects: ESP32 (COM9)

✓ Admin enters: 101 (John Doe)
  Clicks: Search Student
  Web app shows: "John Doe - TYCO A"

✓ Admin clicks: Start Enrollment
  Places John's finger on sensor
  ESP32 displays: "Scanning...
                  Please wait"

✓ First scan completes
  Serial: [FP] STORED at ID: 46

✓ Admin places same finger again
  ESP32 displays: "Scanning...
                  Please wait"

✓ Second scan completes
  Serial: [SUCCESS] Fingerprint saved!

✓ Web app shows: "✓ Enrollment Complete!"
  Display: "ATTENDRO Ready"

✓ Database updated:
  fingerprint_templates shows:
  - student_id: uuid-john-doe
  - fingerprint_id: 46
```

---

## 🚨 Emergency Commands

```
Device not responding?
→ Type: RESET
→ Wait 5 seconds
→ Device reboots

Want to clear all fingerprints?
→ Type: CLEAR
→ Confirms: ✓ Database cleared

Need to debug enrollment?
→ Type: BRIDGE
→ Use Python GUI or web app
→ Type: RESET to exit

Lost device registration?
→ Type: REGISTER
→ Confirms: ✓ Device registered
```

---

## ✅ Pre-Deployment Checklist

- [ ] WiFi credentials configured
- [ ] Code uploads successfully
- [ ] Serial Monitor shows "✓ Device Ready"
- [ ] Fingerprint sensor responds (VERIFY command)
- [ ] OLED display shows "ATTENDRO"
- [ ] LED blinks (test with STATUS command)
- [ ] Buzzer beeps (enroll a fingerprint)
- [ ] Test student enrolled successfully
- [ ] Device appears in web app
- [ ] Attendance session detects device
- [ ] Test student scan updates attendance
- [ ] Multiple students scan successfully
- [ ] Real-time updates work in web app

**If ALL checked ✓ → System is PRODUCTION READY! 🎉**

---

## 📞 Support Contacts

1. **Device not detected in web app?**
   - Check: Device code in code matches what faculty enters
   - Check: Device_code in fingerprint_devices table
   - Check: device_sessions table has device_id

2. **Fingerprint not matching?**
   - Check: Student enrolled first
   - Check: fingerprint_templates has record
   - Try: Different finger pressure

3. **Attendance not updating?**
   - Check: Session is ACTIVE
   - Check: WiFi is connected
   - Check: Serial shows [SUCCESS]

4. **WiFi keeps dropping?**
   - Check: Router is 2.4GHz mode
   - Check: Signal strength (move closer)
   - Check: Try increasing WIFI_RECONNECT_INTERVAL

---

**Version: 3.0 | Updated: 2026-04-13 | Status: Production Ready ✓**

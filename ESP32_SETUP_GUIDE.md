# ESP32 Attendance Device - Setup & Operation Guide

## 🚀 Quick Start (5 Minutes)

### Step 1: Configure WiFi
Edit `esp32_firmware/src/main.cpp` lines 28-29:
```cpp
const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
```

### Step 2: Upload Code
1. Open Arduino IDE
2. Open: `esp32_firmware/src/main.cpp`
3. Select: Board → ESP32 Dev Module
4. Select: COM Port for ESP32
5. Click: Upload (Ctrl+U)
6. Wait for: "Leaving... Hard resetting via RTS pin" message

### Step 3: Monitor
1. Click: Serial Monitor (Ctrl+Shift+M)
2. Set Baud Rate: 115200
3. Power cycle ESP32
4. You should see initialization messages

---

## 📋 Complete Workflow

### 1️⃣ Admin Enrolls Fingerprints (One Time Setup)

**On Web App:**
```
1. Navigate to: /admin/fingerprint-enrollment
2. Click: Connect Sensor → Select USB port
3. Enter: Student number (101)
4. Click: Search Student
5. Scan: First finger (place and lift slowly)
6. Scan: Second finger (same finger)
7. ✓ Stored in ESP32 and Supabase
```

**On ESP32 Display:**
```
First scan:  "Scanning...
             Please wait"

After save:  "ATTENDRO
             Ready"
```

**On Serial Monitor:**
```
[FP] Finger detected
[FP] Image conversion OK
[FP] Stored at ID: 5
```

---

### 2️⃣ Faculty Starts Attendance Session

**On Web App (Faculty Account):**
```
1. Navigate to: /faculty/attendance
2. Select: Class, Subject, Time
3. Click: "Add Device"
4. Enter: DEVICE_001 (the device code)
5. Click: "Select Device"
6. Click: "Submit Attendance"
```

**What Happens on ESP32:**
```
1. Device detects new session every 5 seconds
2. Updates display to show subject name
3. LED blinks twice (ready signal)
4. Display shows: "Physics
                  Scan finger..."
5. Serial shows: "[SESSION] ACTIVE: Physics"
```

---

### 3️⃣ Student Scans Fingerprint

**Student Scans at Device:**
```
1. Student places finger on R307 sensor
2. Holds for 1-2 seconds
3. Lifts finger slowly
```

**On ESP32 Display:**
```
Shows:      "Scanning...
             Please wait"

Then shows: "John Doe
             PRESENT ✓"
```

**On ESP32 Serial Monitor:**
```
[FP] Finger detected
[FP] MATCH! ID=5, Confidence=87
[STUDENT] Name: John Doe, ID: UUID, Enrollment: 101
[ATTENDANCE] Marking: John Doe → PRESENT
[SUCCESS] John Doe marked PRESENT!
```

**Simultaneously on Web App:**
```
Faculty sees in real-time:
- Student name appears as "Present"
- Count updates (28 Present, 0 Absent)
- Timestamp shows when marked
```

**LED & Buzzer Feedback:**
```
Match found:  LED ON → Green blink
              Buzzer: 2 short beeps (high pitch)

No match:     LED ON → Red blink
              Buzzer: 2 error beeps (low pitch)
```

---

### 4️⃣ Faculty Finalizes Attendance

**On Web App:**
```
1. All students scanned
2. Click: "Submit" or "Finalize"
3. Attendance saved permanently
```

**On ESP32:**
```
1. Device continues ready state
2. Session ends (faculty finishes)
3. Display shows: "ATTENDRO
                  Ready"
4. Next session automatically detected
```

---

## 🔧 Hardware Wiring (Double-Check)

```
ESP32 DEV KIT
═════════════

FINGERPRINT R307 (5V Power)
├─ VCC → VIN (5V) ⚠️ NOT 3.3V
├─ GND → GND
├─ TX  → GPIO16
└─ RX  → GPIO17

OLED Display (3.3V)
├─ VCC → 3.3V
├─ GND → GND
├─ SDA → GPIO21
└─ SCL → GPIO22

FEEDBACK (3.3V)
├─ LED  → GPIO2 (Blue LED)
└─ BUZZER → GPIO5 (Passive buzzer)
```

---

## 🎯 Serial Commands (Type in Serial Monitor)

### STATUS
Shows device health:
```
╔════════ DEVICE STATUS ════════╗
║ WiFi: ✓ Connected
║ IP: 192.168.1.X
║ Sensor: ✓ Ready
║ Display: ✓ Ready
║ Device Registered: ✓ Yes
║ Session: ✓ ACTIVE
║ Fingerprints: 45 enrolled
╚═════════════════════════════════╝
```

### CHECK
Manually check for active session:
```
[SESSION] ACTIVE: Physics
```

### VERIFY
Test fingerprint sensor:
```
[CMD] ✓ Sensor responsive
```

### REGISTER
Manually register device with Supabase:
```
[DEVICE] ✓ Updated existing device
```

### CLEAR
Delete all fingerprints from sensor:
```
[CMD] ✓ Database cleared
```

### BRIDGE
Enter bridge mode (for web app enrollment):
```
ESP32 becomes transparent to R307
Python script can control sensor directly
```

### RESET
Restart the device:
```
Reboots ESP32
```

---

## ✅ Complete Testing Checklist

### Initial Setup
- [ ] WiFi credentials updated in code
- [ ] Code uploaded successfully
- [ ] Serial Monitor shows initialization
- [ ] Display shows "ATTENDRO"
- [ ] Fingerprint sensor detected

### Device Registration
- [ ] Run: `STATUS` command
- [ ] Shows: "Device Registered: ✓ Yes"
- [ ] Or run: `REGISTER` command

### Enrollment Test
- [ ] Admin navigates to /admin/fingerprint-enrollment
- [ ] Clicks "Connect Sensor"
- [ ] Enroll test student
- [ ] Serial shows: "[SUCCESS]"
- [ ] Check Supabase: fingerprint_templates has record

### Live Attendance Test
- [ ] Faculty creates attendance session with device DEVICE_001
- [ ] Web app shows device is online
- [ ] ESP32 display shows subject name
- [ ] Student scans enrolled fingerprint
- [ ] Web app shows attendance updated to "Present"
- [ ] Serial shows: "[SUCCESS] marked PRESENT"
- [ ] LED blinks and buzzer beeps

### Real-time Sync Test
- [ ] Multiple students scan at device
- [ ] Faculty sees updates in real-time (1-2 sec delay)
- [ ] Database shows attendance records
- [ ] No manual updates needed

---

## 🆘 Troubleshooting

### Display Shows Nothing
**Problem:** Black screen on OLED display

**Solutions:**
1. Check wiring: SDA→GPIO21, SCL→GPIO22
2. Verify 3.3V power (NOT 5V)
3. Check connector: Should be firmly inserted
4. Try different I2C address (some 0.91" OLEDs use different addresses)
5. Serial Monitor should show: `[DISPLAY] Initializing... OK at 0x3C`

---

### Fingerprint Sensor Not Detected
**Problem:** Serial shows "Fingerprint not found"

**Solutions:**
1. Check power: **MUST BE 5V** (not 3.3V)
2. Check wiring: TX→GPIO16, RX→GPIO17
3. Verify GND connection
4. Try different USB cable
5. Run: `VERIFY` command in Serial Monitor
6. Check Serial shows: "[CMD] ✓ Sensor responsive"

---

### WiFi Not Connecting
**Problem:** Serial shows "WiFi Connection failed"

**Solutions:**
1. Check SSID and password in code (case-sensitive)
2. Router must be 2.4GHz (not 5GHz only)
3. Type: `STATUS` to see WiFi status
4. Restart router
5. Check if connection timeout is too short (increase to 30 seconds)

---

### Device Not Appearing Online in Web App
**Problem:** Faculty can't find device when adding to session

**Solutions:**
1. Wait 30 seconds after upload for device registration
2. Run: `STATUS` command → should show "Device Registered: ✓ Yes"
3. Run: `REGISTER` command manually
4. Check Supabase: `fingerprint_devices` table has device
5. Verify device_code in ESP32 code matches web app (DEVICE_001)

---

### Session Not Detected
**Problem:** ESP32 shows "ATTENDRO Ready" instead of subject name

**Solutions:**
1. Run: `CHECK` command in Serial Monitor
2. Should show: `[SESSION] ACTIVE: [Subject Name]`
3. If not active:
   - Verify faculty created attendance session
   - Verify device DEVICE_001 was added to session
   - Wait 5 seconds for ESP32 to poll
4. Check Supabase: `device_sessions` table has record with `session_status: ACTIVE`

---

### Fingerprint Not Matching
**Problem:** Student scans but shows "Not Found"

**Solutions:**
1. Student may not be enrolled yet
2. Run: `STATUS` command → check "Fingerprints: X enrolled"
3. Try scanning again with different finger pressure
4. Enroll student first using /admin/fingerprint-enrollment
5. Check Supabase: `fingerprint_templates` has row for student

---

### Attendance Not Updating in Web App
**Problem:** Student scans but web app doesn't show update

**Solutions:**
1. Check Serial Monitor: Should show "[SUCCESS]"
2. If shows "[ERROR]":
   - Verify WiFi is connected
   - Verify session is active (run: `CHECK`)
   - Check Supabase connection
3. Refresh web app page (may take 1-2 second delay)
4. Check database: `attendance_records` table for new record
5. Wait 5 seconds then refresh again

---

### LED or Buzzer Not Working
**Problem:** No feedback when fingerprint matches

**Solutions:**
1. Check wiring: LED→GPIO2, Buzzer→GPIO5
2. Verify 3.3V power for both
3. LED might be reversed (swap + and -)
4. Buzzer should be passive (not active)
5. Try: `STATUS` command → if device shows OK, feedback should work

---

## 📊 Expected Performance

| Operation | Time | Notes |
|-----------|------|-------|
| WiFi Connect | 5-10s | At startup |
| Device Register | 2-3s | First time only |
| Session Detection | 5s | Polled every 5 seconds |
| Fingerprint Scan | 3-5s | Image capture + template |
| Database Update | 1-2s | API call to Supabase |
| **Total: Scan to Update** | **8-12s** | Full workflow |

---

## 🔐 Data Security
- All API calls use HTTPS
- Supabase API keys are embedded (consider server-side API for production)
- Device token refreshes every 30 seconds (heartbeat)
- Fingerprint data never leaves device (only ID stored in Supabase)

---

## 📞 Support
If issues persist:

1. **Collect Info:**
   - Serial Monitor output (full startup to error)
   - Photo of wiring from 3 angles
   - Screenshot of web app
   - Screenshot of Serial Monitor

2. **Check Logs:**
   - Supabase: `fingerprint_devices` table
   - Supabase: `device_sessions` table
   - Supabase: `fingerprint_templates` table
   - Supabase: `attendance_records` table

3. **Restart:**
   - Type: `RESET` in Serial Monitor
   - Wait 5 seconds
   - Check Serial output again

---

## ✨ Production Deployment

### Before Going Live:
- [ ] Test complete workflow end-to-end
- [ ] Verify WiFi is stable (try running for 1 hour)
- [ ] Enroll all students using /admin/fingerprint-enrollment
- [ ] Train faculty on device usage
- [ ] Set up backup WiFi network
- [ ] Document device location and access

### For Multiple Devices:
- Edit `esp32_firmware/src/main.cpp`:
  - Change `DEVICE_CODE` to "DEVICE_002", "DEVICE_003" etc
  - Compile and upload to each device separately
- Each device will register independently
- Faculty can add multiple devices to same session

---

## 📝 Notes
- Device firmware updates: Re-upload code via Arduino IDE
- WiFi credentials: Update code and re-upload (no over-the-air update)
- Fingerprint database: Clear with `CLEAR` command if needed
- Bridge mode: Use for Python GUI enrollment (if needed)

**Your device is now production-ready! 🎉**

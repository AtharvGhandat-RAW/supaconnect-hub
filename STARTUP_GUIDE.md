# COMPLETE STARTUP & TESTING GUIDE

## ⚠️ CRITICAL: Update WiFi Credentials First!

Edit this file: `esp32_firmware/src/main.cpp`

Find lines 16-17 and update:
```cpp
const char* WIFI_SSID = "YOUR_WIFI_SSID";        // ← Change to your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // ← Change to your WiFi password
```

**Save the file!**

---

## ✅ STEP 1: Hardware Checklist

Before uploading, verify all connections:

```
R307 Fingerprint Sensor:
☐ VCC (Red)    →  VIN (5V) - MUST BE 5V, NOT 3.3V!
☐ GND (Black)  →  GND
☐ TX (Green)   →  GPIO16
☐ RX (White)   →  GPIO17

OLED Display:
☐ VCC (Red)    →  3.3V
☐ GND (Black)  →  GND
☐ SDA (Yellow) →  GPIO21
☐ SCL (Blue)   →  GPIO22

ESP32:
☐ USB cable connected to PC
☐ All wires firmly inserted
```

**If R307 is powered by 3.3V, it WON'T WORK!** Use VIN (5V).

---

## ✅ STEP 2: Upload ESP32 Code

1. Open Arduino IDE
2. File → Open → `esp32_firmware/src/main.cpp`
3. **UPDATE WiFi CREDENTIALS** (see above)
4. Tools → Board: "ESP32 Dev Module"
5. Tools → Port: "COM3" (or your ESP32 port)
6. Click **Upload** button
7. Wait for "Leaving... Hard resetting via RTS pin" message

---

## ✅ STEP 3: Verify ESP32 Boot

1. Open Serial Monitor (Tools → Serial Monitor)
2. Set Baud Rate: **115200**
3. Press RESET button on ESP32
4. You should see:

```
================================
ATTENDRO - Attendance Device
Version 2.0 - Enhanced
================================

[INIT] Initializing I2C... OK
[DISPLAY] Scanning I2C addresses... Found at 0x3C!
[FINGERPRINT] Testing sensor... OK at 57600 baud
[FINGERPRINT] Stored templates: 0
[WIFI] Connecting to YOUR_WIFI_SSID...........WiFi connected!
[WIFI] IP: 192.168.x.x
[DEVICE] Registering with Supabase...
[DEVICE] ✓ Device updated

✓ Device Ready!

Commands: STATUS, CHECK, RESET, CLEAR, BRIDGE
```

**If any line shows ✗ or FAILED:**
- Display not showing? Check I2C wiring
- Fingerprint not detected? Check R307 is at 5V power
- WiFi failed? Check SSID and password in code

---

## ✅ STEP 4: Enable Bridge Mode for Python GUI

In Serial Monitor, type:
```
BRIDGE
```

Press Enter. You should see:
```
[CMD] >>> BRIDGE MODE ENABLED <<<
PC Software can now control R307
Data being forwarded:
  Serial (USB) <-> R307 Sensor
```

**IMPORTANT:** Now **CLOSE the Serial Monitor** completely!

---

## ✅ STEP 5: Connect Python GUI

1. Open Command Prompt (Windows) or Terminal (Mac/Linux)
2. Navigate to folder: `cd C:\Users\YourName\Desktop\ATTENDRO` (Windows)
3. Run GUI: `python fingerprint_gui.py`
4. Select COM port (should show COM3 or COM9)
5. Click **Connect** button
6. Should show: **"Sensor: Connected at 57600 baud"**

If error "Sensor password verification failed":
- Make sure you typed `BRIDGE` command in Serial Monitor
- Make sure Serial Monitor is CLOSED
- Wait 2 seconds after closing Serial Monitor before connecting

---

## ✅ STEP 6: Test Enrollment

### Step 6a: Verify Student Exists
1. In Python GUI, enter enrollment number: **101**
2. Click **"Verify"** button
3. Should show: **"Student found: [name]"**

If "Student not found":
- Check enrollment number is correct
- Check student is registered in web app
- Check database connection

### Step 6b: Enroll Fingerprint
1. Click **"Enroll New Fingerprint"** button
2. **Place finger firmly on sensor** (wait 2 seconds)
3. You should see in Serial Monitor: **"Finger detected!"**
4. **Lift finger, then place same finger again** (wait 2 seconds)
5. You should see: **"Match found!"** then **"Fingerprint stored at ID 1"**

If "Image conversion failed":
- Place finger more firmly on sensor
- Ensure finger is clean and dry
- Try different fingers

### Step 6c: Verify Saved
In Python GUI:
- Click **"View Enrolled"** button
- Should show your fingerprint saved

---

## ✅ STEP 7: Test Attendance System

### On Web App (Faculty Side):
1. Go to "Take Attendance" page
2. Select class and subject
3. Click **"Add Device"** button
4. Enter device code: **DEVICE_001**
5. Click **"Select Device"**
6. Click **"Submit Attendance"** button

### On ESP32 Device:
1. Serial Monitor should show: **"[SESSION] Active: Mathematics"**
2. OLED display shows: **"Mathematics"** / **"Scan finger..."**
3. LED blinks green

### Student Scans Finger:
1. Student places enrolled finger on sensor
2. ESP32 shows: **"Scanning... Please wait"** 
3. Then shows: **"Student Name PRESENT ✓"**
4. LED blinks, buzzer beeps

### On Web App:
5. Attendance shows: **"PRESENT"** in 1-2 seconds automatically
6. Click **"Refresh"** button to see update

---

## 🔧 Troubleshooting

### Problem: Display shows nothing
```
1. Check I2C wiring: SDA→GPIO21, SCL→GPIO22
2. Clean solder joints with multimeter
3. Try address 0x3D instead of 0x3C (modify code)
4. Replace display if not working
```

### Problem: Fingerprint sensor not detected
```
1. Check R307 POWER IS 5V (VIN), NOT 3.3V
2. Check TX→GPIO16, RX→GPIO17 wiring
3. Check all GND connections
4. Use different ESP32 if broken
```

### Problem: Python GUI won't connect
```
1. Ensure you typed BRIDGE in Serial Monitor
2. Close Serial Monitor completely
3. Wait 2 seconds
4. Try connecting again
5. Check COM port is correct
```

### Problem: Fingerprint not enrolling
```
1. Ensure finger is placed firmly
2. Ensure finger is clean and dry
3. Try different finger
4. Check Serial Monitor for "Image captured !" message
5. Make sure 2 seconds between finger placements
```

### Problem: Attendance not updating in web app
```
1. Check ESP32 shows "WiFi: ✓ Connected" in STATUS
2. Check device is registered (in Supabase fingerprint_devices table)
3. Check session is active (check device_sessions table)
4. Check attendance record created (attendance_records table)
5. Click Refresh button to see update
```

---

## 📊 Testing Checklist

After setup, verify each part works:

```
Hardware:
☐ ESP32 powers on (blue LED)
☐ Display shows "ATTENDRO"
☐ R307 sensor powers on
☐ Serial shows "Device Ready!"

WiFi:
☐ Serial shows "WiFi connected!" 
☐ Serial shows valid IP address
☐ "STATUS" command shows "WiFi: ✓ Connected"

Fingerprint:
☐ Serial shows "Fingerprint... OK at 57600 baud"
☐ Python GUI shows "Sensor: Connected"
☐ Can enroll fingerprint successfully
☐ Can verify/match enrolled fingerprint

Attendance:
☐ Faculty can add device in web app
☐ ESP32 receives session (shows on display)
☐ Student scans finger
☐ Attendance updates immediately in web app
☐ Can see "PRESENT" status

Database:
☐ Device shows in fingerprint_devices table  
☐ Fingerprints show in fingerprint_templates table
☐ Session shows in device_sessions table
☐ Attendance records created in attendance_records table
```

---

## 📞 Support Commands

```
In Serial Monitor, type these commands:

STATUS          - Show all system status
CHECK           - Check for active session
CLEAR           - Clear all fingerprints
RESET           - Restart ESP32
BRIDGE          - Enter bridge mode for Python
```

---

## 🎯 Expected Output

### Normal Operation:
```
Serial Monitor:
[WIFI] Connected! IP: 192.168.1.100
[HEARTBEAT] Sending status...
[SESSION] Active: Mathematics
[FINGERPRINT] Finger detected!
[MATCH] ID: 1, Confidence: 95
[ATTENDANCE] Processing FP ID 1
[SUCCESS] John Doe marked present
```

### Display:
```
Startup:  "ATTENDRO"
Ready:    "ATTENDRO" / "Ready"
Session:  "Mathematics" / "Scan finger..."
Scanning: "Scanning..." / "Please wait"
Match:    "John Doe" / "PRESENT ✓"
```

---

Done! The system should now be working. If any part fails, check the troubleshooting section above.

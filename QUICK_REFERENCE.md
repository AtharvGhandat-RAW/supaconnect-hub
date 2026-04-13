# QUICK REFERENCE - ATTENDRO System

## 🔌 Wiring (Double-Check!)

```
R307 SENSOR (MUST BE 5V!)      OLED DISPLAY (3.3V)      CONNECTIONS  
─────────────────────────      ───────────────────      ─────────────
VCC →  VIN (5V)!               VCC →  3.3V              ESP32 Board
GND →  GND                      GND →  GND
TX  →  GPIO16 (RX)             SDA →  GPIO21 (I2C)
RX  →  GPIO17 (TX)             SCL →  GPIO22 (I2C)
```

❌ WRONG: R307 VCC to 3.3V - IT WON'T WORK!
✅ RIGHT: R307 VCC to VIN (5V) - ONLY WAY IT WORKS!

---

## 📝 Setup Checklist (15 minutes)

### 1️⃣ Code Update (1 min)
- [ ] Open `esp32_firmware/src/main.cpp`
- [ ] Line 16-17: Update WiFi SSID & Password
- [ ] Save file

### 2️⃣ Upload (5 min)
- [ ] Arduino IDE → Tools → Board: ESP32 Dev Module
- [ ] Tools → Port: COM3
- [ ] Upload code
- [ ] Wait for "Hard resetting..." message

### 3️⃣ Verify Boot (3 min)
- [ ] Serial Monitor → Baud: 115200
- [ ] Press RESET on ESP32
- [ ] Check for ✓ marks (Display, Fingerprint, WiFi)
- [ ] See "Device Ready!"

### 4️⃣ Bridge Mode (2 min)
- [ ] Serial Monitor: Type `BRIDGE` + Enter
- [ ] See "BRIDGE MODE ENABLED"
- [ ] **CLOSE Serial Monitor**

### 5️⃣ Python Connect (3 min)
- [ ] Run: `python fingerprint_gui.py`
- [ ] Select COM port
- [ ] Click Connect
- [ ] See "Sensor: Connected at 57600 baud"

### 6️⃣ Test Enroll (2 min)
- [ ] Enter enrollment: 101
- [ ] Click Verify → Should find student
- [ ] Click "Enroll New Fingerprint"
- [ ] Scan finger 2x
- [ ] See "Fingerprint stored"

---

## ⚡ Daily Use Workflow

### To Take Attendance with Fingerprint:

**Faculty (Web App):**
1. Go to "Take Attendance"
2. Select class & subject
3. Click "Add Device"
4. Enter: `DEVICE_001`
5. Click "Select Device"
6. Students start scanning

**Student (Device):**
1. ESP32 shows class name
2. Place finger on sensor
3. Should see "PRESENT ✓" on screen
4. LED blinks, buzzer beeps

**Verify in Web App:**
1. Attendance updates automatically (1-2 seconds)
2. Shows "PRESENT" status
3. Click "Refresh" to see latest

---

## 🔍 Quick Debug Commands

Type in Serial Monitor:

| Command | What it shows |
|---------|--------------|
| `STATUS` | WiFi, Sensor, Display, Session status |
| `CHECK` | Force check for active session |
| `CLEAR` | Delete all fingerprints from sensor |
| `RESET` | Restart ESP32 |
| `BRIDGE` | Enter bridge mode for Python |

---

## ✅ What "Working" Looks Like

**Serial Monitor shows:**
```
[WIFI] Connected! IP: 192.168.1.100
[DISPLAY] Found at 0x3C!
[FINGERPRINT] OK at 57600 baud
[DEVICE] ✓ Device updated
✓ Device Ready!
```

**Display shows:**
```
ATTENDRO    ← On startup
ATTENDRO    ← Idle
Mathematics ← When faculty takes attendance
Scan finger...
```

**Python GUI shows:**
```
Sensor: Connected at 57600 baud
```

**When student scans:**
```
[FINGERPRINT] Finger detected!
[MATCH] ID: 1, Confidence: 95
[SUCCESS] John Doe marked present
→ Web app shows "PRESENT" ✓
```

---

## ❌ Common Mistakes (DON'T DO!)

| Mistake | Result | Fix |
|---------|--------|-----|
| R307 to 3.3V instead of 5V | Sensor not detected | Use VIN (5V) |
| Wrong WiFi password in code | WiFi fails | Update code, re-upload |
| Serial Monitor open during Python connect | Connection fails | Close Serial Monitor |
| OLED wiring to wrong GPIO | Display blank | Check SDA→21, SCL→22 |
| Not scanning finger firmly | "Image conversion failed" | Press harder, 2 seconds |

---

## 📱 File Structure

```
ATTENDRO/
├── esp32_firmware/
│   └── src/main.cpp          ← Update WiFi here!
├── python_enrollment/
│   ├── fingerprint_gui.py     ← Run this for enrollment
│   └── requirements.txt
├── STARTUP_GUIDE.md          ← Full troubleshooting
├── HARDWARE_SETUP.md         ← Wiring diagrams
└── README.md
```

---

## 📞 If Something Doesn't Work

1. **Check Serial Monitor** (Tools → Serial Monitor)
   - Baud rate must be 115200
   - Should see [INIT], [DISPLAY], [FINGERPRINT], [WIFI] all with ✓

2. **Run `STATUS` command** in Serial Monitor
   - Shows what's broken with ✓ or ✗

3. **Check Wiring** again
   - R307: VCC→VIN(5V), GND→GND, TX→GPIO16, RX→GPIO17
   - OLED: VCC→3.3V, GND→GND, SDA→GPIO21, SCL→GPIO22

4. **Restart Everything**
   - Press RESET on ESP32
   - Close and reopen Serial Monitor
   - Close Python GUI
   - Try again

---

## 🎯 Success = All Green ✅

```
✅ Display shows "ATTENDRO" on startup
✅ Serial Monitor shows "Device Ready!"
✅ Python GUI connects and shows sensor status
✅ Can enroll fingerprint successfully
✅ Student scans finger → "PRESENT" shows in 2 seconds
✅ Web app updates in real-time
```

If all ✅, your system is **WORKING PERFECTLY**! 🎉

---

**Last Updated:** 2026-04-13
**Version:** 2.0 Enhanced

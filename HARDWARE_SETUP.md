# Hardware Setup & Troubleshooting Guide

## Required Hardware
- ESP32 DevKit V1
- R307 Fingerprint Sensor
- 0.91" OLED Display (SSD1306)
- USB Cable (for ESP32)
- Jumper Wires

## Wiring Diagram

### R307 Fingerprint Sensor
```
R307 Pin    ESP32 Pin    Wire Color
──────────────────────────────────────
VCC         VIN (5V)     Red
GND         GND          Black
TX          GPIO16       Green
RX          GPIO17       White
```

### OLED Display (0.91")
```
OLED Pin    ESP32 Pin    Wire Color
──────────────────────────────────────
VCC         3.3V         Red
GND         GND          Black
SDA         GPIO21       Yellow
SCL         GPIO22       Blue
```

## Step 1: Upload ESP32 Code
1. Open Arduino IDE
2. Open `esp32_firmware/src/main.cpp`
3. Select Board: ESP32 Dev Module
4. Select Port: COM3 (or your ESP32 port)
5. Click Upload

## Step 2: Verify ESP32 is Working
1. Open Serial Monitor (Tools → Serial Monitor)
2. Set baud rate to 115200
3. Press RESET button on ESP32
4. You should see:
```
================================
ESP32 Biometric Attendance Device
================================

Initializing display... Trying address 0x3C... OK at 0x3C
Initializing fingerprint sensor... OK
  Fingerprint baud: 57600
  Stored fingerprints: 0
Connecting to WiFi: YOUR_WIFI_SSID
WiFi connected!
IP: 192.168.x.x

Device ready!
Commands: STATUS, CHECK, RESET, CLEAR, BRIDGE
```

## Step 3: Enable Bridge Mode
1. In Serial Monitor, type: `BRIDGE`
2. Press Enter
3. You should see: `Switching to bridge mode...`
4. **CLOSE Serial Monitor**

## Step 4: Connect Python GUI
1. Open Python GUI: `python fingerprint_gui.py`
2. Select COM port (should be COM3 or COM9)
3. Click Connect
4. Should show: "Sensor: Connected at 57600 baud"

## Step 5: Test Enrollment
1. Enter enrollment number: 101
2. Click "Verify" - student should be found
3. Click "Enroll New Fingerprint"
4. Place finger on sensor repeatedly
5. Should see "Fingerprint stored at ID 1"

## Common Issues & Solutions

### Issue 1: Display Shows Nothing
**Solution:**
- Check I2C wiring: SDA→GPIO21, SCL→GPIO22
- Try both address 0x3C and 0x3D
- Use USB multimeter to check 3.3V power to display

### Issue 2: Fingerprint Sensor Not Detected
**Solution:**
```
Serial Monitor → Type: STATUS
Check output shows: Sensor: Ready
```
If shows "Not found":
- Check R307 wiring: TX→GPIO16, RX→GPIO17
- Ensure R307 has 5V power (NOT 3.3V)
- Check GND connection

### Issue 3: Python GUI Won't Connect
**Solution:**
1. Type `BRIDGE` in Serial Monitor FIRST
2. Close Serial Monitor completely
3. Then connect in Python GUI
4. Don't open Serial Monitor while Python is connected

### Issue 4: Fingerprint Not Enrolling
**Solution:**
- Check R307 response noise (try wet finger)
- Press finger firmly on sensor
- Wait 2 seconds between scans
- Check Serial Monitor output for "Image captured"

### Issue 5: Attendance Not Updating
**Solution:**
1. Check WiFi is connected: `STATUS` command in Serial Monitor
2. Check Supabase credentials in code
3. Check device is registered in database
4. Monitor web app for real-time updates

## Diagnostic Commands

Type these in Serial Monitor:

```
STATUS              - Show all device info and connections
CHECK               - Check for active sessions
CLEAR               - Clear all fingerprints from sensor
BRIDGE              - Enter bridge mode for Python GUI
RESET               - Restart ESP32
```

## Expected Workflow

### Enrollment (Using Python GUI)
1. ESP32 in Bridge Mode
2. Python GUI Connected
3. Enter Student Number
4. Click "Enroll New Fingerprint"
5. Scan finger 2x
6. Fingerprint saved to ESP32 and database

### Attendance (Using Web App)
1. Faculty clicks "Take Attendance"
2. Faculty clicks "Add Device" and enters device code (DEVICE_001)
3. ESP32 receives active session
4. Student scans finger
5. Attendance updates: PRESENT in 1-2 seconds
6. Faculty sees real-time update in web app

### Troubleshooting Flow
1. Check Serial Monitor for errors
2. Run `STATUS` command
3. Check each component: Display, Sensor, WiFi
4. Check database for device registration
5. Check web app logs for API errors

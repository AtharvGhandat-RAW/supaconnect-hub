# Fingerprint Enrollment Software

Python desktop application for enrolling student fingerprints using R307 sensor.

## Features

- **GUI Application** - Modern graphical interface with real-time feedback
- **CLI Application** - Command-line interface for terminal use
- Connect to R307 fingerprint sensor via USB/Serial
- Verify students against Supabase database
- Enroll fingerprints with two-scan verification
- Sync fingerprint data to cloud database
- Verify and delete fingerprints

## Screenshots

```
┌─────────────────────────────────────────────────────────────┐
│  Fingerprint Enrollment System              ● Connected     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔌 Connection          │  📝 Enroll New Fingerprint       │
│  ─────────────────────  │  ────────────────────────────    │
│  Port: [COM3    ▼] [↻]  │  Enrollment Number:              │
│                         │  [________________] [Verify]     │
│  [    Connect    ]      │                                  │
│                         │  ┌──────────────────────────┐    │
│  Sensor: COM3           │  │ John Doe                 │    │
│  Fingerprints: 12       │  │ Roll: 15 | Class: TYCO A │    │
│                         │  └──────────────────────────┘    │
│  ⚡ Quick Actions       │                                  │
│  ─────────────────────  │       ┌─────────────┐           │
│  [🔍 Verify Fingerprint]│       │     👆      │           │
│  [📋 View Enrolled     ]│       │             │           │
│  [🗑️ Delete Single     ]│       └─────────────┘           │
│  [⚠️ Clear All         ]│                                  │
│                         │  ① First  ② Second  ③ Save     │
│                         │                                  │
│                         │  [   Start Enrollment   ]        │
├─────────────────────────┴──────────────────────────────────┤
│  📜 Activity Log                                           │
│  [10:15:23] ✅ Connected successfully! Fingerprints: 12    │
│  [10:15:45] ℹ️ Verifying student: 22CO015                  │
│  [10:15:46] ✅ Student verified: John Doe                  │
└─────────────────────────────────────────────────────────────┘
```

## Hardware Requirements

- R307 Optical Fingerprint Sensor
- USB to TTL Serial Adapter (e.g., CP2102, CH340, FTDI)

## Wiring (USB to TTL to R307)

```
USB-TTL Adapter          R307 Fingerprint
───────────────          ────────────────
TX (Green) ──────────── RX (White wire)
RX (White) ──────────── TX (Green wire)
VCC (Red)  ──────────── VCC (Red wire) - 3.3V
GND (Black) ─────────── GND (Black wire)
```

**Note:** R307 works with 3.3V. Do not connect to 5V!

## Installation

### Windows

```bash
# Install Python 3.8+ from python.org

# Install dependencies
pip install -r requirements.txt

# Run the application
python fingerprint_enrollment.py
```

### Linux/Mac

```bash
# Install Python and pip
sudo apt install python3 python3-pip  # Debian/Ubuntu
brew install python3                   # MacOS

# Install dependencies
pip3 install -r requirements.txt

# Add user to dialout group (Linux only)
sudo usermod -a -G dialout $USER
# Log out and back in

# Run the application
python3 fingerprint_enrollment.py
```

## Configuration

Edit `fingerprint_enrollment.py` and update these values:

```python
SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY"
SUPABASE_SERVICE_KEY = "YOUR_SERVICE_ROLE_KEY"
```

## Usage

### GUI Application (Recommended)

```bash
python fingerprint_gui.py
```

### CLI Application

```bash
python fingerprint_enrollment.py
```

### 1. Start the Application

```bash
python fingerprint_enrollment.py
```

### 2. Connect to Sensor

The application will auto-detect the serial port. If not found, enter manually:
- Windows: `COM3`, `COM4`, etc.
- Linux: `/dev/ttyUSB0`, `/dev/ttyACM0`
- Mac: `/dev/tty.usbserial-*`

### 3. Enroll Fingerprint

1. Select option `1` (Enroll new fingerprint)
2. Enter student's enrollment number
3. System verifies student in database
4. Place finger on sensor (1st scan)
5. Remove finger
6. Place same finger again (2nd scan)
7. Fingerprint saved to sensor and database

### 4. Verify Fingerprint

1. Select option `2` (Verify fingerprint)
2. Place finger on sensor
3. System shows match result and confidence score

### 5. Delete Fingerprint

1. Select option `3` (Delete fingerprint)
2. Enter fingerprint ID or 'all' to clear database

## Troubleshooting

### Sensor Not Found

1. Check USB cable and connections
2. Verify correct COM port / device
3. Try different USB port
4. Install USB-TTL driver if needed

### Permission Denied (Linux)

```bash
sudo usermod -a -G dialout $USER
# Then log out and log back in
```

### Fingerprints Don't Match

1. Clean the sensor surface
2. Press finger firmly but not too hard
3. Position finger consistently
4. Try different finger if problem persists

### Database Sync Failed

1. Check internet connection
2. Verify Supabase credentials
3. Ensure student exists in database
4. Check console for error details

## Database Schema

The application uses these Supabase tables:

- `students` - Student information
- `fingerprint_templates` - Maps fingerprint ID to student

## Security Notes

1. **Service Key**: Keep the service role key secure
2. **Local Storage**: Fingerprints stored on R307 sensor (not as images)
3. **Database**: Only fingerprint ID stored, not biometric data

## Integration with ESP32 Device

After enrolling fingerprints using this software:

1. Fingerprint IDs are stored on R307 sensor
2. Mappings saved to Supabase database
3. ESP32 device can verify fingerprints from same R307 sensor
4. Or load data from database to different R307 sensors

## Building Executable (Optional)

Create standalone executable using PyInstaller:

```bash
pip install pyinstaller
pyinstaller --onefile --name FingerprintEnrollment fingerprint_enrollment.py
```

Output in `dist/` folder.

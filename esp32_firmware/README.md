# ESP32 Biometric Attendance Device

Complete firmware for ESP32-based fingerprint attendance system.

## Hardware Required

| Component | Model | Quantity |
|-----------|-------|----------|
| Microcontroller | ESP32 DevKit V1 | 1 |
| Fingerprint Sensor | R307 Optical | 1 |
| OLED Display | 0.91" SSD1306 128x32 | 1 |
| Buzzer | 5V Active Buzzer (optional) | 1 |
| Jumper Wires | Male-to-Female | 10+ |

## Wiring Diagram

```
                    ESP32 DevKit V1
                   ┌───────────────┐
                   │               │
    R307 TX ──────►│ GPIO16 (RX2)  │
    R307 RX ◄──────│ GPIO17 (TX2)  │
                   │               │
    OLED SDA ─────►│ GPIO21 (SDA)  │
    OLED SCL ─────►│ GPIO22 (SCL)  │
                   │               │
    Buzzer + ─────►│ GPIO5         │
                   │               │
    3.3V ─────────►│ 3V3           │◄───── R307 VCC, OLED VCC
    GND ──────────►│ GND           │◄───── R307 GND, OLED GND, Buzzer -
                   │               │
                   └───────────────┘
```

## Detailed Wiring

### R307 Fingerprint Sensor (4 wires)

| R307 Pin | Wire Color | ESP32 Pin | Description |
|----------|------------|-----------|-------------|
| VCC | Red | 3V3 | 3.3V Power |
| GND | Black | GND | Ground |
| TX | Green | GPIO16 | Data from sensor |
| RX | White | GPIO17 | Data to sensor |

**Important:** R307 operates at 3.3V. Do NOT connect to 5V!

### OLED Display SSD1306 (4 pins)

| OLED Pin | ESP32 Pin |
|----------|-----------|
| VCC | 3V3 |
| GND | GND |
| SDA | GPIO21 |
| SCL | GPIO22 |

### Buzzer (optional)

| Buzzer | ESP32 Pin |
|--------|-----------|
| + (positive) | GPIO5 |
| - (negative) | GND |

## Software Setup

### 1. Install PlatformIO

Install VS Code with PlatformIO extension, or install PlatformIO Core CLI.

### 2. Configure Settings

Edit `src/main.cpp` and update these values:

```cpp
// WiFi Settings
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase Settings
const char* SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const char* SUPABASE_KEY = "YOUR_ANON_KEY";
const char* SUPABASE_SERVICE_KEY = "YOUR_SERVICE_KEY";

// Device Settings
const char* DEVICE_CODE = "DEVICE_001";
```

### 3. Build and Upload

```bash
cd esp32_firmware

# Build
pio run

# Upload to ESP32
pio run -t upload

# Open Serial Monitor
pio device monitor
```

## First Run Checklist

1. **Power On** - Connect ESP32 to USB power
2. **Watch Display** - You should see "BIOMETRIC ATTENDANCE"
3. **WiFi Connection** - Display shows "Connecting WiFi..."
4. **Check Serial** - Monitor shows connection status
5. **Test Sensor** - Place finger, should detect if working

## Serial Commands

Open Serial Monitor (115200 baud) and send:

| Command | Description |
|---------|-------------|
| `STATUS` | Show device status |
| `CHECK` | Check for active attendance session |
| `RESET` | Restart the device |
| `CLEAR` | Delete all fingerprints from sensor |

## How It Works

### Enrollment (using Python Software)

1. Run Python enrollment software on PC
2. Connect R307 sensor to PC via USB-TTL adapter
3. Enter student enrollment number
4. Scan finger twice
5. Fingerprint saved to sensor and database

### Taking Attendance

1. **Faculty starts session** in the web app
2. **Configures device** by entering device code
3. **Device receives** session info and shows subject name
4. **Students scan** fingerprints one by one
5. **Real-time update** - attendance marked in app instantly
6. **Display feedback** - shows student name and "PRESENT"

## Troubleshooting

### Display Not Working

1. Check I2C address (0x3C or 0x3D)
2. Verify SDA/SCL connections
3. Check 3.3V power

```cpp
// Try different address in main.cpp:
#define OLED_ADDR 0x3D  // instead of 0x3C
```

### Fingerprint Sensor Not Found

1. Check wiring (TX/RX may be swapped)
2. Verify 3.3V connection (NOT 5V!)
3. Check baud rate

```cpp
// Try different baud rate:
fpSerial.begin(9600, SERIAL_8N1, FP_RX, FP_TX);
finger.begin(9600);
```

### WiFi Not Connecting

1. Check SSID and password (case sensitive)
2. Ensure 2.4GHz network (ESP32 doesn't support 5GHz)
3. Move closer to router

### No Response from Sensor

Test with simple code:

```cpp
void setup() {
    Serial.begin(115200);
    Serial2.begin(57600, SERIAL_8N1, 16, 17);

    Serial.println("Testing R307...");

    // Send test packet
    uint8_t packet[] = {0xEF, 0x01, 0xFF, 0xFF, 0xFF, 0xFF, 0x01, 0x00, 0x03, 0x01, 0x00, 0x05};
    Serial2.write(packet, sizeof(packet));

    delay(500);

    while (Serial2.available()) {
        Serial.print(Serial2.read(), HEX);
        Serial.print(" ");
    }
    Serial.println();
}

void loop() {}
```

## LED Indicators

| Pattern | Meaning |
|---------|---------|
| Single flash | Success operation |
| 3 quick flashes | Error occurred |
| Continuous blink | Processing |

## Power Requirements

- **Operating Voltage:** 3.3V
- **Current Draw:**
  - Idle: ~80mA
  - Scanning: ~120mA
  - WiFi active: ~150mA
- **Recommended:** 5V/1A USB power adapter

## Enclosure Suggestions

For a complete device:
1. 3D print a case (design files coming soon)
2. Use a standard project box (100x60x25mm)
3. Cut holes for sensor and display

## Production Checklist

- [ ] Configure WiFi credentials
- [ ] Configure Supabase credentials
- [ ] Set unique DEVICE_CODE for each device
- [ ] Test enrollment with Python software
- [ ] Test attendance flow with web app
- [ ] Secure enclosure
- [ ] Label with device code

/**
 * ESP32 Biometric Attendance Device
 * Configuration File
 *
 * IMPORTANT: Copy this file to config_local.h and update with your credentials
 */

#ifndef CONFIG_H
#define CONFIG_H

// ============ WiFi Configuration ============
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ============ Supabase Configuration ============
#define SUPABASE_URL "https://YOUR_PROJECT.supabase.co"
#define SUPABASE_ANON_KEY "YOUR_SUPABASE_ANON_KEY"
#define SUPABASE_SERVICE_KEY "YOUR_SERVICE_ROLE_KEY"  // Used for device operations

// ============ Device Configuration ============
#define DEVICE_CODE "DEVICE_001"  // Unique device identifier
#define DEVICE_NAME "Attendance Device 1"

// ============ Hardware Pin Configuration ============
// R307 Fingerprint Sensor (UART2)
#define FP_RX_PIN 16      // ESP32 RX <- R307 TX (Green wire)
#define FP_TX_PIN 17      // ESP32 TX -> R307 RX (White wire)

// OLED Display (I2C)
#define OLED_SDA 21       // I2C Data
#define OLED_SCL 22       // I2C Clock
#define OLED_ADDRESS 0x3C // SSD1306 I2C address (try 0x3D if 0x3C doesn't work)
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32  // 0.91" OLED is typically 128x32

// LED Indicators
#define LED_SUCCESS 2     // Green LED (built-in LED on most ESP32)
#define LED_ERROR 4       // Red LED (optional external)
#define BUZZER_PIN 5      // Buzzer for feedback (optional)

// ============ Fingerprint Sensor Settings ============
#define FP_BAUD_RATE 57600
#define FP_MAX_TEMPLATES 127  // R307 supports 127 fingerprints
#define FP_CONFIDENCE_THRESHOLD 50  // Minimum confidence for match

// ============ Operation Timeouts ============
#define WIFI_CONNECT_TIMEOUT 15000    // 15 seconds
#define FP_CAPTURE_TIMEOUT 10000      // 10 seconds
#define API_REQUEST_TIMEOUT 10000     // 10 seconds
#define DISPLAY_MESSAGE_DURATION 2000 // 2 seconds

// ============ Operating Modes ============
typedef enum {
    MODE_IDLE,            // Waiting for command
    MODE_ENROLL,          // Fingerprint enrollment
    MODE_VERIFY,          // Verify enrollment no
    MODE_ATTENDANCE,      // Taking attendance
    MODE_CONFIG,          // Configuration mode
    MODE_ERROR            // Error state
} DeviceMode;

// ============ Status Codes ============
typedef enum {
    STATUS_OK = 0,
    STATUS_ERROR_WIFI,
    STATUS_ERROR_SERVER,
    STATUS_ERROR_FP_SENSOR,
    STATUS_ERROR_NO_MATCH,
    STATUS_ERROR_TIMEOUT,
    STATUS_ERROR_INVALID_ENROLLMENT,
    STATUS_ERROR_ALREADY_ENROLLED,
    STATUS_ERROR_NOT_CONFIGURED
} StatusCode;

#endif // CONFIG_H

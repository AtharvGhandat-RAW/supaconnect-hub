/**
 * ATTENDRO - ESP32 Biometric Attendance Device
 * Production-Ready Version 3.0
 *
 * Features:
 * - Reliable WiFi connectivity with auto-reconnect
 * - Real-time session detection from web app
 * - Fingerprint matching with Supabase integration
 * - Live attendance updates
 * - OLED status display
 * - LED and buzzer feedback
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_Fingerprint.h>

// ==================== CONFIGURATION ====================
// Update these with your credentials
const char* WIFI_SSID = "Phone";
const char* WIFI_PASSWORD = "999999999";

const char* SUPABASE_URL = "https://gphcfejuurygcetmtpec.supabase.co";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODM0ODAsImV4cCI6MjA4MDM1OTQ4MH0.NrHmxfRMW3E2SdiMEfNwbozGG36xpG1jroQB0dy3s5E";
const char* SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4MzQ4MCwiZXhwIjoyMDgwMzU5NDgwfQ.EuzI5mIV6nu5H6mC3QYkQsbmdkqLEXuWIZlf2oiqZ7g";

// Device Configuration (set in web app, then device uses this code)
const char* DEVICE_CODE = "DEVICE_001";
const char* DEVICE_NAME = "Attendance Device 1";

// ==================== PIN DEFINITIONS ====================
#define FP_RX 16           // Fingerprint RX pin
#define FP_TX 17           // Fingerprint TX pin
#define OLED_SDA 21        // OLED SDA pin
#define OLED_SCL 22        // OLED SCL pin
#define LED_PIN 2          // Status LED
#define BUZZER_PIN 5       // Buzzer pinaca

// ==================== DISPLAY SETUP ====================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ==================== FINGERPRINT SETUP ====================
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

// ==================== STATUS VARIABLES ====================
bool wifiConnected = false;
bool sensorReady = false;
bool displayReady = false;

String deviceId = "";
String currentSessionId = "";
String currentAttendanceSessionId = "";
bool sessionActive = false;
bool deviceRegistered = false;

unsigned long lastHeartbeat = 0;
unsigned long lastSessionCheck = 0;
unsigned long lastWiFiCheck = 0;
unsigned long lastDisplayUpdate = 0;

const unsigned long HEARTBEAT_INTERVAL = 30000;      // 30 seconds
const unsigned long SESSION_CHECK_INTERVAL = 5000;   // 5 seconds (faster)
const unsigned long WIFI_CHECK_INTERVAL = 5000;      // 5 seconds
const unsigned long DISPLAY_UPDATE_INTERVAL = 1000;  // 1 second

// ==================== FUNCTION DECLARATIONS ====================
void setupDisplay();
void setupFingerprint();
void setupWiFi();
void showStatus(const char* line1, const char* line2 = "");
void beep(int ms = 100);
void handleFingerprint();
void processAttendance(int fingerprintId);
void registerDevice();
void sendHeartbeat();
void checkActiveSession();
String makeApiRequest(const char* method, String endpoint, String body = "");
void handleCommand(String cmd);

// ==================== SETUP ====================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n\n══════════════════════════════════════");
    Serial.println("  ATTENDRO v3.0 - Attendance Device");
    Serial.println("══════════════════════════════════════\n");

    // Initialize pins
    pinMode(LED_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    // Initialize I2C for OLED
    Serial.print("[INIT] Starting I2C...");
    Wire.begin(OLED_SDA, OLED_SCL);
    Wire.setClock(400000);
    delay(100);
    Serial.println(" OK");

    // Setup components
    setupDisplay();
    setupFingerprint();
    setupWiFi();

    Serial.println("\n\n✓ Device Initialized!\n");
    Serial.println("Commands: STATUS, CHECK, VERIFY, RESET, BRIDGE, CLEAR");
    Serial.println("Type in Serial Monitor to use commands\n");
}

// ==================== MAIN LOOP ====================
void loop() {
    // Handle serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        cmd.toUpperCase();
        if (cmd.length() > 0) {
            handleCommand(cmd);
        }
    }

    // WiFi maintenance
    unsigned long now = millis();

    if (now - lastWiFiCheck > WIFI_CHECK_INTERVAL) {
        if (WiFi.status() != WL_CONNECTED) {
            if (wifiConnected) {
                wifiConnected = false;
                Serial.println("[WIFI] Connection lost, reconnecting...");
            }
            WiFi.reconnect();
        } else if (!wifiConnected) {
            wifiConnected = true;
            Serial.printf("[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        }
        lastWiFiCheck = now;
    }

    // Periodic tasks (only if WiFi connected)
    if (wifiConnected) {
        if (now - lastSessionCheck > SESSION_CHECK_INTERVAL) {
            checkActiveSession();
            lastSessionCheck = now;
        }

        if (now - lastHeartbeat > HEARTBEAT_INTERVAL) {
            sendHeartbeat();
            lastHeartbeat = now;
        }
    }

    // Fingerprint detection
    if (sensorReady && sessionActive) {
        handleFingerprint();
    }

    delay(50);
}

// ==================== DISPLAY FUNCTIONS ====================
void setupDisplay() {
    Serial.print("[DISPLAY] Initializing...");

    uint8_t addresses[] = {0x3C, 0x3D};
    bool found = false;

    for (uint8_t addr : addresses) {
        if (display.begin(SSD1306_SWITCHCAPVCC, addr)) {
            displayReady = true;
            found = true;
            Serial.printf(" OK at 0x%02X\n", addr);

            display.clearDisplay();
            display.setTextSize(2);
            display.setTextColor(SSD1306_WHITE);
            display.setCursor(15, 8);
            display.println("ATTENDRO");
            display.display();
            delay(1500);
            break;
        }
    }

    if (!found) {
        Serial.println(" FAILED!");
        Serial.println("  Check: SDA→GPIO21, SCL→GPIO22, VCC→3.3V, GND→GND");
        displayReady = false;
    }
}

void showStatus(const char* line1, const char* line2) {
    if (!displayReady) return;

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);

    display.setCursor(0, 0);
    display.println(line1);

    if (line2 != NULL && strlen(line2) > 0) {
        display.setCursor(0, 20);
        display.println(line2);
    }

    display.display();
}

// ==================== FINGERPRINT FUNCTIONS ====================
void setupFingerprint() {
    Serial.print("[FINGERPRINT] Detecting sensor...");

    const uint32_t baudRates[] = {57600, 115200, 38400};

    for (uint32_t baud : baudRates) {
        fpSerial.begin(baud, SERIAL_8N1, FP_RX, FP_TX);
        delay(120);
        finger.begin(baud);
        delay(100);

        if (finger.verifyPassword()) {
            sensorReady = true;
            finger.getTemplateCount();
            Serial.printf(" OK at %d baud\n", baud);
            Serial.printf("[FINGERPRINT] Enrolled templates: %d\n", finger.templateCount);
            return;
        }
    }

    Serial.println(" FAILED!");
    Serial.println("  Check: TX→GPIO16, RX→GPIO17, VCC→5V, GND→GND");
    sensorReady = false;
}

void handleFingerprint() {
    uint8_t result = finger.getImage();

    // No finger detected
    if (result != FINGERPRINT_OK) {
        delay(100);
        return;
    }

    // Finger detected - show scanning
    if (displayReady) {
        showStatus("Scanning...", "Please wait");
    }
    Serial.println("[FP] Finger detected, processing...");

    // Convert image to template
    result = finger.image2Tz();
    if (result != FINGERPRINT_OK) {
        Serial.println("[FP] Error: Image conversion failed");
        showStatus("Error", "Image failed");
        delay(1500);
        return;
    }

    // Search for match in database
    result = finger.fingerSearch();

    if (result == FINGERPRINT_OK && finger.confidence >= 50) {
        Serial.printf("[FP] MATCH! ID=%d, Confidence=%d\n", finger.fingerID, finger.confidence);
        processAttendance(finger.fingerID);
    } else {
        Serial.printf("[FP] No match (result=%d, confidence=%d)\n", result, finger.confidence);
        showStatus("Not Found", "Please enroll");

        // Error beep
        digitalWrite(LED_PIN, HIGH);
        beep(100);
        beep(100);
        digitalWrite(LED_PIN, LOW);
        delay(1500);
    }

    // Wait for finger removal
    unsigned long timeout = millis();
    while (finger.getImage() != FINGERPRINT_NOFINGER && millis() - timeout < 5000) {
        delay(100);
    }

    delay(500);
    showStatus("ATTENDRO", "Ready");
}

void processAttendance(int fingerprintId) {
    if (!wifiConnected) {
        showStatus("No WiFi", "Error");
        Serial.println("[ERROR] WiFi not connected");
        delay(2000);
        showStatus("ATTENDRO", "Ready");
        return;
    }

    if (!sessionActive) {
        showStatus("No Session", "Active");
        Serial.println("[ERROR] No active session");
        delay(2000);
        showStatus("ATTENDRO", "Ready");
        return;
    }

    Serial.printf("[ATTENDANCE] Processing fingerprint ID: %d\n", fingerprintId);

    // Step 1: Get student from fingerprint template
    String getStudentEndpoint = String("fingerprint_templates?fingerprint_id=eq.") +
                                String(fingerprintId) +
                                "&select=student_id,students(id,name,enrollment_no)";

    String studentResponse = makeApiRequest("GET", getStudentEndpoint);

    if (studentResponse.length() < 3) {
        showStatus("Not Found", "DB Error");
        Serial.println("[ERROR] Fingerprint not in database");
        digitalWrite(LED_PIN, HIGH);
        beep(100);
        beep(100);
        digitalWrite(LED_PIN, LOW);
        delay(2000);
        showStatus("ATTENDRO", "Ready");
        return;
    }

    // Parse student data
    JsonDocument doc;
    deserializeJson(doc, studentResponse);

    if (doc.size() == 0) {
        showStatus("Error", "Parse failed");
        Serial.println("[ERROR] Failed to parse JSON");
        delay(2000);
        showStatus("ATTENDRO", "Ready");
        return;
    }

    const char* studentId = doc[0]["student_id"];
    const char* studentName = doc[0]["students"]["name"];
    const char* enrollmentNo = doc[0]["students"]["enrollment_no"];

    Serial.printf("[STUDENT] Name: %s, ID: %s, Enrollment: %s\n", studentName, studentId, enrollmentNo);

    // Step 2: Mark attendance as PRESENT
    String attendancePayload = String("{") +
                              "\"session_id\":\"" + currentAttendanceSessionId + "\"," +
                              "\"student_id\":\"" + String(studentId) + "\"," +
                              "\"status\":\"PRESENT\"," +
                              "\"remarks\":\"Fingerprint verified\"" +
                              "}";

    Serial.printf("[ATTENDANCE] Updating: %s\n", attendancePayload.c_str());

    String attendanceResponse = makeApiRequest("POST", "attendance_records", attendancePayload);

    // Check if update was successful
    if (attendanceResponse.indexOf("error") == -1) {
        Serial.printf("[SUCCESS] %s marked PRESENT!\n", studentName);
        showStatus(studentName, "PRESENT ✓");

        // Success feedback
        digitalWrite(LED_PIN, HIGH);
        beep(200);
        delay(100);
        beep(200);
        digitalWrite(LED_PIN, LOW);
        delay(2000);
    } else {
        Serial.println("[ERROR] Attendance update failed!");
        Serial.println(attendanceResponse);
        showStatus("Error", "Update failed");

        // Error feedback
        digitalWrite(LED_PIN, HIGH);
        for (int i = 0; i < 3; i++) {
            beep(100);
            delay(100);
        }
        digitalWrite(LED_PIN, LOW);
        delay(2000);
    }

    showStatus("ATTENDRO", "Ready");
}

// ==================== WIFI & API FUNCTIONS ====================
void setupWiFi() {
    Serial.printf("[WIFI] Connecting to '%s'...\n", WIFI_SSID);
    showStatus("WiFi", "Connecting...");

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 25) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.printf("[WIFI] ✓ Connected\n");
        Serial.printf("[WIFI] IP Address: %s\n", WiFi.localIP().toString().c_str());
        showStatus("WiFi", "Connected!");
        delay(1500);
    } else {
        Serial.println("[WIFI] ✗ Connection failed");
        Serial.println("  Check SSID and password in code");
        wifiConnected = false;
        showStatus("WiFi", "Failed");
        delay(2000);
    }
}

void registerDevice() {
    if (!wifiConnected) return;

    Serial.println("[DEVICE] Registering with Supabase...");

    String checkEndpoint = String("fingerprint_devices?device_code=eq.") + DEVICE_CODE + "&select=id";
    String checkResponse = makeApiRequest("GET", checkEndpoint);

    JsonDocument checkDoc;
    deserializeJson(checkDoc, checkResponse);

    String body = String("{") +
                 "\"device_code\":\"" + DEVICE_CODE + "\"," +
                 "\"device_name\":\"" + DEVICE_NAME + "\"," +
                 "\"status\":\"ACTIVE\"," +
                 "\"firmware_version\":\"3.0\"," +
                 "\"last_seen_at\":\"now()\"" +
                 "}";

    if (checkDoc.size() > 0) {
        // Device exists - update it
        deviceId = checkDoc[0]["id"].as<String>();
        String updateEndpoint = String("fingerprint_devices?id=eq.") + deviceId;
        makeApiRequest("PATCH", updateEndpoint, body);
        Serial.println("[DEVICE] ✓ Updated existing device");
    } else {
        // Device doesn't exist - create it
        makeApiRequest("POST", "fingerprint_devices", body);
        Serial.println("[DEVICE] ✓ Registered new device");
    }

    deviceRegistered = true;
}

void sendHeartbeat() {
    if (!wifiConnected || !deviceRegistered) return;

    String endpoint = String("fingerprint_devices?device_code=eq.") + DEVICE_CODE;
    String body = String("{\"last_seen_at\":\"now()\",\"status\":\"ACTIVE\"}");

    String response = makeApiRequest("PATCH", endpoint, body);

    if (response.indexOf("error") == -1) {
        Serial.println("[HEARTBEAT] ✓ Sent");
    }
}

void checkActiveSession() {
    if (!wifiConnected || !deviceRegistered) return;

    // Get device ID first
    String devEndpoint = String("fingerprint_devices?device_code=eq.") + DEVICE_CODE + "&select=id";
    String devResponse = makeApiRequest("GET", devEndpoint);

    JsonDocument devDoc;
    deserializeJson(devDoc, devResponse);

    if (devDoc.size() == 0) {
        if (sessionActive) {
            sessionActive = false;
            currentSessionId = "";
            showStatus("ATTENDRO", "No session");
        }
        return;
    }

    deviceId = devDoc[0]["id"].as<String>();

    // Check for active session for this device
    String sessEndpoint = String("device_sessions?device_id=eq.") + deviceId +
                         "&session_status=eq.ACTIVE" +
                         "&select=id,attendance_session_id,subjects(name)";

    String sessResponse = makeApiRequest("GET", sessEndpoint);

    JsonDocument sessDoc;
    deserializeJson(sessDoc, sessResponse);

    if (sessDoc.size() > 0) {
        // Active session found
        String newSessionId = sessDoc[0]["id"].as<String>();
        String newAttendanceSessionId = sessDoc[0]["attendance_session_id"].as<String>();
        const char* subjectName = sessDoc[0]["subjects"]["name"];

        if (newSessionId != currentSessionId) {
            // New session
            currentSessionId = newSessionId;
            currentAttendanceSessionId = newAttendanceSessionId;
            sessionActive = true;

            Serial.printf("[SESSION] ✓ ACTIVE: %s\n", subjectName);
            showStatus(subjectName, "Scan finger...");

            // Session start feedback
            beep(100);
            delay(100);
            beep(100);
        }
    } else {
        // No active session
        if (sessionActive) {
            sessionActive = false;
            currentSessionId = "";
            currentAttendanceSessionId = "";
            Serial.println("[SESSION] ✗ No active session");
            showStatus("ATTENDRO", "Ready");
        }
    }
}

String makeApiRequest(const char* method, String endpoint, String body) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[API] Error: WiFi not connected");
        return "{}";
    }

    HTTPClient http;
    String url = String(SUPABASE_URL) + "/rest/v1/" + endpoint;

    if (!http.begin(url)) {
        Serial.printf("[API] Error: Failed to begin request to %s\n", url.c_str());
        return "{}";
    }

    // Set headers
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_SERVICE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_SERVICE_KEY);
    http.addHeader("Prefer", "return=representation");
    http.setTimeout(8000);

    int httpCode = -1;

    if (strcmp(method, "GET") == 0) {
        httpCode = http.GET();
    } else if (strcmp(method, "POST") == 0) {
        httpCode = http.POST(body);
    } else if (strcmp(method, "PATCH") == 0) {
        httpCode = http.PATCH(body);
    } else if (strcmp(method, "DELETE") == 0) {
        httpCode = http.sendRequest("DELETE");
    }

    String response = "";

    if (httpCode > 0) {
        response = http.getString();

        if (httpCode >= 200 && httpCode < 300) {
            // Success
            Serial.printf("[API] %s %s -> %d\n", method, endpoint.c_str(), httpCode);
        } else {
            // Error
            Serial.printf("[API] ERROR %d: %s\n", httpCode, url.c_str());
            Serial.println("[API] Response: " + response);
        }
    } else {
        Serial.printf("[API] ERROR: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
    return response;
}

// ==================== COMMAND HANDLING ====================
void handleCommand(String cmd) {
    Serial.println("[CMD] Processing: " + cmd);

    if (cmd == "STATUS") {
        Serial.println("\n╔════════ DEVICE STATUS ════════╗");
        Serial.printf("║ WiFi: %s\n", wifiConnected ? "✓ Connected" : "✗ Disconnected");
        if (wifiConnected) {
            Serial.printf("║ IP: %s\n", WiFi.localIP().toString().c_str());
        }
        Serial.printf("║ Sensor: %s\n", sensorReady ? "✓ Ready" : "✗ Not found");
        Serial.printf("║ Display: %s\n", displayReady ? "✓ Ready" : "✗ Not found");
        Serial.printf("║ Device Registered: %s\n", deviceRegistered ? "✓ Yes" : "✗ No");
        Serial.printf("║ Session: %s\n", sessionActive ? "✓ ACTIVE" : "✗ Inactive");
        if (sensorReady) {
            finger.getTemplateCount();
            Serial.printf("║ Fingerprints: %d enrolled\n", finger.templateCount);
        }
        Serial.println("╚═════════════════════════════════╝\n");
    }
    else if (cmd == "CHECK") {
        checkActiveSession();
    }
    else if (cmd == "VERIFY") {
        Serial.println("[CMD] Verifying fingerprint sensor...");
        if (sensorReady) {
            if (finger.verifyPassword()) {
                Serial.println("[CMD] ✓ Sensor responsive");
            } else {
                Serial.println("[CMD] ✗ Sensor not responding");
            }
        } else {
            Serial.println("[CMD] ✗ Sensor not initialized");
        }
    }
    else if (cmd == "REGISTER") {
        registerDevice();
    }
    else if (cmd == "RESET") {
        Serial.println("[CMD] Restarting device...");
        delay(500);
        ESP.restart();
    }
    else if (cmd == "CLEAR") {
        if (sensorReady) {
            Serial.println("[CMD] Clearing fingerprint database...");
            finger.emptyDatabase();
            Serial.println("[CMD] ✓ Database cleared");
        } else {
            Serial.println("[CMD] ✗ Sensor not ready");
        }
    }
    else if (cmd == "BRIDGE") {
        Serial.println("[CMD] Entering BRIDGE MODE");
        Serial.println("[CMD] ESP32 is now transparent to R307");
        Serial.println("[CMD] Type 'RESET' to exit\n");

        // Bridge mode: forward all data between Serial and R307
        fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
        while (true) {
            if (Serial.available()) {
                fpSerial.write(Serial.read());
            }
            if (fpSerial.available()) {
                Serial.write(fpSerial.read());
            }
            delay(2);
        }
    }
    else {
        Serial.println("[CMD] Unknown command!");
        Serial.println("Available: STATUS, CHECK, VERIFY, REGISTER, RESET, CLEAR, BRIDGE");
    }
}

void beep(int ms) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(ms);
    digitalWrite(BUZZER_PIN, LOW);
}

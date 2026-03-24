/**
 * ESP32 Biometric Attendance Device - Complete Working Code
 *
 * Hardware:
 * - ESP32 DevKit V1 or similar
 * - R307 Fingerprint Sensor (connected to Serial2)
 * - 0.91" OLED Display SSD1306 (I2C)
 *
 * Wiring:
 * R307:
 *   - VCC (Red)    -> 5V (VIN)
 *   - GND (Black)  -> GND
 *   - TX (Green)   -> GPIO16 (RX2)
 *   - RX (White)   -> GPIO17 (TX2)
 *
 * OLED:
 *   - VCC -> 3.3V
 *   - GND -> GND
 *   - SDA -> GPIO21
 *   - SCL -> GPIO22
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
// WiFi Settings - UPDATE THESE
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Supabase Settings
const char* SUPABASE_URL = "https://gphcfejuurygcetmtpec.supabase.co";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODM0ODAsImV4cCI6MjA4MDM1OTQ4MH0.NrHmxfRMW3E2SdiMEfNwbozGG36xpG1jroQB0dy3s5E";
const char* SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4MzQ4MCwiZXhwIjoyMDgwMzU5NDgwfQ.EuzI5mIV6nu5H6mC3QYkQsbmdkqLEXuWIZlf2oiqZ7g";

// Device Settings
const char* DEVICE_CODE = "DEVICE_001";
const char* DEVICE_NAME = "Attendance Device 1";

// ==================== PIN DEFINITIONS ====================
#define FP_RX 16          // R307 TX -> ESP32 RX
#define FP_TX 17          // R307 RX -> ESP32 TX
#define OLED_SDA 21       // OLED Data
#define OLED_SCL 22       // OLED Clock
#define LED_PIN 2         // Built-in LED
#define BUZZER_PIN 5      // Optional buzzer
#define BOOT_PIN 0        // Hold BOOT at startup for PC software bridge mode

// ==================== DISPLAY SETUP ====================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32
#define OLED_ADDR 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ==================== FINGERPRINT SETUP ====================
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

// ==================== GLOBAL VARIABLES ====================
bool wifiConnected = false;
bool sensorReady = false;
bool displayReady = false;

String currentSessionId = "";
String currentClassId = "";
String currentSubjectId = "";
String currentSubjectName = "";
String currentClassName = "";
bool sessionActive = false;
bool deviceRegistered = false;
bool bridgeMode = false;

unsigned long lastHeartbeat = 0;
unsigned long lastSessionCheck = 0;
unsigned long lastWiFiReconnectAttempt = 0;

const unsigned long HEARTBEAT_INTERVAL_MS = 30000;
const unsigned long SESSION_CHECK_INTERVAL_MS = 10000;
const unsigned long WIFI_RECONNECT_INTERVAL_MS = 10000;
const unsigned long FINGER_RELEASE_TIMEOUT_MS = 5000;

// ==================== FUNCTION DECLARATIONS ====================
void setupDisplay();
void setupFingerprint();
void setupWiFi();
void maintainWiFiConnection();
void registerDevice();
void sendHeartbeat();
String getTimestamp();
void checkActiveSession();
void handleFingerprint();
void processAttendance(int fingerprintId);
bool markAttendance(String sessionId, String studentId);
void handleCommand(String cmd);
String makeApiRequest(const char* method, String endpoint, String body = "");
void showMessage(const char* line1, const char* line2 = "");
void showStudentInfo(const char* name, const char* className);
void showSuccess(const char* message);
void showError(const char* message);
void showReady();
void beep(int duration = 100);
void runFingerprintBridge();

// ==================== SETUP ====================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n================================");
    Serial.println("ESP32 Biometric Attendance Device");
    Serial.println("================================\n");

    // Initialize pins
    pinMode(LED_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(BOOT_PIN, INPUT_PULLUP);
    digitalWrite(LED_PIN, LOW);

    // Bridge mode lets PC enrollment software talk directly to R307 via ESP32 USB serial.
    if (digitalRead(BOOT_PIN) == LOW) {
        bridgeMode = true;
        fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
        Serial.println("\nBridge mode enabled (PC <-> R307)");
        Serial.println("Open enrollment software on this COM port at 57600 baud");
        return;
    }

    // Initialize I2C for OLED
    Wire.begin(OLED_SDA, OLED_SCL);

    // Setup components
    setupDisplay();
    setupFingerprint();
    setupWiFi();

    if (wifiConnected) {
        registerDevice();
        checkActiveSession();
    }

    showReady();

    Serial.println("\nDevice ready!");
    Serial.println("Commands: STATUS, CHECK, RESET, CLEAR, BRIDGE");
    Serial.println("Tip: Hold BOOT while reset/power-on to enter bridge mode for PC software\n");
}

// ==================== MAIN LOOP ====================
void loop() {
    if (bridgeMode) {
        runFingerprintBridge();
        return;
    }

    // Handle serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        cmd.toUpperCase();
        handleCommand(cmd);
    }

    // Periodic tasks
    unsigned long now = millis();
    maintainWiFiConnection();

    // Heartbeat every 30 seconds
    if (wifiConnected && now - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
        sendHeartbeat();
        lastHeartbeat = now;
    }

    // Check for session every 10 seconds
    if (wifiConnected && now - lastSessionCheck > SESSION_CHECK_INTERVAL_MS) {
        checkActiveSession();
        lastSessionCheck = now;
    }

    // Handle fingerprint scanning
    if (sensorReady) {
        handleFingerprint();
    }

    delay(50);
}

// ==================== DISPLAY FUNCTIONS ====================
void setupDisplay() {
    Serial.print("Initializing display... ");

    if (display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
        displayReady = true;
        display.clearDisplay();
        display.setTextSize(1);
        display.setTextColor(SSD1306_WHITE);
        display.setCursor(20, 8);
        display.println(F("BIOMETRIC"));
        display.setCursor(20, 20);
        display.println(F("ATTENDANCE"));
        display.display();
        Serial.println("OK");
    } else {
        Serial.println("FAILED!");
    }
}

void showMessage(const char* line1, const char* line2) {
    if (!displayReady) return;
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 6);
    display.println(line1);
    if (line2 && strlen(line2) > 0) {
        display.setCursor(0, 20);
        display.println(line2);
    }
    display.display();
}

void showStudentInfo(const char* name, const char* className) {
    if (!displayReady) return;
    display.clearDisplay();
    display.setTextSize(1);

    // Truncate name if needed
    String nameStr = String(name);
    if (nameStr.length() > 20) {
        nameStr = nameStr.substring(0, 17) + "...";
    }

    display.setCursor(0, 0);
    display.println(nameStr);
    display.setCursor(0, 12);
    display.println(className);
    display.setTextSize(2);
    display.setCursor(0, 22);
    display.println(F("PRESENT"));
    display.display();
}

void showSuccess(const char* message) {
    if (!displayReady) return;
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 6);
    display.println(F("SUCCESS"));
    display.setCursor(0, 20);
    display.println(message);
    display.display();

    digitalWrite(LED_PIN, HIGH);
    beep(200);
    delay(200);
    digitalWrite(LED_PIN, LOW);
}

void showError(const char* message) {
    if (!displayReady) return;
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 6);
    display.println(F("ERROR"));
    display.setCursor(0, 20);
    display.println(message);
    display.display();

    for (int i = 0; i < 3; i++) {
        digitalWrite(LED_PIN, HIGH);
        beep(50);
        delay(100);
        digitalWrite(LED_PIN, LOW);
        delay(100);
    }
}

void showReady() {
    if (sessionActive) {
        showMessage(currentSubjectName.c_str(), "Place finger...");
    } else {
        char buf[32];
        snprintf(buf, sizeof(buf), "Device: %s", DEVICE_CODE);
        showMessage(buf, "Ready");
    }
}

// ==================== FINGERPRINT FUNCTIONS ====================
void setupFingerprint() {
    Serial.print("Initializing fingerprint sensor... ");

    const uint32_t baudRates[] = {57600, 115200, 38400};
    const size_t baudCount = sizeof(baudRates) / sizeof(baudRates[0]);

    for (size_t i = 0; i < baudCount; i++) {
        uint32_t baud = baudRates[i];

        fpSerial.begin(baud, SERIAL_8N1, FP_RX, FP_TX);
        delay(120);

        finger.begin(baud);
        delay(120);

        if (finger.verifyPassword()) {
            sensorReady = true;
            Serial.println("OK");
            Serial.print("  Fingerprint baud: ");
            Serial.println(baud);
            Serial.print("  Stored fingerprints: ");
            finger.getTemplateCount();
            Serial.println(finger.templateCount);
            break;
        }
    }

    if (!sensorReady) {
        Serial.println("FAILED!");
        Serial.println("  1) Power R307 from VIN(5V), not 3.3V");
        Serial.println("  2) Check TX->GPIO16 and RX->GPIO17");
        Serial.println("  3) Disconnect other tools from same COM port");
    }
}

void handleFingerprint() {
    // Check for finger
    uint8_t result = finger.getImage();

    if (result != FINGERPRINT_OK) {
        return; // No finger detected
    }

    Serial.println("Finger detected, processing...");

    // Convert image to template
    result = finger.image2Tz();
    if (result != FINGERPRINT_OK) {
        Serial.println("Image conversion failed");
        return;
    }

    // Search for match
    result = finger.fingerSearch();

    if (result == FINGERPRINT_OK) {
        Serial.print("Match found! ID: ");
        Serial.print(finger.fingerID);
        Serial.print(", Confidence: ");
        Serial.println(finger.confidence);

        if (finger.confidence >= 50) {
            // Get student info and mark attendance
            processAttendance(finger.fingerID);
        } else {
            showError("Low confidence");
        }
    } else {
        Serial.println("No match found");
        showMessage("Not Registered!", "Enroll first");
        beep(100);
        delay(100);
        beep(100);
    }

    // Wait for finger removal
    unsigned long startWait = millis();
    while (finger.getImage() != FINGERPRINT_NOFINGER && (millis() - startWait) < FINGER_RELEASE_TIMEOUT_MS) {
        delay(50);
    }
    delay(500);
    showReady();
}

void processAttendance(int fingerprintId) {
    if (!wifiConnected) {
        showError("No WiFi!");
        return;
    }

    showMessage("Verifying...", "");

    // Get student by fingerprint ID
    String endpoint = "fingerprint_templates?fingerprint_id=eq." + String(fingerprintId) +
                     "&select=student_id,students(id,name,enrollment_no,classes(name,division))";

    String response = makeApiRequest("GET", endpoint);

    if (response.length() < 3) {
        showError("Student not found");
        return;
    }

    // Parse response
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, response);

    if (error || doc.size() == 0) {
        showError("Parse error");
        return;
    }

    JsonObject template_obj = doc[0];
    if (!template_obj.containsKey("students") || template_obj["students"].isNull()) {
        showError("No student data");
        return;
    }

    JsonObject student = template_obj["students"];
    String studentId = student["id"].as<String>();
    String studentName = student["name"].as<String>();
    String className = "";

    if (student.containsKey("classes") && !student["classes"].isNull()) {
        className = String(student["classes"]["name"].as<const char*>()) + " " +
                   String(student["classes"]["division"].as<const char*>());
    }

    Serial.print("Student: ");
    Serial.println(studentName);

    // If session is active, mark attendance
    if (sessionActive && currentSessionId.length() > 0) {
        bool success = markAttendance(currentSessionId, studentId);
        if (success) {
            showStudentInfo(studentName.c_str(), className.c_str());
            Serial.println("Attendance marked!");
        } else {
            showMessage(studentName.c_str(), "Already marked");
        }
    } else {
        // Just show student info (idle mode)
        showStudentInfo(studentName.c_str(), className.c_str());
    }

    delay(2000);
}

bool markAttendance(String sessionId, String studentId) {
    // Check if already marked
    String checkEndpoint = "attendance_records?session_id=eq." + sessionId +
                          "&student_id=eq." + studentId + "&select=id,status";
    String checkResponse = makeApiRequest("GET", checkEndpoint);

    DynamicJsonDocument checkDoc(256);
    deserializeJson(checkDoc, checkResponse);

    if (checkDoc.size() > 0) {
        String status = checkDoc[0]["status"].as<String>();
        if (status == "PRESENT") {
            return false; // Already marked
        }

        // Update existing record
        String recordId = checkDoc[0]["id"].as<String>();
        String updateBody = "{\"status\":\"PRESENT\",\"remark\":\"Fingerprint\"}";
        String updateEndpoint = "attendance_records?id=eq." + recordId;
        makeApiRequest("PATCH", updateEndpoint, updateBody);
        return true;
    }

    // Create new record
    String body = "{\"session_id\":\"" + sessionId +
                 "\",\"student_id\":\"" + studentId +
                 "\",\"status\":\"PRESENT\",\"remark\":\"Fingerprint\"}";

    String response = makeApiRequest("POST", "attendance_records", body);
    return response.length() > 0 && response.indexOf("error") == -1;
}

// ==================== WiFi FUNCTIONS ====================
void setupWiFi() {
    Serial.print("Connecting to WiFi: ");
    Serial.println(WIFI_SSID);
    showMessage("Connecting WiFi...", WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        wifiConnected = true;
        Serial.println("\nWiFi connected!");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        showMessage("WiFi Connected!", WiFi.localIP().toString().c_str());
        beep(200);
        delay(1000);
    } else {
        Serial.println("\nWiFi FAILED!");
        showError("WiFi Failed!");
        delay(2000);
    }
}

void maintainWiFiConnection() {
    wl_status_t status = WiFi.status();

    if (status == WL_CONNECTED) {
        if (!wifiConnected) {
            wifiConnected = true;
            Serial.println("WiFi reconnected");
            showMessage("WiFi Reconnected", WiFi.localIP().toString().c_str());
            delay(500);

            if (!deviceRegistered) {
                registerDevice();
            }
            checkActiveSession();
            showReady();
        }
        return;
    }

    if (wifiConnected) {
        wifiConnected = false;
        sessionActive = false;
        currentSessionId = "";
        Serial.println("WiFi disconnected");
        showError("WiFi Lost");
        showReady();
    }

    unsigned long now = millis();
    if (now - lastWiFiReconnectAttempt > WIFI_RECONNECT_INTERVAL_MS) {
        lastWiFiReconnectAttempt = now;
        Serial.println("Attempting WiFi reconnect...");
        WiFi.disconnect(false, false);
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
}

// ==================== API FUNCTIONS ====================
String makeApiRequest(const char* method, String endpoint, String body) {
    if (WiFi.status() != WL_CONNECTED) {
        wifiConnected = false;
        return "";
    }

    HTTPClient http;
    String url = String(SUPABASE_URL) + "/rest/v1/" + endpoint;

    if (!http.begin(url)) {
        Serial.println("HTTP begin failed");
        return "";
    }
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_SERVICE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_SERVICE_KEY);
    http.addHeader("Prefer", "return=representation");
    http.setTimeout(10000);

    int httpCode;
    if (strcmp(method, "GET") == 0) {
        httpCode = http.GET();
    } else if (strcmp(method, "POST") == 0) {
        httpCode = http.POST(body);
    } else if (strcmp(method, "PATCH") == 0) {
        httpCode = http.PATCH(body);
    } else {
        http.end();
        return "";
    }

    String response = "";
    if (httpCode > 0) {
        response = http.getString();
    } else {
        Serial.print("HTTP request failed: ");
        Serial.println(http.errorToString(httpCode));
    }

    if (httpCode >= 400) {
        Serial.print("HTTP ");
        Serial.print(httpCode);
        Serial.print(" -> ");
        Serial.println(url);
    }

    http.end();
    return response;
}

void registerDevice() {
    Serial.println("Registering device...");

    // Check if exists
    String checkEndpoint = "fingerprint_devices?device_code=eq." + String(DEVICE_CODE);
    String existing = makeApiRequest("GET", checkEndpoint);

    String body = "{\"device_code\":\"" + String(DEVICE_CODE) +
                 "\",\"device_name\":\"" + String(DEVICE_NAME) +
                 "\",\"status\":\"ACTIVE\",\"firmware_version\":\"1.0.0\"}";

    if (existing.length() > 2) {
        // Update
        makeApiRequest("PATCH", checkEndpoint, body);
        Serial.println("Device updated");
    } else {
        // Insert
        makeApiRequest("POST", "fingerprint_devices", body);
        Serial.println("Device registered");
    }

    deviceRegistered = true;
}

void sendHeartbeat() {
    String endpoint = "fingerprint_devices?device_code=eq." + String(DEVICE_CODE);
    String body = "{\"last_seen_at\":\"" + getTimestamp() + "\"}";
    makeApiRequest("PATCH", endpoint, body);
}

String getTimestamp() {
    // Simple timestamp - in production use NTP
    return "now()";
}

void checkActiveSession() {
    if (!wifiConnected) return;

    // Get device ID first
    String devEndpoint = "fingerprint_devices?device_code=eq." + String(DEVICE_CODE) + "&select=id";
    String devResponse = makeApiRequest("GET", devEndpoint);

    DynamicJsonDocument devDoc(256);
    deserializeJson(devDoc, devResponse);

    if (devDoc.size() == 0) return;

    String deviceId = devDoc[0]["id"].as<String>();

    // Check for active session
    String sessEndpoint = "device_sessions?device_id=eq." + deviceId +
                         "&session_status=eq.ACTIVE&select=id,attendance_session_id,subjects(name),classes(name,division)";
    String sessResponse = makeApiRequest("GET", sessEndpoint);

    DynamicJsonDocument sessDoc(1024);
    deserializeJson(sessDoc, sessResponse);

    if (sessDoc.size() > 0) {
        JsonObject sess = sessDoc[0];

        if (!sessionActive) {
            // New session started
            currentSessionId = sess["attendance_session_id"].as<String>();

            if (sess.containsKey("subjects") && !sess["subjects"].isNull()) {
                currentSubjectName = sess["subjects"]["name"].as<String>();
            }
            if (sess.containsKey("classes") && !sess["classes"].isNull()) {
                currentClassName = String(sess["classes"]["name"].as<const char*>()) + " " +
                                  String(sess["classes"]["division"].as<const char*>());
            }

            sessionActive = true;
            Serial.println("Session started: " + currentSubjectName);
            showMessage(currentSubjectName.c_str(), "Place finger...");
            beep(500);
        }
    } else {
        if (sessionActive) {
            // Session ended
            sessionActive = false;
            currentSessionId = "";
            Serial.println("Session ended");
            showReady();
        }
    }
}

// ==================== COMMAND HANDLING ====================
void handleCommand(String cmd) {
    Serial.println("Command: " + cmd);

    if (cmd == "STATUS") {
        Serial.println("\n=== DEVICE STATUS ===");
        Serial.print("WiFi: ");
        Serial.println(wifiConnected ? "Connected" : "Disconnected");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        Serial.print("Sensor: ");
        Serial.println(sensorReady ? "Ready" : "Not found");
        Serial.print("Display: ");
        Serial.println(displayReady ? "Ready" : "Not found");
        Serial.print("Session: ");
        Serial.println(sessionActive ? "Active" : "Inactive");
        if (sensorReady) {
            finger.getTemplateCount();
            Serial.print("Fingerprints: ");
            Serial.println(finger.templateCount);
        }
        Serial.println("====================\n");
    }
    else if (cmd == "CHECK") {
        Serial.println("Checking for active session...");
        checkActiveSession();
    }
    else if (cmd == "RESET") {
        Serial.println("Restarting...");
        ESP.restart();
    }
    else if (cmd == "CLEAR") {
        Serial.println("Clearing fingerprint database...");
        if (sensorReady) {
            finger.emptyDatabase();
            Serial.println("Database cleared!");
            showSuccess("Cleared!");
        }
    }
    else if (cmd == "BRIDGE") {
        Serial.println("Switching to bridge mode. Press RESET to return.");
        bridgeMode = true;
        fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
    }
    else {
        Serial.println("Unknown command. Available: STATUS, CHECK, RESET, CLEAR, BRIDGE");
    }
}

void runFingerprintBridge() {
    while (Serial.available()) {
        fpSerial.write(Serial.read());
    }
    while (fpSerial.available()) {
        Serial.write(fpSerial.read());
    }
    delay(2);
}

// ==================== UTILITY FUNCTIONS ====================
void beep(int duration) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(duration);
    digitalWrite(BUZZER_PIN, LOW);
}

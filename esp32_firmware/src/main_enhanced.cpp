/**
 * ESP32 Biometric Attendance Device - ENHANCED VERSION
 * With Better Debugging and Error Handling
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
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

const char* SUPABASE_URL = "https://gphcfejuurygcetmtpec.supabase.co";
const char* SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3ODM0ODAsImV4cCI6MjA4MDM1OTQ4MH0.NrHmxfRMW3E2SdiMEfNwbozGG36xpG1jroQB0dy3s5E";
const char* SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwaGNmZWp1dXJ5Z2NldG10cGVjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4MzQ4MCwiZXhwIjoyMDgwMzU5NDgwfQ.EuzI5mIV6nu5H6mC3QYkQsbmdkqLEXuWIZlf2oiqZ7g";

const char* DEVICE_CODE = "DEVICE_001";
const char* DEVICE_NAME = "Attendance Device 1";

// ==================== PIN DEFINITIONS ====================
#define FP_RX 16
#define FP_TX 17
#define OLED_SDA 21
#define OLED_SCL 22
#define LED_PIN 2
#define BUZZER_PIN 5
#define BOOT_PIN 0

// ==================== DISPLAY SETUP ====================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32
#define OLED_ADDR 0x3C

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

// ==================== FINGERPRINT SETUP ====================
HardwareSerial fpSerial(2);
Adafruit_Fingerprint finger(&fpSerial);

// ==================== STATUS VARIABLES ====================
bool wifiConnected = false;
bool sensorReady = false;
bool displayReady = false;
bool bridgeMode = false;

String currentSessionId = "";
bool sessionActive = false;
bool deviceRegistered = false;

unsigned long lastHeartbeat = 0;
unsigned long lastSessionCheck = 0;
unsigned long lastWiFiReconnect = 0;

const unsigned long HEARTBEAT_INTERVAL = 30000;
const unsigned long SESSION_CHECK_INTERVAL = 10000;
const unsigned long WIFI_RECONNECT_INTERVAL = 10000;

// ==================== FUNCTION DECLARATIONS ====================
void setupDisplay();
void setupFingerprint();
void setupWiFi();
void showStatus(const char* line1, const char* line2 = "");
void beep(int ms = 100);
void handleFingerprint();
void processAttendance(int fingerprintId);

// ==================== SETUP ====================
void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println("\n\n================================");
    Serial.println("ATTENDRO - Attendance Device");
    Serial.println("Version 2.0 - Enhanced");
    Serial.println("================================\n");

    // Initialize pins
    pinMode(LED_PIN, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    pinMode(BOOT_PIN, INPUT_PULLUP);
    digitalWrite(LED_PIN, LOW);

    // Check bridge mode
    if (digitalRead(BOOT_PIN) == LOW) {
        bridgeMode = true;
        fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
        Serial.println(">>> BRIDGE MODE ENABLED <<<");
        Serial.println("PC Software can now control R307");
        Serial.println("Data being forwarded:\n  Serial (USB) <-> R307 Sensor\n");
        return;
    }

    // Initialize I2C
    Serial.print("[INIT] Initializing I2C...");
    Wire.begin(OLED_SDA, OLED_SCL);
    Wire.setClock(400000);
    delay(100);
    Serial.println(" OK");

    // Setup components
    setupDisplay();
    setupFingerprint();
    setupWiFi();

    showStatus("ATTENDRO", "Initializing...");

    if (wifiConnected) {
        registerDevice();
        checkActiveSession();
    }

    showStatus("ATTENDRO", "Ready");
    Serial.println("\n✓ Device Ready!\n");
}

// ==================== MAIN LOOP ====================
void loop() {
    if (bridgeMode) {
        // Forward data between Serial and R307
        while (Serial.available()) fpSerial.write(Serial.read());
        while (fpSerial.available()) Serial.write(fpSerial.read());
        delay(2);
        return;
    }

    // Handle serial commands
    if (Serial.available()) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        cmd.toUpperCase();
        handleCommand(cmd);
    }

    // WiFi maintenance
    if (WiFi.status() != WL_CONNECTED) {
        wifiConnected = false;
        showStatus("WiFi", "DISCONNECTED");
        if (millis() - lastWiFiReconnect > WIFI_RECONNECT_INTERVAL) {
            Serial.println("[WIFI] Attempting reconnect...");
            WiFi.disconnect(false, false);
            WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
            lastWiFiReconnect = millis();
        }
    } else if (!wifiConnected) {
        wifiConnected = true;
        showStatus("ATTENDRO", "Connected!");
        Serial.printf("[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        delay(1500);
    }

    // Periodic tasks
    unsigned long now = millis();

    if (wifiConnected && now - lastHeartbeat > HEARTBEAT_INTERVAL) {
        sendHeartbeat();
        lastHeartbeat = now;
    }

    if (wifiConnected && now - lastSessionCheck > SESSION_CHECK_INTERVAL) {
        checkActiveSession();
        lastSessionCheck = now;
    }

    // Check fingerprint
    if (sensorReady) {
        handleFingerprint();
    }

    delay(50);
}

// ==================== DISPLAY FUNCTIONS ====================
void setupDisplay() {
    Serial.print("[DISPLAY] Scanning I2C addresses...");

    uint8_t addresses[] = {0x3C, 0x3D};
    bool found = false;

    for (uint8_t addr : addresses) {
        if (display.begin(SSD1306_SWITCHCAPVCC, addr)) {
            displayReady = true;
            found = true;
            Serial.printf(" Found at 0x%02X!\n", addr);

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
        Serial.println(" NOT FOUND!");
        Serial.println("  Wiring: SDA→GPIO21, SCL→GPIO22, VCC→3.3V, GND→GND");
    }
}

void showStatus(const char* line1, const char* line2) {
    if (!displayReady) return;

    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println(line1);

    if (line2) {
        display.setCursor(0, 20);
        display.println(line2);
    }

    display.display();
}

// ==================== FINGERPRINT FUNCTIONS ====================
void setupFingerprint() {
    Serial.print("[FINGERPRINT] Testing sensor...");

    const uint32_t baudRates[] = {57600, 115200, 38400};

    for (uint32_t baud : baudRates) {
        fpSerial.begin(baud, SERIAL_8N1, FP_RX, FP_TX);
        delay(120);
        finger.begin(baud);
        delay(120);

        if (finger.verifyPassword()) {
            sensorReady = true;
            finger.getTemplateCount();
            Serial.printf(" OK at %d baud\n", baud);
            Serial.printf("[FINGERPRINT] Stored templates: %d\n", finger.templateCount);
            return;
        }
    }

    Serial.println(" FAILED!");
    Serial.println("  1) Check wiring: TX→GPIO16, RX→GPIO17");
    Serial.println("  2) Ensure 5V power (NOT 3.3V)");
    Serial.println("  3) Check GND connection");
}

void handleFingerprint() {
    uint8_t result = finger.getImage();
    if (result != FINGERPRINT_OK) return;

    showStatus("Scanning...", "Please wait");
    Serial.println("[FINGERPRINT] Finger detected!");

    // Convert to template
    result = finger.image2Tz();
    if (result != FINGERPRINT_OK) {
        Serial.println("  ✗ Image conversion failed");
        showStatus("Error", "Image failed");
        delay(1000);
        showStatus("ATTENDRO", "Ready");
        return;
    }

    // Search for match
    result = finger.fingerSearch();

    if (result == FINGERPRINT_OK && finger.confidence >= 50) {
        Serial.printf("[MATCH] ID: %d, Confidence: %d\n", finger.fingerID, finger.confidence);
        processAttendance(finger.fingerID);
    } else {
        Serial.println("[NO MATCH] Fingerprint not enrolled");
        showStatus("Not Registered", "Please enroll");
        digitalWrite(LED_PIN, HIGH);
        beep(100);
        delay(100);
        beep(100);
        digitalWrite(LED_PIN, LOW);
        delay(1500);
    }

    // Wait for finger removal
    unsigned long start = millis();
    while (finger.getImage() != FINGERPRINT_NOFINGER && millis() - start < 5000) {
        delay(50);
    }
    delay(500);
    showStatus("ATTENDRO", "Ready");
}

void processAttendance(int fingerprintId) {
    if (!wifiConnected) {
        showStatus("No WiFi", "Error");
        Serial.println("[ERROR] WiFi not connected");
        delay(2000);
        return;
    }

    if (!sessionActive) {
        showStatus("No Session", "Active");
        Serial.println("[ERROR] No active session");
        delay(2000);
        return;
    }

    Serial.printf("[ATTENDANCE] Processing FP ID %d for session %s\n", fingerprintId, currentSessionId.c_str());

    // Get student from fingerprint template
    String endpoint = String("fingerprint_templates?fingerprint_id=eq.") + String(fingerprintId) +
                     "&select=student_id,students(id,name,enrollment_no,classes(name,division))";

    String response = makeApiRequest("GET", endpoint);

    if (response.length() < 3) {
        showStatus("Not Found", "DB Error");
        Serial.println("[ERROR] Fingerprint not found in database");
        delay(2000);
        return;
    }

    JsonDocument doc;
    deserializeJson(doc, response);

    if (doc.size() == 0) {
        showStatus("Error", "Parse failed");
        Serial.println("[ERROR] Failed to parse response");
        delay(2000);
        return;
    }

    String studentId = doc[0]["student_id"];
    String studentName = doc[0]["students"]["name"];
    String className = String(doc[0]["students"]["classes"]["name"].as<const char*>()) + " " +
                      String(doc[0]["students"]["classes"]["division"].as<const char*>());

    // Mark attendance
    String attendanceBody = "{\"session_id\":\"" + currentSessionId +
                           "\",\"student_id\":\"" + studentId +
                           "\",\"status\":\"PRESENT\",\"remarks\":\"Fingerprint\"}";

    String attendanceResult = makeApiRequest("POST", "attendance_records", attendanceBody);

    if (attendanceResult.indexOf("error") == -1) {
        Serial.printf("[SUCCESS] %s marked present\n", studentName.c_str());
        showStatus(studentName.c_str(), "PRESENT ✓");
        digitalWrite(LED_PIN, HIGH);
        beep(200);
        delay(200);
        digitalWrite(LED_PIN, LOW);
    } else {
        Serial.println("[ERROR] Failed to mark attendance");
        showStatus("Error", "API Failed");
    }

    delay(2000);
}

// ==================== WIFI & API FUNCTIONS ====================
void setupWiFi() {
    Serial.printf("[WIFI] Connecting to %s...", WIFI_SSID);
    showStatus("WiFi", "Connecting...");

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
        Serial.printf(" OK\n[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println(" FAILED!");
        Serial.println("  Check WiFi SSID and password in code");
    }
}

void registerDevice() {
    Serial.println("[DEVICE] Registering with Supabase...");

    String body = String("{\"device_code\":\"") + DEVICE_CODE +
                 "\",\"device_name\":\"" + DEVICE_NAME +
                 "\",\"status\":\"ACTIVE\",\"firmware_version\":\"2.0\"}";

    String checkEndpoint = String("fingerprint_devices?device_code=eq.") + DEVICE_CODE;
    String existing = makeApiRequest("GET", checkEndpoint);

    if (existing.length() > 2) {
        makeApiRequest("PATCH", checkEndpoint, body);
        Serial.println("[DEVICE] ✓ Device updated");
    } else {
        makeApiRequest("POST", "fingerprint_devices", body);
        Serial.println("[DEVICE] ✓ Device registered");
    }
    deviceRegistered = true;
}

void sendHeartbeat() {
    Serial.println("[HEARTBEAT] Sending status...");
    String endpoint = String("fingerprint_devices?device_code=eq.") + DEVICE_CODE;
    String body = String("{\"last_seen_at\":\"now()\",\"status\":\"ACTIVE\"}");
    makeApiRequest("PATCH", endpoint, body);
}

void checkActiveSession() {
    if (!wifiConnected) return;

    // Get device ID
    String devEndpoint = String("fingerprint_devices?device_code=eq.") + DEVICE_CODE + "&select=id";
    String devResponse = makeApiRequest("GET", devEndpoint);

    JsonDocument devDoc;
    deserializeJson(devDoc, devResponse);

    if (devDoc.size() == 0) return;

    String deviceId = devDoc[0]["id"];

    // Check for active session
    String sessEndpoint = String("device_sessions?device_id=eq.") + deviceId +
                         "&session_status=eq.ACTIVE&select=id,attendance_session_id,subjects(name),classes(name)";
    String sessResponse = makeApiRequest("GET", sessEndpoint);

    JsonDocument sessDoc;
    deserializeJson(sessDoc, sessResponse);

    if (sessDoc.size() > 0) {
        if (!sessionActive) {
            currentSessionId = sessDoc[0]["attendance_session_id"];
            sessionActive = true;
            String subjectName = sessDoc[0]["subjects"]["name"];
            Serial.printf("[SESSION] Active: %s\n", subjectName.as<const char*>());
            showStatus(subjectName.as<const char*>(), "Scan finger...");
        }
    } else {
        if (sessionActive) {
            sessionActive = false;
            currentSessionId = "";
            Serial.println("[SESSION] Ended");
            showStatus("ATTENDRO", "Ready");
        }
    }
}

String makeApiRequest(const char* method, String endpoint, String body = "") {
    if (WiFi.status() != WL_CONNECTED) {
        wifiConnected = false;
        return "";
    }

    HTTPClient http;
    String url = String(SUPABASE_URL) + "/rest/v1/" + endpoint;

    if (!http.begin(url)) {
        Serial.println("[ERROR] HTTP begin failed");
        return "";
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_SERVICE_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_SERVICE_KEY);
    http.addHeader("Prefer", "return=representation");
    http.setTimeout(10000);

    int httpCode = 0;
    if (strcmp(method, "GET") == 0) {
        httpCode = http.GET();
    } else if (strcmp(method, "POST") == 0) {
        httpCode = http.POST(body);
    } else if (strcmp(method, "PATCH") == 0) {
        httpCode = http.PATCH(body);
    }

    String response = "";
    if (httpCode > 0) {
        response = http.getString();
        if (httpCode >= 400) {
            Serial.printf("[API ERROR] %d: %s\n", httpCode, url.c_str());
        }
    } else {
        Serial.printf("[API ERROR] Failed: %s\n", http.errorToString(httpCode).c_str());
    }

    http.end();
    return response;
}

// ==================== COMMAND HANDLING ====================
void handleCommand(String cmd) {
    Serial.println("[CMD] " + cmd);

    if (cmd == "STATUS") {
        Serial.println("\n═══════ DEVICE STATUS ═══════");
        Serial.printf("WiFi: %s\n", wifiConnected ? "✓ Connected" : "✗ Disconnected");
        if (wifiConnected) Serial.printf("  IP: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("Sensor: %s\n", sensorReady ? "✓ Ready" : "✗ Not found");
        Serial.printf("Display: %s\n", displayReady ? "✓ Ready" : "✗ Not found");
        Serial.printf("Session: %s\n", sessionActive ? "✓ Active" : "✗ Inactive");
        if (sensorReady) {
            finger.getTemplateCount();
            Serial.printf("Templates: %d\n", finger.templateCount);
        }
        Serial.println("═════════════════════════════\n");
    }
    else if (cmd == "CHECK") {
        checkActiveSession();
    }
    else if (cmd == "RESET") {
        Serial.println("[CMD] Restarting...");
        ESP.restart();
    }
    else if (cmd == "CLEAR") {
        if (sensorReady) {
            finger.emptyDatabase();
            Serial.println("[CMD] ✓ Database cleared");
        }
    }
    else if (cmd == "BRIDGE") {
        Serial.println("[CMD] Type 'RESET' to exit bridge mode");
        bridgeMode = true;
        fpSerial.begin(57600, SERIAL_8N1, FP_RX, FP_TX);
    }
    else {
        Serial.println("[CMD] Unknown. Available: STATUS, CHECK, RESET, CLEAR, BRIDGE");
    }
}

void beep(int ms) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(ms);
    digitalWrite(BUZZER_PIN, LOW);
}

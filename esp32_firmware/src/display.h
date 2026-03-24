/**
 * OLED Display Handler
 * 0.91" SSD1306 128x32 OLED
 */

#ifndef DISPLAY_H
#define DISPLAY_H

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "config.h"

class DisplayHandler {
private:
    Adafruit_SSD1306* display;
    bool initialized = false;

public:
    DisplayHandler() {
        display = new Adafruit_SSD1306(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
    }

    bool begin() {
        Wire.begin(OLED_SDA, OLED_SCL);

        if (!display->begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS)) {
            Serial.println(F("SSD1306 allocation failed"));
            return false;
        }

        initialized = true;
        display->clearDisplay();
        display->setTextColor(SSD1306_WHITE);
        display->display();
        return true;
    }

    void clear() {
        if (!initialized) return;
        display->clearDisplay();
        display->display();
    }

    // Show startup screen
    void showStartup() {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(20, 4);
        display->println(F("BIOMETRIC"));
        display->setCursor(20, 16);
        display->println(F("ATTENDANCE"));
        display->display();
    }

    // Show WiFi connecting
    void showWiFiConnecting(const char* ssid) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(F("Connecting WiFi..."));
        display->setCursor(0, 16);
        display->print(ssid);
        display->display();
    }

    // Show WiFi connected with IP
    void showWiFiConnected(const char* ip) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(F("WiFi Connected!"));
        display->setCursor(0, 16);
        display->print(ip);
        display->display();
    }

    // Show device ready - idle mode
    void showReady(const char* deviceCode) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->print(F("Device: "));
        display->println(deviceCode);
        display->setCursor(0, 16);
        display->println(F("Ready - Place Finger"));
        display->display();
    }

    // Show enrollment mode - step 1
    void showEnrollStep1() {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(F("ENROLLMENT MODE"));
        display->setCursor(0, 16);
        display->println(F("Place finger 1st time"));
        display->display();
    }

    // Show enrollment mode - step 2
    void showEnrollStep2() {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(F("Remove finger..."));
        display->setCursor(0, 16);
        display->println(F("Place again"));
        display->display();
    }

    // Show enrollment - enter enrollment no
    void showEnterEnrollment() {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(F("Fingerprint saved!"));
        display->setCursor(0, 16);
        display->println(F("Enter Enrollment No."));
        display->display();
    }

    // Show verifying enrollment
    void showVerifying() {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(F("Verifying..."));
        display->display();
    }

    // Show student info after verification
    void showStudentInfo(const char* name, const char* className, int year) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);

        // Truncate name if too long
        String nameStr = String(name);
        if (nameStr.length() > 18) {
            nameStr = nameStr.substring(0, 15) + "...";
        }
        display->println(nameStr);

        display->setCursor(0, 12);
        display->print(F("Class: "));
        display->println(className);

        display->setCursor(0, 24);
        display->print(F("Year: "));
        display->println(year);
        display->display();
    }

    // Show attendance mode
    void showAttendanceMode(const char* subject, const char* className) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(F("ATTENDANCE MODE"));

        display->setCursor(0, 10);
        String subStr = String(subject);
        if (subStr.length() > 21) {
            subStr = subStr.substring(0, 18) + "...";
        }
        display->println(subStr);

        display->setCursor(0, 22);
        display->print(className);
        display->display();
    }

    // Show attendance - place finger
    void showPlaceFinger() {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 4);
        display->println(F("Place your finger"));
        display->setCursor(0, 18);
        display->println(F("on the sensor"));
        display->display();
    }

    // Show attendance marked
    void showAttendanceMarked(const char* name, bool present) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);

        // Truncate name if too long
        String nameStr = String(name);
        if (nameStr.length() > 21) {
            nameStr = nameStr.substring(0, 18) + "...";
        }
        display->setCursor(0, 0);
        display->println(nameStr);

        display->setTextSize(2);
        display->setCursor(0, 14);
        if (present) {
            display->println(F("PRESENT"));
        } else {
            display->println(F("MARKED"));
        }
        display->display();
    }

    // Show count
    void showAttendanceCount(int present, int total) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(F("Attendance Status"));

        display->setTextSize(2);
        display->setCursor(20, 14);
        display->print(present);
        display->print(F("/"));
        display->print(total);
        display->display();
    }

    // Show error
    void showError(const char* message) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(F("ERROR"));
        display->setCursor(0, 16);
        display->println(message);
        display->display();
    }

    // Show success
    void showSuccess(const char* message) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 4);
        display->println(F("SUCCESS"));
        display->setCursor(0, 18);
        display->println(message);
        display->display();
    }

    // Show message with two lines
    void showMessage(const char* line1, const char* line2) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 4);
        display->println(line1);
        display->setCursor(0, 18);
        display->println(line2);
        display->display();
    }

    // Show progress bar
    void showProgress(const char* title, int percent) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);
        display->println(title);

        // Draw progress bar
        int barWidth = map(percent, 0, 100, 0, 120);
        display->drawRect(4, 16, 120, 12, SSD1306_WHITE);
        display->fillRect(6, 18, barWidth - 4, 8, SSD1306_WHITE);

        display->display();
    }

    // Show not configured
    void showNotConfigured() {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 4);
        display->println(F("Not Configured"));
        display->setCursor(0, 18);
        display->println(F("Configure in App"));
        display->display();
    }

    // Show fingerprint not found
    void showNotFound() {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 4);
        display->println(F("Fingerprint"));
        display->setCursor(0, 18);
        display->println(F("Not Registered!"));
        display->display();
    }

    // Show already marked
    void showAlreadyMarked(const char* name) {
        if (!initialized) return;
        display->clearDisplay();
        display->setTextSize(1);
        display->setCursor(0, 0);

        String nameStr = String(name);
        if (nameStr.length() > 21) {
            nameStr = nameStr.substring(0, 18) + "...";
        }
        display->println(nameStr);

        display->setCursor(0, 16);
        display->println(F("Already Marked!"));
        display->display();
    }

    bool isInitialized() {
        return initialized;
    }
};

#endif // DISPLAY_H

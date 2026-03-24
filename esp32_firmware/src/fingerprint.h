/**
 * R307 Fingerprint Module Handler
 * Handles enrollment, verification, and attendance
 */

#ifndef FINGERPRINT_H
#define FINGERPRINT_H

#include <Arduino.h>
#include <Adafruit_Fingerprint.h>
#include "config.h"

class FingerprintHandler {
private:
    HardwareSerial* fpSerial;
    Adafruit_Fingerprint* finger;
    bool initialized = false;

public:
    FingerprintHandler() {
        fpSerial = &Serial2;
        finger = nullptr;
    }

    bool begin() {
        fpSerial->begin(FP_BAUD_RATE, SERIAL_8N1, FP_RX_PIN, FP_TX_PIN);
        finger = new Adafruit_Fingerprint(fpSerial);

        finger->begin(FP_BAUD_RATE);
        delay(100);

        if (finger->verifyPassword()) {
            Serial.println(F("Fingerprint sensor found!"));
            initialized = true;

            // Get sensor parameters
            finger->getParameters();
            Serial.print(F("Capacity: ")); Serial.println(finger->capacity);
            Serial.print(F("Security level: ")); Serial.println(finger->security_level);

            return true;
        } else {
            Serial.println(F("Fingerprint sensor not found!"));
            return false;
        }
    }

    // Get next available fingerprint ID
    int getNextAvailableID() {
        if (!initialized) return -1;

        for (int i = 1; i <= FP_MAX_TEMPLATES; i++) {
            uint8_t p = finger->loadModel(i);
            if (p == FINGERPRINT_PACKETRECIEVEERR) {
                // Error, try next
                continue;
            }
            if (p != FINGERPRINT_OK) {
                // This ID is available
                return i;
            }
        }
        return -1; // All slots full
    }

    // Check if fingerprint exists and return its ID
    int searchFingerprint() {
        if (!initialized) return -1;

        uint8_t p = finger->getImage();
        if (p != FINGERPRINT_OK) return -1;

        p = finger->image2Tz();
        if (p != FINGERPRINT_OK) return -1;

        p = finger->fingerSearch();
        if (p == FINGERPRINT_OK) {
            Serial.print(F("Found ID #")); Serial.print(finger->fingerID);
            Serial.print(F(" with confidence ")); Serial.println(finger->confidence);

            if (finger->confidence >= FP_CONFIDENCE_THRESHOLD) {
                return finger->fingerID;
            }
        }
        return -1;
    }

    // Capture fingerprint for enrollment - Step 1
    // Returns: 0 = success, -1 = timeout, -2 = error
    int captureFingerprint1(unsigned long timeout = FP_CAPTURE_TIMEOUT) {
        if (!initialized) return -2;

        unsigned long startTime = millis();
        int p = -1;

        Serial.println(F("Waiting for fingerprint..."));

        while (millis() - startTime < timeout) {
            p = finger->getImage();
            if (p == FINGERPRINT_OK) {
                Serial.println(F("Image taken"));
                break;
            } else if (p == FINGERPRINT_NOFINGER) {
                delay(50);
            } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
                Serial.println(F("Communication error"));
                return -2;
            } else if (p == FINGERPRINT_IMAGEFAIL) {
                Serial.println(F("Imaging error"));
                return -2;
            }
        }

        if (p != FINGERPRINT_OK) return -1; // Timeout

        // Convert to template
        p = finger->image2Tz(1);
        if (p == FINGERPRINT_OK) {
            Serial.println(F("Image converted"));
            return 0;
        } else if (p == FINGERPRINT_IMAGEMESS) {
            Serial.println(F("Image too messy"));
            return -2;
        } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
            Serial.println(F("Communication error"));
            return -2;
        } else if (p == FINGERPRINT_FEATUREFAIL || p == FINGERPRINT_INVALIDIMAGE) {
            Serial.println(F("Could not find features"));
            return -2;
        }

        return -2;
    }

    // Capture fingerprint for enrollment - Step 2
    // Returns: 0 = success, -1 = timeout, -2 = error
    int captureFingerprint2(unsigned long timeout = FP_CAPTURE_TIMEOUT) {
        if (!initialized) return -2;

        unsigned long startTime = millis();
        int p = -1;

        Serial.println(F("Place same finger again..."));

        while (millis() - startTime < timeout) {
            p = finger->getImage();
            if (p == FINGERPRINT_OK) {
                Serial.println(F("Image taken"));
                break;
            } else if (p == FINGERPRINT_NOFINGER) {
                delay(50);
            } else if (p == FINGERPRINT_PACKETRECIEVEERR) {
                return -2;
            }
        }

        if (p != FINGERPRINT_OK) return -1; // Timeout

        // Convert to template slot 2
        p = finger->image2Tz(2);
        if (p != FINGERPRINT_OK) return -2;

        // Create model from both templates
        p = finger->createModel();
        if (p == FINGERPRINT_OK) {
            Serial.println(F("Fingerprints matched!"));
            return 0;
        } else if (p == FINGERPRINT_ENROLLMISMATCH) {
            Serial.println(F("Fingerprints did not match"));
            return -3; // Mismatch
        }

        return -2;
    }

    // Store fingerprint with given ID
    bool storeFingerprint(int id) {
        if (!initialized || id < 1 || id > FP_MAX_TEMPLATES) return false;

        uint8_t p = finger->storeModel(id);
        if (p == FINGERPRINT_OK) {
            Serial.print(F("Stored as ID #")); Serial.println(id);
            return true;
        } else {
            Serial.println(F("Failed to store"));
            return false;
        }
    }

    // Delete fingerprint by ID
    bool deleteFingerprint(int id) {
        if (!initialized || id < 1 || id > FP_MAX_TEMPLATES) return false;

        uint8_t p = finger->deleteModel(id);
        return (p == FINGERPRINT_OK);
    }

    // Delete all fingerprints
    bool deleteAll() {
        if (!initialized) return false;

        uint8_t p = finger->emptyDatabase();
        return (p == FINGERPRINT_OK);
    }

    // Get number of stored fingerprints
    int getStoredCount() {
        if (!initialized) return -1;

        finger->getTemplateCount();
        return finger->templateCount;
    }

    // Check if finger is on sensor
    bool isFingerPresent() {
        if (!initialized) return false;
        return (finger->getImage() == FINGERPRINT_OK);
    }

    // Wait for finger removal
    void waitForFingerRemoval(unsigned long timeout = 5000) {
        unsigned long startTime = millis();
        while (millis() - startTime < timeout) {
            if (finger->getImage() == FINGERPRINT_NOFINGER) {
                delay(200);
                return;
            }
            delay(50);
        }
    }

    // Get confidence score of last match
    uint16_t getConfidence() {
        return finger->confidence;
    }

    // Get the matched fingerprint ID
    uint16_t getMatchedID() {
        return finger->fingerID;
    }

    bool isInitialized() {
        return initialized;
    }

    // Full enrollment process
    // Returns: fingerprint ID on success, -1 on failure
    int enrollFingerprint(
        void (*onStep1)(),
        void (*onStep2)(),
        void (*onSuccess)(),
        void (*onError)(const char*)
    ) {
        if (!initialized) {
            if (onError) onError("Sensor not ready");
            return -1;
        }

        // Get next available ID
        int id = getNextAvailableID();
        if (id == -1) {
            if (onError) onError("Database full");
            return -1;
        }

        // Step 1: First fingerprint capture
        if (onStep1) onStep1();

        int result = captureFingerprint1();
        if (result != 0) {
            if (onError) {
                if (result == -1) onError("Timeout");
                else onError("Capture failed");
            }
            return -1;
        }

        // Wait for finger removal
        waitForFingerRemoval();

        // Step 2: Second fingerprint capture
        if (onStep2) onStep2();

        result = captureFingerprint2();
        if (result != 0) {
            if (onError) {
                if (result == -1) onError("Timeout");
                else if (result == -3) onError("Fingers don't match");
                else onError("Capture failed");
            }
            return -1;
        }

        // Store the fingerprint
        if (!storeFingerprint(id)) {
            if (onError) onError("Store failed");
            return -1;
        }

        if (onSuccess) onSuccess();
        return id;
    }
};

#endif // FINGERPRINT_H

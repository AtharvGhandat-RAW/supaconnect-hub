/**
 * Supabase API Client for ESP32
 * Handles all communication with Supabase backend
 */

#ifndef SUPABASE_CLIENT_H
#define SUPABASE_CLIENT_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"

// Student data structure
struct StudentData {
    char id[40];
    char name[100];
    char enrollmentNo[30];
    char className[50];
    char division[10];
    int year;
    int semester;
    int rollNo;
    bool valid;
};

// Device session data structure
struct DeviceSessionData {
    char sessionId[40];
    char attendanceSessionId[40];
    char classId[40];
    char subjectId[40];
    char subjectName[100];
    char className[50];
    char facultyName[100];
    bool active;
};

// Attendance result
struct AttendanceResult {
    bool success;
    bool alreadyMarked;
    char studentName[100];
    char message[100];
};

class SupabaseClient {
private:
    String baseUrl;
    String anonKey;
    String serviceKey;
    String deviceCode;

    // Make HTTP request and return response
    String makeRequest(const char* method, const char* endpoint, const char* body = nullptr, bool useServiceKey = false) {
        HTTPClient http;
        String url = baseUrl + "/rest/v1/" + endpoint;

        http.begin(url);
        http.addHeader("Content-Type", "application/json");
        http.addHeader("apikey", useServiceKey ? serviceKey : anonKey);
        http.addHeader("Authorization", "Bearer " + (useServiceKey ? serviceKey : anonKey));
        http.addHeader("Prefer", "return=representation");
        http.setTimeout(API_REQUEST_TIMEOUT);

        int httpCode;
        if (strcmp(method, "GET") == 0) {
            httpCode = http.GET();
        } else if (strcmp(method, "POST") == 0) {
            httpCode = http.POST(body ? body : "");
        } else if (strcmp(method, "PATCH") == 0) {
            httpCode = http.PATCH(body ? body : "");
        } else if (strcmp(method, "DELETE") == 0) {
            httpCode = http.sendRequest("DELETE");
        } else {
            http.end();
            return "";
        }

        String response = "";
        if (httpCode > 0) {
            response = http.getString();
            Serial.printf("HTTP %d: %s\n", httpCode, response.c_str());
        } else {
            Serial.printf("HTTP error: %s\n", http.errorToString(httpCode).c_str());
        }

        http.end();
        return response;
    }

public:
    SupabaseClient() {
        baseUrl = SUPABASE_URL;
        anonKey = SUPABASE_ANON_KEY;
        serviceKey = SUPABASE_SERVICE_KEY;
        deviceCode = DEVICE_CODE;
    }

    void setDeviceCode(const char* code) {
        deviceCode = String(code);
    }

    // Register or update device in database
    bool registerDevice() {
        StaticJsonDocument<256> doc;
        doc["device_code"] = deviceCode;
        doc["device_name"] = DEVICE_NAME;
        doc["status"] = "ACTIVE";
        doc["last_seen_at"] = "now()";
        doc["firmware_version"] = "1.0.0";

        String body;
        serializeJson(doc, body);

        // Try to upsert
        String endpoint = "fingerprint_devices?device_code=eq." + deviceCode;
        String response = makeRequest("GET", endpoint.c_str(), nullptr, true);

        if (response.length() > 2) { // Has data
            // Update existing
            endpoint = "fingerprint_devices?device_code=eq." + deviceCode;
            response = makeRequest("PATCH", endpoint.c_str(), body.c_str(), true);
        } else {
            // Insert new
            response = makeRequest("POST", "fingerprint_devices", body.c_str(), true);
        }

        return response.length() > 0 && response.indexOf("error") == -1;
    }

    // Verify enrollment number and get student data
    bool verifyEnrollment(const char* enrollmentNo, StudentData* student) {
        String endpoint = "students?enrollment_no=eq." + String(enrollmentNo) +
                         "&select=id,name,enrollment_no,year,semester,roll_no,division,classes(name,division)";

        String response = makeRequest("GET", endpoint.c_str());

        if (response.length() < 3) {
            student->valid = false;
            return false;
        }

        StaticJsonDocument<1024> doc;
        DeserializationError error = deserializeJson(doc, response);

        if (error || doc.size() == 0) {
            student->valid = false;
            return false;
        }

        JsonObject obj = doc[0];
        strlcpy(student->id, obj["id"] | "", sizeof(student->id));
        strlcpy(student->name, obj["name"] | "", sizeof(student->name));
        strlcpy(student->enrollmentNo, obj["enrollment_no"] | "", sizeof(student->enrollmentNo));
        student->year = obj["year"] | 0;
        student->semester = obj["semester"] | 0;
        student->rollNo = obj["roll_no"] | 0;

        // Get class info
        if (obj.containsKey("classes") && !obj["classes"].isNull()) {
            JsonObject cls = obj["classes"];
            String className = String(cls["name"] | "") + " " + String(cls["division"] | "");
            strlcpy(student->className, className.c_str(), sizeof(student->className));
            strlcpy(student->division, cls["division"] | "", sizeof(student->division));
        } else {
            strcpy(student->className, "Unknown");
            strcpy(student->division, "");
        }

        student->valid = true;
        return true;
    }

    // Check if student already has fingerprint registered
    bool isStudentEnrolled(const char* studentId) {
        String endpoint = "fingerprint_templates?student_id=eq." + String(studentId) + "&select=id";
        String response = makeRequest("GET", endpoint.c_str());
        return (response.length() > 2); // Has data
    }

    // Save fingerprint template mapping
    bool saveFingerprint(const char* studentId, int fingerprintId) {
        StaticJsonDocument<256> doc;
        doc["student_id"] = studentId;
        doc["fingerprint_id"] = fingerprintId;
        doc["is_verified"] = true;

        String body;
        serializeJson(doc, body);

        String response = makeRequest("POST", "fingerprint_templates", body.c_str(), true);
        return response.length() > 0 && response.indexOf("error") == -1;
    }

    // Get student by fingerprint ID
    bool getStudentByFingerprint(int fingerprintId, StudentData* student) {
        String endpoint = "fingerprint_templates?fingerprint_id=eq." + String(fingerprintId) +
                         "&select=student_id,students(id,name,enrollment_no,year,semester,roll_no,division,classes(name,division))";

        String response = makeRequest("GET", endpoint.c_str());

        if (response.length() < 3) {
            student->valid = false;
            return false;
        }

        StaticJsonDocument<1024> doc;
        DeserializationError error = deserializeJson(doc, response);

        if (error || doc.size() == 0) {
            student->valid = false;
            return false;
        }

        JsonObject template_obj = doc[0];
        if (!template_obj.containsKey("students") || template_obj["students"].isNull()) {
            student->valid = false;
            return false;
        }

        JsonObject obj = template_obj["students"];
        strlcpy(student->id, obj["id"] | "", sizeof(student->id));
        strlcpy(student->name, obj["name"] | "", sizeof(student->name));
        strlcpy(student->enrollmentNo, obj["enrollment_no"] | "", sizeof(student->enrollmentNo));
        student->year = obj["year"] | 0;
        student->semester = obj["semester"] | 0;
        student->rollNo = obj["roll_no"] | 0;

        if (obj.containsKey("classes") && !obj["classes"].isNull()) {
            JsonObject cls = obj["classes"];
            String className = String(cls["name"] | "") + " " + String(cls["division"] | "");
            strlcpy(student->className, className.c_str(), sizeof(student->className));
            strlcpy(student->division, cls["division"] | "", sizeof(student->division));
        } else {
            strcpy(student->className, "Unknown");
            strcpy(student->division, "");
        }

        student->valid = true;
        return true;
    }

    // Get active device session
    bool getActiveSession(DeviceSessionData* session) {
        // First get device ID
        String endpoint = "fingerprint_devices?device_code=eq." + deviceCode + "&select=id";
        String response = makeRequest("GET", endpoint.c_str());

        if (response.length() < 3) {
            session->active = false;
            return false;
        }

        StaticJsonDocument<256> doc;
        deserializeJson(doc, response);

        if (doc.size() == 0) {
            session->active = false;
            return false;
        }

        String deviceId = doc[0]["id"].as<String>();

        // Get active session for this device
        endpoint = "device_sessions?device_id=eq." + deviceId +
                  "&session_status=eq.ACTIVE" +
                  "&select=id,attendance_session_id,class_id,subject_id," +
                  "subjects(name),classes(name,division),faculty(profiles(name))";

        response = makeRequest("GET", endpoint.c_str());

        if (response.length() < 3) {
            session->active = false;
            return false;
        }

        StaticJsonDocument<1024> docSession;
        DeserializationError error = deserializeJson(docSession, response);

        if (error || docSession.size() == 0) {
            session->active = false;
            return false;
        }

        JsonObject obj = docSession[0];
        strlcpy(session->sessionId, obj["id"] | "", sizeof(session->sessionId));
        strlcpy(session->attendanceSessionId, obj["attendance_session_id"] | "", sizeof(session->attendanceSessionId));
        strlcpy(session->classId, obj["class_id"] | "", sizeof(session->classId));
        strlcpy(session->subjectId, obj["subject_id"] | "", sizeof(session->subjectId));

        if (obj.containsKey("subjects") && !obj["subjects"].isNull()) {
            strlcpy(session->subjectName, obj["subjects"]["name"] | "", sizeof(session->subjectName));
        }

        if (obj.containsKey("classes") && !obj["classes"].isNull()) {
            String className = String(obj["classes"]["name"] | "") + " " + String(obj["classes"]["division"] | "");
            strlcpy(session->className, className.c_str(), sizeof(session->className));
        }

        if (obj.containsKey("faculty") && !obj["faculty"].isNull() &&
            obj["faculty"].containsKey("profiles") && !obj["faculty"]["profiles"].isNull()) {
            strlcpy(session->facultyName, obj["faculty"]["profiles"]["name"] | "", sizeof(session->facultyName));
        }

        session->active = true;
        return true;
    }

    // Mark attendance for a student
    AttendanceResult markAttendance(const char* sessionId, const char* studentId, const char* studentName) {
        AttendanceResult result;
        result.success = false;
        result.alreadyMarked = false;
        strcpy(result.studentName, studentName);
        strcpy(result.message, "");

        // Check if already marked
        String checkEndpoint = "attendance_records?session_id=eq." + String(sessionId) +
                              "&student_id=eq." + String(studentId) + "&select=id,status";
        String checkResponse = makeRequest("GET", checkEndpoint.c_str());

        if (checkResponse.length() > 2) {
            // Already has record
            StaticJsonDocument<256> checkDoc;
            deserializeJson(checkDoc, checkResponse);

            if (checkDoc.size() > 0) {
                String status = checkDoc[0]["status"].as<String>();
                if (status == "PRESENT") {
                    result.alreadyMarked = true;
                    strcpy(result.message, "Already marked");
                    return result;
                }

                // Update to present
                String recordId = checkDoc[0]["id"].as<String>();
                StaticJsonDocument<128> updateDoc;
                updateDoc["status"] = "PRESENT";
                updateDoc["remark"] = "Fingerprint verified";

                String updateBody;
                serializeJson(updateDoc, updateBody);

                String updateEndpoint = "attendance_records?id=eq." + recordId;
                String updateResponse = makeRequest("PATCH", updateEndpoint.c_str(), updateBody.c_str(), true);

                result.success = updateResponse.length() > 0 && updateResponse.indexOf("error") == -1;
                strcpy(result.message, result.success ? "Marked Present" : "Update failed");
                return result;
            }
        }

        // Create new record
        StaticJsonDocument<256> doc;
        doc["session_id"] = sessionId;
        doc["student_id"] = studentId;
        doc["status"] = "PRESENT";
        doc["remark"] = "Fingerprint verified";

        String body;
        serializeJson(doc, body);

        String response = makeRequest("POST", "attendance_records", body.c_str(), true);

        result.success = response.length() > 0 && response.indexOf("error") == -1;
        strcpy(result.message, result.success ? "Marked Present" : "Failed to mark");

        return result;
    }

    // Add attendance to queue (for offline support)
    bool queueAttendance(const char* deviceSessionId, int fingerprintId) {
        StaticJsonDocument<256> doc;

        // Get device ID first
        String endpoint = "fingerprint_devices?device_code=eq." + deviceCode + "&select=id";
        String response = makeRequest("GET", endpoint.c_str());

        if (response.length() < 3) return false;

        StaticJsonDocument<128> devDoc;
        deserializeJson(devDoc, response);
        if (devDoc.size() == 0) return false;

        String deviceId = devDoc[0]["id"].as<String>();

        doc["device_id"] = deviceId;
        doc["device_session_id"] = deviceSessionId;
        doc["fingerprint_id"] = fingerprintId;
        doc["scanned_at"] = "now()";

        String body;
        serializeJson(doc, body);

        response = makeRequest("POST", "device_attendance_queue", body.c_str(), true);
        return response.length() > 0 && response.indexOf("error") == -1;
    }

    // Get students list for a class (for batch operations)
    int getClassStudents(const char* classId, StudentData* students, int maxStudents) {
        String endpoint = "students?class_id=eq." + String(classId) +
                         "&status=eq.ACTIVE&select=id,name,enrollment_no,roll_no&order=roll_no.asc";

        String response = makeRequest("GET", endpoint.c_str());

        if (response.length() < 3) return 0;

        DynamicJsonDocument doc(4096);
        DeserializationError error = deserializeJson(doc, response);

        if (error) return 0;

        int count = 0;
        for (JsonObject obj : doc.as<JsonArray>()) {
            if (count >= maxStudents) break;

            strlcpy(students[count].id, obj["id"] | "", sizeof(students[count].id));
            strlcpy(students[count].name, obj["name"] | "", sizeof(students[count].name));
            strlcpy(students[count].enrollmentNo, obj["enrollment_no"] | "", sizeof(students[count].enrollmentNo));
            students[count].rollNo = obj["roll_no"] | 0;
            students[count].valid = true;
            count++;
        }

        return count;
    }

    // Update device heartbeat
    void updateHeartbeat() {
        String endpoint = "fingerprint_devices?device_code=eq." + deviceCode;
        String body = "{\"last_seen_at\": \"now()\"}";
        makeRequest("PATCH", endpoint.c_str(), body.c_str(), true);
    }

    // Check server connectivity
    bool isServerReachable() {
        HTTPClient http;
        http.begin(baseUrl + "/rest/v1/");
        http.addHeader("apikey", anonKey);
        http.setTimeout(5000);

        int httpCode = http.GET();
        http.end();

        return httpCode > 0;
    }
};

#endif // SUPABASE_CLIENT_H

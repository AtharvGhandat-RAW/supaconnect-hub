# Attendro Database Schema Diagram (ER Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 ATTENDRO DATABASE SCHEMA (ER DIAGRAM)                                │
│                                   PostgreSQL / Supabase Database                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

                                    ┌────────────────────────────┐
                                    │        PROFILES            │
                                    │────────────────────────────│
                                    │ PK id: UUID                │
                                    │    name: TEXT              │
                                    │    role: USER_ROLE         │
                                    │    department: TEXT        │
                                    │    created_at: TIMESTAMPTZ │
                                    │    updated_at: TIMESTAMPTZ │
                                    └─────────────┬──────────────┘
                                                  │
                                                  │ 1:1
                                                  ▼
┌──────────────────────────────┐    ┌────────────────────────────┐
│         CLASSES              │    │         FACULTY            │
│──────────────────────────────│    │────────────────────────────│
│ PK id: UUID                  │    │ PK id: UUID                │
│    name: TEXT                │    │ FK profile_id: UUID ───────┼────────────────────┐
│    year: INTEGER             │    │    employee_code: TEXT     │                    │
│    semester: INTEGER         │    │    designation: TEXT       │                    │
│    division: TEXT            │    │    department: TEXT        │                    │
│    department: TEXT          │    │    status: TEXT            │                    │
│ FK class_teacher_id: UUID ───┼───►│    created_at: TIMESTAMPTZ │                    │
│    created_at: TIMESTAMPTZ   │    │    updated_at: TIMESTAMPTZ │                    │
│    updated_at: TIMESTAMPTZ   │    └────────────────────────────┘                    │
└───────────────┬──────────────┘                  │                                    │
                │                                  │                                    │
                │ 1:N                              │ 1:N                                │
                ▼                                  ▼                                    │
┌──────────────────────────────┐    ┌────────────────────────────────────────────────┐ │
│         STUDENTS             │    │            SUBJECT_ALLOCATIONS                  │ │
│──────────────────────────────│    │────────────────────────────────────────────────│ │
│ PK id: UUID                  │    │ PK id: UUID                                    │ │
│    name: TEXT                │    │ FK class_id: UUID ─────────────────────────────┼─┼──┐
│    enrollment_no: TEXT       │    │ FK subject_id: UUID ───────────────────────────┼─┼──┼──┐
│    roll_no: INTEGER ◄────────┼────│ FK faculty_id: UUID ───────────────────────────┼─┘  │  │
│    year: INTEGER             │    │    academic_year: TEXT                         │    │  │
│    semester: INTEGER         │    │    semester: INTEGER                           │    │  │
│ FK class_id: UUID ───────────┼───►│    batch: TEXT (A/B/ALL) ◄─── NEW              │    │  │
│    division: TEXT            │    │    created_at: TIMESTAMPTZ                     │    │  │
│    batch: TEXT (A/B) ◄───────┼────│────────────────────────────────────────────────│    │  │
│    department: TEXT          │    └────────────────────────────────────────────────┘    │  │
│    fingerprint_id: INT ◄─────┼──── NEW: Maps to R307 sensor ID (1-120)                  │  │
│    mobile: TEXT              │                                                          │  │
│    email: TEXT               │    ┌────────────────────────────────────────────────┐    │  │
│    status: STUDENT_STATUS    │    │             SUBJECTS                            │◄───┼──┘
│    created_at: TIMESTAMPTZ   │    │────────────────────────────────────────────────│    │
│    updated_at: TIMESTAMPTZ   │    │ PK id: UUID                                    │    │
└───────────────┬──────────────┘    │    subject_code: TEXT                          │    │
                │                    │    name: TEXT                                  │    │
                │                    │    semester: INTEGER                           │    │
                │                    │    year: INTEGER                               │    │
                │                    │    department: TEXT                            │    │
                │                    │    type: SUBJECT_TYPE (TH/PR/TU)               │    │
                │                    │    weekly_lectures: INTEGER                    │    │
                │                    │    status: TEXT                                │    │
                │                    │    created_at: TIMESTAMPTZ                     │    │
                │                    │    updated_at: TIMESTAMPTZ                     │    │
                │                    └────────────────────────────────────────────────┘    │
                │                                                                          │
                │                    ┌────────────────────────────────────────────────┐    │
                │                    │           ESP32_DEVICES (NEW)                  │    │
                │                    │────────────────────────────────────────────────│    │
                │                    │ PK id: UUID                                    │    │
                │                    │    device_id: TEXT (unique hardware ID)        │    │
                │                    │    location: TEXT (classroom/lab)              │    │
                │                    │    status: TEXT (ACTIVE/INACTIVE)              │    │
                │                    │    last_ping: TIMESTAMPTZ                      │    │
                │                    │    firmware_version: TEXT                      │    │
                │                    │    created_at: TIMESTAMPTZ                     │    │
                │                    └─────────────────┬──────────────────────────────┘    │
                │                                      │                                    │
                │                                      │ 1:N                                │
                │                                      ▼                                    │
                │                    ┌────────────────────────────────────────────────┐    │
                │                    │        BIOMETRIC_SESSIONS (NEW)                │◄───┘
                │                    │────────────────────────────────────────────────│
                │                    │ PK id: UUID                                    │
                │                    │    session_token: TEXT (JWT/unique key)        │
                │                    │ FK device_id: UUID ────────────────────────────┼────┐
                │                    │ FK faculty_id: UUID ───────────────────────────┼────┼─►
                │                    │ FK class_id: UUID ─────────────────────────────┼────┤
                │                    │ FK subject_id: UUID ───────────────────────────┼────┤
                │                    │    lecture_type: TEXT (THEORY/PRACTICAL)       │    │
                │                    │    batch_lock: TEXT (A/B/ALL)                  │    │
                │                    │    allowed_rolls: INTEGER[] (roll list)        │    │
                │                    │    start_time: TIMESTAMPTZ                     │    │
                │                    │    end_time: TIMESTAMPTZ                       │    │
                │                    │    duration_minutes: INTEGER                   │    │
                │                    │    status: TEXT (ACTIVE/COMPLETED/CANCELLED)   │    │
                │                    │    created_at: TIMESTAMPTZ                     │    │
                │                    └─────────────────┬──────────────────────────────┘    │
                │                                      │                                    │
                │                                      │ 1:N                                │
                │                                      ▼                                    │
                │                    ┌────────────────────────────────────────────────┐    │
                │                    │        BIOMETRIC_RECORDS (NEW)                 │    │
                │                    │────────────────────────────────────────────────│    │
                └───────────────────►│ PK id: UUID                                    │    │
                                     │ FK session_id: UUID ───────────────────────────┼────┤
                                     │ FK student_id: UUID                            │    │
                                     │    roll_no: INTEGER (from fingerprint_id)      │    │
                                     │    fingerprint_id: INTEGER (matched ID)        │    │
                                     │    status: ATTENDANCE_STATUS                   │    │
                                     │    scan_timestamp: TIMESTAMPTZ                 │    │
                                     │    sync_status: TEXT (SYNCED/PENDING/FAILED)   │    │
                                     │    device_id: TEXT                             │    │
                                     │    verification_score: INTEGER (0-100)         │    │
                                     │    remarks: TEXT                               │    │
                                     │    created_at: TIMESTAMPTZ                     │    │
                                     │    synced_at: TIMESTAMPTZ                      │    │
                                     └────────────────────────────────────────────────┘    │
                                                                                           │
                                     ┌────────────────────────────────────────────────┐    │
                                     │        OFFLINE_SYNC_QUEUE (NEW)                │    │
                                     │────────────────────────────────────────────────│    │
                                     │ PK id: UUID                                    │    │
                                     │ FK device_id: UUID ────────────────────────────┼────┘
                                     │    session_token: TEXT                         │
                                     │    record_data: JSONB                          │
                                     │    attempts: INTEGER                           │
                                     │    last_attempt: TIMESTAMPTZ                   │
                                     │    status: TEXT (PENDING/PROCESSING/DONE/FAIL) │
                                     │    error_message: TEXT                         │
                                     │    created_at: TIMESTAMPTZ                     │
                                     │    processed_at: TIMESTAMPTZ                   │
                                     └────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         ENUM DEFINITIONS                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   USER_ROLE          STUDENT_STATUS      SUBJECT_TYPE      ATTENDANCE_STATUS      SYNC_STATUS       │
│   ──────────         ──────────────      ────────────      ─────────────────      ───────────       │
│   • ADMIN            • ACTIVE            • TH (Theory)     • PRESENT              • SYNCED          │
│   • FACULTY          • YD (Year Down)    • PR (Practical)  • ABSENT               • PENDING         │
│   • STUDENT          • PASSOUT           • TU (Tutorial)   • LATE                 • FAILED          │
│                                                             • REJECTED                               │
│                                                                                                      │
│   SESSION_STATUS          BATCH_TYPE           LECTURE_TYPE                                         │
│   ──────────────          ──────────           ────────────                                         │
│   • ACTIVE                • A                  • THEORY                                              │
│   • COMPLETED             • B                  • PRACTICAL                                           │
│   • CANCELLED             • ALL                • TUTORIAL                                            │
│   • EXPIRED                                                                                          │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     RELATIONSHIP SUMMARY                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│  PROFILES ──────────────────────── 1:1 ────────────────────────► FACULTY                            │
│  CLASSES ───────────────────────── 1:N ────────────────────────► STUDENTS                           │
│  CLASSES ───────────────────────── 1:N ────────────────────────► SUBJECT_ALLOCATIONS                │
│  SUBJECTS ──────────────────────── 1:N ────────────────────────► SUBJECT_ALLOCATIONS                │
│  FACULTY ───────────────────────── 1:N ────────────────────────► SUBJECT_ALLOCATIONS                │
│  FACULTY ───────────────────────── 1:N ────────────────────────► BIOMETRIC_SESSIONS                 │
│  ESP32_DEVICES ─────────────────── 1:N ────────────────────────► BIOMETRIC_SESSIONS                 │
│  BIOMETRIC_SESSIONS ────────────── 1:N ────────────────────────► BIOMETRIC_RECORDS                  │
│  STUDENTS ──────────────────────── 1:N ────────────────────────► BIOMETRIC_RECORDS                  │
│  ESP32_DEVICES ─────────────────── 1:N ────────────────────────► OFFLINE_SYNC_QUEUE                 │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              FINGERPRINT ID MAPPING STRATEGY                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   RULE: fingerprint_id = roll_no (Direct 1:1 Mapping)                                               │
│                                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────┐   │
│   │   STUDENTS TABLE                           R307 SENSOR STORAGE                              │   │
│   │   ────────────────                         ──────────────────                               │   │
│   │                                                                                              │   │
│   │   Roll 1  ─────── fingerprint_id: 1  ─────► Sensor ID #1 (Template)                         │   │
│   │   Roll 2  ─────── fingerprint_id: 2  ─────► Sensor ID #2 (Template)                         │   │
│   │   Roll 37 ─────── fingerprint_id: 37 ─────► Sensor ID #37 (Template)                        │   │
│   │   Roll 120 ────── fingerprint_id: 120 ────► Sensor ID #120 (Template)                       │   │
│   │                                                                                              │   │
│   │   Benefits:                                                                                  │   │
│   │   ✓ Simple lookup on ESP32 (no complex mapping table)                                       │   │
│   │   ✓ Direct roll number identification from scan result                                      │   │
│   │   ✓ Easy reporting and debugging                                                            │   │
│   │   ✓ Scalable for 120 students per class                                                     │   │
│   └─────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## New Tables for Attendro Feature

### 1. `esp32_devices`
Tracks all registered biometric devices across classrooms.

### 2. `biometric_sessions`
Stores teacher-initiated lecture sessions with security tokens and batch locks.

### 3. `biometric_records`
Records individual fingerprint scans with verification data.

### 4. `offline_sync_queue`
Manages offline attendance data waiting to be synchronized.

## Key Design Decisions

1. **fingerprint_id = roll_no**: Simplifies device-side logic
2. **Session Token**: JWT-based authentication for device communication
3. **Batch Lock**: Ensures only correct batch students can mark attendance
4. **Sync Status**: Tracks offline/online synchronization state

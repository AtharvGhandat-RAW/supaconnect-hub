# Attendro API Endpoints & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ATTENDRO REST API SPECIFICATION                                  │
│                                  (Supabase Edge Functions)                                          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘


╔═════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                        1. CREATE SESSION - Start Lecture                                            ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                     ║
║  ENDPOINT:  POST /api/biometric/create-session                                                    ║
║  AUTH:      Required (Faculty JWT token)                                                          ║
║  RATE LIMIT: 10 requests/minute per user                                                          ║
║                                                                                                     ║
║  REQUEST BODY:                                                                                     ║
║  ──────────────                                                                                    ║
║  {                                                                                                  ║
║    "device_id": "D001",              // Device hardware ID                                         ║
║    "subject_id": "uuid-abc123",      // Subject UUID                                               ║
║    "class_id": "uuid-def456",        // Class UUID                                                 ║
║    "batch": "A",                     // "A", "B", or "ALL"                                        ║
║    "lecture_type": "THEORY",         // "THEORY" or "PRACTICAL"                                   ║
║    "duration_minutes": 50            // Lecture duration (30-120)                                  ║
║  }                                                                                                  ║
║                                                                                                     ║
║  RESPONSE (200 OK):                                                                                ║
║  ─────────────────                                                                                 ║
║  {                                                                                                  ║
║    "success": true,                                                                                ║
║    "session_id": "uuid-session",                                                                   ║
║    "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",                                   ║
║    "device_id": "D001",                                                                            ║
║    "subject": "Data Structures",                                                                   ║
║    "class": "SEM-4-DIV-A",                                                                         ║
║    "batch": "A",                                                                                   ║
║    "allowed_rolls": [1, 2, 3, ..., 60],                                                            ║
║    "start_time": "2025-01-12T09:00:00Z",                                                          ║
║    "end_time": "2025-01-12T09:50:00Z",                                                            ║
║    "expires_in": 3000,               // Seconds                                                    ║
║    "message": "Session created successfully"                                                      ║
║  }                                                                                                  ║
║                                                                                                     ║
║  ERROR (400 BAD REQUEST):                                                                          ║
║  ────────────────────────                                                                          ║
║  {                                                                                                  ║
║    "success": false,                                                                               ║
║    "error": "INVALID_DEVICE",                                                                      ║
║    "message": "Device D001 not found or inactive"                                                  ║
║  }                                                                                                  ║
║                                                                                                     ║
║  ERROR (403 FORBIDDEN):                                                                            ║
║  ──────────────────────                                                                            ║
║  {                                                                                                  ║
║    "success": false,                                                                               ║
║    "error": "NOT_AUTHORIZED",                                                                      ║
║    "message": "Faculty not assigned to this class"                                                 ║
║  }                                                                                                  ║
║                                                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝


╔═════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                        2. MARK ATTENDANCE - Record Fingerprint Scan                                 ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                     ║
║  ENDPOINT:  POST /api/biometric/mark-attendance                                                   ║
║  AUTH:      Required (Device token or Faculty JWT)                                                ║
║  RATE LIMIT: 100 requests/minute per device                                                       ║
║                                                                                                     ║
║  REQUEST BODY (from ESP32):                                                                        ║
║  ──────────────────────────                                                                       ║
║  {                                                                                                  ║
║    "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",                                   ║
║    "device_id": "D001",                                                                            ║
║    "roll_no": 37,                                                                                  ║
║    "fingerprint_id": 37,                                                                           ║
║    "timestamp": 1705080634,                                                                        ║
║    "verification_score": 95,                                                                       ║
║    "status": "PRESENT"                                                                             ║
║  }                                                                                                  ║
║                                                                                                     ║
║  RESPONSE (200 OK):                                                                                ║
║  ─────────────────                                                                                 ║
║  {                                                                                                  ║
║    "success": true,                                                                                ║
║    "record_id": "uuid-record",                                                                     ║
║    "roll_no": 37,                                                                                  ║
║    "status": "PRESENT",                                                                            ║
║    "timestamp": "2025-01-12T09:10:34Z",                                                           ║
║    "message": "Attendance marked successfully"                                                     ║
║  }                                                                                                  ║
║                                                                                                     ║
║  ERROR (401 UNAUTHORIZED):                                                                         ║
║  ──────────────────────────                                                                        ║
║  {                                                                                                  ║
║    "success": false,                                                                               ║
║    "error": "INVALID_TOKEN",                                                                       ║
║    "message": "Session token expired or invalid"                                                   ║
║  }                                                                                                  ║
║                                                                                                     ║
║  ERROR (409 CONFLICT):                                                                             ║
║  ─────────────────────                                                                             ║
║  {                                                                                                  ║
║    "success": false,                                                                               ║
║    "error": "ALREADY_MARKED",                                                                      ║
║    "message": "Roll 37 already marked for this session"                                            ║
║  }                                                                                                  ║
║                                                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝


╔═════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                  3. SYNC ATTENDANCE - Batch Upload Offline Records                                 ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                     ║
║  ENDPOINT:  POST /api/biometric/sync-attendance                                                   ║
║  AUTH:      Required (Device token)                                                               ║
║  RATE LIMIT: 20 requests/minute per device                                                        ║
║                                                                                                     ║
║  REQUEST BODY (Offline Records from ESP32):                                                        ║
║  ───────────────────────────────────────────                                                       ║
║  {                                                                                                  ║
║    "session_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",                                   ║
║    "device_id": "D001",                                                                            ║
║    "records": [                                                                                     ║
║      {                                                                                              ║
║        "roll_no": 37,                                                                              ║
║        "fingerprint_id": 37,                                                                       ║
║        "timestamp": 1705080634,                                                                    ║
║        "verification_score": 95,                                                                   ║
║        "status": "PRESENT"                                                                         ║
║      },                                                                                             ║
║      {                                                                                              ║
║        "roll_no": 15,                                                                              ║
║        "fingerprint_id": 15,                                                                       ║
║        "timestamp": 1705080645,                                                                    ║
║        "verification_score": 92,                                                                   ║
║        "status": "PRESENT"                                                                         ║
║      }                                                                                              ║
║    ]                                                                                                ║
║  }                                                                                                  ║
║                                                                                                     ║
║  RESPONSE (200 OK):                                                                                ║
║  ─────────────────                                                                                 ║
║  {                                                                                                  ║
║    "success": true,                                                                                ║
║    "synced_count": 2,                                                                              ║
║    "failed_count": 0,                                                                              ║
║    "duplicate_count": 0,                                                                           ║
║    "records": [                                                                                     ║
║      { "roll_no": 37, "status": "SYNCED" },                                                        ║
║      { "roll_no": 15, "status": "SYNCED" }                                                         ║
║    ],                                                                                               ║
║    "message": "2 records synced successfully"                                                      ║
║  }                                                                                                  ║
║                                                                                                     ║
║  PARTIAL SUCCESS (207 MULTI-STATUS):                                                               ║
║  ────────────────────────────────────                                                              ║
║  {                                                                                                  ║
║    "success": true,                                                                                ║
║    "synced_count": 1,                                                                              ║
║    "failed_count": 1,                                                                              ║
║    "records": [                                                                                     ║
║      { "roll_no": 37, "status": "SYNCED" },                                                        ║
║      { "roll_no": 75, "status": "FAILED", "reason": "NOT_IN_ALLOWED_BATCH" }                     ║
║    ]                                                                                                ║
║  }                                                                                                  ║
║                                                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝


╔═════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                        4. GET SESSION STATUS - Check Active Session                                ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                     ║
║  ENDPOINT:  GET /api/biometric/session/:session_id                                                ║
║  AUTH:      Required                                                                               ║
║  RATE LIMIT: 30 requests/minute                                                                    ║
║                                                                                                     ║
║  REQUEST PARAMS:                                                                                   ║
║  ───────────────                                                                                   ║
║  session_id: uuid-session (path parameter)                                                         ║
║                                                                                                     ║
║  RESPONSE (200 OK):                                                                                ║
║  ─────────────────                                                                                 ║
║  {                                                                                                  ║
║    "success": true,                                                                                ║
║    "session_id": "uuid-session",                                                                   ║
║    "status": "ACTIVE",                                                                             ║
║    "subject": "Data Structures",                                                                   ║
║    "class": "SEM-4-DIV-A",                                                                         ║
║    "batch": "A",                                                                                   ║
║    "start_time": "2025-01-12T09:00:00Z",                                                          ║
║    "end_time": "2025-01-12T09:50:00Z",                                                            ║
║    "time_remaining_seconds": 1850,                                                                 ║
║    "total_students": 60,                                                                           ║
║    "marked_count": 28,                                                                             ║
║    "absent_count": 32,                                                                             ║
║    "created_by": "uuid-faculty"                                                                    ║
║  }                                                                                                  ║
║                                                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝


╔═════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                    5. GET SESSION RECORDS - View Attendance for Session                             ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                     ║
║  ENDPOINT:  GET /api/biometric/session/:session_id/records                                        ║
║  AUTH:      Required (Faculty can view own, Admin all)                                             ║
║  RATE LIMIT: 20 requests/minute                                                                    ║
║                                                                                                     ║
║  QUERY PARAMS:                                                                                     ║
║  ──────────────                                                                                    ║
║  filter=PRESENT|ABSENT|ALL  (default: ALL)                                                         ║
║  sort=timestamp|roll_no     (default: timestamp)                                                   ║
║  limit=100                  (default: 100)                                                         ║
║  offset=0                   (default: 0)                                                          ║
║                                                                                                     ║
║  RESPONSE (200 OK):                                                                                ║
║  ─────────────────                                                                                 ║
║  {                                                                                                  ║
║    "success": true,                                                                                ║
║    "session_id": "uuid-session",                                                                   ║
║    "total_count": 60,                                                                              ║
║    "present_count": 28,                                                                            ║
║    "absent_count": 32,                                                                             ║
║    "records": [                                                                                     ║
║      {                                                                                              ║
║        "record_id": "uuid-record",                                                                 ║
║        "roll_no": 37,                                                                              ║
║        "student_name": "John Doe",                                                                 ║
║        "status": "PRESENT",                                                                        ║
║        "timestamp": "2025-01-12T09:10:34Z",                                                       ║
║        "verification_score": 95                                                                    ║
║      },                                                                                             ║
║      {                                                                                              ║
║        "roll_no": 15,                                                                              ║
║        "student_name": "Jane Smith",                                                               ║
║        "status": "ABSENT"                                                                          ║
║      }                                                                                              ║
║    ]                                                                                                ║
║  }                                                                                                  ║
║                                                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝


╔═════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                      6. END SESSION - Complete Lecture & Auto-Mark Absent                           ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                     ║
║  ENDPOINT:  POST /api/biometric/end-session                                                       ║
║  AUTH:      Required (Faculty who created session)                                                 ║
║  RATE LIMIT: 10 requests/minute per user                                                          ║
║                                                                                                     ║
║  REQUEST BODY:                                                                                     ║
║  ──────────────                                                                                    ║
║  {                                                                                                  ║
║    "session_id": "uuid-session",                                                                   ║
║    "end_reason": "TIME_EXPIRED|MANUAL_END|CANCELLED"                                              ║
║  }                                                                                                  ║
║                                                                                                     ║
║  RESPONSE (200 OK):                                                                                ║
║  ─────────────────                                                                                 ║
║  {                                                                                                  ║
║    "success": true,                                                                                ║
║    "session_id": "uuid-session",                                                                   ║
║    "status": "COMPLETED",                                                                          ║
║    "summary": {                                                                                     ║
║      "total_students": 60,                                                                         ║
║      "present": 28,                                                                                ║
║      "absent_auto_marked": 32,                                                                     ║
║      "absent_total": 32,                                                                           ║
║      "duration_actual": "50 min 15 sec"                                                            ║
║    },                                                                                               ║
║    "message": "Session completed and closed"                                                       ║
║  }                                                                                                  ║
║                                                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝


╔═════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                      7. GET ALLOWED STUDENTS - For Device Caching                                  ║
╠═════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                     ║
║  ENDPOINT:  GET /api/biometric/students/:class_id/:batch                                          ║
║  AUTH:      Required                                                                               ║
║  RATE LIMIT: 50 requests/minute                                                                    ║
║                                                                                                     ║
║  REQUEST PARAMS:                                                                                   ║
║  ───────────────                                                                                   ║
║  class_id: uuid-class (path)                                                                       ║
║  batch: A|B|ALL        (path)                                                                      ║
║                                                                                                     ║
║  RESPONSE (200 OK):                                                                                ║
║  ─────────────────                                                                                 ║
║  {                                                                                                  ║
║    "success": true,                                                                                ║
║    "class_id": "uuid-class",                                                                       ║
║    "batch": "A",                                                                                   ║
║    "total_count": 60,                                                                              ║
║    "students": [                                                                                    ║
║      {                                                                                              ║
║        "roll_no": 1,                                                                               ║
║        "name": "Student One",                                                                      ║
║        "fingerprint_id": 1,                                                                        ║
║        "enrollment_no": "AI210001"                                                                 ║
║      },                                                                                             ║
║      ...                                                                                            ║
║      {                                                                                              ║
║        "roll_no": 60,                                                                              ║
║        "name": "Student Sixty",                                                                    ║
║        "fingerprint_id": 60,                                                                       ║
║        "enrollment_no": "AI210060"                                                                 ║
║      }                                                                                              ║
║    ]                                                                                                ║
║  }                                                                                                  ║
║                                                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════════════════════════════╝


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    API AUTHENTICATION HEADERS                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   For Faculty/Admin Users:                                                                         │
│   ─────────────────────────                                                                        │
│   Authorization: Bearer <JWT_TOKEN>                                                                │
│   Content-Type: application/json                                                                   │
│   X-Requested-With: XMLHttpRequest                                                                 │
│                                                                                                      │
│   For Device (ESP32):                                                                               │
│   ─────────────────────                                                                             │
│   Authorization: Bearer <SESSION_TOKEN> (or JWT if device credentials)                             │
│   Content-Type: application/json                                                                   │
│   X-Device-ID: D001                                                                                │
│   User-Agent: Attendro-Device/1.0                                                                 │
│                                                                                                      │
│   For Realtime Subscriptions (WebSocket):                                                           │
│   ──────────────────────────────────────                                                           │
│   URL: wss://[project].supabase.co/realtime/v1?apikey=[ANON_KEY]                                  │
│   Message: {"type": "subscribe", "payload": {"channel": "session:uuid"}}                           │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    COMMON ERROR CODES                                               │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   400 BAD REQUEST              Invalid parameters or request format                                 │
│   401 UNAUTHORIZED             Missing or invalid JWT/session token                                │
│   403 FORBIDDEN                User lacks permissions for this action                              │
│   404 NOT FOUND                Resource (session, device, student) not found                       │
│   409 CONFLICT                 Duplicate attendance or session state conflict                      │
│   429 TOO MANY REQUESTS        Rate limit exceeded                                                 │
│   500 INTERNAL SERVER ERROR    Unexpected server error                                             │
│   503 SERVICE UNAVAILABLE      Database or backend service down                                    │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

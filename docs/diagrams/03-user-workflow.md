# Attendro User Workflow Diagrams

## 1. Teacher Session Start Workflow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                            TEACHER SESSION START WORKFLOW                                            │
│                        (Faculty App → Backend → ESP32 Device)                                        │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │   TEACHER   │      │ FACULTY APP │      │  SUPABASE   │      │   DATABASE  │      │   ESP32     │
    │   (Actor)   │      │  (Mobile)   │      │  (Backend)  │      │ (PostgreSQL)│      │  (Device)   │
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
           │                    │                    │                    │                    │
           │  1. Open App &     │                    │                    │                    │
           │     Login          │                    │                    │                    │
           │───────────────────►│                    │                    │                    │
           │                    │                    │                    │                    │
           │                    │  2. Authenticate   │                    │                    │
           │                    │─────────────────── │                    │                    │
           │                    │                    │  3. Verify JWT     │                    │
           │                    │                    │───────────────────►│                    │
           │                    │                    │                    │                    │
           │                    │◄──── 4. Auth OK ───│◄───────────────────│                    │
           │                    │                    │                    │                    │
           │  5. Select:        │                    │                    │                    │
           │  • Device ID       │                    │                    │                    │
           │  • Subject         │                    │                    │                    │
           │  • Class/Division  │                    │                    │                    │
           │  • Lecture Type    │                    │                    │                    │
           │  • Batch (A/B/All) │                    │                    │                    │
           │  • Duration        │                    │                    │                    │
           │───────────────────►│                    │                    │                    │
           │                    │                    │                    │                    │
           │  6. Press "Start   │                    │                    │                    │
           │     Lecture"       │                    │                    │                    │
           │───────────────────►│                    │                    │                    │
           │                    │                    │                    │                    │
           │                    │  7. POST /api/     │                    │                    │
           │                    │     create-session │                    │                    │
           │                    │─────────────────── │                    │                    │
           │                    │                    │                    │                    │
           │                    │                    │  8. Generate:      │                    │
           │                    │                    │  • session_token   │                    │
           │                    │                    │  • allowed_rolls[] │                    │
           │                    │                    │───────────────────►│                    │
           │                    │                    │                    │                    │
           │                    │                    │◄─── 9. Session ────│                    │
           │                    │                    │      Created       │                    │
           │                    │                    │                    │                    │
           │                    │                    │  10. Push session  │                    │
           │                    │                    │      to ESP32      │                    │
           │                    │                    │─────────────────────────────────────────►│
           │                    │                    │                    │                    │
           │                    │                    │                    │    11. Store:      │
           │                    │                    │                    │    • Token         │
           │                    │                    │                    │    • Roll list     │
           │                    │                    │                    │    • Time window   │
           │                    │                    │◄───── 12. ACK ─────│────────────────────│
           │                    │                    │                    │                    │
           │                    │◄─ 13. Session      │                    │                    │
           │                    │    Started         │                    │                    │
           │◄───────────────────│                    │                    │                    │
           │  14. Show "Session │                    │                    │                    │
           │      Active" UI    │                    │                    │                    │
           │                    │                    │                    │                    │
    ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐
    │   TEACHER   │      │ FACULTY APP │      │  SUPABASE   │      │   DATABASE  │      │   ESP32     │
    │   (Actor)   │      │  (Mobile)   │      │  (Backend)  │      │ (PostgreSQL)│      │  (Device)   │
    └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘
```

---

## 2. Student Attendance Marking Workflow (Online Mode)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        STUDENT ATTENDANCE MARKING WORKFLOW (ONLINE)                                  │
│                              (Student → ESP32 → Backend → Dashboard)                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │   STUDENT   │      │    R307     │      │   ESP32     │      │  SUPABASE   │      │  DASHBOARD  │
    │   (Actor)   │      │  (Sensor)   │      │  (Device)   │      │  (Backend)  │      │   (Web)     │
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘      └──────┬──────┘      └──────┴──────┘
           │                    │                    │                    │                    │
           │                    │                    │  ◄── Session       │                    │
           │                    │                    │       Active ──►   │                    │
           │                    │                    │                    │                    │
           │  1. Place finger   │                    │                    │                    │
           │     on sensor      │                    │                    │                    │
           │───────────────────►│                    │                    │                    │
           │                    │                    │                    │                    │
           │                    │  2. Capture &      │                    │                    │
           │                    │     Match Template │                    │                    │
           │                    │───────────────────►│                    │                    │
           │                    │                    │                    │                    │
           │                    │  3. Return         │                    │                    │
           │                    │     fingerID = 37  │                    │                    │
           │                    │───────────────────►│                    │                    │
           │                    │                    │                    │                    │
           │                    │                    │  4. VALIDATION:    │                    │
           │                    │                    │  ┌────────────────┐│                    │
           │                    │                    │  │ ✓ Session      ││                    │
           │                    │                    │  │   Active?      ││                    │
           │                    │                    │  │ ✓ Token Valid? ││                    │
           │                    │                    │  │ ✓ Roll 37 in   ││                    │
           │                    │                    │  │   allowed_list?││                    │
           │                    │                    │  │ ✓ Not already  ││                    │
           │                    │                    │  │   marked?      ││                    │
           │                    │                    │  └────────────────┘│                    │
           │                    │                    │                    │                    │
           │                    │                    │  5. POST /api/     │                    │
           │                    │                    │     mark-attendance│                    │
           │                    │                    │───────────────────►│                    │
           │                    │                    │                    │                    │
           │                    │                    │                    │  6. Insert        │
           │                    │                    │                    │     biometric_    │
           │                    │                    │                    │     records       │
           │                    │                    │                    │────────────────────►
           │                    │                    │                    │                    │
           │                    │                    │                    │  7. Broadcast     │
           │                    │                    │                    │     Realtime      │
           │                    │                    │                    │     Update        │
           │                    │                    │                    │────────────────────►
           │                    │                    │                    │                    │
           │                    │                    │◄─── 8. Success ────│                    │
           │                    │                    │                    │                    │
           │                    │  9. OLED Display:  │                    │                    │
           │◄───────────────────│◄─ "Roll 37        ─│                    │                    │
           │                    │    PRESENT ✓"      │                    │                    │
           │                    │                    │                    │                    │
    ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐      ┌──────┴──────┐
    │   STUDENT   │      │    R307     │      │   ESP32     │      │  SUPABASE   │      │  DASHBOARD  │
    └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘      └─────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    VALIDATION REJECTION SCENARIOS                                    │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   ❌ Scenario 1: No Active Session                                                                  │
│      OLED Display: "No Active Lecture - Contact Teacher"                                            │
│                                                                                                      │
│   ❌ Scenario 2: Wrong Batch/Class (Roll 75 tries Batch A session)                                  │
│      OLED Display: "Not Allowed - Wrong Batch/Class"                                                │
│                                                                                                      │
│   ❌ Scenario 3: Already Marked                                                                     │
│      OLED Display: "Roll 37 Already Marked"                                                         │
│                                                                                                      │
│   ❌ Scenario 4: Session Expired                                                                    │
│      OLED Display: "Session Ended - Time Expired"                                                   │
│                                                                                                      │
│   ❌ Scenario 5: Fingerprint Not Recognized                                                         │
│      OLED Display: "Fingerprint Not Found"                                                          │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Offline Attendance & Sync Workflow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              OFFLINE ATTENDANCE & SYNC WORKFLOW                                      │
│                         (Student → ESP32 [No Internet] → Later Sync)                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘


    PHASE 1: OFFLINE ATTENDANCE RECORDING
    ═══════════════════════════════════════

    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │   STUDENT   │      │   ESP32     │      │  LOCAL      │
    │   (Actor)   │      │  (Device)   │      │  STORAGE    │
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
           │                    │                    │
           │                    │  ┌─────────────┐   │
           │                    │  │ Wi-Fi: ❌   │   │
           │                    │  │ Session: ✓  │   │
           │                    │  │ (cached)    │   │
           │                    │  └─────────────┘   │
           │                    │                    │
           │  1. Place finger   │                    │
           │───────────────────►│                    │
           │                    │                    │
           │                    │  2. Validate       │
           │                    │     against cached │
           │                    │     allowed_rolls  │
           │                    │                    │
           │                    │  3. VALID ✓        │
           │                    │     Store locally  │
           │                    │───────────────────►│
           │                    │                    │
           │                    │  4. Record stored: │
           │                    │  {                 │
           │                    │    roll: 37,       │
           │                    │    session_id: x,  │
           │                    │    timestamp: t,   │
           │                    │    sync: PENDING   │
           │                    │  }                 │
           │                    │                    │
           │  5. OLED:          │                    │
           │  "Roll 37 Saved    │                    │
           │◄──Offline" ────────│                    │
           │                    │                    │


    PHASE 2: AUTOMATIC SYNC WHEN ONLINE
    ════════════════════════════════════

    ┌─────────────┐      ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
    │  LOCAL      │      │   ESP32     │      │  SUPABASE   │      │   DATABASE  │
    │  STORAGE    │      │  (Device)   │      │  (Backend)  │      │ (PostgreSQL)│
    └──────┬──────┘      └──────┬──────┘      └──────┬──────┘      └──────┬──────┘
           │                    │                    │                    │
           │                    │  ┌─────────────┐   │                    │
           │                    │  │ Wi-Fi: ✓    │   │                    │
           │                    │  │ Connected!  │   │                    │
           │                    │  └─────────────┘   │                    │
           │                    │                    │                    │
           │  1. Get pending    │                    │                    │
           │     records        │                    │                    │
           │◄───────────────────│                    │                    │
           │                    │                    │                    │
           │  2. Return records │                    │                    │
           │───────────────────►│                    │                    │
           │                    │                    │                    │
           │                    │  3. POST /api/     │                    │
           │                    │     sync-attendance│                    │
           │                    │     (batch upload) │                    │
           │                    │───────────────────►│                    │
           │                    │                    │                    │
           │                    │                    │  4. Validate       │
           │                    │                    │     session_token  │
           │                    │                    │───────────────────►│
           │                    │                    │                    │
           │                    │                    │  5. Batch insert   │
           │                    │                    │     biometric_     │
           │                    │                    │     records        │
           │                    │                    │───────────────────►│
           │                    │                    │                    │
           │                    │                    │◄─── 6. Success ────│
           │                    │                    │                    │
           │                    │◄─── 7. Sync OK ────│                    │
           │                    │     {synced: 15}   │                    │
           │                    │                    │                    │
           │  8. Mark records   │                    │                    │
           │     as SYNCED      │                    │                    │
           │◄───────────────────│                    │                    │
           │                    │                    │                    │
           │                    │  9. OLED:          │                    │
           │                    │  "15 records       │                    │
           │                    │   synced ✓"        │                    │
           │                    │                    │                    │


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    OFFLINE SYNC DATA STRUCTURE                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   struct OfflineRecord {                                                                            │
│       uint8_t  roll_no;           // 1-120                                                          │
│       uint8_t  fingerprint_id;    // Same as roll_no                                                │
│       char     session_token[64]; // Cached session token                                           │
│       uint32_t timestamp;         // Unix timestamp                                                 │
│       uint8_t  sync_status;       // 0=PENDING, 1=SYNCED, 2=FAILED                                  │
│   };                                                                                                │
│                                                                                                      │
│   // ESP32 can store up to 200 offline records in SPIFFS                                            │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Complete Session Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   COMPLETE SESSION LIFECYCLE                                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
    │  IDLE   │────►│ SESSION │────►│ ACTIVE  │────►│ ENDING  │────►│COMPLETED│────►│REPORTING│
    │         │     │ CREATED │     │         │     │         │     │         │     │         │
    └─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘     └─────────┘


    ╔═════════════════════════════════════════════════════════════════════════════════════════════╗
    ║                                    STAGE DETAILS                                             ║
    ╠═════════════════════════════════════════════════════════════════════════════════════════════╣
    ║                                                                                              ║
    ║  1. IDLE STATE                                                                              ║
    ║     ├── ESP32 shows: "Attendro | Device ID: D001 | Waiting for lecture"                     ║
    ║     ├── Listening for session start command from server                                     ║
    ║     └── No fingerprint scanning allowed                                                     ║
    ║                                                                                              ║
    ║  2. SESSION CREATED                                                                         ║
    ║     ├── Teacher presses "Start Lecture" in Faculty App                                      ║
    ║     ├── Server generates session_token + allowed_rolls[]                                    ║
    ║     ├── ESP32 receives: {token, rolls, subject, batch, duration}                            ║
    ║     └── Transitions to ACTIVE within 5 seconds                                              ║
    ║                                                                                              ║
    ║  3. ACTIVE STATE                                                                            ║
    ║     ├── ESP32 shows: "Data Structures | Batch A | 45 min left | Scan finger"                ║
    ║     ├── Fingerprint scanning ENABLED                                                        ║
    ║     ├── Each valid scan → mark attendance                                                   ║
    ║     ├── Invalid scans → show rejection reason                                               ║
    ║     └── Duration countdown running                                                          ║
    ║                                                                                              ║
    ║  4. ENDING STATE                                                                            ║
    ║     ├── Triggered by: Duration expires OR Teacher ends session                              ║
    ║     ├── ESP32 shows: "Session Ending | Syncing..."                                          ║
    ║     ├── Upload any remaining offline records                                                ║
    ║     └── Wait for server confirmation                                                        ║
    ║                                                                                              ║
    ║  5. COMPLETED STATE                                                                         ║
    ║     ├── All records synced to server                                                        ║
    ║     ├── Session marked as COMPLETED in database                                             ║
    ║     ├── Absent students auto-marked                                                         ║
    ║     └── Transitions back to IDLE                                                            ║
    ║                                                                                              ║
    ║  6. REPORTING                                                                               ║
    ║     ├── Dashboard updates with final attendance                                             ║
    ║     ├── Notifications sent (optional)                                                       ║
    ║     └── Reports available for download                                                      ║
    ║                                                                                              ║
    ╚═════════════════════════════════════════════════════════════════════════════════════════════╝


┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      TIME-BASED SESSION FLOW                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│   TIME        EVENT                          SYSTEM ACTION                                          │
│   ────        ─────                          ─────────────                                          │
│   09:00       Teacher starts 50-min session  Create session, send to device                        │
│   09:01       Session active                 Device shows "Scan finger"                            │
│   09:02-09:45 Students scan fingerprints     Mark attendance, show results                         │
│   09:45       5-min warning                  Device shows "5 min remaining"                        │
│   09:50       Session ends                   Auto-complete, mark absent                            │
│   09:51       Sync complete                  Device returns to IDLE                                │
│                                                                                                      │
│   ⚠️  GRACE PERIOD: Students can scan up to 2 minutes after official end time                      │
│   ⚠️  LATE MARKING: Scans in last 5 minutes can be marked as "LATE"                                │
│                                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

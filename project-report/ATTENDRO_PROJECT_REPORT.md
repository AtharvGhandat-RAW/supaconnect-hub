# ATTENDRO: Biometric + App-Based Attendance System

> NOTE FOR FORMATTING (Word): Apply Times New Roman, 12 pt, justified; headings per guidelines (Chapter Name 14 pt CAPS, Section Heading 12 pt CAPS bold, Subsection 12 pt bold). Set margins: Left 3.5 cm, Top 2.5 cm, Right 1.25 cm, Bottom 1.25 cm. Use double line spacing. Page order: Title Page (i), Certificate (ii), Acknowledgement (iii), Index/Contents (iv), Abstract (v), List of Figures (vi), List of Tables (vii), then Chapter 1 onward (Arabic page numbers starting at 1).

---

## Title Page (i)
**Title:** ATTENDRO: Secure Biometric + App-Based Attendance Management for Polytechnic Institutes  
**Candidate:** ______________________  
**Diploma (Department):** Applied AI & ML  
**Institute:** Rajarambapu Institute of Technology, Islampur  
**Academic Year:** 2025–2026  
**Guide:** ______________________  
**Date of Submission:** ______________________

## Certificate of the Guide (ii)
This is to certify that the project titled **“ATTENDRO: Secure Biometric + App-Based Attendance Management for Polytechnic Institutes”** has been carried out by **[Student Name]** under my guidance and supervision in partial fulfillment of the requirements for the award of the Diploma in **Applied AI & ML** at **Rajarambapu Institute of Technology, Islampur**, during the academic year **2025–2026**.  

Guide Signature: __________   Date: __________  
HOD Signature: __________   Principal Signature: __________

## Acknowledgement (iii)
I express sincere gratitude to **[Guide Name]** for guidance and feedback, to the **Department of Applied AI & ML** for resources, to my peers for collaboration, and to my family for support throughout this project.

## Index / Table of Contents (iv)
- Title Page ............................................................... i  
- Certificate of the Guide ................................................ ii  
- Acknowledgement ......................................................... iii  
- Index / Contents ........................................................ iv  
- Abstract ............................................................... v  
- List of Figures ........................................................ vi  
- List of Tables ......................................................... vii  
- Chapter–1 Introduction ................................................. 1  
- Chapter–2 Literature Survey ............................................. 5  
- Chapter–3 Scope of the Project .......................................... 9  
- Chapter–4 Methodology / Approach ........................................ 13  
- Chapter–5 Designs, Working and Processes ............................... 18  
- Chapter–6 Results and Applications ...................................... 27  
- Chapter–7 Conclusion ................................................... 32  
- References ............................................................. 34

## Abstract (v)
This project delivers **Attendro**, a secure attendance platform that unifies biometric capture on an ESP32-based terminal with a modern web and mobile application stack. It addresses proxy attendance, delayed reporting, and fragmented records by integrating biometric verification, session-based controls, timetable-aware scheduling, and real-time analytics. The implementation uses **Supabase (PostgreSQL + Auth + Realtime)**, **React/React Native frontends**, and an **ESP32 + R307 fingerprint sensor** with offline buffering. Key outcomes include accurate presence capture, reduced manual effort, and faster compliance reporting.

## List of Figures (vi)
1. System Architecture Diagram – Figure 1  
2. Database ER Diagram – Figure 2  
3. Attendance Marking Flow – Figure 3  
4. User Roles Swimlane – Figure 4  
5. Device Wiring Diagram – Figure 5  
6. OLED Interface States – Figure 6  
7. Security Model – Figure 7  
8. Session Token Structure – Figure 8  
9. Use Case Diagram – Figure 10  
10. Module Breakdown – Figure 11  
11. Context-Level DFD – Figure 12  

## List of Tables (vii)
1. Pin Configuration – Table 1  
2. Security Threat Matrix – Table 2  
3. Attendance Dataset Summary – Table 3 (placeholder)  

---

# Chapter–1 Introduction (background of the Project Problem)
### 1.1 Problem Statement
Polytechnic institutes face proxy attendance, manual errors, delayed consolidation, and weak audit trails. Existing systems rely on manual entry or QR scans without biometric trust, leading to compliance gaps.

### 1.2 Objectives
- Achieve **high-trust attendance** using fingerprint biometrics (R307) with session-bound tokens.
- Provide **timetable-aware sessions** for classes/batches/subjects with substitution handling.
- Enable **real-time dashboards** for admins/faculty and **offline capture** on devices.
- Ensure **data integrity** via RBAC, RLS policies, and duplicate-prevention constraints.

### 1.3 Constraints and Assumptions
- Network intermittency on devices; must queue and sync when online.  
- Student enrollment includes roll range per batch; device must enforce batch lock.  
- Auth via Supabase; database is PostgreSQL; frontends are React/React Native.  

# Chapter–2 Literature Survey (to finalize and define the Problem Statement)
- **Biometric attendance**: High accuracy but needs anti-spoofing and time/window validation.  
- **Session-based control**: Tokens tied to class/subject/time reduce misuse.  
- **Offline-first IoT**: Queueing on ESP32 with eventual consistency over Wi‑Fi.  
- **RBAC + RLS**: Database-level policies to segregate admin/faculty/student access.  
- **Prior gaps**: Many systems miss batch locking, substitution workflows, and unified reporting.  

# Chapter–3 Scope of the Project
### 3.1 In-Scope
- Admin web app: master data (faculty/students/classes/subjects), timetable, leaves, substitutions, reports.  
- Faculty app: start sessions, unlock device, manual marking fallback, view attendance.  
- ESP32 terminal: biometric capture, OLED guidance, offline queue, secure token validation.  
- Supabase backend: Auth, PostgREST API, Realtime, edge functions for token issue and sync.

### 3.2 Out-of-Scope
- Face recognition; advanced geo-fencing; payroll integration.  

### 3.3 Success Criteria
- ≥98% biometric match accuracy; ≤2s average scan-to-record latency online; offline queue durability; zero duplicate marks per session.

# Chapter–4 Methodology / Approach
### 4.1 Architecture Overview
Three-tier model: presentation (web + mobile + device), API layer (PostgREST, edge functions, Realtime), data layer (PostgreSQL + storage). See Figure 1.

### 4.2 Process Flow
Faculty starts a session → token issued → device validates token → students scan → records stored/queued → sync → dashboard updates (Figures 3–4).

### 4.3 Data Model
Tables: profiles, faculty, classes, students, subjects, subject_allocations, timetable_slots, attendance_sessions, attendance_records, faculty_leaves, substitution_assignments, activity_log. See Figure 2.

### 4.4 Security Controls
Eight-layer model: auth (JWT), RBAC/RLS, session token HMAC, batch lock, biometric FAR control, duplicate-prevention constraint, time-gate, device auth. See Figures 7–8 and Table 2.

### 4.5 Tools and Stack
- Frontend: React + TypeScript; React Native (planned).  
- Backend: Supabase (Auth, PostgREST, Realtime, Edge Functions).  
- Device: ESP32 DevKit V1, R307 sensor, SSD1306 OLED.  
- Styling/Build: Vite, Tailwind.  

# Chapter–5 Details of Designs, Working and Processes
### 5.1 Module Design
- Master Data, Scheduling, Attendance, Leave/Substitution, Reports, Biometric (see Figure 11).  

### 5.2 Device Interface & Wiring
ESP32 ↔ R307 over UART; ESP32 ↔ OLED over I2C; pin map in Table 1; diagrams in Figure 5 and Figure 6.

### 5.3 Use Cases
Actors: Admin, Faculty, Student, ESP32 device. Key cases: manage users, configure timetable, start session, unlock device, scan fingerprint, view reports (Figure 10).

### 5.4 Data Flow
Context-level DFD in Figure 12: Faculty/Admin ↔ System ↔ Database.

### 5.5 Offline and Sync
- Queue attendance when offline; retry with exponential backoff.  
- Conflict rule: first valid mark per student per session wins; admin overrides flagged.  

### 5.6 Validation Rules
- Session time window ±5 minutes; batch lock by roll range; one record per student per session; substitution must match approved leave.

# Chapter–6 Results and Applications
### 6.1 Expected Results (pilot targets)
- Attendance accuracy ≥98%; proxy attempts blocked by biometric + batch lock.  
- Session setup < 30 seconds; scan-to-record median < 2 seconds online.  

### 6.2 Applications
- Daily compliance reports; defaulter lists; audit trails of overrides; rapid substitution handling during faculty leave.

### 6.3 Screens/Diagrams for Publication
Include HTML diagrams exported to PDF/PNG from `project-report/diagrams/*.html` for journal or conference papers.

# Chapter–7 Conclusion
Attendro combines biometric assurance with timetable-aware sessions and robust RBAC to deliver reliable attendance data. The architecture is modular, offline-tolerant, and ready for production deployment in polytechnic settings.

# References
[1] Ross, A., & Jain, A. (2021). Biometric sensor interoperability and performance. *IEEE TPAMI*.  
[2] Supabase. (2024). PostgREST & RLS Security Guide.  
[3] Espressif Systems. (2023). ESP32 Hardware Design Guidelines.  
[4] R307 Fingerprint Module Datasheet. (2020). Hangzhou Grow Technology.  
[5] SSD1306 OLED Controller Datasheet. (2019). Solomon Systech.  

---

## Appendices
- Appendix A: API endpoint list (GET/POST attendance sessions, records, timetable, leaves, substitutions).  
- Appendix B: Test plan and sample test cases (unit + integration for token issuance, duplicate prevention, batch lock).  
- Appendix C: Deployment checklist (env vars, RLS policies, storage buckets, device enrollment).  

## How to Generate the Word Document
1) Open this file in VS Code or any editor.  
2) Copy into Word; set Times New Roman 12 pt, double spacing, margins: L 3.5 cm, T 2.5 cm, R 1.25 cm, B 1.25 cm.  
3) Apply heading styles: Chapter titles 14 pt CAPS; section headings 12 pt CAPS bold; subsection 12 pt bold.  
4) Insert page numbers: front matter in Roman (i–vii), main matter Arabic starting at 1.  
5) Export diagrams by opening each HTML in `project-report/diagrams/` and printing to PDF/PNG, then embed into Word at the referenced figure numbers.  

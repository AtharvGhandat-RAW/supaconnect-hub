# RIT Polytechnic - AIML Department Attendance Management System

A premium, production-ready attendance and academic management web application for Rajarambapu Institute of Technology (Polytechnic) – AIML Department.

## Features

### Admin Dashboard
- Real-time attendance monitoring and statistics
- Faculty, Classes, Subjects, and Students management
- Timetable import and management
- Faculty leave approval with auto-substitution
- Holiday and calendar management
- Manual substitution assignments
- Defaulter list generation with PDF/CSV exports
- Student promotion/YD wizard
- Comprehensive reports and analytics

### Faculty Dashboard
- Today's lectures overview
- Attendance marking
- Lecture transfer requests
- Auto-generated absent messages (English & Marathi)
- Leave request management
- Subject-wise reports

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS (dark mode)
- **Animations**: Framer Motion
- **Backend**: Supabase (Auth, Postgres, Realtime, Storage)
- **Serverless**: Supabase Edge Functions (TypeScript)
- **Charts**: Recharts
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd rit-attendance-system

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`


## Edge Functions

The application uses three Supabase Edge Functions:

### 1. assign-substitute

Automatically assigns substitute faculty when leave is approved.

**Input:**
```json
{
  "faculty_id": "uuid",
  "date": "YYYY-MM-DD",
  "window": "FULL_DAY" | "HALF_MORNING" | "HALF_AFTERNOON"
}
```

### 2. generate-defaulter

Computes defaulter students based on attendance threshold.

**Input:**
```json
{
  "class_id": "uuid",
  "from": "YYYY-MM-DD",
  "to": "YYYY-MM-DD",
  "threshold": 75
}
```

### 3. ai-summary

Generates monthly attendance summary and insights.

**Input:**
```json
{
  "month": "YYYY-MM",
  "class_id": "uuid (optional)"
}
```

### Deploying Edge Functions


```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Deploy functions
supabase functions deploy assign-substitute
supabase functions deploy generate-defaulter
supabase functions deploy ai-summary
```

## Database Schema

The application uses the following main tables:

- `profiles` - User profiles linked to auth.users
- `faculty` - Faculty information
- `classes` - Class/division data
- `students` - Student records
- `subjects` - Subject master
- `subject_allocations` - Faculty-subject-class mapping
- `timetable_slots` - Weekly timetable
- `attendance_sessions` - Attendance session records
- `attendance_records` - Individual student attendance
- `faculty_leaves` - Leave requests
- `substitution_assignments` - Substitute faculty assignments
- `holidays` - Holiday and calendar management
- `lecture_transfers` - Faculty lecture transfer requests
- `activity_log` - System activity log
- `settings` - Application settings

## Authentication

- Email/Password authentication via Supabase Auth
- Role-based access control (ADMIN / FACULTY)
- No public signup - accounts are created by admin

## Exports

- **PDF**: Print-ready documents with institute header and logo
- **CSV/XLSX**: Downloadable spreadsheet exports

## Project Structure

```
src/
├── components/
│   ├── auth/        # Authentication components
│   ├── layout/      # Layout components (PageShell, NavLink)
│   ├── splash/      # Splash screen
│   └── ui/          # Reusable UI components
├── hooks/           # Custom React hooks
├── integrations/    # Supabase client setup
├── pages/
│   ├── admin/       # Admin dashboard pages
│   └── faculty/     # Faculty dashboard pages
├── services/        # Data service functions
└── utils/           # Utility functions (exports)

supabase/
└── functions/       # Edge functions
```

## License

Private - RIT Polytechnic AIML Department

## Support

For issues and support, contact the AIML Department.

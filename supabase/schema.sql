-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE user_role AS ENUM ('ADMIN', 'FACULTY', 'STUDENT');
CREATE TYPE student_status AS ENUM ('ACTIVE', 'YD', 'PASSOUT');
CREATE TYPE subject_type AS ENUM ('TH', 'PR', 'TU');
CREATE TYPE leave_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE leave_type AS ENUM ('CL', 'DL', 'ML', 'LWP');
CREATE TYPE attendance_status AS ENUM ('PRESENT', 'ABSENT', 'LATE');

-- Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'FACULTY',
    department TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty Table
CREATE TABLE IF NOT EXISTS public.faculty (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    profile_id UUID REFERENCES public.profiles(id) NOT NULL,
    employee_code TEXT UNIQUE,
    designation TEXT,
    department TEXT,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Classes Table
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    division TEXT NOT NULL,
    department TEXT DEFAULT 'AIML',
    class_teacher_id UUID REFERENCES public.faculty(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    enrollment_no TEXT UNIQUE,
    roll_no INTEGER,
    year INTEGER NOT NULL,
    semester INTEGER NOT NULL,
    class_id UUID REFERENCES public.classes(id),
    division TEXT,
    department TEXT DEFAULT 'AIML',
    mobile TEXT,
    email TEXT,
    status student_status DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects Table
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    subject_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    semester INTEGER NOT NULL,
    year INTEGER NOT NULL,
    department TEXT DEFAULT 'AIML',
    type subject_type DEFAULT 'TH',
    weekly_lectures INTEGER DEFAULT 3,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subject Allocations Table
CREATE TABLE IF NOT EXISTS public.subject_allocations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    class_id UUID REFERENCES public.classes(id) NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) NOT NULL,
    faculty_id UUID REFERENCES public.faculty(id) NOT NULL,
    academic_year TEXT,
    semester INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timetable Slots Table
CREATE TABLE IF NOT EXISTS public.timetable_slots (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    day_of_week TEXT NOT NULL,
    start_time TIME NOT NULL,
    class_id UUID REFERENCES public.classes(id) NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) NOT NULL,
    faculty_id UUID REFERENCES public.faculty(id) NOT NULL,
    room_no TEXT,
    valid_from DATE,
    valid_to DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance Sessions Table
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    faculty_id UUID REFERENCES public.faculty(id) NOT NULL,
    class_id UUID REFERENCES public.classes(id) NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    status TEXT DEFAULT 'COMPLETED',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance Records Table
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id UUID REFERENCES public.attendance_sessions(id) NOT NULL,
    student_id UUID REFERENCES public.students(id) NOT NULL,
    status attendance_status NOT NULL,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Faculty Leaves Table
CREATE TABLE IF NOT EXISTS public.faculty_leaves (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    faculty_id UUID REFERENCES public.faculty(id) NOT NULL,
    date DATE NOT NULL,
    leave_type leave_type NOT NULL,
    reason TEXT,
    status leave_status DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Substitution Assignments Table
CREATE TABLE IF NOT EXISTS public.substitution_assignments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    original_faculty_id UUID REFERENCES public.faculty(id) NOT NULL,
    sub_faculty_id UUID REFERENCES public.faculty(id) NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    class_id UUID REFERENCES public.classes(id) NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity Log Table
CREATE TABLE IF NOT EXISTS public.activity_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

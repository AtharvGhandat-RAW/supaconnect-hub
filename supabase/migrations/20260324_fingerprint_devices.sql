-- Fingerprint Device Tables Migration
-- Safe to run multiple times

-- First, drop trigger and function safely (they depend on the table)
DO $$
BEGIN
    DROP TRIGGER IF EXISTS trigger_process_device_attendance ON public.device_attendance_queue;
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;

DROP FUNCTION IF EXISTS process_device_attendance();

-- Drop tables in correct order (respecting foreign keys)
DROP TABLE IF EXISTS public.device_attendance_queue;
DROP TABLE IF EXISTS public.fingerprint_templates;
DROP TABLE IF EXISTS public.device_sessions;
DROP TABLE IF EXISTS public.fingerprint_devices;

-- Create Fingerprint Devices Table
CREATE TABLE public.fingerprint_devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_code TEXT UNIQUE NOT NULL,
    device_name TEXT,
    status TEXT DEFAULT 'ACTIVE',
    last_seen_at TIMESTAMPTZ,
    firmware_version TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Device Sessions Table
CREATE TABLE public.device_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id UUID REFERENCES public.fingerprint_devices(id) ON DELETE CASCADE NOT NULL,
    faculty_id UUID REFERENCES public.faculty(id) ON DELETE CASCADE NOT NULL,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE NOT NULL,
    batch_id UUID,
    attendance_session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE SET NULL,
    session_date DATE DEFAULT CURRENT_DATE NOT NULL,
    start_time TIME NOT NULL,
    session_status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Fingerprint Templates Table
CREATE TABLE public.fingerprint_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL UNIQUE,
    fingerprint_id INTEGER NOT NULL UNIQUE,
    template_data TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Device Attendance Queue Table
CREATE TABLE public.device_attendance_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id UUID REFERENCES public.fingerprint_devices(id) ON DELETE CASCADE NOT NULL,
    device_session_id UUID REFERENCES public.device_sessions(id) ON DELETE SET NULL,
    fingerprint_id INTEGER NOT NULL,
    scanned_at TIMESTAMPTZ NOT NULL,
    synced BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Indexes
CREATE INDEX idx_fp_templates_student ON public.fingerprint_templates(student_id);
CREATE INDEX idx_fp_templates_fpid ON public.fingerprint_templates(fingerprint_id);
CREATE INDEX idx_device_sessions_device ON public.device_sessions(device_id);
CREATE INDEX idx_device_sessions_status ON public.device_sessions(session_status);
CREATE INDEX idx_device_queue_synced ON public.device_attendance_queue(synced);

-- Enable Row Level Security
ALTER TABLE public.fingerprint_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fingerprint_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_attendance_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fingerprint_devices
CREATE POLICY "fingerprint_devices_select" ON public.fingerprint_devices
    FOR SELECT USING (true);

CREATE POLICY "fingerprint_devices_all" ON public.fingerprint_devices
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- RLS Policies for device_sessions
CREATE POLICY "device_sessions_select" ON public.device_sessions
    FOR SELECT USING (
        faculty_id IN (SELECT id FROM public.faculty WHERE profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "device_sessions_insert" ON public.device_sessions
    FOR INSERT WITH CHECK (
        faculty_id IN (SELECT id FROM public.faculty WHERE profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

CREATE POLICY "device_sessions_update" ON public.device_sessions
    FOR UPDATE USING (
        faculty_id IN (SELECT id FROM public.faculty WHERE profile_id = auth.uid())
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- RLS Policies for fingerprint_templates
CREATE POLICY "fingerprint_templates_select" ON public.fingerprint_templates
    FOR SELECT USING (true);

CREATE POLICY "fingerprint_templates_all" ON public.fingerprint_templates
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- RLS Policies for device_attendance_queue
CREATE POLICY "device_attendance_queue_all" ON public.device_attendance_queue
    FOR ALL USING (true);

-- Create function to process attendance
CREATE OR REPLACE FUNCTION process_device_attendance()
RETURNS TRIGGER AS $$
DECLARE
    v_student_id UUID;
    v_session_id UUID;
BEGIN
    SELECT student_id INTO v_student_id
    FROM public.fingerprint_templates
    WHERE fingerprint_id = NEW.fingerprint_id;

    IF v_student_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT attendance_session_id INTO v_session_id
    FROM public.device_sessions
    WHERE id = NEW.device_session_id
    AND session_status = 'ACTIVE';

    IF v_session_id IS NOT NULL THEN
        INSERT INTO public.attendance_records (session_id, student_id, status, remark)
        VALUES (v_session_id, v_student_id, 'PRESENT', 'Fingerprint verified')
        ON CONFLICT (session_id, student_id)
        DO UPDATE SET status = 'PRESENT', remark = 'Fingerprint verified';

        NEW.synced := TRUE;
        NEW.synced_at := NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER trigger_process_device_attendance
    BEFORE INSERT ON public.device_attendance_queue
    FOR EACH ROW
    EXECUTE FUNCTION process_device_attendance();

-- Add unique constraint to attendance_records if needed
DO $$
BEGIN
    ALTER TABLE public.attendance_records
    ADD CONSTRAINT attendance_records_session_student_unique
    UNIQUE (session_id, student_id);
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN duplicate_table THEN NULL;
END $$;

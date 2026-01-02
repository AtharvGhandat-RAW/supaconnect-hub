-- Holidays Table for managing college holidays
CREATE TABLE IF NOT EXISTS public.holidays (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    date DATE NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    holiday_type TEXT DEFAULT 'HOLIDAY' CHECK (holiday_type IN ('HOLIDAY', 'HALF_DAY', 'EXAM_DAY', 'EVENT')),
    is_recurring BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lecture Transfer Requests Table
-- For faculty-to-faculty lecture transfers
CREATE TABLE IF NOT EXISTS public.lecture_transfers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    from_faculty_id UUID REFERENCES public.faculty(id) NOT NULL,
    to_faculty_id UUID REFERENCES public.faculty(id) NOT NULL,
    timetable_slot_id UUID REFERENCES public.timetable_slots(id) NOT NULL,
    date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to substitution_assignments if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'substitution_assignments' AND column_name = 'notes') THEN
        ALTER TABLE public.substitution_assignments ADD COLUMN notes TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'substitution_assignments' AND column_name = 'assigned_by') THEN
        ALTER TABLE public.substitution_assignments ADD COLUMN assigned_by UUID REFERENCES public.profiles(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'substitution_assignments' AND column_name = 'assignment_type') THEN
        ALTER TABLE public.substitution_assignments ADD COLUMN assignment_type TEXT DEFAULT 'AUTO' CHECK (assignment_type IN ('AUTO', 'MANUAL', 'TRANSFER'));
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lecture_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for holidays
CREATE POLICY "Allow read access to all authenticated users" ON public.holidays
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin to manage holidays" ON public.holidays
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- RLS Policies for lecture_transfers
CREATE POLICY "Faculty can view their own transfers" ON public.lecture_transfers
    FOR SELECT USING (
        auth.uid() IN (
            SELECT profile_id FROM public.faculty WHERE id = from_faculty_id OR id = to_faculty_id
        )
    );

CREATE POLICY "Faculty can create transfer requests" ON public.lecture_transfers
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT profile_id FROM public.faculty WHERE id = from_faculty_id
        )
    );

CREATE POLICY "Faculty can respond to incoming transfers" ON public.lecture_transfers
    FOR UPDATE USING (
        auth.uid() IN (
            SELECT profile_id FROM public.faculty WHERE id = to_faculty_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Admin full access
CREATE POLICY "Admin full access to lecture_transfers" ON public.lecture_transfers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_lecture_transfers_from_faculty ON public.lecture_transfers(from_faculty_id);
CREATE INDEX IF NOT EXISTS idx_lecture_transfers_to_faculty ON public.lecture_transfers(to_faculty_id);
CREATE INDEX IF NOT EXISTS idx_lecture_transfers_date ON public.lecture_transfers(date);
CREATE INDEX IF NOT EXISTS idx_lecture_transfers_status ON public.lecture_transfers(status);

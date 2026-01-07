-- Add tracking for attendance modifications
ALTER TABLE public.attendance_records 
ADD COLUMN modified_by UUID REFERENCES public.profiles(id),
ADD COLUMN modified_at TIMESTAMPTZ,
ADD COLUMN is_admin_override BOOLEAN DEFAULT FALSE;

-- Update the update policy to allow admins to set these fields
-- (The existing policy "Admins can manage sessions" should cover it, but let's be safe)

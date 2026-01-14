-- Add end_time column to timetable_slots
ALTER TABLE public.timetable_slots 
ADD COLUMN IF NOT EXISTS end_time TIME;

-- Set a default duration of 1 hour for existing records if needed (Optional, depending on DB state)
-- UPDATE public.timetable_slots SET end_time = start_time + INTERVAL '1 hour' WHERE end_time IS NULL;

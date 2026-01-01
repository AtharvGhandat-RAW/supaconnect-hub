-- Create batches table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create student_batches table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.student_batches (
  batch_id UUID REFERENCES public.batches(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  PRIMARY KEY (batch_id, student_id)
);

-- Add batch_id to subject_allocations
ALTER TABLE public.subject_allocations 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id);

-- Add batch_id to timetable_slots if it doesn't exist
ALTER TABLE public.timetable_slots 
ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id);

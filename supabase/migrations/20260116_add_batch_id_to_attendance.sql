ALTER TABLE public.attendance_sessions ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.batches(id);

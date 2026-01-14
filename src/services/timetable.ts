import { supabase } from '@/integrations/supabase/client';
import { DAYS_OF_WEEK } from '@/lib/constants';

export interface TimetableSlot {
  id: string;
  faculty_id: string;
  class_id: string;
  subject_id: string;
  day_of_week: string;
  start_time: string;
  end_time?: string | null;
  room_no: string | null;
  valid_from: string;
  valid_to: string;
  created_at: string;
  batch_id?: string | null;
}

export async function getTimetableSlots(filters?: {
  faculty_id?: string;
  class_id?: string;
  day_of_week?: string;
}) {
  let query = supabase
    .from('timetable_slots')
    .select(`
      *,
      faculty (id, profiles (name)),
      classes (id, name, division),
      subjects (id, name, subject_code),
      batches (id, name)
    `)
    .order('start_time', { ascending: true });

  if (filters?.faculty_id) query = query.eq('faculty_id', filters.faculty_id);
  if (filters?.class_id) query = query.eq('class_id', filters.class_id);
  if (filters?.day_of_week) query = query.eq('day_of_week', filters.day_of_week);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getTodaySlots(facultyId?: string) {
  const now = new Date();
  const today = DAYS_OF_WEEK[now.getDay()];
  
  // Get local date string in YYYY-MM-DD format to handle timezone issues correctly
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  const todayDate = localDate.toISOString().split('T')[0];

  // Check if today is a holiday
  const { data: holiday } = await supabase
    .from('holidays')
    .select('id, name, holiday_type')
    .eq('date', todayDate)
    .single();

  // If it's a full holiday, return empty array
  if (holiday && holiday.holiday_type === 'HOLIDAY') {
    return [];
  }

  let query = supabase
    .from('timetable_slots')
    .select(`
      *,
      faculty (id, profiles (name)),
      classes (id, name, division),
      subjects (id, name, subject_code)
    `)
    .eq('day_of_week', today)
    .lte('valid_from', todayDate)
    .gte('valid_to', todayDate)
    .order('start_time', { ascending: true });

  if (facultyId) query = query.eq('faculty_id', facultyId);

  // If it's a half day, filter by time
  if (holiday && holiday.holiday_type === 'HALF_DAY') {
    // Assuming half day means afternoon off
    query = query.lt('start_time', '12:30:00');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Helper to ensure subject allocation exists
async function ensureAllocation(facultyId: string, classId: string, subjectId: string) {
  // Check if allocation exists
  const { data: existing } = await supabase
    .from('subject_allocations')
    .select('id')
    .eq('faculty_id', facultyId)
    .eq('class_id', classId)
    .eq('subject_id', subjectId)
    .single();

  if (!existing) {
    // Create allocation
    await supabase
      .from('subject_allocations')
      .insert({ faculty_id: facultyId, class_id: classId, subject_id: subjectId });
  }
}

export async function createTimetableSlot(slot: Omit<TimetableSlot, 'id' | 'created_at'>) {
  // Check for duplicate slot (same class, day, time)
  const { data: existingSlot } = await supabase
    .from('timetable_slots')
    .select('id')
    .eq('class_id', slot.class_id)
    .eq('day_of_week', slot.day_of_week)
    .eq('start_time', slot.start_time)
    .lte('valid_from', slot.valid_to)
    .gte('valid_to', slot.valid_from)
    .maybeSingle();

  if (existingSlot) {
    throw new Error(`A timetable slot already exists for this class at the same day and time`);
  }

  // Check if faculty is already assigned at this time
  const { data: facultyBusy } = await supabase
    .from('timetable_slots')
    .select('id')
    .eq('faculty_id', slot.faculty_id)
    .eq('day_of_week', slot.day_of_week)
    .eq('start_time', slot.start_time)
    .lte('valid_from', slot.valid_to)
    .gte('valid_to', slot.valid_from)
    .maybeSingle();

  if (facultyBusy) {
    throw new Error(`This faculty is already assigned to another class at the same day and time`);
  }

  const { data, error } = await supabase
    .from('timetable_slots')
    .insert(slot)
    .select()
    .single();

  if (error) throw error;

  // Auto-create subject allocation
  await ensureAllocation(slot.faculty_id, slot.class_id, slot.subject_id);

  return data;
}

export async function bulkCreateTimetableSlots(slots: Omit<TimetableSlot, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('timetable_slots')
    .insert(slots)
    .select();

  if (error) throw error;

  // Auto-create subject allocations for all unique faculty-class-subject combinations
  const uniqueAllocations = new Map<string, { faculty_id: string; class_id: string; subject_id: string }>();
  slots.forEach(slot => {
    const key = `${slot.faculty_id}-${slot.class_id}-${slot.subject_id}`;
    if (!uniqueAllocations.has(key)) {
      uniqueAllocations.set(key, {
        faculty_id: slot.faculty_id,
        class_id: slot.class_id,
        subject_id: slot.subject_id,
      });
    }
  });

  // Create allocations (ignore duplicates)
  for (const alloc of uniqueAllocations.values()) {
    await ensureAllocation(alloc.faculty_id, alloc.class_id, alloc.subject_id);
  }

  return data;
}

export async function updateTimetableSlot(id: string, updates: Partial<TimetableSlot>) {
  const { data, error } = await supabase
    .from('timetable_slots')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTimetableSlot(id: string) {
  const { error } = await supabase
    .from('timetable_slots')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

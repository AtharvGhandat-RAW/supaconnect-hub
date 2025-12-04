import { supabase } from '@/integrations/supabase/client';

export interface TimetableSlot {
  id: string;
  faculty_id: string;
  class_id: string;
  subject_id: string;
  day_of_week: string;
  start_time: string;
  room_no: string | null;
  valid_from: string;
  valid_to: string;
  created_at: string;
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
      subjects (id, name, subject_code)
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
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = days[new Date().getDay()];
  const todayDate = new Date().toISOString().split('T')[0];
  
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
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createTimetableSlot(slot: Omit<TimetableSlot, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('timetable_slots')
    .insert(slot)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function bulkCreateTimetableSlots(slots: Omit<TimetableSlot, 'id' | 'created_at'>[]) {
  const { data, error } = await supabase
    .from('timetable_slots')
    .insert(slots)
    .select();
  
  if (error) throw error;
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

import { supabase } from '@/integrations/supabase/client';

export interface LectureTransfer {
  id: string;
  from_faculty_id: string;
  to_faculty_id: string;
  timetable_slot_id: string;
  date: string;
  reason: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  requested_at: string;
  responded_at: string | null;
  created_at: string;
  from_faculty?: {
    id: string;
    profiles?: { name: string };
  };
  to_faculty?: {
    id: string;
    profiles?: { name: string };
  };
  timetable_slots?: {
    id: string;
    start_time: string;
    day_of_week: string;
    classes?: { name: string; division: string };
    subjects?: { name: string; subject_code: string };
  };
}

export async function getLectureTransfers(filters?: {
  from_faculty_id?: string;
  to_faculty_id?: string;
  status?: string;
  date?: string;
}) {
  let query = supabase
    .from('lecture_transfers')
    .select(`
      *,
      from_faculty:from_faculty_id (id, profiles (name)),
      to_faculty:to_faculty_id (id, profiles (name)),
      timetable_slots:timetable_slot_id (
        id, start_time, day_of_week,
        classes (name, division),
        subjects (name, subject_code)
      )
    `)
    .order('created_at', { ascending: false });
  
  if (filters?.from_faculty_id) query = query.eq('from_faculty_id', filters.from_faculty_id);
  if (filters?.to_faculty_id) query = query.eq('to_faculty_id', filters.to_faculty_id);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.date) query = query.eq('date', filters.date);
  
  const { data, error } = await query;
  if (error) throw error;
  return data as LectureTransfer[];
}

export async function getMyIncomingTransfers(facultyId: string) {
  return getLectureTransfers({ to_faculty_id: facultyId, status: 'PENDING' });
}

export async function getMyOutgoingTransfers(facultyId: string) {
  return getLectureTransfers({ from_faculty_id: facultyId });
}

export async function createTransferRequest(transfer: {
  from_faculty_id: string;
  to_faculty_id: string;
  timetable_slot_id: string;
  date: string;
  reason?: string;
}) {
  const { data, error } = await supabase
    .from('lecture_transfers')
    .insert({
      ...transfer,
      status: 'PENDING',
      requested_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as LectureTransfer;
}

export async function respondToTransfer(
  id: string,
  response: 'ACCEPTED' | 'REJECTED'
) {
  const { data, error } = await supabase
    .from('lecture_transfers')
    .update({
      status: response,
      responded_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  
  // If accepted, create a substitution assignment
  if (response === 'ACCEPTED' && data) {
    const transfer = data as LectureTransfer;
    await supabase.from('substitution_assignments').insert({
      src_faculty_id: transfer.from_faculty_id,
      sub_faculty_id: transfer.to_faculty_id,
      class_id: null, // Will be fetched from timetable_slot
      subject_id: null,
      date: transfer.date,
      start_time: null,
      status: 'CONFIRMED',
      assignment_type: 'TRANSFER',
    });
  }
  
  return data as LectureTransfer;
}

export async function cancelTransfer(id: string) {
  const { data, error } = await supabase
    .from('lecture_transfers')
    .update({ status: 'CANCELLED' })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as LectureTransfer;
}

export async function getAvailableFacultyForTransfer(
  slotId: string,
  date: string,
  excludeFacultyId: string
) {
  // Get the slot details
  const { data: slot } = await supabase
    .from('timetable_slots')
    .select('day_of_week, start_time, subject_id')
    .eq('id', slotId)
    .single();
  
  if (!slot) return [];
  
  // Get all faculty
  const { data: allFaculty } = await supabase
    .from('faculty')
    .select('id, profiles (name)')
    .eq('status', 'Active')
    .neq('id', excludeFacultyId);
  
  // Get busy faculty at this time
  const { data: busyFaculty } = await supabase
    .from('timetable_slots')
    .select('faculty_id')
    .eq('day_of_week', slot.day_of_week)
    .eq('start_time', slot.start_time)
    .lte('valid_from', date)
    .gte('valid_to', date);
  
  const busyFacultyIds = new Set(busyFaculty?.map(f => f.faculty_id) || []);
  
  // Return all faculty as per requirement (even if busy)
  // We map them to include an isBusy flag if we wanted to support it in UI later, 
  // but for now we just return all of them as requested.
  const allFacultyList = allFaculty || [];
  
  return allFacultyList;
}

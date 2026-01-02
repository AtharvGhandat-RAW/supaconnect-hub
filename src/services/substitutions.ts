import { supabase } from '@/integrations/supabase/client';

export interface SubstitutionAssignment {
  id: string;
  src_faculty_id: string;
  sub_faculty_id: string;
  class_id: string;
  subject_id: string;
  date: string;
  start_time: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  assigned_by?: string;
  assignment_type: 'AUTO' | 'MANUAL' | 'TRANSFER';
  created_at: string;
  src_faculty?: {
    id: string;
    profiles?: { name: string };
  };
  sub_faculty?: {
    id: string;
    profiles?: { name: string };
  };
  classes?: {
    id: string;
    name: string;
    division: string;
  };
  subjects?: {
    id: string;
    name: string;
    subject_code: string;
  };
}

export async function getSubstitutionAssignments(filters?: {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  src_faculty_id?: string;
  sub_faculty_id?: string;
  status?: string;
}) {
  let query = supabase
    .from('substitution_assignments')
    .select(`
      *,
      src_faculty:src_faculty_id (id, profiles (name)),
      sub_faculty:sub_faculty_id (id, profiles (name)),
      classes (id, name, division),
      subjects (id, name, subject_code)
    `)
    .order('date', { ascending: false })
    .order('start_time', { ascending: true });
  
  if (filters?.date) query = query.eq('date', filters.date);
  if (filters?.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('date', filters.dateTo);
  if (filters?.src_faculty_id) query = query.eq('src_faculty_id', filters.src_faculty_id);
  if (filters?.sub_faculty_id) query = query.eq('sub_faculty_id', filters.sub_faculty_id);
  if (filters?.status) query = query.eq('status', filters.status);
  
  const { data, error } = await query;
  if (error) throw error;
  return data as SubstitutionAssignment[];
}

export async function createManualSubstitution(assignment: {
  src_faculty_id: string;
  sub_faculty_id: string;
  class_id: string;
  subject_id: string;
  date: string;
  start_time: string;
  notes?: string;
  assigned_by?: string;
}) {
  const { data, error } = await supabase
    .from('substitution_assignments')
    .insert({
      ...assignment,
      status: 'CONFIRMED',
      assignment_type: 'MANUAL',
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as SubstitutionAssignment;
}

export async function updateSubstitutionStatus(
  id: string,
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
) {
  const { data, error } = await supabase
    .from('substitution_assignments')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as SubstitutionAssignment;
}

export async function deleteSubstitution(id: string) {
  const { error } = await supabase
    .from('substitution_assignments')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Get slots that need substitutes for a given faculty on a date
export async function getSlotsNeedingSubstitutes(facultyId: string, date: string) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[new Date(date).getDay()];
  
  // Get all slots for this faculty on this day
  const { data: slots, error } = await supabase
    .from('timetable_slots')
    .select(`
      *,
      classes (id, name, division),
      subjects (id, name, subject_code)
    `)
    .eq('faculty_id', facultyId)
    .eq('day_of_week', dayOfWeek)
    .lte('valid_from', date)
    .gte('valid_to', date)
    .order('start_time', { ascending: true });
  
  if (error) throw error;
  
  // Check which slots already have substitutions
  const { data: existingSubs } = await supabase
    .from('substitution_assignments')
    .select('start_time')
    .eq('src_faculty_id', facultyId)
    .eq('date', date);
  
  const subTimes = new Set(existingSubs?.map(s => s.start_time) || []);
  
  // Return slots that don't have substitutions yet
  return (slots || []).filter(slot => !subTimes.has(slot.start_time));
}

// Get available faculty for substitution at a specific time
export async function getAvailableFacultyForSlot(
  date: string,
  startTime: string,
  excludeFacultyId: string
) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = dayNames[new Date(date).getDay()];
  
  // Get all active faculty except the one on leave
  const { data: allFaculty } = await supabase
    .from('faculty')
    .select('id, department, profiles (name)')
    .eq('status', 'Active')
    .neq('id', excludeFacultyId);
  
  // Get busy faculty at this time
  const { data: busyFaculty } = await supabase
    .from('timetable_slots')
    .select('faculty_id')
    .eq('day_of_week', dayOfWeek)
    .eq('start_time', startTime)
    .lte('valid_from', date)
    .gte('valid_to', date);
  
  // Also check for faculty who are on leave that day
  const { data: onLeave } = await supabase
    .from('faculty_leaves')
    .select('faculty_id')
    .eq('date', date)
    .eq('status', 'APPROVED');
  
  // Also check for faculty who already have a substitution at this time
  const { data: alreadySubbing } = await supabase
    .from('substitution_assignments')
    .select('sub_faculty_id')
    .eq('date', date)
    .eq('start_time', startTime)
    .neq('status', 'CANCELLED');
  
  const busyIds = new Set([
    ...(busyFaculty?.map(f => f.faculty_id) || []),
    ...(onLeave?.map(l => l.faculty_id) || []),
    ...(alreadySubbing?.map(s => s.sub_faculty_id) || []),
  ]);
  
  return (allFaculty || []).filter(f => !busyIds.has(f.id));
}

// Get my substitution duties (for faculty)
export async function getMySubstitutionDuties(facultyId: string) {
  const today = new Date().toISOString().split('T')[0];
  return getSubstitutionAssignments({
    sub_faculty_id: facultyId,
    dateFrom: today,
    status: 'CONFIRMED',
  });
}

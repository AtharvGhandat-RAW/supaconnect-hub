import { supabase } from '@/integrations/supabase/client';

export interface AttendanceSession {
  id: string;
  class_id: string;
  subject_id: string;
  faculty_id: string;
  date: string;
  start_time: string;
  is_substitution: boolean;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  student_id: string;
  status: 'PRESENT' | 'ABSENT';
  remark: string | null;
  created_at: string;
}

export async function getAttendanceSessions(filters?: {
  class_id?: string;
  subject_id?: string;
  faculty_id?: string;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  let query = supabase
    .from('attendance_sessions')
    .select(`
      *,
      classes (id, name, division),
      subjects (id, name, subject_code),
      faculty (id, profiles (name))
    `)
    .order('date', { ascending: false })
    .order('start_time', { ascending: false });
  
  if (filters?.class_id) query = query.eq('class_id', filters.class_id);
  if (filters?.subject_id) query = query.eq('subject_id', filters.subject_id);
  if (filters?.faculty_id) query = query.eq('faculty_id', filters.faculty_id);
  if (filters?.date) query = query.eq('date', filters.date);
  if (filters?.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('date', filters.dateTo);
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAttendanceRecords(sessionId: string) {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(`
      *,
      students (id, name, roll_no, enrollment_no)
    `)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  
  if (error) throw error;
  return data;
}

export async function createAttendanceSession(session: {
  class_id: string;
  subject_id: string;
  faculty_id: string;
  date: string;
  start_time: string;
  is_substitution?: boolean;
}) {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert(session)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function createAttendanceRecords(records: {
  session_id: string;
  student_id: string;
  status: 'PRESENT' | 'ABSENT';
  remark?: string;
}[]) {
  const { data, error } = await supabase
    .from('attendance_records')
    .insert(records)
    .select();
  
  if (error) throw error;
  return data;
}

export async function updateAttendanceRecord(id: string, updates: Partial<AttendanceRecord>) {
  const { data, error } = await supabase
    .from('attendance_records')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function getTodayAttendanceStats() {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: sessions, error } = await supabase
    .from('attendance_sessions')
    .select('id')
    .eq('date', today);
  
  if (error) throw error;
  
  if (!sessions || sessions.length === 0) {
    return { totalSessions: 0, totalPresent: 0, totalAbsent: 0, percentage: 0 };
  }
  
  const sessionIds = sessions.map(s => s.id);
  
  const { data: records, error: recordsError } = await supabase
    .from('attendance_records')
    .select('status')
    .in('session_id', sessionIds);
  
  if (recordsError) throw recordsError;
  
  const totalPresent = records?.filter(r => r.status === 'PRESENT').length || 0;
  const totalAbsent = records?.filter(r => r.status === 'ABSENT').length || 0;
  const total = totalPresent + totalAbsent;
  
  return {
    totalSessions: sessions.length,
    totalPresent,
    totalAbsent,
    percentage: total > 0 ? Math.round((totalPresent / total) * 100) : 0
  };
}

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

export async function getDefaulters(filters?: { class_id?: string; subject_id?: string }) {
  // 1. Get students (filtered by class if provided)
  let studentsQuery = supabase
    .from('students')
    .select('id, name, roll_no, class_id, classes(name, division)')
    .eq('status', 'ACTIVE');

  if (filters?.class_id) {
    studentsQuery = studentsQuery.eq('class_id', filters.class_id);
  }

  const { data: students, error: studentsError } = await studentsQuery;
  if (studentsError) throw studentsError;
  if (!students || students.length === 0) return [];

  // 2. Get sessions (filtered by class/subject)
  let sessionsQuery = supabase
    .from('attendance_sessions')
    .select('id');

  if (filters?.class_id) sessionsQuery = sessionsQuery.eq('class_id', filters.class_id);
  if (filters?.subject_id) sessionsQuery = sessionsQuery.eq('subject_id', filters.subject_id);

  const { data: sessions, error: sessionsError } = await sessionsQuery;
  if (sessionsError) throw sessionsError;

  const sessionIds = sessions?.map(s => s.id) || [];

  // If no sessions, return 0% attendance (or 100%? usually 0 if no data, but here we want to show low attendance)
  // Actually if no sessions, percentage is 0/0 = NaN. Let's say 0.
  if (sessionIds.length === 0) return students.map(s => ({ ...s, percentage: 0, total: 0, present: 0, className: s.classes ? `${s.classes.name} ${s.classes.division}` : 'Unknown' }));

  // 3. Get records for these sessions
  const { data: records, error: recordsError } = await supabase
    .from('attendance_records')
    .select('student_id, status')
    .in('session_id', sessionIds);

  if (recordsError) throw recordsError;

  // 4. Calculate stats
  const stats = new Map<string, { present: number; total: number }>();
  students.forEach(s => stats.set(s.id, { present: 0, total: 0 }));

  records?.forEach(r => {
    if (stats.has(r.student_id)) {
      const s = stats.get(r.student_id)!;
      s.total++;
      if (r.status === 'PRESENT') s.present++;
    }
  });

  // 5. Format and sort
  const result = students.map(s => {
    const stat = stats.get(s.id)!;
    return {
      ...s,
      present: stat.present,
      total: stat.total,
      percentage: stat.total > 0 ? Math.round((stat.present / stat.total) * 100) : 0,
      className: s.classes ? `${s.classes.name} ${s.classes.division}` : 'Unknown'
    };
  });

  // Sort by percentage ascending (lowest attendance first)
  return result.sort((a, b) => a.percentage - b.percentage);
}

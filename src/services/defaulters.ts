import { supabase } from '@/integrations/supabase/client';

export interface DefaulterStudent {
  id: string;
  roll_no: number | null;
  name: string;
  enrollment_no: string | null;
  totalLectures: number;
  present: number;
  absent: number;
  percentage: number;
}

export async function computeDefaulters(
  classId: string,
  dateFrom: string,
  dateTo: string,
  threshold: number
): Promise<DefaulterStudent[]> {
  // Get all students in the class
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, roll_no, name, enrollment_no')
    .eq('class_id', classId)
    .eq('status', 'ACTIVE')
    .order('roll_no', { ascending: true });

  if (studentsError) throw studentsError;
  if (!students || students.length === 0) return [];

  // Get all sessions for this class in the date range
  const { data: sessions, error: sessionsError } = await supabase
    .from('attendance_sessions')
    .select('id')
    .eq('class_id', classId)
    .gte('date', dateFrom)
    .lte('date', dateTo);

  if (sessionsError) throw sessionsError;
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map(s => s.id);

  // Get all attendance records for these sessions
  const { data: records, error: recordsError } = await supabase
    .from('attendance_records')
    .select('student_id, status')
    .in('session_id', sessionIds);

  if (recordsError) throw recordsError;

  // Compute attendance per student
  const studentAttendance = new Map<string, { present: number; absent: number }>();
  
  students.forEach(student => {
    studentAttendance.set(student.id, { present: 0, absent: 0 });
  });

  (records || []).forEach(record => {
    const current = studentAttendance.get(record.student_id);
    if (current) {
      if (record.status === 'PRESENT') {
        current.present++;
      } else {
        current.absent++;
      }
    }
  });

  // Calculate percentages and filter defaulters
  const defaulters: DefaulterStudent[] = [];
  
  students.forEach(student => {
    const attendance = studentAttendance.get(student.id);
    if (attendance) {
      const total = attendance.present + attendance.absent;
      const percentage = total > 0 ? Math.round((attendance.present / total) * 100) : 0;
      
      if (percentage < threshold) {
        defaulters.push({
          id: student.id,
          roll_no: student.roll_no,
          name: student.name,
          enrollment_no: student.enrollment_no,
          totalLectures: total,
          present: attendance.present,
          absent: attendance.absent,
          percentage,
        });
      }
    }
  });

  // Sort by percentage ascending
  return defaulters.sort((a, b) => a.percentage - b.percentage);
}

export async function getStudentAttendanceStats(
  studentId: string,
  dateFrom?: string,
  dateTo?: string
) {
  let query = supabase
    .from('attendance_records')
    .select(`
      status,
      attendance_sessions!inner (date, class_id, subject_id)
    `)
    .eq('student_id', studentId);

  if (dateFrom) query = query.gte('attendance_sessions.date', dateFrom);
  if (dateTo) query = query.lte('attendance_sessions.date', dateTo);

  const { data, error } = await query;
  if (error) throw error;

  const present = data?.filter(r => r.status === 'PRESENT').length || 0;
  const absent = data?.filter(r => r.status === 'ABSENT').length || 0;
  const total = present + absent;

  return {
    present,
    absent,
    total,
    percentage: total > 0 ? Math.round((present / total) * 100) : 0,
  };
}

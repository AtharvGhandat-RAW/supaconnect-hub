import { supabase } from '@/integrations/supabase/client';
import type { Student } from './students';

export interface PromotionStudent extends Student {
  newRollNo?: number;
  action: 'PROMOTE' | 'YD';
  suggestion?: string;
}

export async function getStudentsForPromotion(
  sourceClassId: string,
  threshold: number = 75
): Promise<PromotionStudent[]> {
  // Get students from source class
  const { data: students, error } = await supabase
    .from('students')
    .select('*')
    .eq('class_id', sourceClassId)
    .eq('status', 'ACTIVE')
    .order('roll_no', { ascending: true });

  if (error) throw error;
  if (!students) return [];

  // Get attendance stats for suggestions
  const studentsWithSuggestions: PromotionStudent[] = await Promise.all(
    students.map(async (student, index) => {
      // Get attendance percentage
      const { data: records } = await supabase
        .from('attendance_records')
        .select('status')
        .eq('student_id', student.id);

      const present = records?.filter(r => r.status === 'PRESENT').length || 0;
      const total = records?.length || 0;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 100;

      const suggestion = percentage < threshold ? 'Low attendance - consider YD' : undefined;

      return {
        ...student,
        newRollNo: index + 1,
        action: 'PROMOTE' as const,
        suggestion,
      };
    })
  );

  return studentsWithSuggestions;
}

export async function executePromotion(
  students: PromotionStudent[],
  targetClassId: string,
  targetSemester: number
) {
  const promoteStudents = students.filter(s => s.action === 'PROMOTE');
  const ydStudents = students.filter(s => s.action === 'YD');

  // Promote students
  for (const student of promoteStudents) {
    if (targetClassId === 'COMPLETED') {
      await supabase
        .from('students')
        .update({
          class_id: null,
          status: 'COMPLETED',
          // Keep semester/year as record of last state or clear them? 
          // Usually we keep them or move to an alumni table. 
          // For now, just marking status as COMPLETED and removing class_id is enough to hide them from active lists.
        })
        .eq('id', student.id);
    } else {
      await supabase
        .from('students')
        .update({
          class_id: targetClassId,
          semester: targetSemester,
          roll_no: student.newRollNo,
          year: Math.ceil(targetSemester / 2),
        })
        .eq('id', student.id);
    }
  }

  // Mark YD students
  for (const student of ydStudents) {
    await supabase
      .from('students')
      .update({
        status: 'YD',
      })
      .eq('id', student.id);
  }

  return {
    promoted: promoteStudents.length,
    yearDown: ydStudents.length,
  };
}

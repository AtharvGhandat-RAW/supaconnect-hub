import { supabase } from '@/integrations/supabase/client';

export interface Student {
  id: string;
  enrollment_no: string | null;
  roll_no: number | null;
  name: string;
  year: number;
  semester: number;
  class_id: string | null;
  division: string | null;
  department: string | null;
  mobile: string | null;
  email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function getStudents(filters?: {
  class_id?: string;
  year?: number;
  semester?: number;
  status?: string;
}) {
  let query = supabase
    .from('students')
    .select('*')
    .order('roll_no', { ascending: true });
  
  if (filters?.class_id) query = query.eq('class_id', filters.class_id);
  if (filters?.year) query = query.eq('year', filters.year);
  if (filters?.semester) query = query.eq('semester', filters.semester);
  if (filters?.status) query = query.eq('status', filters.status);
  
  const { data, error } = await query;
  if (error) throw error;
  return data as Student[];
}

export async function getStudentById(id: string) {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) throw error;
  return data as Student;
}

export async function createStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('students')
    .insert(student)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateStudent(id: string, updates: Partial<Student>) {
  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function bulkCreateStudents(students: Omit<Student, 'id' | 'created_at' | 'updated_at'>[]) {
  const { data, error } = await supabase
    .from('students')
    .insert(students)
    .select();
  
  if (error) throw error;
  return data;
}

export async function getStudentCount() {
  const { count, error } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'ACTIVE');
  
  if (error) throw error;
  return count || 0;
}

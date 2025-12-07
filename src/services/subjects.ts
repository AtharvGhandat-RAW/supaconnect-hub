import { supabase } from '@/integrations/supabase/client';

export interface Subject {
  id: string;
  subject_code: string;
  name: string;
  semester: number;
  year: number;
  department: string | null;
  type: 'TH' | 'PR' | 'TU';
  weekly_lectures: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export async function getSubjects(filters?: {
  year?: number;
  semester?: number;
  department?: string;
  status?: string;
}) {
  let query = supabase
    .from('subjects')
    .select('*')
    .order('subject_code', { ascending: true });

  if (filters?.year) query = query.eq('year', filters.year);
  if (filters?.semester) query = query.eq('semester', filters.semester);
  if (filters?.department) query = query.eq('department', filters.department);
  if (filters?.status) query = query.eq('status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return data as Subject[];
}

export async function getSubjectById(id: string) {
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Subject;
}

export async function createSubject(subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('subjects')
    .insert(subject)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateSubject(id: string, updates: Partial<Subject>) {
  const { data, error } = await supabase
    .from('subjects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function bulkCreateSubjects(subjects: Omit<Subject, 'id' | 'created_at' | 'updated_at'>[]) {
  const { data, error } = await supabase
    .from('subjects')
    .insert(subjects)
    .select();

  if (error) throw error;
  return data;
}

export async function deleteSubject(id: string) {
  const { error } = await supabase
    .from('subjects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

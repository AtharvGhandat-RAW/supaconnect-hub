import { supabase } from '@/integrations/supabase/client';

export interface SubjectAllocation {
  id: string;
  faculty_id: string;
  class_id: string;
  subject_id: string;
  created_at: string;
  subjects?: {
    id: string;
    name: string;
    subject_code: string;
    semester: number;
    year: number;
    type: string;
  };
  classes?: {
    id: string;
    name: string;
    division: string;
  };
}

export async function getSubjectAllocations(facultyId?: string) {
  let query = supabase
    .from('subject_allocations')
    .select(`
      *,
      subjects (id, name, subject_code, semester, year, type),
      classes (id, name, division)
    `);

  if (facultyId) query = query.eq('faculty_id', facultyId);

  const { data, error } = await query;
  if (error) throw error;
  return data as SubjectAllocation[];
}

export async function createSubjectAllocation(allocation: {
  faculty_id: string;
  class_id: string;
  subject_id: string;
}) {
  const { data, error } = await supabase
    .from('subject_allocations')
    .insert(allocation)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSubjectAllocation(id: string) {
  const { error } = await supabase
    .from('subject_allocations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

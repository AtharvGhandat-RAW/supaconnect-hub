import { supabase } from '@/integrations/supabase/client';

export interface Faculty {
  id: string;
  profile_id: string;
  employee_code: string | null;
  designation: string | null;
  department: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    id: string;
    name: string;
    role: string;
    department: string | null;
  };
}

export async function getFaculty() {
  const { data, error } = await supabase
    .from('faculty')
    .select(`
      *,
      profiles (id, name, role, department)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Faculty[];
}

export async function getFacultyById(id: string) {
  const { data, error } = await supabase
    .from('faculty')
    .select(`
      *,
      profiles (id, name, role, department)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Faculty;
}

export async function createFaculty(faculty: {
  profile_id: string;
  employee_code?: string;
  designation?: string;
  department?: string;
}) {
  const { data, error } = await supabase
    .from('faculty')
    .insert(faculty)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateFaculty(id: string, updates: Partial<Faculty>) {
  const { data, error } = await supabase
    .from('faculty')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFaculty(id: string) {
  const { error } = await supabase
    .from('faculty')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getAllFacultyWithEmail() {
  const { data, error } = await supabase
    .rpc('get_all_faculty_with_email');

  if (error) throw error;
  return data as { id: string; name: string; email: string; employee_code: string | null }[];
}

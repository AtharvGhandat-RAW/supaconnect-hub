import { supabase } from '@/integrations/supabase/client';

export interface Class {
  id: string;
  name: string;
  year: number;
  semester: number;
  division: string;
  department: string | null;
  class_teacher_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function getClasses() {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .order('year', { ascending: true })
    .order('division', { ascending: true });

  if (error) throw error;
  return data as Class[];
}

export async function getClassById(id: string) {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Class;
}

export async function getClassByTeacherId(teacherId: string) {
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('class_teacher_id', teacherId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as Class | null;
}

export async function createClass(classData: {
  name: string;
  year: number;
  semester: number;
  division: string;
  department?: string;
  class_teacher_id?: string;
}) {
  // Check for duplicate class (same name and division)
  const { data: existingByName } = await supabase
    .from('classes')
    .select('id')
    .ilike('name', classData.name)
    .ilike('division', classData.division)
    .maybeSingle();

  if (existingByName) {
    throw new Error(`Class "${classData.name} ${classData.division}" already exists`);
  }

  // Check for duplicate (same year, semester, division)
  const { data: existingByYearSem } = await supabase
    .from('classes')
    .select('id')
    .eq('year', classData.year)
    .eq('semester', classData.semester)
    .ilike('division', classData.division)
    .maybeSingle();

  if (existingByYearSem) {
    throw new Error(`A class for Year ${classData.year}, Semester ${classData.semester}, Division ${classData.division} already exists`);
  }

  const { data, error } = await supabase
    .from('classes')
    .insert(classData)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClass(id: string, updates: Partial<Class>) {
  const { data, error } = await supabase
    .from('classes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteClass(id: string) {
  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

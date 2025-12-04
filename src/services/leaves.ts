import { supabase } from '@/integrations/supabase/client';

export interface FacultyLeave {
  id: string;
  faculty_id: string;
  date: string;
  leave_type: 'FULL_DAY' | 'HALF_MORNING' | 'HALF_AFTERNOON';
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export async function getFacultyLeaves(filters?: {
  faculty_id?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  let query = supabase
    .from('faculty_leaves')
    .select(`
      *,
      faculty (id, profiles (name))
    `)
    .order('date', { ascending: false });
  
  if (filters?.faculty_id) query = query.eq('faculty_id', filters.faculty_id);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('date', filters.dateTo);
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createLeaveRequest(leave: {
  faculty_id: string;
  date: string;
  leave_type: 'FULL_DAY' | 'HALF_MORNING' | 'HALF_AFTERNOON';
  reason?: string;
}) {
  const { data, error } = await supabase
    .from('faculty_leaves')
    .insert({ ...leave, status: 'PENDING' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function updateLeaveStatus(id: string, status: 'APPROVED' | 'REJECTED') {
  const { data, error } = await supabase
    .from('faculty_leaves')
    .update({ status })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

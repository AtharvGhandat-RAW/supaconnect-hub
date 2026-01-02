import { supabase } from '@/integrations/supabase/client';

export interface Holiday {
  id: string;
  date: string;
  name: string;
  description: string | null;
  holiday_type: 'HOLIDAY' | 'HALF_DAY' | 'EXAM_DAY' | 'EVENT';
  is_recurring: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function getHolidays(filters?: {
  dateFrom?: string;
  dateTo?: string;
  type?: string;
}) {
  let query = supabase
    .from('holidays')
    .select('*')
    .order('date', { ascending: true });
  
  if (filters?.dateFrom) query = query.gte('date', filters.dateFrom);
  if (filters?.dateTo) query = query.lte('date', filters.dateTo);
  if (filters?.type) query = query.eq('holiday_type', filters.type);
  
  const { data, error } = await query;
  if (error) throw error;
  return data as Holiday[];
}

export async function getHolidayByDate(date: string) {
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .eq('date', date)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data as Holiday | null;
}

export async function createHoliday(holiday: {
  date: string;
  name: string;
  description?: string;
  holiday_type?: 'HOLIDAY' | 'HALF_DAY' | 'EXAM_DAY' | 'EVENT';
  is_recurring?: boolean;
  created_by?: string;
}) {
  const { data, error } = await supabase
    .from('holidays')
    .insert(holiday)
    .select()
    .single();
  
  if (error) throw error;
  return data as Holiday;
}

export async function updateHoliday(id: string, updates: Partial<Holiday>) {
  const { data, error } = await supabase
    .from('holidays')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as Holiday;
}

export async function deleteHoliday(id: string) {
  const { error } = await supabase
    .from('holidays')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function isHoliday(date: string): Promise<boolean> {
  const holiday = await getHolidayByDate(date);
  return !!holiday;
}

export async function getUpcomingHolidays(limit = 5) {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('holidays')
    .select('*')
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(limit);
  
  if (error) throw error;
  return data as Holiday[];
}

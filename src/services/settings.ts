import { supabase } from '@/integrations/supabase/client';

export interface Settings {
  id: string;
  current_academic_year: string;
  current_semester: number;
  defaulter_threshold: number;
  auto_substitution: boolean;
  ai_suggestion: boolean;
  created_at: string;
  updated_at: string;
}

export async function getSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  return data as Settings | null;
}

export async function updateSettings(updates: Partial<Settings>) {
  // First try to get existing settings
  const existing = await getSettings();
  
  if (existing) {
    const { data, error } = await supabase
      .from('settings')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } else {
    // Create new settings row
    const { data, error } = await supabase
      .from('settings')
      .insert(updates)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }
}

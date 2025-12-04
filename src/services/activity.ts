import { supabase } from '@/integrations/supabase/client';

export interface ActivityLog {
  id: string;
  user_profile_id: string | null;
  message: string;
  timestamp: string;
}

export async function getActivityLogs(limit = 20) {
  const { data, error } = await supabase
    .from('activity_log')
    .select(`
      *,
      profiles:user_profile_id (name)
    `)
    .order('timestamp', { ascending: false })
    .limit(limit);
  
  if (error) throw error;
  return data;
}

export async function createActivityLog(message: string, userProfileId?: string) {
  const { data, error } = await supabase
    .from('activity_log')
    .insert({
      message,
      user_profile_id: userProfileId || null,
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

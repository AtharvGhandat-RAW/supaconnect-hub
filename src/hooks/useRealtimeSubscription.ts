import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useRealtimeSubscription(
  table: string,
  queryKeys: string[][],
  filter?: string
) {
  const queryClient = useQueryClient();

  const invalidateQueries = useCallback(() => {
    queryKeys.forEach(key => {
      queryClient.invalidateQueries({ queryKey: key });
    });
  }, [queryClient, queryKeys]);

  useEffect(() => {
    const channelName = `realtime-${table}-${Date.now()}`;
    
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table,
          ...(filter ? { filter } : {})
        },
        (payload) => {
          console.log(`Realtime ${table}:`, payload.eventType);
          invalidateQueries();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter, invalidateQueries]);
}

// Convenience hooks for specific pages
export function useAdminDashboardRealtime() {
  useRealtimeSubscription('attendance_sessions', [['attendance-sessions'], ['dashboard-stats'], ['today-sessions']]);
  useRealtimeSubscription('faculty_leaves', [['faculty-leaves'], ['dashboard-stats']]);
  useRealtimeSubscription('timetable_slots', [['timetable-slots'], ['today-sessions']]);
  useRealtimeSubscription('activity_log', [['activity-log']]);
}

export function useFacultyTodayRealtime(facultyId?: string) {
  useRealtimeSubscription('timetable_slots', [['today-slots'], ['faculty-timetable']], facultyId ? `faculty_id=eq.${facultyId}` : undefined);
  useRealtimeSubscription('attendance_sessions', [['attendance-sessions'], ['faculty-stats']], facultyId ? `faculty_id=eq.${facultyId}` : undefined);
}

export function useTimetableRealtime() {
  useRealtimeSubscription('timetable_slots', [['timetable-slots']]);
}

export function useFacultyLeaveRealtime() {
  useRealtimeSubscription('faculty_leaves', [['faculty-leaves']]);
}

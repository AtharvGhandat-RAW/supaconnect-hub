import { supabase } from '@/integrations/supabase/client';

export interface Notification {
  id: string;
  type: 'substitution' | 'attendance' | 'leave' | 'syllabus';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// Get notifications from activity log for a faculty member
export async function getFacultyNotifications(profileId: string): Promise<Notification[]> {
  const notifications: Notification[] = [];
  
  try {
    // Get recent activity log entries related to this faculty
    const { data: activities } = await supabase
      .from('activity_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(20);
    
    // Get substitution assignments for this faculty
    const { data: faculty } = await supabase
      .from('faculty')
      .select('id')
      .eq('profile_id', profileId)
      .single();
    
    if (faculty) {
      const { data: substitutions } = await supabase
        .from('substitution_assignments')
        .select(`
          *,
          classes (name, division),
          subjects (name, subject_code),
          faculty!substitution_assignments_src_faculty_id_fkey (profiles (name))
        `)
        .eq('sub_faculty_id', faculty.id)
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true })
        .limit(10);
      
      substitutions?.forEach(sub => {
        const srcFaculty = sub.faculty as unknown as { profiles: { name: string } } | null;
        notifications.push({
          id: `sub-${sub.id}`,
          type: 'substitution',
          title: 'Substitution Assigned',
          message: `You have a substitution for ${srcFaculty?.profiles?.name || 'Another Faculty'} - ${sub.subjects?.name} (${sub.classes?.name} ${sub.classes?.division}) on ${new Date(sub.date).toLocaleDateString('en-IN')} at ${sub.start_time}`,
          timestamp: sub.created_at,
          read: false,
        });
      });
      
      // Get leave status updates
      const { data: leaves } = await supabase
        .from('faculty_leaves')
        .select('*')
        .eq('faculty_id', faculty.id)
        .neq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(5);
      
      leaves?.forEach(leave => {
        notifications.push({
          id: `leave-${leave.id}`,
          type: 'leave',
          title: `Leave ${leave.status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
          message: `Your leave request for ${new Date(leave.date).toLocaleDateString('en-IN')} has been ${leave.status.toLowerCase()}`,
          timestamp: leave.created_at,
          read: false,
        });
      });
    }
    
    // Sort by timestamp
    notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
  } catch (error) {
    console.error('Error fetching notifications:', error);
  }
  
  return notifications;
}

// Get pending attendance alerts (lectures without attendance marked)
export async function getPendingAttendanceAlerts(facultyId: string): Promise<Notification[]> {
  const notifications: Notification[] = [];
  const today = new Date().toISOString().split('T')[0];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = days[new Date().getDay()];
  
  try {
    // Get today's slots
    const { data: slots } = await supabase
      .from('timetable_slots')
      .select(`
        *,
        classes (name, division),
        subjects (name)
      `)
      .eq('faculty_id', facultyId)
      .eq('day_of_week', dayOfWeek)
      .lte('valid_from', today)
      .gte('valid_to', today);
    
    // Get completed sessions
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('start_time')
      .eq('faculty_id', facultyId)
      .eq('date', today);
    
    const completedTimes = new Set(sessions?.map(s => s.start_time) || []);
    
    const now = new Date();
    slots?.forEach(slot => {
      const [hours, minutes] = slot.start_time.split(':').map(Number);
      const slotTime = new Date();
      slotTime.setHours(hours, minutes, 0, 0);
      const windowEnd = new Date(slotTime.getTime() + 15 * 60 * 1000);
      
      // If we're past the window and attendance not marked
      if (now > windowEnd && !completedTimes.has(slot.start_time)) {
        notifications.push({
          id: `pending-${slot.id}`,
          type: 'attendance',
          title: 'Attendance Pending',
          message: `Attendance not marked for ${slot.subjects?.name} (${slot.classes?.name} ${slot.classes?.division}) at ${slot.start_time}`,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
    });
    
  } catch (error) {
    console.error('Error fetching pending alerts:', error);
  }
  
  return notifications;
}

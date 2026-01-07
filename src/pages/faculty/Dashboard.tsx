import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, BookOpen, Users, CheckCircle, AlertCircle, Activity, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageShell from '@/components/layout/PageShell';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getTodaySlots } from '@/services/timetable';
import { getSubjectAllocations, type SubjectAllocation } from '@/services/allocations';
import { getRecentActivity } from '@/services/activity';
import { getClassByTeacherId, type Class } from '@/services/classes';

interface LectureSlot {
  id: string;
  className: string;
  division: string;
  subject: string;
  subjectCode: string;
  time: string;
  room: string;
  isSubstitution: boolean;
  status: 'upcoming' | 'ongoing' | 'completed' | 'pending';
}

interface ActivityItem {
  id: string;
  message: string;
  timestamp: string;
}

const FacultyDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ name: string; department: string | null } | null>(null);
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [todaySlots, setTodaySlots] = useState<LectureSlot[]>([]);
  const [assignedClass, setAssignedClass] = useState<Class | null>(null);
  const [allocations, setAllocations] = useState<SubjectAllocation[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState({
    totalLectures: 0,
    completed: 0,
    pending: 0,
    substitutions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      try {
        // Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('name, department')
          .eq('id', user.id)
          .single();

        if (profileData) setProfile(profileData);

        // Fetch faculty record
        const { data: facultyData } = await supabase
          .from('faculty')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (facultyData) {
          setFacultyId(facultyData.id);
          await fetchAllData(facultyData.id, user.id);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  // Realtime subscriptions
  useEffect(() => {
    if (!facultyId || !user) return;

    const channel = supabase
      .channel('faculty-dashboard-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_sessions',
        filter: `faculty_id=eq.${facultyId}`,
      }, () => {
        fetchTodayData(facultyId);
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'timetable_slots',
        filter: `faculty_id=eq.${facultyId}`,
      }, () => {
        fetchTodayData(facultyId);
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
      }, () => {
        fetchActivity(user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [facultyId, user]);

  const fetchAllData = async (fId: string, profileId?: string) => {
    await Promise.all([
      fetchTodayData(fId),
      fetchAllocations(fId),
      fetchAssignedClass(fId),
      profileId ? fetchActivity(profileId) : Promise.resolve(),
    ]);
  };

  const fetchAssignedClass = async (fId: string) => {
    try {
      const classData = await getClassByTeacherId(fId);
      setAssignedClass(classData);
    } catch (error) {
      console.error('Error fetching assigned class:', error);
    }
  };

  const fetchTodayData = async (fId: string) => {
    try {
      const slots = await getTodaySlots(fId);
      const today = new Date().toISOString().split('T')[0];

      // Get today's attendance sessions for this faculty
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id, start_time')
        .eq('faculty_id', fId)
        .eq('date', today);

      // Get substitution assignments for today
      const { data: substitutions } = await supabase
        .from('substitution_assignments')
        .select('id, start_time')
        .eq('sub_faculty_id', fId)
        .eq('date', today);

      const completedTimes = new Set(sessions?.map(s => s.start_time) || []);
      const substitutionTimes = new Set(substitutions?.map(s => s.start_time) || []);

      const formattedSlots: LectureSlot[] = (slots || []).map((slot: {
        id: string;
        classes?: { name: string; division: string } | null;
        subjects?: { name: string; subject_code: string } | null;
        start_time: string;
        room_no: string | null;
      }) => {
        const isCompleted = completedTimes.has(slot.start_time);
        const isSubstitution = substitutionTimes.has(slot.start_time);
        const now = new Date();
        const [hours, minutes] = slot.start_time.split(':').map(Number);
        const slotTime = new Date();
        slotTime.setHours(hours, minutes, 0, 0);

        let status: 'upcoming' | 'ongoing' | 'completed' | 'pending' = 'upcoming';
        if (isCompleted) {
          status = 'completed';
        } else if (now >= slotTime && now <= new Date(slotTime.getTime() + 60 * 60 * 1000)) {
          status = 'ongoing';
        } else if (now > new Date(slotTime.getTime() + 60 * 60 * 1000)) {
          status = 'pending';
        }

        return {
          id: slot.id,
          className: slot.classes?.name || 'Unknown',
          division: slot.classes?.division || '',
          subject: slot.subjects?.name || 'Unknown',
          subjectCode: slot.subjects?.subject_code || '',
          time: slot.start_time,
          room: slot.room_no || 'TBA',
          isSubstitution,
          status,
        };
      });

      setTodaySlots(formattedSlots);
      setStats(prev => ({
        ...prev,
        totalLectures: formattedSlots.length,
        completed: formattedSlots.filter(s => s.status === 'completed').length,
        pending: formattedSlots.filter(s => s.status === 'pending' || s.status === 'upcoming' || s.status === 'ongoing').length - formattedSlots.filter(s => s.status === 'completed').length,
        substitutions: formattedSlots.filter(s => s.isSubstitution).length,
      }));
    } catch (error) {
      console.error('Error fetching today data:', error);
    }
  };

  const fetchAllocations = async (fId: string) => {
    try {
      const allocationsData = await getSubjectAllocations(fId);
      setAllocations(allocationsData);
    } catch (error) {
      console.error('Error fetching allocations:', error);
    }
  };

  const fetchActivity = async (profileId: string) => {
    try {
      const activity = await getRecentActivity(profileId, 5);
      setRecentActivity(activity.map(a => ({
        id: a.id,
        message: a.message,
        timestamp: a.timestamp,
      })));
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'ongoing':
        return <Clock className="w-5 h-5 text-warning animate-pulse" />;
      case 'pending':
        return <AlertCircle className="w-5 h-5 text-danger" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <PageShell role="faculty">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              {getGreeting()}, Prof. {profile?.name || 'Professor'}
            </h1>
            <p className="text-muted-foreground mt-1">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate('/faculty/today')} className="border-border/50">
            <Calendar className="w-4 h-4 mr-2" />
            View Schedule
          </Button>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Today's Lectures"
            value={loading ? '...' : stats.totalLectures}
            icon={Calendar}
            color="primary"
          />
          <StatCard
            title="Completed"
            value={loading ? '...' : stats.completed}
            icon={CheckCircle}
            color="success"
          />
          <StatCard
            title="Pending"
            value={loading ? '...' : stats.totalLectures - stats.completed}
            icon={Clock}
            color="warning"
          />
          <StatCard
            title="Substitutions"
            value={loading ? '...' : stats.substitutions}
            icon={RefreshCw}
            color="accent"
          />
        </div>

        {assignedClass && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-6 rounded-xl border-l-4 border-l-accent"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-accent/20">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Class Teacher</h3>
                <p className="text-muted-foreground">You are the class teacher for <span className="text-foreground font-medium">{assignedClass.name} {assignedClass.division}</span></p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Today's Lectures */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Today's Schedule
            </h2>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                    <div className="h-20 bg-muted rounded"></div>
                  </div>
                ))}
              </div>
            ) : todaySlots.length === 0 ? (
              <div className="glass-card rounded-xl p-8 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No lectures scheduled for today</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todaySlots.slice(0, 4).map((slot, index) => (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`glass-card rounded-xl p-4 border-l-4 ${slot.status === 'completed' ? 'border-l-success' :
                      slot.status === 'ongoing' ? 'border-l-warning' :
                        slot.status === 'pending' ? 'border-l-danger' : 'border-l-muted'
                      }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(slot.status)}
                          <span className="text-lg font-semibold text-foreground">
                            {slot.time}
                          </span>
                          {slot.isSubstitution && (
                            <StatusBadge variant="info">Sub</StatusBadge>
                          )}
                        </div>
                        <h3 className="font-medium text-foreground">
                          {slot.subject} ({slot.subjectCode})
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {slot.className} {slot.division} • Room {slot.room}
                        </p>
                      </div>
                      <StatusBadge
                        variant={
                          slot.status === 'completed' ? 'success' :
                            slot.status === 'ongoing' ? 'warning' :
                              slot.status === 'pending' ? 'danger' : 'outline'
                        }
                      >
                        {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                      </StatusBadge>
                    </div>
                  </motion.div>
                ))}
                {todaySlots.length > 4 && (
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground"
                    onClick={() => navigate('/faculty/today')}
                  >
                    View all {todaySlots.length} lectures
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Recent Activity
            </h2>
            <div className="glass-card rounded-xl p-4 mb-6">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              ) : (
                <div className="space-y-3">
                  {recentActivity.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-border/30 last:border-0 pb-3 last:pb-0"
                    >
                      <p className="text-sm text-foreground">{item.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(item.timestamp)}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Assigned Subjects */}
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Assigned Subjects
            </h2>
            <div className="glass-card rounded-xl p-4">
              {allocations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No subjects assigned</p>
              ) : (
                <div className="space-y-3">
                  {allocations.map((alloc, index) => (
                    <motion.div
                      key={alloc.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-border/30 last:border-0 pb-3 last:pb-0"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium text-foreground">{alloc.subjects?.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {alloc.classes?.name} {alloc.classes?.division} • {alloc.subjects?.subject_code}
                          </p>
                        </div>
                        <StatusBadge variant="outline" className="text-xs">
                          {alloc.subjects?.type}
                        </StatusBadge>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </PageShell>
  );
};

export default FacultyDashboardPage;

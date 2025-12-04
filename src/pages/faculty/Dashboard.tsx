import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, BookOpen, Users, CheckCircle, AlertCircle } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getTodaySlots } from '@/services/timetable';

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

const FacultyDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ name: string; department: string | null } | null>(null);
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [todaySlots, setTodaySlots] = useState<LectureSlot[]>([]);
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
          await fetchTodayData(facultyData.id);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

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

      const completedTimes = new Set(sessions?.map(s => s.start_time) || []);

      const formattedSlots: LectureSlot[] = (slots || []).map((slot: {
        id: string;
        classes?: { name: string; division: string } | null;
        subjects?: { name: string; subject_code: string } | null;
        start_time: string;
        room_no: string | null;
      }) => {
        const isCompleted = completedTimes.has(slot.start_time);
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
          isSubstitution: false,
          status,
        };
      });

      setTodaySlots(formattedSlots);
      setStats({
        totalLectures: formattedSlots.length,
        completed: formattedSlots.filter(s => s.status === 'completed').length,
        pending: formattedSlots.filter(s => s.status === 'pending' || s.status === 'upcoming').length,
        substitutions: formattedSlots.filter(s => s.isSubstitution).length,
      });
    } catch (error) {
      console.error('Error fetching today data:', error);
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

  return (
    <PageShell role="faculty">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            {getGreeting()}, {profile?.name || 'Professor'}
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

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
            value={loading ? '...' : stats.pending}
            icon={Clock}
            color="warning"
          />
          <StatCard
            title="Substitutions"
            value={loading ? '...' : stats.substitutions}
            icon={Users}
            color="accent"
          />
        </div>

        {/* Today's Lectures */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Today's Schedule
          </h2>

          {loading ? (
            <div className="grid gap-4">
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
            <div className="grid gap-4">
              {todaySlots.map((slot) => (
                <motion.div
                  key={slot.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`glass-card rounded-xl p-4 border-l-4 ${
                    slot.status === 'completed' ? 'border-l-success' :
                    slot.status === 'ongoing' ? 'border-l-warning' :
                    slot.status === 'pending' ? 'border-l-danger' : 'border-l-muted'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(slot.status)}
                        <span className="text-lg font-semibold text-foreground">
                          {slot.time}
                        </span>
                        {slot.isSubstitution && (
                          <StatusBadge variant="info">Substitution</StatusBadge>
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
            </div>
          )}
        </div>
      </motion.div>
    </PageShell>
  );
};

export default FacultyDashboardPage;

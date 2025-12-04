import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, BookOpen, Users, CheckCircle, AlertCircle, Play } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getTodaySlots } from '@/services/timetable';
import { getAttendanceSessions } from '@/services/attendance';

interface LectureSlot {
  id: string;
  className: string;
  division: string;
  subject: string;
  subjectCode: string;
  subjectId: string;
  classId: string;
  time: string;
  room: string;
  isSubstitution: boolean;
  status: 'upcoming' | 'ongoing' | 'completed' | 'leave';
  canTakeAttendance: boolean;
  sessionId?: string;
}

const FacultyTodayPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [todaySlots, setTodaySlots] = useState<LectureSlot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFacultyId() {
      if (!user) return;

      try {
        const { data } = await supabase
          .from('faculty')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (data) {
          setFacultyId(data.id);
        }
      } catch (error) {
        console.error('Error fetching faculty:', error);
      }
    }
    fetchFacultyId();
  }, [user]);

  useEffect(() => {
    if (!facultyId) return;

    async function fetchTodayData() {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [slots, sessions] = await Promise.all([
          getTodaySlots(facultyId!),
          getAttendanceSessions({ faculty_id: facultyId!, date: today }),
        ]);

        const completedSlots = new Map(
          (sessions || []).map((s: { start_time: string; id: string }) => [s.start_time, s.id])
        );

        const now = new Date();

        const formattedSlots: LectureSlot[] = (slots || []).map((slot: {
          id: string;
          classes?: { id: string; name: string; division: string } | null;
          subjects?: { id: string; name: string; subject_code: string } | null;
          start_time: string;
          room_no: string | null;
        }) => {
          const sessionId = completedSlots.get(slot.start_time);
          const isCompleted = !!sessionId;

          const [hours, minutes] = slot.start_time.split(':').map(Number);
          const slotTime = new Date();
          slotTime.setHours(hours, minutes, 0, 0);

          const windowStart = new Date(slotTime.getTime() - 5 * 60 * 1000); // -5 min
          const windowEnd = new Date(slotTime.getTime() + 15 * 60 * 1000); // +15 min
          const slotEnd = new Date(slotTime.getTime() + 60 * 60 * 1000); // +1 hour

          let status: 'upcoming' | 'ongoing' | 'completed' | 'leave' = 'upcoming';
          let canTakeAttendance = false;

          if (isCompleted) {
            status = 'completed';
          } else if (now >= windowStart && now <= windowEnd) {
            status = 'ongoing';
            canTakeAttendance = true;
          } else if (now > slotEnd) {
            status = 'upcoming'; // Missed
          }

          return {
            id: slot.id,
            className: slot.classes?.name || 'Unknown',
            division: slot.classes?.division || '',
            classId: slot.classes?.id || '',
            subject: slot.subjects?.name || 'Unknown',
            subjectCode: slot.subjects?.subject_code || '',
            subjectId: slot.subjects?.id || '',
            time: slot.start_time,
            room: slot.room_no || 'TBA',
            isSubstitution: false,
            status,
            canTakeAttendance,
            sessionId,
          };
        });

        setTodaySlots(formattedSlots);
      } catch (error) {
        console.error('Error fetching today data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTodayData();

    // Realtime subscription
    const channel = supabase
      .channel('faculty-today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
        fetchTodayData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [facultyId]);

  const handleTakeAttendance = (slot: LectureSlot) => {
    navigate(`/faculty/attendance/new`, {
      state: {
        classId: slot.classId,
        subjectId: slot.subjectId,
        startTime: slot.time,
        className: `${slot.className} ${slot.division}`,
        subjectName: slot.subject,
      },
    });
  };

  const handleViewAttendance = (sessionId: string) => {
    navigate(`/faculty/attendance/${sessionId}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'ongoing':
        return <Play className="w-5 h-5 text-warning animate-pulse" />;
      case 'leave':
        return <AlertCircle className="w-5 h-5 text-danger" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Today's Lectures
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

        {loading ? (
          <div className="grid gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
                <div className="h-24 bg-muted rounded"></div>
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
                className={`glass-card rounded-xl p-5 border-l-4 ${
                  slot.status === 'completed' ? 'border-l-success' :
                  slot.status === 'ongoing' ? 'border-l-warning' :
                  slot.status === 'leave' ? 'border-l-danger' : 'border-l-muted'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(slot.status)}
                      <span className="text-xl font-bold text-foreground">{slot.time}</span>
                      {slot.isSubstitution && (
                        <StatusBadge variant="info">Substitution</StatusBadge>
                      )}
                      <StatusBadge
                        variant={
                          slot.status === 'completed' ? 'success' :
                          slot.status === 'ongoing' ? 'warning' :
                          slot.status === 'leave' ? 'danger' : 'outline'
                        }
                      >
                        {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                      </StatusBadge>
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">
                      {slot.subject}
                      <span className="text-muted-foreground font-normal ml-2">({slot.subjectCode})</span>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {slot.className} {slot.division} • Room {slot.room}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {slot.canTakeAttendance && (
                      <Button onClick={() => handleTakeAttendance(slot)} className="btn-gradient">
                        <Play className="w-4 h-4 mr-2" />
                        Take Attendance
                      </Button>
                    )}
                    {slot.sessionId && (
                      <Button variant="outline" onClick={() => handleViewAttendance(slot.sessionId!)}>
                        View Attendance
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </PageShell>
  );
};

export default FacultyTodayPage;

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, BookOpen, Users, CheckCircle, AlertCircle, Play, ArrowRightLeft } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getTodaySlots } from '@/services/timetable';
import { getAttendanceSessions } from '@/services/attendance';
import { checkTimeGate } from '@/utils/timeGate';

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
  substitutionFor?: string;
  status: 'upcoming' | 'ongoing' | 'completed' | 'missed';
  canTakeAttendance: boolean;
  timeGateReason?: string;
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
        
        // Fetch regular slots and substitution assignments
        const [slots, sessions, substitutions] = await Promise.all([
          getTodaySlots(facultyId!),
          getAttendanceSessions({ faculty_id: facultyId!, date: today }),
          supabase
            .from('substitution_assignments')
            .select(`
              *,
              classes (id, name, division),
              subjects (id, name, subject_code),
              faculty!substitution_assignments_src_faculty_id_fkey (profiles (name))
            `)
            .eq('sub_faculty_id', facultyId!)
            .eq('date', today),
        ]);

        const completedSlots = new Map(
          (sessions || []).map((s: { start_time: string; id: string }) => [s.start_time, s.id])
        );

        // Format regular slots
        const formattedSlots: LectureSlot[] = (slots || []).map((slot: {
          id: string;
          classes?: { id: string; name: string; division: string } | null;
          subjects?: { id: string; name: string; subject_code: string } | null;
          start_time: string;
          room_no: string | null;
        }) => {
          const sessionId = completedSlots.get(slot.start_time);
          const isCompleted = !!sessionId;
          const timeGate = checkTimeGate(slot.start_time);
          
          // Check for 15-minute expiration
          const now = new Date();
          const [hours, minutes] = slot.start_time.split(':').map(Number);
          const lectureTime = new Date();
          lectureTime.setHours(hours, minutes, 0, 0);
          
          // If start time was "yesterday" logic via Date object, we might need care, 
          // but assuming today's view handles only today's timestamps.
          const fifteenMinsAfter = new Date(lectureTime.getTime() + 15 * 60000);
          
          let status: 'upcoming' | 'ongoing' | 'completed' | 'missed' = 'upcoming';
          
          if (isCompleted) {
            status = 'completed';
          } else if (now > fifteenMinsAfter) {
            // If currentTime > startTime + 15mins and not completed
            status = 'missed';
          } else if (timeGate.enabled) {
            status = 'ongoing';
          } else if (timeGate.reason === 'Attendance window closed') {
            status = 'missed';
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
            // Only allow taking attendance if not missed/completed and gate is open (or within 15 mins)
            canTakeAttendance: !isCompleted && status !== 'missed' && timeGate.enabled,
            timeGateReason: status === 'missed' ? 'Lecture time expired' : timeGate.reason,
            sessionId,
          };
        })
        // Filter out missed lectures from the view completely if desired, 
        // or keep them but show as missed. User said "remove that", so filtering.
        .filter((slot: LectureSlot) => slot.status !== 'missed'); 

        // Add substitution assignments
        const subData = substitutions.data || [];
        subData.forEach((sub: any) => {
          const sessionId = completedSlots.get(sub.start_time);
          const isCompleted = !!sessionId;
          const timeGate = checkTimeGate(sub.start_time);
          const srcFaculty = sub.faculty as unknown as { profiles: { name: string } } | null;

          // Check for 15-minute expiration
          const now = new Date();
          const [hours, minutes] = sub.start_time.split(':').map(Number);
          const lectureTime = new Date();
          lectureTime.setHours(hours, minutes, 0, 0);
          const fifteenMinsAfter = new Date(lectureTime.getTime() + 15 * 60000);

          let status: 'upcoming' | 'ongoing' | 'completed' | 'missed' = 'upcoming';
          if (isCompleted) {
            status = 'completed';
          } else if (now > fifteenMinsAfter) {
             status = 'missed';
          } else if (timeGate.enabled) {
            status = 'ongoing';
          } else if (timeGate.reason === 'Attendance window closed') {
            status = 'missed';
          }
          
          if (status === 'missed') return; // Skip missed substitutions too

          formattedSlots.push({
            id: `sub-${sub.id}`,
            className: sub.classes?.name || 'Unknown',
            division: sub.classes?.division || '',
            classId: sub.classes?.id || '',
            subject: sub.subjects?.name || 'Unknown',
            subjectCode: sub.subjects?.subject_code || '',
            subjectId: sub.subjects?.id || '',
            time: sub.start_time,
            room: 'TBA',
            isSubstitution: true,
            substitutionFor: srcFaculty?.profiles?.name,
            status,
            canTakeAttendance: !isCompleted && status !== 'missed' && timeGate.enabled,
            timeGateReason: status === 'missed' ? 'Lecture time expired' : timeGate.reason,
            sessionId,
          });
        });

        // Sort by time
        formattedSlots.sort((a, b) => a.time.localeCompare(b.time));

        setTodaySlots(formattedSlots);
      } catch (error) {
        console.error('Error fetching today data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchTodayData();

    // Realtime subscriptions
    const channel = supabase
      .channel('faculty-today')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
        fetchTodayData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_slots' }, () => {
        fetchTodayData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'substitution_assignments' }, () => {
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
        isSubstitution: slot.isSubstitution,
      },
    });
  };

  const handleViewAttendance = (sessionId: string) => {
    navigate(`/faculty/attendance/${sessionId}/view`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'ongoing':
        return <Play className="w-5 h-5 text-warning animate-pulse" />;
      case 'missed':
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
                  slot.status === 'missed' ? 'border-l-danger' : 'border-l-muted'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      {getStatusIcon(slot.status)}
                      <span className="text-xl font-bold text-foreground">{slot.time}</span>
                      {slot.isSubstitution && (
                        <StatusBadge variant="info">
                          <ArrowRightLeft className="w-3 h-3 mr-1" />
                          Substitution
                        </StatusBadge>
                      )}
                      <StatusBadge
                        variant={
                          slot.status === 'completed' ? 'success' :
                          slot.status === 'ongoing' ? 'warning' :
                          slot.status === 'missed' ? 'danger' : 'outline'
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
                    {slot.isSubstitution && slot.substitutionFor && (
                      <p className="text-sm text-info mt-1">
                        Substitution for Prof. {slot.substitutionFor}
                      </p>
                    )}
                    {slot.timeGateReason && slot.status !== 'completed' && (
                      <p className="text-xs text-muted-foreground mt-1">{slot.timeGateReason}</p>
                    )}
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

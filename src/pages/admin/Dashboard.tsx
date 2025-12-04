import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, GraduationCap, ClipboardCheck, BookOpen, Activity } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import StatCard from '@/components/ui/StatCard';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { getStudentCount } from '@/services/students';
import { getClasses } from '@/services/classes';
import { getTodayAttendanceStats, getAttendanceSessions } from '@/services/attendance';
import { getActivityLogs } from '@/services/activity';
import { getTodaySlots } from '@/services/timetable';
import { supabase } from '@/integrations/supabase/client';

interface TodaySession {
  id: string;
  className: string;
  subject: string;
  faculty: string;
  time: string;
  status: 'Marked' | 'Pending' | 'On Leave';
}

const AdminDashboardPage: React.FC = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    attendancePercentage: 0,
    lecturesMarked: 0,
    lecturesScheduled: 0,
  });
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  const [activities, setActivities] = useState<{ id: string; message: string; time: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [studentCount, classes, attendanceStats, todaySlots, activityLogs] = await Promise.all([
        getStudentCount(),
        getClasses(),
        getTodayAttendanceStats(),
        getTodaySlots(),
        getActivityLogs(10),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const todayAttendanceSessions = await getAttendanceSessions({ date: today });

      const markedSessionIds = new Set(todayAttendanceSessions?.map((s: { id: string }) => s.id) || []);

      setStats({
        totalStudents: studentCount,
        totalClasses: classes.length,
        attendancePercentage: attendanceStats.percentage,
        lecturesMarked: markedSessionIds.size,
        lecturesScheduled: todaySlots?.length || 0,
      });

      // Map today's slots to sessions with status
      const sessions: TodaySession[] = (todaySlots || []).map((slot: {
        id: string;
        classes?: { name: string; division: string } | null;
        subjects?: { name: string } | null;
        faculty?: { profiles?: { name: string } | null } | null;
        start_time: string;
      }) => ({
        id: slot.id,
        className: `${slot.classes?.name || ''} ${slot.classes?.division || ''}`,
        subject: slot.subjects?.name || 'Unknown',
        faculty: slot.faculty?.profiles?.name || 'Unknown',
        time: slot.start_time,
        status: markedSessionIds.has(slot.id) ? 'Marked' : 'Pending' as const,
      }));

      setTodaySessions(sessions);

      // Format activities
      const formattedActivities = (activityLogs || []).map((log: { id: string; message: string; timestamp: string }) => ({
        id: log.id,
        message: log.message,
        time: new Date(log.timestamp).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }));

      setActivities(formattedActivities);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up realtime subscriptions
    const attendanceChannel = supabase
      .channel('admin-attendance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
        fetchData();
      })
      .subscribe();

    const activityChannel = supabase
      .channel('admin-activity')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(attendanceChannel);
      supabase.removeChannel(activityChannel);
    };
  }, []);

  const sessionColumns = [
    { key: 'className', header: 'Class' },
    { key: 'subject', header: 'Subject' },
    { key: 'faculty', header: 'Faculty' },
    { key: 'time', header: 'Time' },
    {
      key: 'status',
      header: 'Status',
      render: (session: TodaySession) => (
        <StatusBadge
          variant={
            session.status === 'Marked' ? 'success' :
            session.status === 'On Leave' ? 'warning' : 'outline'
          }
        >
          {session.status}
        </StatusBadge>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* Header */}
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of attendance and academic management
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Students"
            value={loading ? '...' : stats.totalStudents}
            icon={Users}
            color="primary"
          />
          <StatCard
            title="Total Classes"
            value={loading ? '...' : stats.totalClasses}
            icon={GraduationCap}
            color="secondary"
          />
          <StatCard
            title="Today's Attendance"
            value={loading ? '...' : `${stats.attendancePercentage}%`}
            icon={ClipboardCheck}
            color={stats.attendancePercentage >= 75 ? 'success' : 'warning'}
          />
          <StatCard
            title="Lectures Today"
            value={loading ? '...' : `${stats.lecturesMarked}/${stats.lecturesScheduled}`}
            subtitle="Marked / Scheduled"
            icon={BookOpen}
            color="accent"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Today's Attendance Status */}
          <div className="lg:col-span-2">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Today's Attendance Status
            </h2>
            <DataTable
              columns={sessionColumns}
              data={todaySessions}
              keyExtractor={(item) => item.id}
              emptyMessage="No lectures scheduled for today"
              isLoading={loading}
            />
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              Recent Activity
            </h2>
            <div className="glass-card rounded-xl p-4 space-y-3">
              {loading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent activity
                </p>
              ) : (
                activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-border/30"
                  >
                    <div className="w-2 h-2 rounded-full bg-accent mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground line-clamp-2">
                        {activity.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </PageShell>
  );
};

export default AdminDashboardPage;

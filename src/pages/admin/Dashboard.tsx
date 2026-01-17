import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, GraduationCap, ClipboardCheck, BookOpen, Activity } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import StatCard from '@/components/ui/StatCard';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { getStudentCount } from '@/services/students';
import { getClasses } from '@/services/classes';
import { getTodayAttendanceStats, getAttendanceSessions, getDefaulters } from '@/services/attendance';
import { getActivityLogs } from '@/services/activity';
import { getTodaySlots } from '@/services/timetable';
import { getSubjects } from '@/services/subjects';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

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

  // Defaulters state
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [classesList, setClassesList] = useState<any[]>([]);
  const [subjectsList, setSubjectsList] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [defaultersLoading, setDefaultersLoading] = useState(false);
  const [realtimeTrigger, setRealtimeTrigger] = useState(0);

  const fetchData = async () => {
    try {
      const [studentCount, classes, attendanceStats, todaySlots, activityLogs, subjects] = await Promise.all([
        getStudentCount(),
        getClasses(),
        getTodayAttendanceStats(),
        getTodaySlots(),
        getActivityLogs(10),
        getSubjects(),
      ]);

      setClassesList(classes);
      setSubjectsList(subjects);

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
    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => {
        setRealtimeTrigger(p => p + 1);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => {
        setRealtimeTrigger(p => p + 1);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => {
        setRealtimeTrigger(p => p + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Re-fetch main data when trigger changes
  useEffect(() => {
      if (realtimeTrigger > 0) {
          fetchData();
      }
  }, [realtimeTrigger]);

  useEffect(() => {
    const fetchDefaulters = async () => {
      setDefaultersLoading(true);
      try {
        const filters: any = {};
        if (selectedClass && selectedClass !== 'all') filters.class_id = selectedClass;
        if (selectedSubject && selectedSubject !== 'all') filters.subject_id = selectedSubject;

        const data = await getDefaulters(filters);
        setDefaulters(data.slice(0, 5)); // Top 5
      } catch (error) {
        console.error('Error fetching defaulters:', error);
      } finally {
        setDefaultersLoading(false);
      }
    };
    fetchDefaulters();
  }, [selectedClass, selectedSubject, realtimeTrigger]);

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
          {/* Top Defaulters Section */}
          <div className="lg:col-span-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-destructive" />
                Top 5 Defaulters
              </h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="w-full sm:w-40">
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {classesList.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-40">
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="All Subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Subjects</SelectItem>
                      {subjectsList.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="glass-card rounded-xl p-0 overflow-hidden">
              <DataTable
                columns={[
                  { key: 'name', header: 'Student Name' },
                  { key: 'className', header: 'Class' },
                  { key: 'present', header: 'Present' },
                  { key: 'total', header: 'Total' },
                  {
                    key: 'percentage',
                    header: 'Attendance %',
                    render: (row: any) => (
                      <StatusBadge variant={row.percentage >= 75 ? 'success' : 'danger'}>
                        {row.percentage}%
                      </StatusBadge>
                    )
                  }
                ]}
                data={defaulters}
                keyExtractor={(item) => item.id}
                isLoading={defaultersLoading}
                emptyMessage="No defaulters found"
              />
            </div>
          </div>

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

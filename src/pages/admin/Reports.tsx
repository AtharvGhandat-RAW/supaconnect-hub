import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getClasses, type Class } from '@/services/classes';
import { getSubjects, type Subject } from '@/services/subjects';
import { getAttendanceSessions } from '@/services/attendance';
import { supabase } from '@/integrations/supabase/client';

const AdminReportsPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceData, setAttendanceData] = useState<{ date: string; percentage: number }[]>([]);
  const [subjectData, setSubjectData] = useState<{ subject: string; percentage: number }[]>([]);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [classData, subjectData] = await Promise.all([
          getClasses(),
          getSubjects(),
        ]);
        setClasses(classData);
        setSubjects(subjectData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  useEffect(() => {
    async function fetchReportData() {
      if (!selectedClass) return;

      try {
        // Fetch attendance sessions for the class in date range
        const sessions = await getAttendanceSessions({
          class_id: selectedClass,
          dateFrom,
          dateTo,
        });

        if (!sessions || sessions.length === 0) {
          setAttendanceData([]);
          setSubjectData([]);
          return;
        }

        // Group by date for line chart
        const dateMap = new Map<string, { present: number; total: number }>();
        const subjectMap = new Map<string, { present: number; total: number; name: string }>();

        for (const session of sessions) {
          // Get records for this session
          const { data: records } = await supabase
            .from('attendance_records')
            .select('status')
            .eq('session_id', session.id);

          const present = records?.filter(r => r.status === 'PRESENT').length || 0;
          const total = records?.length || 0;

          // Date aggregation
          const date = session.date;
          const existing = dateMap.get(date) || { present: 0, total: 0 };
          dateMap.set(date, { present: existing.present + present, total: existing.total + total });

          // Subject aggregation
          const subjectId = session.subject_id;
          const subjectName = (session as { subjects?: { name: string } }).subjects?.name || 'Unknown';
          const existingSubject = subjectMap.get(subjectId) || { present: 0, total: 0, name: subjectName };
          subjectMap.set(subjectId, {
            present: existingSubject.present + present,
            total: existingSubject.total + total,
            name: subjectName,
          });
        }

        // Convert to chart data
        const attendanceChartData = Array.from(dateMap.entries())
          .map(([date, { present, total }]) => ({
            date,
            percentage: total > 0 ? Math.round((present / total) * 100) : 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const subjectChartData = Array.from(subjectMap.values())
          .map(({ name, present, total }) => ({
            subject: name,
            percentage: total > 0 ? Math.round((present / total) * 100) : 0,
          }));

        setAttendanceData(attendanceChartData);
        setSubjectData(subjectChartData);
      } catch (error) {
        console.error('Error fetching report data:', error);
      }
    }
    fetchReportData();
  }, [selectedClass, dateFrom, dateTo]);

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">View attendance trends and statistics</p>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white/5 border-border/50 mt-1"
              />
            </div>
            <div>
              <Label>To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white/5 border-border/50 mt-1"
              />
            </div>
          </div>
        </div>

        {!selectedClass ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Select a class to view reports</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Attendance Trend */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Attendance Trend</h2>
              {attendanceData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={attendanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                    <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="percentage"
                      stroke="#4F46E5"
                      strokeWidth={2}
                      dot={{ fill: '#4F46E5' }}
                      name="Attendance %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Subject-wise Attendance */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Subject-wise Attendance</h2>
              {subjectData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={subjectData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="subject" stroke="#9CA3AF" fontSize={12} angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#9CA3AF" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                      labelStyle={{ color: '#F9FAFB' }}
                    />
                    <Bar dataKey="percentage" fill="#9333EA" name="Attendance %" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </PageShell>
  );
};

export default AdminReportsPage;

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { BarChart3, Download, FileText } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getClasses, type Class } from '@/services/classes';
import { getSubjects, type Subject } from '@/services/subjects';
import { supabase } from '@/integrations/supabase/client';
import { downloadCSV, generatePDFContent, printPDF } from '@/utils/export';
import { toast } from '@/hooks/use-toast';

interface StudentReport {
  roll_no: number | null;
  name: string;
  enrollment_no: string | null;
  present: number;
  total: number;
  percentage: number;
}

const AdminReportsPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [attendanceData, setAttendanceData] = useState<{ date: string; percentage: number }[]>([]);
  const [subjectData, setSubjectData] = useState<{ subject: string; percentage: number }[]>([]);
  const [threshold, setThreshold] = useState(75);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [classData, subjectData, settingsData] = await Promise.all([
          getClasses(),
          getSubjects(),
          supabase.from('settings').select('defaulter_threshold').maybeSingle(),
        ]);
        setClasses(classData);
        setSubjects(subjectData);
        if (settingsData.data?.defaulter_threshold) {
          setThreshold(settingsData.data.defaulter_threshold);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  const filteredSubjects = subjects.filter(s => {
    if (!selectedClass) return false;
    const cls = classes.find(c => c.id === selectedClass);
    return cls && s.semester === cls.semester && s.year === cls.year;
  });

  const handleGenerateReport = async () => {
    if (!selectedClass) {
      toast({ title: 'Error', description: 'Please select a class', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      // Fetch students for the class
      const { data: students } = await supabase
        .from('students')
        .select('id, roll_no, name, enrollment_no')
        .eq('class_id', selectedClass)
        .eq('status', 'ACTIVE')
        .order('roll_no');

      if (!students || students.length === 0) {
        setStudentReports([]);
        setAttendanceData([]);
        setSubjectData([]);
        toast({ title: 'No Data', description: 'No students found in this class' });
        return;
      }

      // Build session query
      let sessionQuery = supabase
        .from('attendance_sessions')
        .select('id, date, subject_id, subjects(name)')
        .eq('class_id', selectedClass)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (selectedSubject !== 'all') {
        sessionQuery = sessionQuery.eq('subject_id', selectedSubject);
      }

      const { data: sessions } = await sessionQuery;

      if (!sessions || sessions.length === 0) {
        setStudentReports([]);
        setAttendanceData([]);
        setSubjectData([]);
        toast({ title: 'No Data', description: 'No attendance sessions found for selected criteria' });
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      // Fetch all attendance records
      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id, session_id, status')
        .in('session_id', sessionIds);

      // Calculate per-student stats
      const studentStats: Record<string, { present: number; total: number }> = {};
      students.forEach(s => {
        studentStats[s.id] = { present: 0, total: 0 };
      });

      // Date aggregation for chart
      const dateMap = new Map<string, { present: number; total: number }>();
      const subjectMap = new Map<string, { present: number; total: number; name: string }>();

      sessions.forEach(session => {
        const sessionRecords = records?.filter(r => r.session_id === session.id) || [];
        const present = sessionRecords.filter(r => r.status === 'PRESENT').length;
        const total = sessionRecords.length;

        // Date aggregation
        const dateStats = dateMap.get(session.date) || { present: 0, total: 0 };
        dateMap.set(session.date, { present: dateStats.present + present, total: dateStats.total + total });

        // Subject aggregation
        const subjectsArr = session.subjects as unknown as { name: string }[] | null;
        const subjectName = subjectsArr?.[0]?.name || 'Unknown';
        const subjectStats = subjectMap.get(session.subject_id) || { present: 0, total: 0, name: subjectName };
        subjectMap.set(session.subject_id, {
          present: subjectStats.present + present,
          total: subjectStats.total + total,
          name: subjectName,
        });

        // Per student
        sessionRecords.forEach(record => {
          if (studentStats[record.student_id]) {
            studentStats[record.student_id].total++;
            if (record.status === 'PRESENT') {
              studentStats[record.student_id].present++;
            }
          }
        });
      });

      // Build student reports
      const reports: StudentReport[] = students.map(s => ({
        roll_no: s.roll_no,
        name: s.name,
        enrollment_no: s.enrollment_no,
        present: studentStats[s.id]?.present || 0,
        total: studentStats[s.id]?.total || 0,
        percentage: studentStats[s.id]?.total > 0
          ? Math.round((studentStats[s.id].present / studentStats[s.id].total) * 100)
          : 0,
      }));

      setStudentReports(reports.sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0)));

      // Chart data
      setAttendanceData(
        Array.from(dateMap.entries())
          .map(([date, { present, total }]) => ({
            date,
            percentage: total > 0 ? Math.round((present / total) * 100) : 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
      );

      setSubjectData(
        Array.from(subjectMap.values()).map(({ name, present, total }) => ({
          subject: name,
          percentage: total > 0 ? Math.round((present / total) * 100) : 0,
        }))
      );

      toast({ title: 'Success', description: 'Report generated successfully' });
    } catch (error) {
      console.error('Error generating report:', error);
      toast({ title: 'Error', description: 'Failed to generate report', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCSV = () => {
    if (studentReports.length === 0) return;
    downloadCSV(studentReports, `attendance_report_${dateFrom}_${dateTo}`, [
      { key: 'roll_no', header: 'Roll No' },
      { key: 'name', header: 'Name' },
      { key: 'enrollment_no', header: 'Enrollment No' },
      { key: 'present', header: 'Present' },
      { key: 'total', header: 'Total' },
      { key: 'percentage', header: 'Percentage' },
    ]);
  };

  const handleExportPDF = () => {
    if (studentReports.length === 0) return;
    const cls = classes.find(c => c.id === selectedClass);
    const subj = selectedSubject === 'all' ? 'All Subjects' : subjects.find(s => s.id === selectedSubject)?.name || '';
    
    const html = generatePDFContent({
      title: 'Attendance Report',
      subtitle: `${cls?.name} ${cls?.division} | ${subj} | ${dateFrom} to ${dateTo}`,
      headers: ['Roll No', 'Name', 'Enrollment No', 'Present', 'Total', 'Percentage'],
      rows: studentReports.map(r => [
        r.roll_no?.toString() || '-',
        r.name,
        r.enrollment_no || '-',
        r.present.toString(),
        r.total.toString(),
        `${r.percentage}%`,
      ]),
    });
    printPDF(html);
  };

  const columns = [
    { key: 'roll_no', header: 'Roll No', render: (r: StudentReport) => r.roll_no || '-' },
    { key: 'name', header: 'Name' },
    { key: 'enrollment_no', header: 'Enrollment No', render: (r: StudentReport) => r.enrollment_no || '-' },
    { key: 'present', header: 'Present' },
    { key: 'total', header: 'Total' },
    {
      key: 'percentage',
      header: 'Attendance %',
      render: (r: StudentReport) => (
        <span className={r.percentage < threshold ? 'text-destructive font-semibold' : 'text-success font-semibold'}>
          {r.percentage}%
        </span>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Generate detailed attendance reports for AIML department</p>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Class *</Label>
              <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSubject('all'); }}>
                <SelectTrigger className="bg-muted/50 border-border/50 mt-1">
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
              <Label>Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass}>
                <SelectTrigger className="bg-muted/50 border-border/50 mt-1">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {filteredSubjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
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
                className="bg-muted/50 border-border/50 mt-1"
              />
            </div>
            <div>
              <Label>To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-muted/50 border-border/50 mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleGenerateReport} 
                className="w-full btn-gradient"
                disabled={generating || !selectedClass}
              >
                {generating ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </div>

        {studentReports.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Select a class and click Generate Report to view attendance data</p>
          </div>
        ) : (
          <>
            {/* Export buttons */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={handleExportPDF}>
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="glass-card rounded-xl p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Attendance Trend</h2>
                {attendanceData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={attendanceData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="percentage"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                        name="Attendance %"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="glass-card rounded-xl p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Subject-wise Attendance</h2>
                {subjectData.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={subjectData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="subject" stroke="hsl(var(--muted-foreground))" fontSize={12} angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        labelStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                      <Bar dataKey="percentage" fill="hsl(var(--secondary))" name="Attendance %" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Student-wise table */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Student-wise Attendance</h2>
              <DataTable
                columns={columns}
                data={studentReports}
                keyExtractor={(r) => r.enrollment_no || r.name}
                emptyMessage="No student data"
              />
            </div>
          </>
        )}
      </motion.div>
    </PageShell>
  );
};

export default AdminReportsPage;

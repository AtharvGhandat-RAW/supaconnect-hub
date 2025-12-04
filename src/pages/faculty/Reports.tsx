import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, FileText, BarChart3 } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getSubjectAllocations, type SubjectAllocation } from '@/services/allocations';
import { getClasses, type Class } from '@/services/classes';
import { downloadCSV, generatePDFContent, printPDF } from '@/utils/export';
import { getSettings } from '@/services/settings';
import ritLogo from '@/assets/rit-logo.jpg';

interface StudentAttendance {
  id: string;
  roll_no: number | null;
  name: string;
  enrollment_no: string | null;
  present: number;
  total: number;
  percentage: number;
}

const FacultyReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<SubjectAllocation[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [studentData, setStudentData] = useState<StudentAttendance[]>([]);
  const [threshold, setThreshold] = useState(75);

  useEffect(() => {
    async function fetchInitialData() {
      if (!user) return;

      try {
        const { data: facultyData } = await supabase
          .from('faculty')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (facultyData) {
          setFacultyId(facultyData.id);
          const [allocs, classData, settings] = await Promise.all([
            getSubjectAllocations(facultyData.id),
            getClasses(),
            getSettings(),
          ]);
          setAllocations(allocs);
          setClasses(classData);
          if (settings?.defaulter_threshold) {
            setThreshold(settings.defaulter_threshold);
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, [user]);

  const handleGenerateReport = async () => {
    if (!selectedClass || !selectedSubject || !facultyId) return;

    setReportLoading(true);
    try {
      // Get students in the class
      const { data: students } = await supabase
        .from('students')
        .select('id, roll_no, name, enrollment_no')
        .eq('class_id', selectedClass)
        .eq('status', 'ACTIVE')
        .order('roll_no');

      if (!students) {
        setStudentData([]);
        return;
      }

      // Get sessions for this class/subject in date range
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('class_id', selectedClass)
        .eq('subject_id', selectedSubject)
        .eq('faculty_id', facultyId)
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (!sessions || sessions.length === 0) {
        setStudentData(students.map(s => ({
          ...s,
          present: 0,
          total: 0,
          percentage: 0,
        })));
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      // Get attendance records
      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id, status')
        .in('session_id', sessionIds);

      // Calculate per-student stats
      const studentStats = new Map<string, { present: number; total: number }>();
      students.forEach(s => studentStats.set(s.id, { present: 0, total: 0 }));

      (records || []).forEach(record => {
        const stats = studentStats.get(record.student_id);
        if (stats) {
          stats.total++;
          if (record.status === 'PRESENT') stats.present++;
        }
      });

      const reportData: StudentAttendance[] = students.map(s => {
        const stats = studentStats.get(s.id) || { present: 0, total: 0 };
        return {
          ...s,
          present: stats.present,
          total: stats.total,
          percentage: stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0,
        };
      });

      setStudentData(reportData);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const handleExportCSV = () => {
    downloadCSV(studentData, 'attendance_report', [
      { key: 'roll_no', header: 'Roll No' },
      { key: 'name', header: 'Name' },
      { key: 'enrollment_no', header: 'Enrollment' },
      { key: 'present', header: 'Present' },
      { key: 'total', header: 'Total' },
      { key: 'percentage', header: 'Attendance %' },
    ]);
  };

  const handleExportPDF = () => {
    const selectedAlloc = allocations.find(a => a.subject_id === selectedSubject);
    const subjectName = selectedAlloc?.subjects?.name || '';
    const classData = classes.find(c => c.id === selectedClass);
    const className = classData ? `${classData.name} ${classData.division}` : '';

    const htmlContent = generatePDFContent({
      title: 'Attendance Report',
      subtitle: `Class: ${className} | Subject: ${subjectName}`,
      date: `${dateFrom} to ${dateTo}`,
      logoSrc: ritLogo,
      headers: ['Roll No', 'Name', 'Enrollment', 'Present', 'Total', 'Attendance %'],
      rows: studentData.map(s => [
        s.roll_no?.toString() || '-',
        s.name,
        s.enrollment_no || '-',
        s.present.toString(),
        s.total.toString(),
        `${s.percentage}%`,
      ]),
    });

    printPDF(htmlContent);
  };

  const filteredSubjects = allocations.filter(a => a.class_id === selectedClass);

  const columns = [
    { key: 'roll_no', header: 'Roll No', render: (s: StudentAttendance) => s.roll_no || '-' },
    { key: 'name', header: 'Name' },
    { key: 'enrollment_no', header: 'Enrollment', render: (s: StudentAttendance) => s.enrollment_no || '-' },
    { key: 'present', header: 'Present' },
    { key: 'total', header: 'Total' },
    {
      key: 'percentage',
      header: 'Attendance %',
      render: (s: StudentAttendance) => (
        <StatusBadge variant={s.percentage >= threshold ? 'success' : 'danger'}>
          {s.percentage}%
        </StatusBadge>
      ),
    },
  ];

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Generate attendance reports for your classes</p>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSubject(''); }}>
                <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set(allocations.map(a => a.class_id))].map(classId => {
                    const classData = classes.find(c => c.id === classId);
                    return (
                      <SelectItem key={classId} value={classId}>
                        {classData?.name} {classData?.division}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject</Label>
              <Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass}>
                <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubjects.map(a => (
                    <SelectItem key={a.subject_id} value={a.subject_id}>
                      {a.subjects?.name}
                    </SelectItem>
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
            <div className="flex items-end">
              <Button
                onClick={handleGenerateReport}
                disabled={reportLoading || !selectedClass || !selectedSubject}
                className="w-full btn-gradient"
              >
                {reportLoading ? 'Loading...' : 'Generate'}
              </Button>
            </div>
          </div>
        </div>

        {studentData.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} className="border-border/50">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="border-border/50">
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        )}

        {!selectedClass || !selectedSubject ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Select class and subject to generate report</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={studentData}
            keyExtractor={(s) => s.id}
            isLoading={reportLoading}
            emptyMessage="No data available"
          />
        )}
      </motion.div>
    </PageShell>
  );
};

export default FacultyReportsPage;

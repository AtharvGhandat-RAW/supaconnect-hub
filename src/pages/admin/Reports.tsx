import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { BarChart3, Download, FileText, Printer, Wand2, AlertTriangle, CheckCircle, Users, BookOpen, RotateCcw } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { getClasses, type Class } from '@/services/classes';
import { getSubjects, type Subject } from '@/services/subjects';
import { getStudents, type Student } from '@/services/students';
import { getFaculty, type Faculty } from '@/services/faculty';
import { supabase } from '@/integrations/supabase/client';
import { downloadCSV, generatePDFContent, printPDF } from '@/utils/export';
import { toast } from '@/hooks/use-toast';
import ReportPreviewDialog from '@/components/ReportPreviewDialog';

interface StudentReport {
  student_id: string;
  roll_no: number | null;
  name: string;
  enrollment_no: string | null;
  present: number;
  total: number;
  percentage: number;
  subjects?: { name: string; present: number; total: number; percentage: number }[];
}

interface SubjectReport {
  subject_id: string;
  subject_name: string;
  subject_code: string;
  total_sessions: number;
  avg_attendance: number;
  students_below_threshold: number;
  total_students: number;
}

const AdminReportsPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [facultyList, setFacultyList] = useState<Faculty[]>([]);
  const [substitutionReports, setSubstitutionReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [manipulating, setManipulating] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState('all');
  const [selectedFaculty, setSelectedFaculty] = useState('all');
  const [reportType, setReportType] = useState<'student-wise' | 'subject-wise'>('student-wise');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [studentReports, setStudentReports] = useState<StudentReport[]>([]);
  const [subjectReports, setSubjectReports] = useState<SubjectReport[]>([]);
  const [attendanceData, setAttendanceData] = useState<{ date: string; percentage: number }[]>([]);
  const [threshold, setThreshold] = useState(75);
  const [showManipulateDialog, setShowManipulateDialog] = useState(false);
  const [studentsToFix, setStudentsToFix] = useState<StudentReport[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  useEffect(() => {
    async function fetchSubstitutions() {
        if (reportType !== 'substitutions') return;
        
        let subQuery = supabase
        .from('substitution_assignments')
        .select(`
          *,
          original_faculty:original_faculty_id(profiles(name)),
          sub_faculty:sub_faculty_id(profiles(name)),
          classes(name, division),
          subjects(name, subject_code)
        `)
        .gte('date', dateFrom)
        .lte('date', dateTo);

       if (selectedClass) subQuery = subQuery.eq('class_id', selectedClass);
       
       const { data } = await subQuery;
       
       let filtered = data || [];
       if (selectedFaculty !== 'all') {
           filtered = filtered.filter((s: any) => s.original_faculty_id === selectedFaculty || s.sub_faculty_id === selectedFaculty);
       }
       setSubstitutionReports(filtered);
    }
    fetchSubstitutions();
  }, [reportType, dateFrom, dateTo, selectedClass, selectedFaculty]);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [classData, subjectData, studentData, facultyData, settingsData] = await Promise.all([
          getClasses(),
          getSubjects(),
          getStudents(),
          getFaculty(),
          supabase.from('settings').select('defaulter_threshold').maybeSingle(),
        ]);
        setClasses(classData);
        setSubjects(subjectData);
        setAllStudents(studentData);
        setFacultyList(facultyData);
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

  const filteredStudents = allStudents.filter(s => s.class_id === selectedClass);

  const handleGenerateReport = async () => {
    if (!selectedClass && selectedFaculty === 'all') {
      toast({ title: 'Error', description: 'Please select a Class or Faculty', variant: 'destructive' });
      return;
    }

    setGenerating(true);
    try {
      let students: Student[] = [];
      if (selectedClass) {
        const { data } = await supabase
          .from('students')
          .select('id, roll_no, name, enrollment_no')
          .eq('class_id', selectedClass)
          .eq('status', 'ACTIVE')
          .order('roll_no');
        students = data || [];
      }

      let sessionQuery = supabase
        .from('attendance_sessions')
        .select('id, date, subject_id, subjects(id, name, subject_code)')
        .gte('date', dateFrom)
        .lte('date', dateTo);

      if (selectedClass) {
        sessionQuery = sessionQuery.eq('class_id', selectedClass);
      }
      if (selectedFaculty !== 'all') {
        sessionQuery = sessionQuery.eq('faculty_id', selectedFaculty);
      }
      if (selectedSubject !== 'all') {
        sessionQuery = sessionQuery.eq('subject_id', selectedSubject);
      }

      const { data: sessions } = await sessionQuery;

      if (!sessions || sessions.length === 0) {
        setStudentReports([]);
        setSubjectReports([]);
        setAttendanceData([]);
        toast({ title: 'No Data', description: 'No attendance sessions found for selected criteria' });
        return;
      }

      const sessionIds = sessions.map(s => s.id);

      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id, session_id, status')
        .in('session_id', sessionIds);

      const studentStats: Record<string, { 
        present: number; 
        total: number;
        subjects: Record<string, { present: number; total: number; name: string }>;
      }> = {};
      
      students.forEach(s => {
        studentStats[s.id] = { present: 0, total: 0, subjects: {} };
      });

      const subjectMap = new Map<string, { 
        name: string; 
        code: string;
        sessions: number;
        studentData: Record<string, { present: number; total: number }>;
      }>();

      const dateMap = new Map<string, { present: number; total: number }>();

      sessions.forEach(session => {
        const sessionRecords = records?.filter(r => r.session_id === session.id) || [];
        const subjectsArr = session.subjects as unknown as { id: string; name: string; subject_code: string } | null;
        const subjectId = subjectsArr?.id || session.subject_id;
        const subjectName = subjectsArr?.name || 'Unknown';
        const subjectCode = subjectsArr?.subject_code || '';

        if (!subjectMap.has(subjectId)) {
          subjectMap.set(subjectId, {
            name: subjectName,
            code: subjectCode,
            sessions: 0,
            studentData: {},
          });
        }
        const subjectStats = subjectMap.get(subjectId)!;
        subjectStats.sessions++;

        const present = sessionRecords.filter(r => r.status === 'PRESENT').length;
        const total = sessionRecords.length;
        const dateStats = dateMap.get(session.date) || { present: 0, total: 0 };
        dateMap.set(session.date, { present: dateStats.present + present, total: dateStats.total + total });

        sessionRecords.forEach(record => {
          if (studentStats[record.student_id]) {
            studentStats[record.student_id].total++;
            if (record.status === 'PRESENT') {
              studentStats[record.student_id].present++;
            }

            if (!studentStats[record.student_id].subjects[subjectId]) {
              studentStats[record.student_id].subjects[subjectId] = { present: 0, total: 0, name: subjectName };
            }
            studentStats[record.student_id].subjects[subjectId].total++;
            if (record.status === 'PRESENT') {
              studentStats[record.student_id].subjects[subjectId].present++;
            }

            if (!subjectStats.studentData[record.student_id]) {
              subjectStats.studentData[record.student_id] = { present: 0, total: 0 };
            }
            subjectStats.studentData[record.student_id].total++;
            if (record.status === 'PRESENT') {
              subjectStats.studentData[record.student_id].present++;
            }
          }
        });
      });

      const reports: StudentReport[] = students.map(s => ({
        student_id: s.id,
        roll_no: s.roll_no,
        name: s.name,
        enrollment_no: s.enrollment_no,
        present: studentStats[s.id]?.present || 0,
        total: studentStats[s.id]?.total || 0,
        percentage: studentStats[s.id]?.total > 0
          ? Math.round((studentStats[s.id].present / studentStats[s.id].total) * 100)
          : 0,
        subjects: Object.entries(studentStats[s.id]?.subjects || {}).map(([, data]) => ({
          name: data.name,
          present: data.present,
          total: data.total,
          percentage: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
        })),
      }));

      const filteredReports = selectedStudent === 'all' 
        ? reports 
        : reports.filter(r => r.student_id === selectedStudent);

      setStudentReports(filteredReports.sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0)));

      const subjectReportsList: SubjectReport[] = Array.from(subjectMap.entries()).map(([id, data]) => {
        const studentDataValues = Object.values(data.studentData);
        const totalPresent = studentDataValues.reduce((sum, s) => sum + s.present, 0);
        const totalAttendance = studentDataValues.reduce((sum, s) => sum + s.total, 0);
        const belowThreshold = studentDataValues.filter(s => 
          s.total > 0 && (s.present / s.total) * 100 < threshold
        ).length;

        return {
          subject_id: id,
          subject_name: data.name,
          subject_code: data.code,
          total_sessions: data.sessions,
          avg_attendance: totalAttendance > 0 ? Math.round((totalPresent / totalAttendance) * 100) : 0,
          students_below_threshold: belowThreshold,
          total_students: studentDataValues.length,
        };
      });

      setSubjectReports(subjectReportsList);

      setAttendanceData(
        Array.from(dateMap.entries())
          .map(([date, { present, total }]) => ({
            date,
            percentage: total > 0 ? Math.round((present / total) * 100) : 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date))
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

  const handlePrintOriginal = () => {
    if (studentReports.length === 0) return;
    const cls = classes.find(c => c.id === selectedClass);
    const subj = selectedSubject === 'all' ? 'All Subjects' : subjects.find(s => s.id === selectedSubject)?.name || '';
    
    const html = generatePDFContent({
      title: 'Attendance Report (Original)',
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
    setPreviewContent(html);
    setPreviewTitle('Attendance Report (Original)');
    setShowPreview(true);
  };

  const handleShowManipulateDialog = () => {
    const belowThreshold = studentReports.filter(r => r.percentage < 75 && r.total > 0);
    if (belowThreshold.length === 0) {
      toast({ title: 'All Good!', description: 'All students are already above 75% attendance' });
      return;
    }
    setStudentsToFix(belowThreshold);
    setShowManipulateDialog(true);
  };

  const handleManipulateAndSave = async () => {
    if (studentsToFix.length === 0) return;
    
    setManipulating(true);
    try {
      for (const student of studentsToFix) {
        // We want new percentage >= 0.75 by changing 'ABSENT' to 'PRESENT'.
        // Denominator (Total) stays the same.
        // (Present + x) / Total >= 0.76 (using 0.76 to be safe)
        // x >= 0.76 * Total - Present
        
        let neededPresent = Math.ceil(0.76 * student.total - student.present);
        
        // If neededPresent is negative (already above 76%), skip.
        if (neededPresent <= 0) continue;

        const { data: existingSessions } = await supabase
          .from('attendance_sessions')
          .select('id')
          .eq('class_id', selectedClass)
          .gte('date', dateFrom)
          .lte('date', dateTo);

        if (!existingSessions || existingSessions.length === 0) continue;

        // Find sessions where student is absent and update to present
        const { data: absentRecords } = await supabase
          .from('attendance_records')
          .select('id, session_id')
          .eq('student_id', student.student_id)
          .eq('status', 'ABSENT')
          .in('session_id', existingSessions.map(s => s.id));
        
        // Limit the number of records to flip
        const recordsToFlip = absentRecords ? absentRecords.slice(0, neededPresent) : [];

        if (recordsToFlip.length > 0) {
          const recordIds = recordsToFlip.map(r => r.id);
          await supabase
            .from('attendance_records')
            .update({ 
              status: 'PRESENT', 
              remark: 'Marked Present by Admin/HOD',
              is_admin_override: true,
              updated_at: new Date().toISOString() 
            } as any)
            .in('id', recordIds);
        }
      }

      toast({ 
        title: 'Manipulation Complete', 
        description: `${studentsToFix.length} students' attendance has been permanently updated.` 
      });
      
      setShowManipulateDialog(false);
      setStudentsToFix([]);
      
      await handleGenerateReport();
      
    } catch (error) {
      console.error('Error manipulating attendance:', error);
      toast({ title: 'Error', description: 'Failed to manipulate attendance', variant: 'destructive' });
    } finally {
      setManipulating(false);
    }
  };

  const handlePrintManipulated = () => {
    if (studentReports.length === 0) return;
    const cls = classes.find(c => c.id === selectedClass);
    const subj = selectedSubject === 'all' ? 'All Subjects' : subjects.find(s => s.id === selectedSubject)?.name || '';
    
    const manipulatedReports = studentReports.map(r => {
      // If student is already above threshold or has 0 total classes, no change.
      if (r.percentage >= 75 || r.total === 0) return r;

      // Calculate the minimum additional 'present' needed to reach 76% (to be safe > 75)
      // (Present + x) / Total >= 0.76 => x >= 0.76*Total - Present
      let needed = Math.ceil(0.76 * r.total - r.present);
      
      // We cannot add more 'present' than the number of 'absent' sessions (Total - Present).
      // Max possible X is (Total - Present).
      const maxPossible = r.total - r.present;
      if (needed > maxPossible) needed = maxPossible;

      const newPresent = r.present + needed;
      const newPercentage = Math.round((newPresent / r.total) * 100);

      return { ...r, present: newPresent, percentage: newPercentage };
    });

    const html = generatePDFContent({
      title: 'Attendance Report (Adjusted)',
      subtitle: `${cls?.name} ${cls?.division} | ${subj} | ${dateFrom} to ${dateTo}`,
      headers: ['Roll No', 'Name', 'Enrollment No', 'Present', 'Total', 'Percentage'],
      rows: manipulatedReports.map(r => [
        r.roll_no?.toString() || '-',
        r.name,
        r.enrollment_no || '-',
        r.present.toString(),
        r.total.toString(),
        `${r.percentage}%`,
      ]),
    });
    setPreviewContent(html);
    setPreviewTitle('Attendance Report (Adjusted)');
    setShowPreview(true);
  };

  const studentColumns = [
    { key: 'roll_no', header: 'Roll No', render: (r: StudentReport) => r.roll_no || '-' },
    { key: 'name', header: 'Name' },
    { key: 'enrollment_no', header: 'Enrollment No', render: (r: StudentReport) => r.enrollment_no || '-' },
    { key: 'present', header: 'Present' },
    { key: 'total', header: 'Total' },
    {
      key: 'percentage',
      header: 'Attendance %',
      render: (r: StudentReport) => (
        <span className={r.percentage < threshold ? 'text-destructive font-semibold' : 'text-green-500 font-semibold'}>
          {r.percentage}%
        </span>
      ),
    },
  ];

  const subjectColumns = [
    { key: 'subject_code', header: 'Code' },
    { key: 'subject_name', header: 'Subject Name' },
    { key: 'total_sessions', header: 'Sessions' },
    {
      key: 'avg_attendance',
      header: 'Avg Attendance',
      render: (r: SubjectReport) => (
        <span className={r.avg_attendance < threshold ? 'text-destructive font-semibold' : 'text-green-500 font-semibold'}>
          {r.avg_attendance}%
        </span>
      ),
    },
    {
      key: 'students_below_threshold',
      header: 'Defaulters',
      render: (r: SubjectReport) => (
        <span className={r.students_below_threshold > 0 ? 'text-destructive' : 'text-muted-foreground'}>
          {r.students_below_threshold} / {r.total_students}
        </span>
      ),
    },
  ];

  const belowThresholdCount = studentReports.filter(r => r.percentage < threshold && r.total > 0).length;
  const aboveThresholdCount = studentReports.filter(r => r.percentage >= threshold || r.total === 0).length;

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">Generate detailed attendance reports for AIML department</p>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <Label>Faculty</Label>
              <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
                <SelectTrigger className="bg-muted/50 border-border/50 mt-1">
                  <SelectValue placeholder="All Faculty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Faculty</SelectItem>
                  {facultyList.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.profiles?.name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Class</Label>
              <Select value={selectedClass || "all_classes"} onValueChange={(v) => { setSelectedClass(v === "all_classes" ? "" : v); setSelectedSubject('all'); setSelectedStudent('all'); }}>
                <SelectTrigger className="bg-muted/50 border-border/50 mt-1">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_classes">All Classes</SelectItem>
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
              <Label>Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={!selectedClass}>
                <SelectTrigger className="bg-muted/50 border-border/50 mt-1">
                  <SelectValue placeholder="All students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Students</SelectItem>
                  {filteredStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.roll_no} - {s.name}</SelectItem>
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

        {studentReports.length === 0 && subjectReports.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Select a class and click Generate Report to view attendance data</p>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{studentReports.length}</p>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">{aboveThresholdCount}</p>
                    <p className="text-xs text-muted-foreground">Above 75%</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/20">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-destructive">{belowThresholdCount}</p>
                    <p className="text-xs text-muted-foreground">Below 75%</p>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-secondary/20">
                    <BookOpen className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{subjectReports.length}</p>
                    <p className="text-xs text-muted-foreground">Subjects</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="glass-card rounded-xl p-4">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-fit">
                  <p className="text-sm font-medium text-foreground mb-2">Export Options</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportCSV}>
                      <Download className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                </div>
                <div className="flex-1 min-w-fit">
                  <p className="text-sm font-medium text-foreground mb-2">Print Original Report</p>
                  <Button variant="outline" size="sm" onClick={handlePrintOriginal}>
                    <Printer className="w-4 h-4 mr-2" />
                    Print Original
                  </Button>
                </div>
                <div className="flex-1 min-w-fit">
                  <p className="text-sm font-medium text-foreground mb-2">Manipulate & Fix Defaulters</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handlePrintManipulated} className="border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10">
                      <FileText className="w-4 h-4 mr-2" />
                      Print Adjusted
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={handleShowManipulateDialog}
                      className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:from-yellow-700 hover:to-orange-700"
                      disabled={belowThresholdCount === 0}
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Fix & Save Permanently
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Report Tabs */}
            <Tabs value={reportType} onValueChange={(v) => setReportType(v as typeof reportType)}>
              <TabsList>
                <TabsTrigger value="student-wise" className="gap-2">
                  <Users className="w-4 h-4" />
                  Student-wise Report
                </TabsTrigger>
                <TabsTrigger value="subject-wise" className="gap-2">
                  <BookOpen className="w-4 h-4" />
                  Subject-wise Report
                </TabsTrigger>
                <TabsTrigger value="defaulters" className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Defaulter List
                </TabsTrigger>
                <TabsTrigger value="substitutions" className="gap-2">
                  <RotateCcw className="w-4 h-4" />
                  Substitution Report
                </TabsTrigger>
              </TabsList>

              <TabsContent value="student-wise" className="space-y-6">
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
                    <h2 className="text-lg font-semibold text-foreground mb-4">Attendance Distribution</h2>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Above 75%', value: aboveThresholdCount, fill: 'hsl(142, 76%, 36%)' },
                            { name: 'Below 75%', value: belowThresholdCount, fill: 'hsl(0, 84%, 60%)' },
                          ]}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="hsl(142, 76%, 36%)" />
                          <Cell fill="hsl(0, 84%, 60%)" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Student-wise table */}
                <div className="glass-card rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Student-wise Attendance</h2>
                  <DataTable
                    columns={studentColumns}
                    data={studentReports}
                    keyExtractor={(r) => r.student_id}
                    emptyMessage="No student data"
                  />
                </div>
              </TabsContent>

              <TabsContent value="subject-wise" className="space-y-6">
                {/* Subject bar chart */}
                <div className="glass-card rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Subject-wise Attendance Overview</h2>
                  {subjectReports.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={subjectReports}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="subject_code" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                          labelStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value: number) => [`${value}%`, 'Avg Attendance']}
                        />
                        <Bar dataKey="avg_attendance" name="Avg Attendance">
                          {subjectReports.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.avg_attendance >= 75 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Subject-wise table */}
                <div className="glass-card rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Subject-wise Report</h2>
                  <DataTable
                    columns={subjectColumns}
                    data={subjectReports}
                    keyExtractor={(r) => r.subject_id}
                    emptyMessage="No subject data"
                  />
                </div>
              </TabsContent>

              <TabsContent value="defaulters" className="space-y-6">
                <div className="glass-card rounded-xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Defaulter List (Below {threshold}%)</h2>
                      <p className="text-sm text-muted-foreground">Students requiring attention</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                        const defaulters = studentReports.filter(r => r.percentage < threshold && r.total > 0);
                        if (defaulters.length === 0) return;
                        const cls = classes.find(c => c.id === selectedClass);
                        const subj = selectedSubject === 'all' ? 'All Subjects' : subjects.find(s => s.id === selectedSubject)?.name || '';
                        const html = generatePDFContent({
                           title: 'Defaulter List Report',
                           subtitle: `${cls?.name} ${cls?.division} | ${subj} | ${dateFrom} to ${dateTo}`,
                           headers: ['Roll No', 'Name', 'Enrollment No', 'Present', 'Total', 'Percentage'],
                           rows: defaulters.map(r => [
                             r.roll_no?.toString() || '-',
                             r.name,
                             r.enrollment_no || '-',
                             r.present.toString(),
                             r.total.toString(),
                             `${r.percentage}%`
                           ])
                        });
                        setPreviewContent(html);
                        setPreviewTitle('Defaulter List Report');
                        setShowPreview(true);
                    }} className="w-full sm:w-auto">
                      <Printer className="w-4 h-4 mr-2" />
                      Print Defaulter List
                    </Button>
                  </div>
                  <DataTable
                    columns={studentColumns}
                    data={studentReports.filter(r => r.percentage < threshold && r.total > 0)}
                    keyExtractor={(r) => r.student_id}
                    emptyMessage="No defaulters found"
                  />
                </div>
              </TabsContent>
              <TabsContent value="substitutions" className="space-y-6">
                <div className="glass-card rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Substitution Report</h2>
                  <DataTable
                    data={substitutionReports}
                    keyExtractor={(r: any) => r.id}
                    columns={[
                        { key: 'date', header: 'Date' },
                        { key: 'original_name', header: 'Original Faculty', render: (r: any) => r.original_faculty?.profiles?.name || '-' },
                        { key: 'sub_name', header: 'Substitute', render: (r: any) => r.sub_faculty?.profiles?.name || '-' },
                        { key: 'subject', header: 'Subject', render: (r: any) => r.subjects?.name || '-' },
                        { key: 'class', header: 'Class', render: (r: any) => `${r.classes?.name || ''} ${r.classes?.division || ''}` },
                        { key: 'status', header: 'Status' }
                    ]}
                    emptyMessage="No substitutions found"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* Manipulation Confirmation Dialog */}
        <AlertDialog open={showManipulateDialog} onOpenChange={setShowManipulateDialog}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-yellow-500">
                <Wand2 className="w-5 h-5" />
                Manipulate Attendance Data
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <p className="text-destructive font-medium">
                    ⚠️ WARNING: This action will PERMANENTLY modify attendance records in the database!
                  </p>
                  <p>
                    The following {studentsToFix.length} student(s) are below 75% and will be adjusted:
                  </p>
                  <div className="max-h-60 overflow-y-auto rounded-lg border border-border/50 p-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50">
                          <th className="text-left p-2">Roll No</th>
                          <th className="text-left p-2">Name</th>
                          <th className="text-right p-2">Current %</th>
                          <th className="text-right p-2">New %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentsToFix.map(s => {
                          let needed = Math.ceil(0.76 * s.total - s.present);
                          const maxPossible = s.total - s.present;
                          if (needed > maxPossible) needed = maxPossible;
                          
                          const newPresent = s.present + needed;
                          const newPercentage = s.total > 0 ? Math.round((newPresent / s.total) * 100) : 0;
                          
                          return (
                          <tr key={s.student_id} className="border-b border-border/30">
                            <td className="p-2">{s.roll_no || '-'}</td>
                            <td className="p-2">{s.name}</td>
                            <td className="p-2 text-right text-destructive">{s.percentage}%</td>
                            <td className="p-2 text-right text-green-500">{newPercentage}%</td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This will change ABSENT records to PRESENT to bring each student above 75%.
                  </p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={manipulating}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleManipulateAndSave}
                disabled={manipulating}
                className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:from-yellow-700 hover:to-orange-700"
              >
                {manipulating ? 'Processing...' : `Fix ${studentsToFix.length} Students Permanently`}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ReportPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          title={previewTitle}
          htmlContent={previewContent}
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminReportsPage;

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, Users, BookOpen, AlertCircle, Send, RotateCcw, Zap, AlertTriangle } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getStudents, type Student } from '@/services/students';
import { getClassWithTeacher } from '@/services/classes';
import { 
  createAttendanceSession, 
  createAttendanceRecords,
  getLastAttendanceSession,
  getLastClassAttendanceToday,
  getAttendanceRecordsWithStatus,
  getRecentAbsencePatterns,
  getMonthlySubjectAbsences
} from '@/services/attendance';
import { createActivityLog } from '@/services/activity';
import { shareToWhatsApp } from '@/utils/whatsapp';
import { checkTimeGate } from '@/utils/timeGate';

interface StudentAttendance extends Student {
  isPresent: boolean;
  recentAbsences?: number; // Number of absences in last 5 sessions
}

const FacultyAttendancePage: React.FC = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [facultyName, setFacultyName] = useState('');
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  // Topics related state removed
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [absentStudents, setAbsentStudents] = useState<Student[]>([]);
  const [timeGateError, setTimeGateError] = useState<string | null>(null);
  const [hasLastSession, setHasLastSession] = useState(false);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [absencePatterns, setAbsencePatterns] = useState<Map<string, number>>(new Map());
  const [monthlyAbsences, setMonthlyAbsences] = useState<Map<string, number>>(new Map());
  const [classTeacher, setClassTeacher] = useState<{name: string, phone?: string} | null>(null);
  
  // New state for copy functionality
  const [copySourceSession, setCopySourceSession] = useState<{id: string, time: string, subject: string} | null>(null);

  const state = location.state as {
    classId: string;
    subjectId: string;
    startTime: string;
    className: string;
    subjectName: string;
    isSubstitution?: boolean;
    batchId?: string;
    batchName?: string;
  } | undefined;

  const dataFetchedRef = React.useRef(false);

  useEffect(() => {
    async function fetchData() {
      if (!user || !state) return;
      
      // Prevent double fetching or re-fetching on spurious re-renders
      if (dataFetchedRef.current) return;
      dataFetchedRef.current = true;

      try {
        // Get faculty info
        const { data: facultyData } = await supabase
          .from('faculty')
          .select('id, profiles!inner (name)')
          .eq('profile_id', user.id)
          .single();

        if (facultyData) {
          setFacultyId(facultyData.id);
          const profiles = facultyData.profiles as unknown as { name: string } | null;
          setFacultyName(profiles?.name || '');
        }

        if (!state) {
          setLoading(false);
          return;
        }

        if (!state.classId) {
            console.error('Missing classId in state:', state);
            toast({ title: 'Error', description: 'Class information is missing.', variant: 'destructive' });
            setLoading(false);
            return;
        }

        // Check time gate
        const timeGate = checkTimeGate(state.startTime);
        if (!timeGate.enabled) {
          setTimeGateError(timeGate.reason || 'Attendance window not available');
        }

        console.log('Fetching data for Class:', state.classId, 'Subject:', state.subjectId);

        // Fetch data with individual error handling for better debugging
        try {
            // Determine how to fetch students (Class vs Batch)
            let studentsPromise;
            if (state.batchId) {
                // Fetch batch students
                studentsPromise = supabase
                    .from('student_batches')
                    .select('student:students(*)')
                    .eq('batch_id', state.batchId)
                    .then(({ data, error }) => {
                        if (error) throw error;
                        // @ts-ignore
                        return data.map(d => d.student).filter(s => s.status === 'ACTIVE') as Student[];
                    });
            } else {
                // Fetch whole class
                studentsPromise = getStudents({ class_id: state.classId, status: 'ACTIVE' });
            }

            const [studentDataResult, patternsResult, monthlyStatsResult, classInfoResult, lastSessionResult, sameDaySourceResult] = await Promise.allSettled([
                studentsPromise,
                getRecentAbsencePatterns(state.classId, state.subjectId, 5),
                getMonthlySubjectAbsences(state.classId, state.subjectId),
                getClassWithTeacher(state.classId),
                getLastAttendanceSession(state.classId, state.subjectId),
                getLastClassAttendanceToday(state.classId, new Date().toISOString().split('T')[0], state.batchId)
            ]);

            // Process Students
            let studentData: Student[] = [];
            if (studentDataResult.status === 'fulfilled') {
                studentData = studentDataResult.value;
                if (!studentData || studentData.length === 0) {
                    console.warn(`No active students found for class ${state.classId} (Batch: ${state.batchId || 'None'})`);
                    toast({ 
                        title: 'No Students Found', 
                        description: 'Could not find any active students for this class/batch.',
                        variant: 'destructive'
                    });
                }
            } else {
                console.error('Failed to fetch students:', studentDataResult.reason);
                throw new Error('Failed to fetch students: ' + (studentDataResult.reason.message || 'Unknown error'));
            }

            // Process Patterns
            const patterns = patternsResult.status === 'fulfilled' ? patternsResult.value : new Map();
            if (patternsResult.status === 'rejected') console.error('Failed to fetch patterns:', patternsResult.reason);

            // Process Monthly Stats
            const monthlyStats = monthlyStatsResult.status === 'fulfilled' ? monthlyStatsResult.value : new Map();
            if (monthlyStatsResult.status === 'rejected') console.error('Failed to fetch monthly stats:', monthlyStatsResult.reason);

            // Process Class Info
            let classInfo = null;
            if (classInfoResult.status === 'fulfilled') {
                classInfo = classInfoResult.value;
            } else {
                console.error('Failed to fetch class info:', classInfoResult.reason);
                // Non-critical?
            }

            // Process Last Session (Subject Specific context)
            const lastSession = lastSessionResult.status === 'fulfilled' ? lastSessionResult.value : null;

            // Process Same Day Source (For Copying)
            const sameDaySource = sameDaySourceResult.status === 'fulfilled' ? sameDaySourceResult.value : null;
            if (sameDaySource && sameDaySource.id) {
                // @ts-ignore
                const subjectName = sameDaySource.subject?.name || 'Unknown Subject';
                setCopySourceSession({
                    id: sameDaySource.id,
                    time: sameDaySource.start_time,
                    subject: subjectName
                });
            }

            setAbsencePatterns(patterns);
            setMonthlyAbsences(monthlyStats);

            // Set class teacher info
            if (classInfo && classInfo.faculty && classInfo.faculty.profiles) {
                setClassTeacher({
                    name: classInfo.faculty.profiles.name,
                    phone: classInfo.faculty.profiles.phone
                });
            }
            
            // Critical: Check if attendance for this session already exists
            if (lastSession && sessionId === 'new') {
                const today = new Date().toISOString().split('T')[0];
                // Simple loose equality for time (e.g. 09:00:00 vs 09:00)
                if (lastSession.date === today && lastSession.start_time.startsWith(state.startTime)) {
                    toast({ 
                        title: "Attendance Already Taken", 
                        description: "Attendance for this lecture has already been submitted.", 
                        variant: "destructive" 
                    });
                    navigate('/faculty/today');
                    return;
                }
            }

            // Check if there's a previous session to copy from
            if (lastSession) {
                setHasLastSession(true);
                setLastSessionDate(lastSession.date);
            }

            // Set students with absence patterns
            setStudents(studentData.map(s => ({ 
                ...s, 
                isPresent: true,
                recentAbsences: patterns.get(s.id) || 0
            })));

        } catch (error: any) {
             console.error('Error processing data:', error);
             throw error; // Re-throw to be caught by outer catch
        } finally {
            setLoading(false);
        }

      } catch (error: any) {
        console.error('Error fetching data:', error);
        toast({ 
            title: 'Error Loading Data', 
            description: error.message || 'Failed to load data. Please check console.', 
            variant: 'destructive' 
        });
        setLoading(false);
      }
    }
    fetchData();
  }, [user, state]);

  const handleTogglePresent = (studentId: string) => {
    setStudents(prev =>
      prev.map(s => s.id === studentId ? { ...s, isPresent: !s.isPresent } : s)
    );
  };

  const handleCopyFromSession = async () => {
    if (!copySourceSession) return;
    
    try {
        setLoading(true);
        const records = await getAttendanceRecordsWithStatus(copySourceSession.id);
        
        if (records.size > 0) {
            setStudents(prev => prev.map(s => ({
                ...s,
                isPresent: records.has(s.id) ? records.get(s.id) === 'PRESENT' : s.isPresent // Only override if record exists, else keep current
            })));
            
            toast({
                title: 'Attendance Copied',
                description: `Copied attendance from ${copySourceSession.subject} (${copySourceSession.time}).`,
            });
        }
    } catch (error) {
        console.error('Error copying attendance:', error);
        toast({ title: 'Error', description: 'Failed to copy attendance', variant: 'destructive' });
    } finally {
        setLoading(false);
    }
  };

  const handleMarkAllPresent = () => {
    setStudents(prev => prev.map(s => ({ ...s, isPresent: true })));
  };

  const handleMarkAllAbsent = () => {
    setStudents(prev => prev.map(s => ({ ...s, isPresent: false })));
  };

  // Copy attendance from last lecture
  const handleCopyFromLastLecture = useCallback(async () => {
    if (!state) return;
    
    try {
      const lastSession = await getLastAttendanceSession(state.classId, state.subjectId);
      if (!lastSession) {
        toast({ title: 'No Previous Session', description: 'No previous attendance record found for this subject', variant: 'destructive' });
        return;
      }

      const lastRecords = await getAttendanceRecordsWithStatus(lastSession.id);
      
      setStudents(prev => prev.map(s => ({
        ...s,
        isPresent: lastRecords.get(s.id) === 'PRESENT'
      })));

      toast({ 
        title: 'Copied from Last Lecture', 
        description: `Loaded attendance from ${new Date(lastSession.date).toLocaleDateString('en-IN')}. Review and make changes if needed.` 
      });
    } catch (error) {
      console.error('Error copying from last lecture:', error);
      toast({ title: 'Error', description: 'Failed to load previous attendance', variant: 'destructive' });
    }
  }, [state]);

  // Quick mark frequent absentees as absent
  const handleMarkFrequentAbsenteesAbsent = () => {
    setStudents(prev => prev.map(s => ({
      ...s,
      isPresent: (s.recentAbsences || 0) < 3 // Mark as absent if absent 3+ times in last 5 sessions
    })));
    
    const frequentAbsentees = students.filter(s => (s.recentAbsences || 0) >= 3).length;
    toast({ 
      title: 'Frequent Absentees Marked', 
      description: `${frequentAbsentees} students with 3+ recent absences marked as absent. Verify and adjust.` 
    });
  };

  // Copy to clipboard utility function
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied', description: 'Message copied to clipboard' });
    }).catch(() => {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    });
  };


  // Generate comprehensive message with ALL absent students - English only
  const generateFullMessageEN = () => {
    if (!state || absentStudents.length === 0) return '';
    const today = new Date().toLocaleDateString('en-GB');
    const studentDetails = absentStudents.map(s => {
      const absences = monthlyAbsences.get(s.id) || 0;
      const currentMonthTotal = absences + 1;
      return `  • Roll ${s.roll_no?.toString().padStart(2, '0')} - ${s.name} (Absence: ${currentMonthTotal} this month)`;
    }).join('\n');

    return `🔔 *ATTENDANCE ALERT*
━━━━━━━━━━━━━━━━━━━━
📚 Class: ${state.className}
📖 Subject: ${state.subjectName}
📅 Date: ${today}
👨‍🏫 Subject Teacher: Prof. ${facultyName}
${classTeacher ? `👨‍🏫 Class Teacher: Prof. ${classTeacher.name} ${classTeacher.phone ? `(${classTeacher.phone})` : ''}` : ''}
━━━━━━━━━━━━━━━━━━━━

❌ *ABSENT STUDENTS (${absentStudents.length}):*
${studentDetails}

━━━━━━━━━━━━━━━━━━━━
Dear Parents/Students,
Please ensure regular attendance.
Contact class teacher for any concerns.

— AIML Department
   RIT Polytechnic, Pune`;
  };

  // Generate comprehensive message with ALL absent students - Marathi only
  const generateFullMessageMR = () => {
    if (!state || absentStudents.length === 0) return '';
    const today = new Date().toLocaleDateString('en-IN');
    const studentDetails = absentStudents.map(s => {
      const absences = monthlyAbsences.get(s.id) || 0;
      const currentMonthTotal = absences + 1;
      return `  • रोल ${s.roll_no?.toString().padStart(2, '0')} - ${s.name} (ह्या महिन्यातील गैरहजेरी: ${currentMonthTotal})`;
    }).join('\n');

    return `🔔 *उपस्थिती सूचना*
━━━━━━━━━━━━━━━━━━━━
📚 इयत्ता: ${state.className}
📖 विषय: ${state.subjectName}
📅 दिनांक: ${today}
👨‍🏫 विषय शिक्षक: प्रो. ${facultyName}
${classTeacher ? `👨‍🏫 वर्ग शिक्षक: प्रो. ${classTeacher.name} ${classTeacher.phone ? `(${classTeacher.phone})` : ''}` : ''}
━━━━━━━━━━━━━━━━━━━━

❌ *गैरहजर विद्यार्थी (${absentStudents.length}):*
${studentDetails}

━━━━━━━━━━━━━━━━━━━━
आदरणीय पालक/विद्यार्थी,
कृपया नियमित उपस्थिती राखावी.
कोणत्याही समस्येसाठी वर्ग शिक्षकांशी संपर्क करा.

— AIML विभाग
   RIT पॉलिटेक्निक, पुणे`;
  };

  const handleSubmit = async () => {
    if (!state || !facultyId) return;

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Create attendance session
      // Ensure time format is HH:MM (remove seconds if present)
      const cleanStartTime = state.startTime.length > 5 ? state.startTime.substring(0, 5) : state.startTime;
      
      const session = await createAttendanceSession({
        class_id: state.classId,
        subject_id: state.subjectId,
        faculty_id: facultyId,
        date: today,
        start_time: cleanStartTime,
        is_substitution: state.isSubstitution || false,
        batch_id: state.batchId || null,
      });

      // Create attendance records
      const records = students.map(s => ({
        session_id: session.id,
        student_id: s.id,
        status: s.isPresent ? 'PRESENT' as const : 'ABSENT' as const,
      }));
      await createAttendanceRecords(records);

      // Log activity
      await createActivityLog(
        `Prof. ${facultyName} marked attendance for ${state.subjectName} (${state.className})`
      );
      
      setSubmitted(true);
      setAbsentStudents(students.filter(s => !s.isPresent));
      toast({ title: 'Success', description: 'Attendance marked successfully' });

    } catch (error: any) {
        console.error('Error submitting attendance:', error);
        toast({ 
            title: 'Submission Failed', 
            description: error.message || 'Failed to submit attendance', 
            variant: 'destructive' 
        });
    } finally {
      setSubmitting(false);
    }
  };

  if (!state && sessionId !== 'new') {
    return (
      <PageShell role="faculty">
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Invalid session</p>
          <Button onClick={() => navigate('/faculty/today')} className="mt-4">
            Back to Today
          </Button>
        </div>
      </PageShell>
    );
  }

  // Time gate error
  if (timeGateError) {
    return (
      <PageShell role="faculty">
        <div className="glass-card rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Attendance Not Available</h2>
          <p className="text-muted-foreground mb-4">{timeGateError}</p>
          <p className="text-sm text-muted-foreground mb-4">
            {state?.className} • {state?.subjectName} • {state?.startTime}
          </p>
          <Button onClick={() => navigate('/faculty/today')}>
            Back to Today
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {!submitted ? (
          <>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                  Take Attendance
                </h1>
                <p className="text-muted-foreground mt-1">
                  {state?.className} • {state?.subjectName} • {state?.startTime}
                </p>
                {state?.isSubstitution && (
                  <StatusBadge variant="info" className="mt-2">Substitution Lecture</StatusBadge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {hasLastSession && (
                  <Button variant="outline" onClick={handleCopyFromLastLecture} className="gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Copy from Last ({lastSessionDate ? new Date(lastSessionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''})
                  </Button>
                )}
                <Button variant="outline" onClick={handleMarkAllPresent}>
                  Mark All Present
                </Button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {copySourceSession && (
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleCopyFromSession}
                  className="gap-2 border-primary/30 hover:bg-primary/10 text-primary"
                >
                    <Copy className="w-4 h-4" />
                    Copy Attendance from {copySourceSession.subject}
                </Button>
              )}
              {absencePatterns.size > 0 && Array.from(absencePatterns.values()).some(v => v >= 3) && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleMarkFrequentAbsenteesAbsent}
                  className="gap-2 text-warning border-warning/30 hover:bg-warning/10"
                >
                  <Zap className="w-4 h-4" />
                  Auto-mark Frequent Absentees
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleMarkAllAbsent} className="text-muted-foreground">
                Mark All Absent
              </Button>
            </div>

            {/* Students List */}
            <div className="glass-card rounded-xl p-3 sm:p-6 pb-20 sm:pb-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Users className="w-5 h-5" /> Students</span>
                <span className="text-sm bg-background/20 px-2 py-1 rounded">
                   {students.filter(s => s.isPresent).length}/{students.length} Present
                </span>
              </h2>
              {loading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2 pb-16">
                  {students.map(student => (
                    <div
                      key={student.id}
                      onClick={() => handleTogglePresent(student.id)}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer select-none ${student.isPresent
                        ? 'bg-success/10 border-success/30 hover:bg-success/20'
                        : 'bg-danger/10 border-danger/30 hover:bg-danger/20'
                        }`}
                    >
                      <div className="flex items-center gap-3 mb-2 sm:mb-0">
                        <span className="text-sm font-mono text-muted-foreground w-8 shrink-0">
                          {student.roll_no?.toString().padStart(2, '0')}
                        </span>
                        <div className="flex flex-col">
                            <span className="font-medium text-foreground text-sm sm:text-base line-clamp-1">{student.name}</span>
                            {/* Frequent absentee indicator */}
                            {(student.recentAbsences || 0) >= 3 && (
                            <span 
                                className="flex items-center gap-1 text-[10px] sm:text-xs text-warning mt-0.5" 
                                title={`Absent ${student.recentAbsences} times in last 5 lectures`}
                            >
                                <AlertTriangle className="w-3 h-3" />
                                Frequent Absentee ({student.recentAbsences}x)
                            </span>
                            )}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full sm:w-auto" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant={student.isPresent ? 'default' : 'outline'}
                          onClick={() => handleTogglePresent(student.id)}
                          className={`flex-1 sm:flex-none ${student.isPresent ? 'bg-success hover:bg-success/80' : ''}`}
                        >
                          Present
                        </Button>
                        <Button
                          size="sm"
                          variant={!student.isPresent ? 'default' : 'outline'}
                          onClick={() => handleTogglePresent(student.id)}
                          className={`flex-1 sm:flex-none ${!student.isPresent ? 'bg-danger hover:bg-danger/80' : ''}`}
                        >
                          Absent
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Bar - Sticky on Mobile */}
            <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-border/50 bg-background/95 backdrop-blur z-50 sm:static sm:bg-transparent sm:border-0 sm:p-0">
                <div className="glass-card sm:rounded-xl p-0 sm:p-4 border-0 sm:border bg-transparent shadow-none">
                    <div className="flex gap-2 md:justify-end">
                        <Button variant="outline" onClick={() => navigate('/faculty/today')} className="flex-1 sm:flex-none">
                        Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={submitting} className="btn-gradient flex-1 sm:flex-none">
                        {submitting ? 'Submitting...' : 'Submit Attendance'}
                        </Button>
                    </div>
                </div>
            </div>
            
            {/* Spacer for sticky footer on mobile */}
            <div className="h-20 sm:hidden"></div>

          </>
        ) : (
          /* Simplified Post-Submission View */
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Check className="w-6 h-6 text-success" />
              <h1 className="text-2xl font-display font-bold text-foreground">
                Attendance Submitted
              </h1>
            </div>

            {absentStudents.length > 0 ? (
              <>
                {/* Quick Summary */}
                <div className="glass-card rounded-xl p-4 bg-gradient-to-r from-success/10 to-danger/10">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-3xl font-bold text-success">{students.length - absentStudents.length}</div>
                      <div className="text-sm text-muted-foreground">Present</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-danger">{absentStudents.length}</div>
                      <div className="text-sm text-muted-foreground">Absent</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-foreground">{students.length}</div>
                      <div className="text-sm text-muted-foreground">Total</div>
                    </div>
                    <div>
                      <div className="text-3xl font-bold text-accent">
                        {Math.round(((students.length - absentStudents.length) / students.length) * 100)}%
                      </div>
                      <div className="text-sm text-muted-foreground">Attendance</div>
                    </div>
                  </div>
                </div>

                {/* English Message */}
                <div className="glass-card rounded-xl p-5 border border-blue-500/30">
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    🇬🇧 English Message
                  </h2>
                  <pre className="text-sm bg-black/20 p-4 rounded-lg whitespace-pre-wrap border border-border/30 mb-4 max-h-[250px] overflow-y-auto font-sans">
                    {generateFullMessageEN()}
                  </pre>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => shareToWhatsApp(generateFullMessageEN())}
                      className="btn-gradient flex-1"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Share English to WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(generateFullMessageEN())}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Marathi Message */}
                <div className="glass-card rounded-xl p-5 border border-orange-500/30">
                  <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    🇮🇳 मराठी संदेश
                  </h2>
                  <pre className="text-sm bg-black/20 p-4 rounded-lg whitespace-pre-wrap border border-border/30 mb-4 max-h-[250px] overflow-y-auto font-sans">
                    {generateFullMessageMR()}
                  </pre>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => shareToWhatsApp(generateFullMessageMR())}
                      className="bg-orange-600 hover:bg-orange-700 flex-1"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      मराठी WhatsApp वर पाठवा
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => copyToClipboard(generateFullMessageMR())}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground text-center bg-accent/10 p-3 rounded-lg">
                  💡 <strong>Tip:</strong> Click Share → WhatsApp will open → Select your Parents Group → Send
                </p>
              </>
            ) : (
              <div className="glass-card rounded-xl p-8 text-center">
                <Check className="w-12 h-12 text-success mx-auto mb-4" />
                <p className="text-lg font-semibold text-foreground">All students were present! 🎉</p>
                <p className="text-muted-foreground mt-2">No notifications needed.</p>
              </div>
            )}

            <Button onClick={() => navigate('/faculty/today')} className="w-full sm:w-auto">
              Back to Today's Lectures
            </Button>
          </div>
        )}
      </motion.div>
    </PageShell>
  );
};

export default FacultyAttendancePage;

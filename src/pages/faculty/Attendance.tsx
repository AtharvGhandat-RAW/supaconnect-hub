import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, Users, BookOpen } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getStudents, type Student } from '@/services/students';
import { createAttendanceSession, createAttendanceRecords } from '@/services/attendance';
import { getSyllabusTopics, markTopicsCovered, type SyllabusTopic } from '@/services/syllabus';
import { createActivityLog } from '@/services/activity';

interface StudentAttendance extends Student {
  isPresent: boolean;
}

const FacultyAttendancePage: React.FC = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [facultyName, setFacultyName] = useState('');
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [absentStudents, setAbsentStudents] = useState<Student[]>([]);

  const state = location.state as {
    classId: string;
    subjectId: string;
    startTime: string;
    className: string;
    subjectName: string;
  } | undefined;

  useEffect(() => {
    async function fetchData() {
      if (!user) return;

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

        // Fetch students for the class
        const studentData = await getStudents({ class_id: state.classId, status: 'ACTIVE' });
        setStudents(studentData.map(s => ({ ...s, isPresent: true })));

        // Fetch syllabus topics for the subject
        const topicData = await getSyllabusTopics(state.subjectId);
        setTopics(topicData);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
      } finally {
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

  const handleMarkAllPresent = () => {
    setStudents(prev => prev.map(s => ({ ...s, isPresent: true })));
  };

  const handleToggleTopic = (topicId: string) => {
    setSelectedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  const handleSubmit = async () => {
    if (!state || !facultyId) return;

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Create attendance session
      const session = await createAttendanceSession({
        class_id: state.classId,
        subject_id: state.subjectId,
        faculty_id: facultyId,
        date: today,
        start_time: state.startTime,
      });

      // Create attendance records
      const records = students.map(s => ({
        session_id: session.id,
        student_id: s.id,
        status: s.isPresent ? 'PRESENT' as const : 'ABSENT' as const,
      }));
      await createAttendanceRecords(records);

      // Mark syllabus topics covered
      if (selectedTopics.size > 0) {
        await markTopicsCovered(session.id, Array.from(selectedTopics));
      }

      // Log activity
      await createActivityLog(
        `Prof. ${facultyName} marked attendance for ${state.subjectName} (${state.className})`
      );

      // Set absent students for message generation
      const absent = students.filter(s => !s.isPresent);
      setAbsentStudents(absent);
      setSubmitted(true);

      toast({ title: 'Success', description: 'Attendance submitted successfully' });
    } catch (error) {
      console.error('Error submitting attendance:', error);
      toast({ title: 'Error', description: 'Failed to submit attendance', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Message copied to clipboard' });
  };

  const generateCommonMessageEN = () => {
    if (!state) return '';
    const rolls = absentStudents.map(s => s.roll_no?.toString().padStart(2, '0')).join(', ');
    const today = new Date().toLocaleDateString('en-IN');
    return `Dear Parent/Student,
The following students were absent for today's lecture.
Class: ${state.className}  Subject: ${state.subjectName}  Date: ${today}
Absent Roll Nos: ${rolls}
Please ensure regular attendance.
— AIML Dept, RIT Polytechnic Pune`;
  };

  const generateCommonMessageMR = () => {
    if (!state) return '';
    const rolls = absentStudents.map(s => s.roll_no?.toString().padStart(2, '0')).join(', ');
    const today = new Date().toLocaleDateString('en-IN');
    return `आदरणीय पालक / विद्यार्थी,
खालील विद्यार्थी आजच्या तासाला गैरहजर होते.
इयत्ता: ${state.className}  विषय: ${state.subjectName}  दिनांक: ${today}
गैरहजर रोल क्र.: ${rolls}
नियमित उपस्थिती आवश्यक आहे.
— AIML विभाग, RIT Polytechnic Pune`;
  };

  const generateStudentMessageEN = (student: Student) => {
    if (!state) return '';
    const today = new Date().toLocaleDateString('en-IN');
    return `Dear ${student.name},
You were absent for ${state.subjectName} lecture.
Class: ${state.className}  Date: ${today}
Please maintain regular attendance.
— AIML Dept, RIT Polytechnic Pune`;
  };

  const generateStudentMessageMR = (student: Student) => {
    if (!state) return '';
    const today = new Date().toLocaleDateString('en-IN');
    return `प्रिय ${student.name},
आपण आज ${today} रोजी ${state.className} च्या ${state.subjectName} तासाला गैरहजर होता.
कृपया नियमित उपस्थिती राखावी.
— AIML विभाग, RIT Polytechnic Pune`;
  };

  const topicsByUnit = topics.reduce((acc, topic) => {
    if (!acc[topic.unit_no]) acc[topic.unit_no] = [];
    acc[topic.unit_no].push(topic);
    return acc;
  }, {} as Record<number, SyllabusTopic[]>);

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
              </div>
              <Button variant="outline" onClick={handleMarkAllPresent}>
                Mark All Present
              </Button>
            </div>

            {/* Students List */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Students ({students.filter(s => s.isPresent).length}/{students.length} Present)
              </h2>
              {loading ? (
                <div className="animate-pulse space-y-2">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 bg-muted rounded"></div>
                  ))}
                </div>
              ) : (
                <div className="grid gap-2 max-h-[400px] overflow-y-auto">
                  {students.map(student => (
                    <div
                      key={student.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                        student.isPresent
                          ? 'bg-success/10 border-success/30'
                          : 'bg-danger/10 border-danger/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-muted-foreground w-8">
                          {student.roll_no?.toString().padStart(2, '0')}
                        </span>
                        <span className="font-medium text-foreground">{student.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={student.isPresent ? 'default' : 'outline'}
                          onClick={() => handleTogglePresent(student.id)}
                          className={student.isPresent ? 'bg-success hover:bg-success/80' : ''}
                        >
                          P
                        </Button>
                        <Button
                          size="sm"
                          variant={!student.isPresent ? 'default' : 'outline'}
                          onClick={() => handleTogglePresent(student.id)}
                          className={!student.isPresent ? 'bg-danger hover:bg-danger/80' : ''}
                        >
                          A
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Syllabus Coverage */}
            {topics.length > 0 && (
              <div className="glass-card rounded-xl p-6">
                <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5" />
                  Topics Covered Today
                </h2>
                <div className="space-y-4">
                  {Object.entries(topicsByUnit).map(([unit, unitTopics]) => (
                    <div key={unit}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Unit {unit}</h3>
                      <div className="space-y-2">
                        {unitTopics.map(topic => (
                          <label
                            key={topic.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedTopics.has(topic.id)}
                              onCheckedChange={() => handleToggleTopic(topic.id)}
                            />
                            <span className="text-sm text-foreground">{topic.topic_text}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate('/faculty/today')}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting} className="btn-gradient">
                {submitting ? 'Submitting...' : 'Submit Attendance'}
              </Button>
            </div>
          </>
        ) : (
          /* Absent Messages */
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Check className="w-6 h-6 text-success" />
              <h1 className="text-2xl font-display font-bold text-foreground">
                Attendance Submitted
              </h1>
            </div>

            {absentStudents.length > 0 ? (
              <>
                <div className="glass-card rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Common Absent Message ({absentStudents.length} absent)
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">English</span>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generateCommonMessageEN())}>
                          <Copy className="w-4 h-4 mr-1" /> Copy
                        </Button>
                      </div>
                      <pre className="text-sm bg-white/5 p-3 rounded-lg whitespace-pre-wrap border border-border/30">
                        {generateCommonMessageEN()}
                      </pre>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Marathi (मराठी)</span>
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(generateCommonMessageMR())}>
                          <Copy className="w-4 h-4 mr-1" /> Copy
                        </Button>
                      </div>
                      <pre className="text-sm bg-white/5 p-3 rounded-lg whitespace-pre-wrap border border-border/30">
                        {generateCommonMessageMR()}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="glass-card rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-4">
                    Per-Student Messages
                  </h2>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {absentStudents.map(student => (
                      <div key={student.id} className="border border-border/30 rounded-lg p-4">
                        <h3 className="font-medium text-foreground mb-2">
                          Roll {student.roll_no} - {student.name}
                        </h3>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(generateStudentMessageEN(student))}
                          >
                            <Copy className="w-3 h-3 mr-1" /> EN
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(generateStudentMessageMR(student))}
                          >
                            <Copy className="w-3 h-3 mr-1" /> MR
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-card rounded-xl p-8 text-center">
                <Check className="w-12 h-12 text-success mx-auto mb-4" />
                <p className="text-muted-foreground">All students were present!</p>
              </div>
            )}

            <Button onClick={() => navigate('/faculty/today')}>
              Back to Today's Lectures
            </Button>
          </div>
        )}
      </motion.div>
    </PageShell>
  );
};

export default FacultyAttendancePage;

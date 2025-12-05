import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Check, Copy, Users, BookOpen, AlertCircle, Send } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getStudents, type Student } from '@/services/students';
import { createAttendanceSession, createAttendanceRecords } from '@/services/attendance';
import { getSyllabusTopics, getCoverageForSession, markTopicsCovered, type SyllabusTopic } from '@/services/syllabus';
import { createActivityLog } from '@/services/activity';
import { shareToWhatsApp } from '@/utils/whatsapp';
import { checkTimeGate } from '@/utils/timeGate';

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
  const [timeGateError, setTimeGateError] = useState<string | null>(null);

  const state = location.state as {
    classId: string;
    subjectId: string;
    startTime: string;
    className: string;
    subjectName: string;
    isSubstitution?: boolean;
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

        // Check time gate
        const timeGate = checkTimeGate(state.startTime);
        if (!timeGate.enabled) {
          setTimeGateError(timeGate.reason || 'Attendance window not available');
        }

        // Fetch students for the class
        const studentData = await getStudents({ class_id: state.classId, status: 'ACTIVE' });
        setStudents(studentData.map(s => ({ ...s, isPresent: true })));

        // Fetch syllabus topics for the subject
        const topicData = await getSyllabusTopics(state.subjectId);
        setTopics(topicData);

        // If reopening an existing session, load previously covered topics
        if (sessionId && sessionId !== 'new') {
          const existingCoverage = await getCoverageForSession(sessionId);
          if (existingCoverage.length > 0) {
            setSelectedTopics(new Set(existingCoverage));
          }
        }
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

  // Generate comprehensive message with ALL absent students - English only
  const generateFullMessageEN = () => {
    if (!state || absentStudents.length === 0) return '';
    const today = new Date().toLocaleDateString('en-IN');
    const studentDetails = absentStudents.map(s =>
      `  • Roll ${s.roll_no?.toString().padStart(2, '0')} - ${s.name}`
    ).join('\n');

    return `🔔 *ATTENDANCE ALERT*
━━━━━━━━━━━━━━━━━━━━
📚 Class: ${state.className}
📖 Subject: ${state.subjectName}
📅 Date: ${today}
👨‍🏫 Faculty: Prof. ${facultyName}
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
    const studentDetails = absentStudents.map(s =>
      `  • रोल ${s.roll_no?.toString().padStart(2, '0')} - ${s.name}`
    ).join('\n');

    return `🔔 *उपस्थिती सूचना*
━━━━━━━━━━━━━━━━━━━━
📚 इयत्ता: ${state.className}
📖 विषय: ${state.subjectName}
📅 दिनांक: ${today}
👨‍🏫 प्राध्यापक: प्रो. ${facultyName}
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
      const session = await createAttendanceSession({
        class_id: state.classId,
        subject_id: state.subjectId,
        faculty_id: facultyId,
        date: today,
        start_time: state.startTime,
        is_substitution: state.isSubstitution || false,
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

      // Log activity with topic count
      const topicInfo = selectedTopics.size > 0 ? ` and covered ${selectedTopics.size} topic(s)` : '';
      await createActivityLog(
        `Prof. ${facultyName} marked attendance for ${state.subjectName} (${state.className})${topicInfo}`
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
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${student.isPresent
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
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Topics Covered Today
                {selectedTopics.size > 0 && (
                  <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                    {selectedTopics.size} selected
                  </span>
                )}
              </h2>
              {topics.length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(topicsByUnit).map(([unit, unitTopics]) => (
                    <div key={unit}>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Unit {unit}
                        <span className="text-xs ml-2">({unitTopics.filter(t => selectedTopics.has(t.id)).length}/{unitTopics.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {unitTopics.map(topic => (
                          <label
                            key={topic.id}
                            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selectedTopics.has(topic.id)
                                ? 'bg-accent/10 border border-accent/30'
                                : 'hover:bg-white/5 border border-transparent'
                              }`}
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
              ) : (
                <div className="text-center py-6">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground mb-3">No topics defined for this subject yet</p>
                  <Link
                    to="/faculty/subjects"
                    className="text-accent hover:underline text-sm font-medium"
                  >
                    → Add topics from My Subjects
                  </Link>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="glass-card rounded-xl p-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/faculty/today')}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="btn-gradient">
                  {submitting ? 'Submitting...' : 'Submit Attendance'}
                </Button>
              </div>
            </div>
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

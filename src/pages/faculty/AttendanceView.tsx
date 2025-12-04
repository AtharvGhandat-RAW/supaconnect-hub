import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, X, BookOpen, MessageSquare, Copy, Users } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { openWhatsApp } from '@/utils/whatsapp';

interface SessionDetails {
  id: string;
  date: string;
  start_time: string;
  is_substitution: boolean;
  created_at: string;
  classes: { name: string; division: string } | null;
  subjects: { name: string; subject_code: string } | null;
  faculty: { profiles: { name: string } | null } | null;
}

interface AttendanceRecord {
  id: string;
  status: 'PRESENT' | 'ABSENT';
  student: {
    id: string;
    name: string;
    roll_no: number | null;
    mobile: string | null;
  } | null;
}

interface CoveredTopic {
  id: string;
  topic_text: string;
  unit_no: number;
}

const FacultyAttendanceViewPage: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionDetails | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [coveredTopics, setCoveredTopics] = useState<CoveredTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSessionData() {
      if (!sessionId) return;

      try {
        // Fetch session details
        const { data: sessionData, error: sessionError } = await supabase
          .from('attendance_sessions')
          .select(`
            id, date, start_time, is_substitution, created_at,
            classes (name, division),
            subjects (name, subject_code),
            faculty (profiles (name))
          `)
          .eq('id', sessionId)
          .single();

        if (sessionError) throw sessionError;
        
        // Handle joined data properly
        const session: SessionDetails = {
          id: sessionData.id,
          date: sessionData.date,
          start_time: sessionData.start_time,
          is_substitution: sessionData.is_substitution,
          created_at: sessionData.created_at,
          classes: sessionData.classes as unknown as SessionDetails['classes'],
          subjects: sessionData.subjects as unknown as SessionDetails['subjects'],
          faculty: sessionData.faculty as unknown as SessionDetails['faculty'],
        };
        setSession(session);

        // Fetch attendance records
        const { data: recordsData, error: recordsError } = await supabase
          .from('attendance_records')
          .select(`
            id, status,
            students (id, name, roll_no, mobile)
          `)
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (recordsError) throw recordsError;
        setRecords(
          (recordsData || []).map((r) => ({
            id: r.id,
            status: r.status,
            student: r.students as unknown as AttendanceRecord['student'],
          }))
        );

        // Fetch covered topics
        const { data: coverageData, error: coverageError } = await supabase
          .from('syllabus_coverage')
          .select(`
            id,
            syllabus_topics (id, topic_text, unit_no)
          `)
          .eq('session_id', sessionId);

        if (coverageError) throw coverageError;
        setCoveredTopics(
          (coverageData || []).map((c) => {
            const topic = c.syllabus_topics as unknown as { id: string; topic_text: string; unit_no: number } | null;
            return {
              id: topic?.id || c.id,
              topic_text: topic?.topic_text || '',
              unit_no: topic?.unit_no || 0,
            };
          }).filter(t => t.topic_text)
        );
      } catch (error) {
        console.error('Error fetching session:', error);
        toast({ title: 'Error', description: 'Failed to load session', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    }

    fetchSessionData();
  }, [sessionId]);

  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;
  const absentStudents = records.filter((r) => r.status === 'ABSENT');

  const generateCommonMessageEN = () => {
    if (!session) return '';
    const rolls = absentStudents
      .map((r) => r.student?.roll_no?.toString().padStart(2, '0'))
      .filter(Boolean)
      .join(', ');
    const date = new Date(session.date).toLocaleDateString('en-IN');
    const className = `${session.classes?.name || ''} ${session.classes?.division || ''}`.trim();
    const subject = session.subjects?.name || '';

    return `Dear Parent/Student,
The following students were absent for today's lecture.
Class: ${className}  Subject: ${subject}  Date: ${date}
Absent Roll Nos: ${rolls}
Please ensure regular attendance.
— AIML Dept, RIT Polytechnic Pune`;
  };

  const generateCommonMessageMR = () => {
    if (!session) return '';
    const rolls = absentStudents
      .map((r) => r.student?.roll_no?.toString().padStart(2, '0'))
      .filter(Boolean)
      .join(', ');
    const date = new Date(session.date).toLocaleDateString('en-IN');
    const className = `${session.classes?.name || ''} ${session.classes?.division || ''}`.trim();
    const subject = session.subjects?.name || '';

    return `आदरणीय पालक / विद्यार्थी,
खालील विद्यार्थी आजच्या तासाला गैरहजर होते.
इयत्ता: ${className}  विषय: ${subject}  दिनांक: ${date}
गैरहजर रोल क्र.: ${rolls}
नियमित उपस्थिती आवश्यक आहे.
— AIML विभाग, RIT Polytechnic पुणे`;
  };

  const generateStudentMessageEN = (student: AttendanceRecord['student']) => {
    if (!session || !student) return '';
    const date = new Date(session.date).toLocaleDateString('en-IN');
    const className = `${session.classes?.name || ''} ${session.classes?.division || ''}`.trim();
    const subject = session.subjects?.name || '';

    return `Dear ${student.name},
You were absent for ${subject} lecture.
Class: ${className}  Date: ${date}
Please maintain regular attendance.
— AIML Dept, RIT Polytechnic Pune`;
  };

  const generateStudentMessageMR = (student: AttendanceRecord['student']) => {
    if (!session || !student) return '';
    const date = new Date(session.date).toLocaleDateString('en-IN');
    const className = `${session.classes?.name || ''} ${session.classes?.division || ''}`.trim();
    const subject = session.subjects?.name || '';

    return `प्रिय ${student.name},
आपण आज ${date} रोजी ${className} च्या ${subject} तासाला गैरहजर होता.
कृपया नियमित उपस्थिती राखावी.
— AIML विभाग, RIT Polytechnic पुणे`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Message copied to clipboard' });
  };

  const topicsByUnit = coveredTopics.reduce((acc, topic) => {
    if (!acc[topic.unit_no]) acc[topic.unit_no] = [];
    acc[topic.unit_no].push(topic);
    return acc;
  }, {} as Record<number, CoveredTopic[]>);

  if (loading) {
    return (
      <PageShell role="faculty">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="glass-card rounded-xl p-6 h-64"></div>
        </div>
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell role="faculty">
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Session not found</p>
          <Button onClick={() => navigate('/faculty/today')} className="mt-4">
            Back to Today
          </Button>
        </div>
      </PageShell>
    );
  }

  const facultyProfiles = session.faculty?.profiles as { name: string } | null;

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/faculty/today')} className="mb-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Attendance Record
            </h1>
            <p className="text-muted-foreground mt-1">
              {session.classes?.name} {session.classes?.division} • {session.subjects?.name} ({session.subjects?.subject_code})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge variant={session.is_substitution ? 'info' : 'outline'}>
              {session.is_substitution ? 'Substitution' : 'Regular'}
            </StatusBadge>
            <StatusBadge variant="success">
              {new Date(session.date).toLocaleDateString('en-IN')} • {session.start_time}
            </StatusBadge>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{records.length}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center border-l-4 border-l-success">
            <p className="text-2xl font-bold text-success">{presentCount}</p>
            <p className="text-sm text-muted-foreground">Present</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center border-l-4 border-l-danger">
            <p className="text-2xl font-bold text-danger">{absentCount}</p>
            <p className="text-sm text-muted-foreground">Absent</p>
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0}%
            </p>
            <p className="text-sm text-muted-foreground">Attendance</p>
          </div>
        </div>

        {/* Attendance List */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5" />
            Student Attendance
          </h2>
          <div className="grid gap-2 max-h-[400px] overflow-y-auto">
            {records.map((record) => (
              <div
                key={record.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  record.status === 'PRESENT'
                    ? 'bg-success/10 border-success/30'
                    : 'bg-danger/10 border-danger/30'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground w-8">
                    {record.student?.roll_no?.toString().padStart(2, '0')}
                  </span>
                  <span className="font-medium text-foreground">{record.student?.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {record.status === 'PRESENT' ? (
                    <Check className="w-5 h-5 text-success" />
                  ) : (
                    <X className="w-5 h-5 text-danger" />
                  )}
                  <span className={`text-sm font-medium ${record.status === 'PRESENT' ? 'text-success' : 'text-danger'}`}>
                    {record.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Syllabus Coverage */}
        {coveredTopics.length > 0 && (
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Topics Covered
            </h2>
            <div className="space-y-4">
              {Object.entries(topicsByUnit).map(([unit, unitTopics]) => (
                <div key={unit}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Unit {unit}</h3>
                  <div className="space-y-1">
                    {unitTopics.map((topic) => (
                      <div key={topic.id} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-success" />
                        {topic.topic_text}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WhatsApp Messages */}
        {absentCount > 0 && (
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Absence Messages
            </h2>

            {/* Common Messages */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Common Message (All Absent)</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button size="sm" onClick={() => openWhatsApp(null, generateCommonMessageEN())} className="btn-gradient">
                  Open WhatsApp (EN)
                </Button>
                <Button size="sm" onClick={() => openWhatsApp(null, generateCommonMessageMR())} className="btn-gradient">
                  Open WhatsApp (MR)
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(generateCommonMessageEN())}>
                  <Copy className="w-3 h-3 mr-1" /> Copy EN
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(generateCommonMessageMR())}>
                  <Copy className="w-3 h-3 mr-1" /> Copy MR
                </Button>
              </div>
            </div>

            {/* Per-Student Messages */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Per-Student Messages</h3>
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {absentStudents.map((record) => (
                  <div key={record.id} className="border border-border/30 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-foreground">
                        Roll {record.student?.roll_no} - {record.student?.name}
                      </span>
                      {record.student?.mobile && (
                        <span className="text-xs text-muted-foreground">{record.student.mobile}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openWhatsApp(record.student?.mobile || null, generateStudentMessageEN(record.student))}
                      >
                        EN → WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openWhatsApp(record.student?.mobile || null, generateStudentMessageMR(record.student))}
                      >
                        MR → WhatsApp
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Submitted Info */}
        <div className="text-sm text-muted-foreground">
          <p>
            Submitted by {facultyProfiles?.name || 'Faculty'} on{' '}
            {new Date(session.created_at).toLocaleString('en-IN')}
          </p>
        </div>
      </motion.div>
    </PageShell>
  );
};

export default FacultyAttendanceViewPage;

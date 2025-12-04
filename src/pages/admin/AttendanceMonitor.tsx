import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Calendar, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getAttendanceSessions, getAttendanceRecords, updateAttendanceRecord } from '@/services/attendance';
import { getClasses, type Class } from '@/services/classes';
import { getSubjects, type Subject } from '@/services/subjects';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AttendanceSession {
  id: string;
  date: string;
  start_time: string;
  classes?: { name: string; division: string };
  subjects?: { name: string; subject_code: string };
  faculty?: { profiles?: { name: string } };
}

interface AttendanceRecordWithStudent {
  id: string;
  status: 'PRESENT' | 'ABSENT';
  remark: string | null;
  students?: { id: string; name: string; roll_no: number; enrollment_no: string };
}

const AdminAttendanceMonitorPage: React.FC = () => {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionRecords, setSessionRecords] = useState<AttendanceRecordWithStudent[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [classData, subjectData] = await Promise.all([getClasses(), getSubjects()]);
      setClasses(classData);
      setSubjects(subjectData);
      await fetchSessions();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const filters: { class_id?: string; subject_id?: string; date?: string } = {};
      if (classFilter !== 'all') filters.class_id = classFilter;
      if (subjectFilter !== 'all') filters.subject_id = subjectFilter;
      if (dateFilter) filters.date = dateFilter;
      
      const data = await getAttendanceSessions(filters);
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading) {
      fetchSessions();
    }
  }, [classFilter, subjectFilter, dateFilter]);

  const handleViewSession = async (sessionId: string) => {
    setSelectedSession(sessionId);
    setRecordsLoading(true);
    try {
      const records = await getAttendanceRecords(sessionId);
      setSessionRecords(records || []);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load records', variant: 'destructive' });
    } finally {
      setRecordsLoading(false);
    }
  };

  const handleToggleStatus = async (recordId: string, currentStatus: 'PRESENT' | 'ABSENT') => {
    const newStatus = currentStatus === 'PRESENT' ? 'ABSENT' : 'PRESENT';
    const reason = prompt('Enter reason for change:');
    if (!reason) return;

    try {
      await updateAttendanceRecord(recordId, { status: newStatus, remark: reason });
      toast({ title: 'Success', description: 'Attendance updated' });
      if (selectedSession) handleViewSession(selectedSession);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update', variant: 'destructive' });
    }
  };

  const sessionColumns = [
    { key: 'date', header: 'Date' },
    { key: 'start_time', header: 'Time' },
    {
      key: 'class',
      header: 'Class',
      render: (s: AttendanceSession) => `${s.classes?.name || ''} ${s.classes?.division || ''}`,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (s: AttendanceSession) => s.subjects?.name || '-',
    },
    {
      key: 'faculty',
      header: 'Faculty',
      render: (s: AttendanceSession) => s.faculty?.profiles?.name || '-',
    },
    {
      key: 'actions',
      header: '',
      render: (s: AttendanceSession) => (
        <Button variant="outline" size="sm" onClick={() => handleViewSession(s.id)}>
          View Records
        </Button>
      ),
    },
  ];

  const recordColumns = [
    { key: 'roll_no', header: 'Roll', render: (r: AttendanceRecordWithStudent) => r.students?.roll_no || '-' },
    { key: 'name', header: 'Name', render: (r: AttendanceRecordWithStudent) => r.students?.name || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (r: AttendanceRecordWithStudent) => (
        <StatusBadge variant={r.status === 'PRESENT' ? 'success' : 'danger'}>
          {r.status === 'PRESENT' ? <CheckCircle className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
          {r.status}
        </StatusBadge>
      ),
    },
    { key: 'remark', header: 'Remark', render: (r: AttendanceRecordWithStudent) => r.remark || '-' },
    {
      key: 'actions',
      header: '',
      render: (r: AttendanceRecordWithStudent) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToggleStatus(r.id, r.status)}
          className="text-muted-foreground hover:text-foreground"
        >
          Toggle
        </Button>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Attendance Monitor
          </h1>
          <p className="text-muted-foreground mt-1">View and manage attendance records</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white/5 border-border/50"
            />
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-white/5 border-border/50">
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-white/5 border-border/50">
              <SelectValue placeholder="Subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={sessionColumns}
          data={sessions}
          keyExtractor={(s) => s.id}
          isLoading={loading}
          emptyMessage="No attendance sessions found"
        />

        {/* Session Records Dialog */}
        <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
          <DialogContent className="glass-card border-border/50 max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Attendance Records</DialogTitle>
            </DialogHeader>
            <DataTable
              columns={recordColumns}
              data={sessionRecords}
              keyExtractor={(r) => r.id}
              isLoading={recordsLoading}
              emptyMessage="No records found"
            />
          </DialogContent>
        </Dialog>
      </motion.div>
    </PageShell>
  );
};

export default AdminAttendanceMonitorPage;

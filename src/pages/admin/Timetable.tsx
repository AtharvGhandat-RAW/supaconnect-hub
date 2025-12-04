import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, Search, Calendar, Edit2, Trash2, Plus } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { getTimetableSlots, createTimetableSlot, deleteTimetableSlot, type TimetableSlot } from '@/services/timetable';
import { getClasses, type Class } from '@/services/classes';
import { getSubjects, type Subject } from '@/services/subjects';
import { getFaculty, type Faculty } from '@/services/faculty';
import { downloadTemplate } from '@/utils/export';
import { supabase } from '@/integrations/supabase/client';

interface TimetableSlotWithDetails extends TimetableSlot {
  faculty?: { profiles?: { name: string } };
  classes?: { name: string; division: string };
  subjects?: { name: string; subject_code: string };
}

const AdminTimetablePage: React.FC = () => {
  const [slots, setSlots] = useState<TimetableSlotWithDetails[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('all');
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    faculty_id: '',
    class_id: '',
    subject_id: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    room_no: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const fetchData = async () => {
    try {
      const [slotsData, classData, subjectData, facultyData] = await Promise.all([
        getTimetableSlots(),
        getClasses(),
        getSubjects(),
        getFaculty(),
      ]);
      setSlots(slotsData || []);
      setClasses(classData);
      setSubjects(subjectData);
      setFaculty(facultyData);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel('timetable-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_slots' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredSlots = slots.filter(slot => {
    const matchesClass = classFilter === 'all' || slot.class_id === classFilter;
    const matchesFaculty = facultyFilter === 'all' || slot.faculty_id === facultyFilter;
    const matchesDay = dayFilter === 'all' || slot.day_of_week === dayFilter;
    return matchesClass && matchesFaculty && matchesDay;
  });

  const handleAddSlot = async () => {
    try {
      await createTimetableSlot(formData);
      toast({ title: 'Success', description: 'Timetable slot created' });
      setIsAddDialogOpen(false);
      setFormData({
        faculty_id: '',
        class_id: '',
        subject_id: '',
        day_of_week: 'Monday',
        start_time: '09:00',
        room_no: '',
        valid_from: new Date().toISOString().split('T')[0],
        valid_to: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create slot', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this slot?')) return;
    try {
      await deleteTimetableSlot(id);
      toast({ title: 'Success', description: 'Slot deleted' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'day_of_week', header: 'Day' },
    { key: 'start_time', header: 'Time' },
    {
      key: 'class',
      header: 'Class',
      render: (slot: TimetableSlotWithDetails) => `${slot.classes?.name || ''} ${slot.classes?.division || ''}`,
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (slot: TimetableSlotWithDetails) => slot.subjects?.name || '-',
    },
    {
      key: 'faculty',
      header: 'Faculty',
      render: (slot: TimetableSlotWithDetails) => slot.faculty?.profiles?.name || '-',
    },
    { key: 'room_no', header: 'Room', render: (slot: TimetableSlotWithDetails) => slot.room_no || '-' },
    {
      key: 'validity',
      header: 'Validity',
      render: (slot: TimetableSlotWithDetails) => `${slot.valid_from} - ${slot.valid_to}`,
    },
    {
      key: 'actions',
      header: '',
      render: (slot: TimetableSlotWithDetails) => (
        <Button variant="ghost" size="sm" onClick={() => handleDelete(slot.id)} className="text-danger">
          <Trash2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Timetable</h1>
            <p className="text-muted-foreground mt-1">Manage class timetables and schedules</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => downloadTemplate('timetable')} className="border-border/50">
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button variant="outline" className="border-border/50">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Slot
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50 max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Timetable Slot</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Day</Label>
                      <Select value={formData.day_of_week} onValueChange={(v) => setFormData({ ...formData, day_of_week: v })}>
                        <SelectTrigger className="bg-white/5 border-border/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Time</Label>
                      <Input
                        type="time"
                        value={formData.start_time}
                        onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Class</Label>
                    <Select value={formData.class_id} onValueChange={(v) => setFormData({ ...formData, class_id: v })}>
                      <SelectTrigger className="bg-white/5 border-border/50"><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subject</Label>
                    <Select value={formData.subject_id} onValueChange={(v) => setFormData({ ...formData, subject_id: v })}>
                      <SelectTrigger className="bg-white/5 border-border/50"><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.subject_code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Faculty</Label>
                    <Select value={formData.faculty_id} onValueChange={(v) => setFormData({ ...formData, faculty_id: v })}>
                      <SelectTrigger className="bg-white/5 border-border/50"><SelectValue placeholder="Select faculty" /></SelectTrigger>
                      <SelectContent>
                        {faculty.map(f => <SelectItem key={f.id} value={f.id}>{f.profiles?.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Room No</Label>
                    <Input
                      value={formData.room_no}
                      onChange={(e) => setFormData({ ...formData, room_no: e.target.value })}
                      placeholder="101"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Valid From</Label>
                      <Input
                        type="date"
                        value={formData.valid_from}
                        onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                    <div>
                      <Label>Valid To</Label>
                      <Input
                        type="date"
                        value={formData.valid_to}
                        onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddSlot} className="w-full btn-gradient">
                    Create Slot
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={dayFilter} onValueChange={setDayFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-white/5 border-border/50">
              <SelectValue placeholder="Day" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Days</SelectItem>
              {days.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-white/5 border-border/50">
              <SelectValue placeholder="Class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={facultyFilter} onValueChange={setFacultyFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-white/5 border-border/50">
              <SelectValue placeholder="Faculty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Faculty</SelectItem>
              {faculty.map(f => <SelectItem key={f.id} value={f.id}>{f.profiles?.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={filteredSlots}
          keyExtractor={(slot) => slot.id}
          isLoading={loading}
          emptyMessage="No timetable slots found"
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminTimetablePage;

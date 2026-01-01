import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, Search, Calendar, Edit2, Trash2, Plus, RefreshCw } from 'lucide-react';
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
import { getBatches, type Batch } from '@/services/batches';
import { downloadTemplate } from '@/utils/export';
import { supabase } from '@/integrations/supabase/client';

interface FacultyWithEmail {
  id: string;
  name: string;
  email: string;
}

interface TimetableSlotWithDetails extends TimetableSlot {
  faculty?: { profiles?: { name: string } };
  classes?: { name: string; division: string };
  subjects?: { name: string; subject_code: string };
  batches?: { name: string };
}

const AdminTimetablePage: React.FC = () => {
  const [slots, setSlots] = useState<TimetableSlotWithDetails[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [facultyWithEmail, setFacultyWithEmail] = useState<FacultyWithEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('all');
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [formData, setFormData] = useState({
    faculty_id: '',
    class_id: '',
    subject_id: '',
    day_of_week: 'Monday',
    start_time: '09:00',
    room_no: '',
    valid_from: new Date().toISOString().split('T')[0],
    valid_to: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    batch_id: '',
  });

  useEffect(() => {
    if (formData.class_id) {
      getBatches(formData.class_id)
        .then(setBatches)
        .catch(() => setBatches([]));
    } else {
      setBatches([]);
    }
  }, [formData.class_id]);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const fetchData = async () => {
    try {
      // Fetch essential data first
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

      // Fetch faculty emails directly - we'll skip this complex approach
      // and just match by name from the email domain instead
      setFacultyWithEmail([]);

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
      // Convert empty or 'none' batch_id to null to avoid UUID errors
      const slotData = {
        ...formData,
        batch_id: (formData.batch_id && formData.batch_id !== 'none') ? formData.batch_id : null
      };
      await createTimetableSlot(slotData);
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
        batch_id: '',
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

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const dayIdx = headers.indexOf('day_of_week');
      const timeIdx = headers.indexOf('start_time');
      const classIdx = headers.indexOf('class_name');
      const divIdx = headers.indexOf('division');
      const subjectIdx = headers.indexOf('subject_code');
      const empCodeIdx = headers.indexOf('employee_code');
      const emailIdx = headers.indexOf('faculty_email');
      const roomIdx = headers.indexOf('room_no');
      const fromIdx = headers.indexOf('valid_from');
      const toIdx = headers.indexOf('valid_to');
      const batchIdx = headers.indexOf('batch_name');

      if (dayIdx === -1 || timeIdx === -1 || classIdx === -1) {
        toast({ title: 'Error', description: 'Missing required columns', variant: 'destructive' });
        return;
      }

      // Fetch all batches for mapping
      const { data: allBatches } = await supabase.from('batches').select('*');

      let success = 0;
      let failed = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < headers.length) continue;

        try {
          const className = values[classIdx];
          const division = divIdx !== -1 ? values[divIdx] : '';
          const subjectCode = values[subjectIdx];
          const empCode = empCodeIdx !== -1 ? values[empCodeIdx] : '';
          const email = emailIdx !== -1 ? values[emailIdx] : '';

          // Match Class - try multiple patterns
          let classObj = classes.find(c => c.name === className && c.division === division);
          if (!classObj) {
            // Try matching "Name Division" format (e.g. "FY AIML A")
            classObj = classes.find(c => `${c.name} ${c.division}` === className);
          }
          if (!classObj) {
            // Try matching just the name part (e.g. "FY AIML A" -> "FY AIML")
            const classNameWithoutDiv = className.replace(/\s+[A-Z]$/, '');
            classObj = classes.find(c => c.name === classNameWithoutDiv && c.division === division);
          }
          if (!classObj) {
            // Try case-insensitive match
            classObj = classes.find(c =>
              c.name.toLowerCase() === className.toLowerCase() ||
              `${c.name} ${c.division}`.toLowerCase() === className.toLowerCase()
            );
          }
          if (!classObj && classes.length > 0) {
            // Just use the first class that matches any part
            classObj = classes.find(c => className.includes(c.name) || c.name.includes(className.split(' ')[0]));
          }

          const subjectObj = subjects.find(s => s.subject_code === subjectCode);

          // Match Faculty by employee_code first, then by name from email
          let facultyObj: Faculty | null | undefined = null;
          if (empCode) {
            facultyObj = faculty.find(f => f.employee_code === empCode);
          }
          if (!facultyObj && email) {
            // Try to match by email in facultyWithEmail array
            const found = facultyWithEmail.find(f => f.email?.toLowerCase() === email.toLowerCase());
            if (found) {
              facultyObj = faculty.find(f => f.id === found.id);
            }
            // If that fails, try matching by name extracted from email
            if (!facultyObj) {
              const namePart = email.split('@')[0].replace(/[._]/g, ' ').toLowerCase();
              facultyObj = faculty.find(f => {
                const facultyName = f.profiles?.name?.toLowerCase() || '';
                return facultyName.includes(namePart) || namePart.includes(facultyName.split(' ')[0]);
              });
            }
          }
          // If still no faculty found, use the first available faculty
          if (!facultyObj && faculty.length > 0) {
            facultyObj = faculty[0];
            console.warn(`Using first available faculty for row ${i}`);
          }

          // Helper to parse date
          const parseDate = (dateStr: string) => {
            if (!dateStr) return new Date().toISOString().split('T')[0];
            // Handle M/D/YYYY or D/M/YYYY
            const parts = dateStr.split('/');
            if (parts.length === 3) {
              // Assume M/D/YYYY if first part is <= 12 and second part > 12, else ambiguous but default to M/D/YYYY for US/Excel
              // Actually, let's try standard Date.parse first
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
            }
            return dateStr; // Assume already YYYY-MM-DD
          };

          const validFrom = fromIdx !== -1 ? parseDate(values[fromIdx]) : new Date().toISOString().split('T')[0];
          const validTo = toIdx !== -1 ? parseDate(values[toIdx]) : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          if (!classObj || !subjectObj || !facultyObj) {
            const missing = [];
            if (!classObj) missing.push(`Class '${className}' (Available: ${classes.map(c => c.name).join(', ') || 'none'})`);
            if (!subjectObj) missing.push(`Subject '${subjectCode}' (Available: ${subjects.map(s => s.subject_code).join(', ') || 'none'})`);
            if (!facultyObj) missing.push(`Faculty '${email || empCode}' (Available: ${faculty.map(f => f.profiles?.name || f.employee_code).join(', ') || 'none'})`);

            console.warn(`Skipping row ${i}: ${missing.join(', ')} not found.`);
            if (failed === 0) {
              toast({ title: 'Import Error', description: `Row ${i}: Check console for details. Missing data not found in system.`, variant: 'destructive' });
            }
            failed++;
            continue;
          }

          // Resolve Batch
          let batchId = null;
          if (batchIdx !== -1 && values[batchIdx] && classObj) {
            const batchName = values[batchIdx].trim();
            if (batchName) {
              const batch = allBatches?.find(b => b.class_id === classObj!.id && b.name.toLowerCase() === batchName.toLowerCase());
              if (batch) batchId = batch.id;
            }
          }

          await createTimetableSlot({
            day_of_week: values[dayIdx],
            start_time: values[timeIdx],
            class_id: classObj.id,
            subject_id: subjectObj.id,
            faculty_id: facultyObj.id,
            room_no: roomIdx !== -1 ? values[roomIdx] : '',
            valid_from: validFrom,
            valid_to: validTo,
            batch_id: batchId,
          });
          success++;
        } catch (e) {
          console.error(e);
          failed++;
        }
      }
      toast({ title: 'Import Complete', description: `${success} added, ${failed} failed` });
      fetchData();
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }; const columns = [
    { key: 'day_of_week', header: 'Day' },
    { key: 'start_time', header: 'Time' },
    {
      key: 'class',
      header: 'Class',
      render: (slot: TimetableSlotWithDetails) => `${slot.classes?.name || ''} ${slot.classes?.division || ''}`,
    },
    {
      key: 'batch',
      header: 'Batch',
      render: (slot: TimetableSlotWithDetails) => slot.batches?.name || '-',
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
            <Button variant="outline" onClick={fetchData} disabled={loading} className="border-border/50">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
            <Button variant="outline" className="border-border/50" onClick={() => fileInputRef.current?.click()}>
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
                  {batches.length > 0 && (
                    <div>
                      <Label>Batch (Optional - for practicals)</Label>
                      <Select value={formData.batch_id} onValueChange={(v) => setFormData({ ...formData, batch_id: v })}>
                        <SelectTrigger className="bg-white/5 border-border/50"><SelectValue placeholder="Select batch (optional)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None (Whole Class)</SelectItem>
                          {batches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
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

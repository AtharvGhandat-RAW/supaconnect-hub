import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Upload, BookOpen, Edit2, Trash2 } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getSubjects, createSubject, updateSubject, type Subject } from '@/services/subjects';

const AdminSubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({
    subject_code: '',
    name: '',
    semester: 1,
    year: 1,
    department: 'AIML',
    type: 'TH' as 'TH' | 'PR' | 'TU',
    weekly_lectures: 3,
    status: 'Active',
  });

  const fetchData = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast({ title: 'Error', description: 'Failed to load subjects', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subject_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = yearFilter === 'all' || s.year.toString() === yearFilter;
    return matchesSearch && matchesYear;
  });

  const resetForm = () => {
    setFormData({
      subject_code: '',
      name: '',
      semester: 1,
      year: 1,
      department: 'AIML',
      type: 'TH',
      weekly_lectures: 3,
      status: 'Active',
    });
    setEditingSubject(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, formData);
        toast({ title: 'Success', description: 'Subject updated successfully' });
      } else {
        await createSubject(formData);
        toast({ title: 'Success', description: 'Subject created successfully' });
      }
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save subject', variant: 'destructive' });
    }
  };

  const handleEdit = (s: Subject) => {
    setEditingSubject(s);
    setFormData({
      subject_code: s.subject_code,
      name: s.name,
      semester: s.semester,
      year: s.year,
      department: s.department || 'AIML',
      type: s.type,
      weekly_lectures: s.weekly_lectures,
      status: s.status,
    });
    setIsAddDialogOpen(true);
  };

  const columns = [
    { key: 'subject_code', header: 'Code' },
    {
      key: 'name',
      header: 'Subject Name',
      render: (s: Subject) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium text-foreground">{s.name}</span>
        </div>
      ),
    },
    { key: 'year', header: 'Year' },
    { key: 'semester', header: 'Sem' },
    {
      key: 'type',
      header: 'Type',
      render: (s: Subject) => (
        <StatusBadge variant={s.type === 'TH' ? 'default' : s.type === 'PR' ? 'info' : 'warning'}>
          {s.type}
        </StatusBadge>
      ),
    },
    { key: 'weekly_lectures', header: 'Weekly' },
    {
      key: 'status',
      header: 'Status',
      render: (s: Subject) => (
        <StatusBadge variant={s.status === 'Active' ? 'success' : 'outline'}>
          {s.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (s: Subject) => (
        <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}>
          <Edit2 className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Subjects</h1>
            <p className="text-muted-foreground mt-1">Manage subjects and course details</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border/50">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="btn-gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Subject Code</Label>
                      <Input
                        value={formData.subject_code}
                        onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                        placeholder="CS101"
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as 'TH' | 'PR' | 'TU' })}>
                        <SelectTrigger className="bg-white/5 border-border/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TH">Theory</SelectItem>
                          <SelectItem value="PR">Practical</SelectItem>
                          <SelectItem value="TU">Tutorial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Subject Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Introduction to AI"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Year</Label>
                      <Select value={formData.year.toString()} onValueChange={(v) => setFormData({ ...formData, year: parseInt(v) })}>
                        <SelectTrigger className="bg-white/5 border-border/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1st Year</SelectItem>
                          <SelectItem value="2">2nd Year</SelectItem>
                          <SelectItem value="3">3rd Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Semester</Label>
                      <Select value={formData.semester.toString()} onValueChange={(v) => setFormData({ ...formData, semester: parseInt(v) })}>
                        <SelectTrigger className="bg-white/5 border-border/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map((s) => (
                            <SelectItem key={s} value={s.toString()}>Sem {s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Weekly Lectures</Label>
                      <Input
                        type="number"
                        value={formData.weekly_lectures}
                        onChange={(e) => setFormData({ ...formData, weekly_lectures: parseInt(e.target.value) || 0 })}
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSubmit} className="w-full btn-gradient">
                    {editingSubject ? 'Update Subject' : 'Create Subject'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-border/50"
            />
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-white/5 border-border/50">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              <SelectItem value="1">1st Year</SelectItem>
              <SelectItem value="2">2nd Year</SelectItem>
              <SelectItem value="3">3rd Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={filteredSubjects}
          keyExtractor={(s) => s.id}
          isLoading={loading}
          emptyMessage="No subjects found"
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminSubjectsPage;

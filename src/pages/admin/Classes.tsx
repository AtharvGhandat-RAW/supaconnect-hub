import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, GraduationCap, Edit2, Trash2 } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getClasses, createClass, updateClass, deleteClass, type Class } from '@/services/classes';
import { getFaculty, type Faculty } from '@/services/faculty';

const AdminClassesPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    year: 1,
    semester: 1,
    division: 'A',
    department: 'AIML',
    class_teacher_id: '',
  });

  const fetchData = async () => {
    try {
      const [classData, facultyData] = await Promise.all([getClasses(), getFaculty()]);
      setClasses(classData);
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
  }, []);

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.division.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ name: '', year: 1, semester: 1, division: 'A', department: 'AIML', class_teacher_id: '' });
    setEditingClass(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingClass) {
        await updateClass(editingClass.id, formData);
        toast({ title: 'Success', description: 'Class updated successfully' });
      } else {
        await createClass(formData);
        toast({ title: 'Success', description: 'Class created successfully' });
      }
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save class', variant: 'destructive' });
    }
  };

  const handleEdit = (c: Class) => {
    setEditingClass(c);
    setFormData({
      name: c.name,
      year: c.year,
      semester: c.semester,
      division: c.division,
      department: c.department || 'AIML',
      class_teacher_id: c.class_teacher_id || '',
    });
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this class?')) return;
    try {
      await deleteClass(id);
      toast({ title: 'Success', description: 'Class deleted' });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete class', variant: 'destructive' });
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Class Name',
      render: (c: Class) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <GraduationCap className="w-4 h-4 text-secondary" />
          </div>
          <span className="font-medium text-foreground">{c.name}</span>
        </div>
      ),
    },
    { key: 'division', header: 'Division' },
    { key: 'year', header: 'Year' },
    { key: 'semester', header: 'Semester' },
    { key: 'department', header: 'Department', render: (c: Class) => c.department || '-' },
    {
      key: 'actions',
      header: '',
      render: (c: Class) => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}>
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)} className="text-danger">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Classes</h1>
            <p className="text-muted-foreground mt-1">Manage classes and divisions</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="btn-gradient">
                <Plus className="w-4 h-4 mr-2" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50">
              <DialogHeader>
                <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Class Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="FY AIML"
                    className="bg-white/5 border-border/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Year</Label>
                    <Select value={formData.year.toString()} onValueChange={(v) => setFormData({ ...formData, year: parseInt(v) })}>
                      <SelectTrigger className="bg-white/5 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
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
                      <SelectTrigger className="bg-white/5 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6].map((s) => (
                          <SelectItem key={s} value={s.toString()}>Sem {s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Division</Label>
                    <Input
                      value={formData.division}
                      onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                      placeholder="A"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select value={formData.department} onValueChange={(v) => setFormData({ ...formData, department: v })}>
                      <SelectTrigger className="bg-white/5 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AIML">AIML</SelectItem>
                        <SelectItem value="CS">Computer Science</SelectItem>
                        <SelectItem value="IT">Information Technology</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Class Teacher</Label>
                  <Select value={formData.class_teacher_id || 'none'} onValueChange={(v) => setFormData({ ...formData, class_teacher_id: v === 'none' ? '' : v })}>
                    <SelectTrigger className="bg-white/5 border-border/50">
                      <SelectValue placeholder="Select class teacher" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not assigned</SelectItem>
                      {faculty.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.profiles?.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSubmit} className="w-full btn-gradient">
                  {editingClass ? 'Update Class' : 'Create Class'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white/5 border-border/50 max-w-md"
          />
        </div>

        <DataTable
          columns={columns}
          data={filteredClasses}
          keyExtractor={(c) => c.id}
          isLoading={loading}
          emptyMessage="No classes found"
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminClassesPage;

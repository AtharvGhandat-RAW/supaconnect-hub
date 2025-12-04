import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Upload, Users, Edit2, Eye } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getStudents, createStudent, type Student } from '@/services/students';
import { getClasses, type Class } from '@/services/classes';

const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    enrollment_no: '',
    roll_no: null as number | null,
    year: 1,
    semester: 1,
    class_id: '',
    division: 'A',
    department: 'AIML',
    mobile: '',
    email: '',
  });

  const fetchData = async () => {
    try {
      const [studentData, classData] = await Promise.all([getStudents(), getClasses()]);
      setStudents(studentData);
      setClasses(classData);
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

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.enrollment_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.roll_no?.toString().includes(searchTerm);
    const matchesClass = classFilter === 'all' || s.class_id === classFilter;
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const handleSubmit = async () => {
    try {
      await createStudent({
        ...formData,
        roll_no: formData.roll_no,
        status: 'ACTIVE',
      });
      toast({ title: 'Success', description: 'Student added successfully' });
      setIsAddDialogOpen(false);
      setFormData({
        name: '',
        enrollment_no: '',
        roll_no: null,
        year: 1,
        semester: 1,
        class_id: '',
        division: 'A',
        department: 'AIML',
        mobile: '',
        email: '',
      });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add student', variant: 'destructive' });
    }
  };

  const columns = [
    { key: 'roll_no', header: 'Roll No', render: (s: Student) => s.roll_no || '-' },
    {
      key: 'name',
      header: 'Name',
      render: (s: Student) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-accent" />
          </div>
          <span className="font-medium text-foreground">{s.name}</span>
        </div>
      ),
    },
    { key: 'enrollment_no', header: 'Enrollment No', render: (s: Student) => s.enrollment_no || '-' },
    { key: 'year', header: 'Year' },
    { key: 'semester', header: 'Sem' },
    { key: 'division', header: 'Division', render: (s: Student) => s.division || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (s: Student) => (
        <StatusBadge variant={s.status === 'ACTIVE' ? 'success' : s.status === 'YD' ? 'warning' : 'outline'}>
          {s.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: () => (
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Edit2 className="w-4 h-4" />
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
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Students</h1>
            <p className="text-muted-foreground mt-1">Manage student records and information</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="border-border/50">
              <Upload className="w-4 h-4 mr-2" />
              Import CSV
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50 max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add New Student</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4 max-h-[70vh] overflow-y-auto pr-2">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Full name"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Enrollment No</Label>
                      <Input
                        value={formData.enrollment_no}
                        onChange={(e) => setFormData({ ...formData, enrollment_no: e.target.value })}
                        placeholder="ENR001"
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                    <div>
                      <Label>Roll No</Label>
                      <Input
                        type="number"
                        value={formData.roll_no || ''}
                        onChange={(e) => setFormData({ ...formData, roll_no: parseInt(e.target.value) || null })}
                        placeholder="1"
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Class</Label>
                      <Select value={formData.class_id || 'none'} onValueChange={(v) => setFormData({ ...formData, class_id: v === 'none' ? '' : v })}>
                        <SelectTrigger className="bg-white/5 border-border/50"><SelectValue placeholder="Select class" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Not assigned</SelectItem>
                          {classes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Division</Label>
                      <Input
                        value={formData.division}
                        onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                        placeholder="A"
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Mobile</Label>
                    <Input
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      placeholder="9876543210"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="student@rit.edu"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <Button onClick={handleSubmit} className="w-full btn-gradient">
                    Add Student
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, roll no, or enrollment..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-border/50"
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
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-white/5 border-border/50">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="YD">Year Down</SelectItem>
              <SelectItem value="PASSOUT">Passout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={filteredStudents}
          keyExtractor={(s) => s.id}
          isLoading={loading}
          emptyMessage="No students found"
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminStudentsPage;

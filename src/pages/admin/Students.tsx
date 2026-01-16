import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Upload, Users, Edit2, Eye, Download, RefreshCw, ArrowUpCircle, Trash2 } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getStudents, createStudent, bulkCreateStudents, updateStudent, deleteStudent, type Student } from '@/services/students';
import { getClasses, type Class } from '@/services/classes';
import { downloadTemplate } from '@/utils/export';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  // Attendance State
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isPromoteDialogOpen, setIsPromoteDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [promoteFrom, setPromoteFrom] = useState('');
  const [promoteTo, setPromoteTo] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    enrollment_no: '',
    roll_no: null as number | null,
    year: 1,
    semester: 1,
    class_id: '',
    division: 'A',
    mobile: '',
    email: '',
  });

  // Auto-update year, semester, division when class is selected
  const handleClassChange = (classId: string) => {
    if (classId === 'none' || !classId) {
      setFormData({ ...formData, class_id: '' });
      return;
    }
    
    const selectedClass = classes.find(c => c.id === classId);
    if (selectedClass) {
      setFormData({
        ...formData,
        class_id: classId,
        year: selectedClass.year,
        semester: selectedClass.semester,
        division: selectedClass.division || 'A',
      });
    } else {
      setFormData({ ...formData, class_id: classId });
    }
  };

  // Load attendance when viewing a student
  useEffect(() => {
    if (isViewDialogOpen && selectedStudent) {
      fetchStudentAttendance(selectedStudent.id);
    }
  }, [isViewDialogOpen, selectedStudent]);

  const fetchStudentAttendance = async (studentId: string) => {
    setAttendanceLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select(`
            id,
            status,
            session_id,
            session:attendance_sessions!inner (
                date,
                start_time,
                subject:subjects!inner (name, subject_code)
            )
        `)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
            
      if (error) throw error;
      setAttendanceData(data || []);
    } catch (err) {
      console.error('Attendance fetch error:', err);
      // Don't show toast on every error to avoid spam, just log
    } finally {
      setAttendanceLoading(false);
    }
  };

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

    const channel = supabase
      .channel('students-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handlePromote = async () => {
    if (!promoteFrom) return;

    try {
      // If promoting to "completed" (special value)
      if (promoteTo === 'completed') {
        const { error } = await supabase
          .from('students')
          .update({ status: 'ALUMNI' })
          .eq('class_id', promoteFrom);
        if (error) throw error;
        toast({ title: 'Success', description: 'Students marked as Alumni' });
      } else if (promoteTo) {
        // Promote to another class
        const { error } = await supabase
          .from('students')
          .update({ class_id: promoteTo })
          .eq('class_id', promoteFrom);
        if (error) throw error;
        toast({ title: 'Success', description: 'Students promoted successfully' });
      }

      setIsPromoteDialogOpen(false);
      setPromoteFrom('');
      setPromoteTo('');
      fetchData();
    } catch (error) {
      console.error('Error promoting students:', error);
      toast({ title: 'Error', description: 'Failed to promote students', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }
    try {
      await createStudent({
        ...formData,
        department: 'AIML',
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
        mobile: '',
        email: '',
      });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add student', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!studentToDelete) return;
    
    try {
      await deleteStudent(studentToDelete.id);
      toast({ title: 'Success', description: `${studentToDelete.name} has been deleted` });
      setIsDeleteDialogOpen(false);
      setStudentToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({ title: 'Error', description: 'Failed to delete student', variant: 'destructive' });
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      const nameIdx = headers.indexOf('name');
      const enrollIdx = headers.indexOf('enrollment_no');
      const rollIdx = headers.indexOf('roll_no');
      const yearIdx = headers.indexOf('year');
      const semIdx = headers.indexOf('semester');
      const divIdx = headers.indexOf('division');
      const mobileIdx = headers.indexOf('mobile');
      const emailIdx = headers.indexOf('email');
      const classIdIdx = headers.indexOf('class_id');

      if (nameIdx === -1) {
        toast({ title: 'Error', description: 'CSV must have name column', variant: 'destructive' });
        return;
      }

      // Helper function to find class by year and division
      const findClassId = (year: number, division: string): string | null => {
        // First try to match by year and division
        const matchedClass = classes.find(c =>
          c.year === year && c.division?.toUpperCase() === division?.toUpperCase()
        );
        if (matchedClass) {
          return matchedClass.id;
        }

        // Try to match by year only
        const yearMatch = classes.find(c => c.year === year);
        if (yearMatch) {
          return yearMatch.id;
        }

        return null;
      };

      const studentsToCreate = [];
      let skipped = 0;

      for (let i = 1; i < lines.length; i++) {
        // Handle CSV values with potential commas inside quoted strings
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        if (!values[nameIdx] || values[nameIdx].trim() === '') {
          skipped++;
          continue;
        }

        const year = yearIdx !== -1 ? parseInt(values[yearIdx]) || 3 : 3; // Default to Year 3 for TY
        const division = divIdx !== -1 ? values[divIdx] || 'A' : 'A';

        // Try to match class by year and division
        const classId = classIdIdx !== -1 && values[classIdIdx]
          ? values[classIdIdx]
          : findClassId(year, division);

        studentsToCreate.push({
          name: values[nameIdx],
          enrollment_no: enrollIdx !== -1 && values[enrollIdx] ? values[enrollIdx] : null,
          roll_no: rollIdx !== -1 ? parseInt(values[rollIdx]) || null : null,
          year: year,
          semester: semIdx !== -1 ? parseInt(values[semIdx]) || (year * 2 - 1) : (year * 2 - 1), // Auto-calculate semester from year
          division: division,
          department: 'AIML',
          mobile: mobileIdx !== -1 && values[mobileIdx] ? values[mobileIdx] : null,
          email: emailIdx !== -1 && values[emailIdx] ? values[emailIdx] : null,
          status: 'ACTIVE' as const,
          class_id: classId,
        });
      }

      try {
        if (studentsToCreate.length > 0) {
          const result = await bulkCreateStudents(studentsToCreate);
          const addedCount = result?.length || studentsToCreate.length;
          toast({
            title: 'Import Complete',
            description: `${addedCount} students added/updated${skipped > 0 ? `, ${skipped} skipped` : ''}`
          });
          fetchData();
        } else {
          toast({ title: 'Warning', description: 'No valid students found in CSV', variant: 'destructive' });
        }
      } catch (error) {
        console.error('Import error:', error);
        toast({ title: 'Error', description: 'Failed to import students. Check console for details.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
      render: (s: Student) => (
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSelectedStudent(s);
              setIsViewDialogOpen(true);
            }}
            aria-label={`View ${s.name}`}
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => {
              setSelectedStudent(s);
              setFormData({
                name: s.name,
                enrollment_no: s.enrollment_no || '',
                roll_no: s.roll_no,
                year: s.year,
                semester: s.semester,
                class_id: s.class_id || '',
                division: s.division || 'A',
                mobile: s.mobile || '',
                email: s.email || '',
              });
              setIsEditDialogOpen(true);
            }}
            aria-label={`Edit ${s.name}`}
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              setStudentToDelete(s);
              setIsDeleteDialogOpen(true);
            }}
            aria-label={`Delete ${s.name}`}
          >
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
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Students</h1>
            <p className="text-muted-foreground mt-1">Manage AIML department student records</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadTemplate('students')}>
              <Download className="w-4 h-4 mr-2" />
              Template
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Dialog open={isPromoteDialogOpen} onOpenChange={setIsPromoteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-accent/50 text-accent hover:bg-accent/10">
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  Promote
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle>Promote Students</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Promote From Class</Label>
                    <Select value={promoteFrom} onValueChange={setPromoteFrom}>
                      <SelectTrigger className="bg-muted/50 border-border/50"><SelectValue placeholder="Select Class" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Promote To Class</Label>
                    <Select value={promoteTo} onValueChange={setPromoteTo}>
                      <SelectTrigger className="bg-muted/50 border-border/50"><SelectValue placeholder="Select Target Class" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="completed" className="text-accent">Completed Diploma (Alumni)</SelectItem>
                        {classes.filter(c => c.id !== promoteFrom).map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handlePromote} className="w-full btn-gradient" disabled={!promoteFrom || !promoteTo}>
                    Promote Students
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
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
                    <Label>Name *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Full name"
                      className="bg-muted/50 border-border/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Roll No</Label>
                      <Input
                        type="number"
                        value={formData.roll_no || ''}
                        onChange={(e) => setFormData({ ...formData, roll_no: parseInt(e.target.value) || null })}
                        placeholder="1"
                        className="bg-muted/50 border-border/50"
                      />
                    </div>
                    <div>
                      <Label>Enrollment No</Label>
                      <Input
                        value={formData.enrollment_no}
                        onChange={(e) => setFormData({ ...formData, enrollment_no: e.target.value })}
                        placeholder="23212840055"
                        className="bg-muted/50 border-border/50"
                      />
                    </div>
                  </div>
                  
                  {/* Class Selection - Primary field */}
                  <div>
                    <Label>Class *</Label>
                    <Select value={formData.class_id || 'none'} onValueChange={handleClassChange}>
                      <SelectTrigger className="bg-muted/50 border-border/50">
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select a class...</SelectItem>
                        {/* Group classes by year for better organization */}
                        {[1, 2, 3].map(year => {
                          const yearClasses = classes.filter(c => c.year === year);
                          if (yearClasses.length === 0) return null;
                          const yearLabel = year === 1 ? 'FY' : year === 2 ? 'SY' : 'TY';
                          return (
                            <div key={year}>
                              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30">
                                {yearLabel} - Year {year}
                              </div>
                              {yearClasses.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.name} {c.division}
                                </SelectItem>
                              ))}
                            </div>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {formData.class_id && (
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs">
                          Year {formData.year}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 text-secondary text-xs">
                          Sem {formData.semester}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10 text-accent text-xs">
                          Div {formData.division}
                        </span>
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Mobile</Label>
                      <Input
                        value={formData.mobile}
                        onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                        placeholder="9876543210"
                        className="bg-muted/50 border-border/50"
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="student@rit.edu"
                        className="bg-muted/50 border-border/50"
                      />
                    </div>
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
              className="pl-10 bg-muted/50 border-border/50"
            />
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-muted/50 border-border/50">
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
            <SelectTrigger className="w-full sm:w-40 bg-muted/50 border-border/50">
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

        {/* View Student Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col p-0">
            <div className="p-6 pb-2">
                <DialogHeader>
                <DialogTitle>Student Details</DialogTitle>
                </DialogHeader>
            </div>
            
            {selectedStudent && (
              <Tabs defaultValue="profile" className="w-full flex-1 flex flex-col overflow-hidden">
                <div className="px-6">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="profile">Profile Information</TabsTrigger>
                        <TabsTrigger value="attendance">Attendance Records</TabsTrigger>
                    </TabsList>
                </div>
                
                <TabsContent value="profile" className="flex-1 overflow-y-auto p-6 space-y-4 mt-0">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Full Name</Label>
                            <p className="font-semibold text-lg text-foreground">{selectedStudent.name}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Enrollment No</Label>
                            <p className="font-mono text-lg">{selectedStudent.enrollment_no || '-'}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg col-span-2 md:col-span-1">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Class Info</Label>
                            <div className="flex gap-2 mt-1">
                                <span className="px-2 py-1 bg-primary/10 rounded text-xs font-bold text-primary border border-primary/20">Year {selectedStudent.year}</span>
                                <span className="px-2 py-1 bg-primary/10 rounded text-xs font-bold text-primary border border-primary/20">Sem {selectedStudent.semester}</span>
                                <span className="px-2 py-1 bg-primary/10 rounded text-xs font-bold text-primary border border-primary/20">Div {selectedStudent.division || '-'}</span>
                            </div>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Roll No</Label>
                            <p className="font-mono text-lg font-bold text-primary">{selectedStudent.roll_no || '-'}</p>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg col-span-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Contact Details</Label>
                            <div className="grid grid-cols-2 gap-4 mt-1">
                                <div>
                                    <span className="text-xs text-muted-foreground block">Mobile</span>
                                    <p>{selectedStudent.mobile || '-'}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">Email</span>
                                    <p className="break-all">{selectedStudent.email || '-'}</p>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1 p-3 bg-muted/20 rounded-lg col-span-2">
                            <Label className="text-muted-foreground text-xs uppercase tracking-wider font-bold">Current Status</Label>
                            <div className="mt-1">
                                <StatusBadge variant={selectedStudent.status === 'ACTIVE' ? 'success' : 'warning'}>
                                    {selectedStudent.status}
                                </StatusBadge>
                            </div>
                        </div>
                     </div>
                </TabsContent>

                <TabsContent value="attendance" className="flex-1 overflow-hidden flex flex-col p-6 mt-0 h-full">
                    {attendanceLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <div className="flex flex-col h-full gap-4">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-4 shrink-0">
                                <div className="bg-background border border-border/50 p-4 rounded-xl text-center shadow-sm">
                                    <span className="text-xs text-muted-foreground font-bold uppercase">Total Lectures</span>
                                    <p className="text-3xl font-bold mt-1 text-foreground">{attendanceData.length}</p>
                                </div>
                                <div className="bg-green-500/5 border border-green-500/20 p-4 rounded-xl text-center shadow-sm">
                                    <span className="text-xs text-green-600 font-bold uppercase">Present</span>
                                    <p className="text-3xl font-bold mt-1 text-green-700">
                                        {attendanceData.filter(a => a.status === 'PRESENT').length}
                                    </p>
                                </div>
                                <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-xl text-center shadow-sm">
                                    <span className="text-xs text-blue-600 font-bold uppercase">Attendance %</span>
                                    <p className="text-3xl font-bold mt-1 text-blue-700">
                                        {attendanceData.length > 0 
                                            ? Math.round((attendanceData.filter(a => a.status === 'PRESENT').length / attendanceData.length) * 100) 
                                            : 0}%
                                    </p>
                                </div>
                            </div>
                            
                            <div className="text-sm font-semibold text-muted-foreground mt-2 shrink-0">Recent Activity</div>

                             <ScrollArea className="flex-1 border rounded-xl bg-background/50">
                                <div className="p-2 space-y-2">
                                    {attendanceData.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                            <p>No attendance records found for this student.</p>
                                        </div>
                                    ) : (
                                        attendanceData.map((record, i) => (
                                            <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-card border border-border/50 hover:bg-accent/5 transition-colors group">
                                                <div className="flex gap-3 items-center">
                                                    <div className={`w-2 h-10 rounded-full ${record.status === 'PRESENT' ? 'bg-green-500' : 'bg-red-500'}`} />
                                                    <div>
                                                        <p className="font-semibold text-sm text-foreground">
                                                            {record.session?.subject?.name || 'Unknown Subject'}
                                                        </p>
                                                        <div className="flex gap-2 text-xs text-muted-foreground">
                                                            <span>{record.session?.subject?.subject_code}</span>
                                                            <span>•</span>
                                                            <span>{new Date(record.session?.date).toLocaleDateString()}</span>
                                                            <span>•</span>
                                                            <span className="font-mono bg-muted px-1 rounded">{record.session?.start_time}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                                                    record.status === 'PRESENT' 
                                                        ? 'bg-green-100 text-green-700 border-green-200' 
                                                        : 'bg-red-100 text-red-700 border-red-200'
                                                }`}>
                                                    {record.status}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </TabsContent>
              </Tabs>
            )}
            <div className="p-4 border-t mt-auto bg-muted/10">
                <Button onClick={() => setIsViewDialogOpen(false)} className="w-full" variant="outline">
                  Close Student Details
                </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Student Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Student</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Roll No</Label>
                  <Input
                    type="number"
                    value={formData.roll_no || ''}
                    onChange={(e) => setFormData({ ...formData, roll_no: parseInt(e.target.value) || null })}
                    className="bg-muted/50 border-border/50"
                  />
                </div>
                <div>
                  <Label>Enrollment No</Label>
                  <Input
                    value={formData.enrollment_no}
                    onChange={(e) => setFormData({ ...formData, enrollment_no: e.target.value })}
                    className="bg-muted/50 border-border/50"
                  />
                </div>
              </div>
              
              {/* Class Selection - Primary field */}
              <div>
                <Label>Class</Label>
                <Select value={formData.class_id} onValueChange={handleClassChange}>
                  <SelectTrigger className="bg-muted/50 border-border/50">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Group classes by year for better organization */}
                    {[1, 2, 3].map(year => {
                      const yearClasses = classes.filter(c => c.year === year);
                      if (yearClasses.length === 0) return null;
                      const yearLabel = year === 1 ? 'FY' : year === 2 ? 'SY' : 'TY';
                      return (
                        <div key={year}>
                          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30">
                            {yearLabel} - Year {year}
                          </div>
                          {yearClasses.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} {c.division}
                            </SelectItem>
                          ))}
                        </div>
                      );
                    })}
                  </SelectContent>
                </Select>
                {formData.class_id && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs">
                      Year {formData.year}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/10 text-secondary text-xs">
                      Sem {formData.semester}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-accent/10 text-accent text-xs">
                      Div {formData.division}
                    </span>
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Mobile</Label>
                  <Input
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="bg-muted/50 border-border/50"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-muted/50 border-border/50"
                  />
                </div>
              </div>
              <Button 
                onClick={async () => {
                  if (!selectedStudent) return;
                  try {
                    await updateStudent(selectedStudent.id, {
                      name: formData.name,
                      enrollment_no: formData.enrollment_no || null,
                      roll_no: formData.roll_no,
                      year: formData.year,
                      semester: formData.semester,
                      class_id: formData.class_id || null,
                      division: formData.division,
                      mobile: formData.mobile || null,
                      email: formData.email || null,
                    });
                    toast({ title: 'Success', description: 'Student updated' });
                    setIsEditDialogOpen(false);
                    setSelectedStudent(null);
                    fetchData();
                  } catch (error) {
                    toast({ title: 'Error', description: 'Failed to update student', variant: 'destructive' });
                  }
                }} 
                className="w-full btn-gradient"
              >
                Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Student</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <span className="font-semibold text-foreground">{studentToDelete?.name}</span>? 
                This action cannot be undone and will permanently remove the student record.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setStudentToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </PageShell>
  );
};

export default AdminStudentsPage;

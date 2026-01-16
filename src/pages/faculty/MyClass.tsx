import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Save, Search, UserMinus, Edit2, Download } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';

interface Student {
  id: string;
  name: string;
  enrollment_no: string;
  roll_no: number;
  mobile: string;
  email: string;
  status: 'ACTIVE' | 'YD' | 'PASSOUT';
  year: number;
  semester: number;
  division: string;
  class_id?: string; // Included for reference
}

interface ClassDetails {
  id: string;
  name: string;
  department: string;
  year: number;
  semester: number;
  division: string;
}

const FacultyMyClass = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classDetails, setClassDetails] = useState<ClassDetails | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Dialog States
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditRollDialogOpen, setIsEditRollDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  // Form States
  const [newStudent, setNewStudent] = useState({
    name: '',
    enrollment_no: '',
    roll_no: '',
    mobile: '',
    email: '',
    status: 'ACTIVE'
  });
  const [newRollNo, setNewRollNo] = useState('');

  useEffect(() => {
    if (user) {
      fetchClassData();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      setFilteredStudents(students.filter(s => 
        s.name.toLowerCase().includes(lowerQuery) || 
        s.enrollment_no.toLowerCase().includes(lowerQuery) ||
        s.roll_no.toString().includes(lowerQuery)
      ));
    } else {
      setFilteredStudents(students);
    }
  }, [searchQuery, students]);

  const fetchClassData = async () => {
    try {
      setLoading(true);
      
      // 1. Get Faculty ID
      const { data: facultyData, error: facultyError } = await supabase
        .from('faculty')
        .select('id')
        .eq('profile_id', user?.id)
        .single();
      
      if (facultyError) throw facultyError;
      if (!facultyData) {
        setLoading(false);
        return;
      }

      // 2. Get Class where this faculty is class teacher
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('class_teacher_id', facultyData.id)
        .single();

      if (classError && classError.code !== 'PGRST116') throw classError; // PGRST116 is "no rows returned"
      
      if (classData) {
        setClassDetails(classData);
        
        // 3. Get Students
        const { data: studentsData, error: studentsError } = await supabase
          .from('students')
          .select('*')
          .eq('class_id', classData.id)
          .order('roll_no', { ascending: true });
          
        if (studentsError) throw studentsError;
        
        setStudents(studentsData || []);
        setFilteredStudents(studentsData || []);
      }
    } catch (error) {
      console.error('Error fetching class data:', error);
      toast.error('Failed to load class data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!classDetails) return;
    if (!newStudent.name || !newStudent.enrollment_no || !newStudent.roll_no) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const payload = {
        ...newStudent,
        class_id: classDetails.id,
        year: classDetails.year,
        semester: classDetails.semester,
        division: classDetails.division,
        department: classDetails.department,
        roll_no: parseInt(newStudent.roll_no)
      };
      
      const { error } = await supabase
        .from('students')
        .insert([payload]);

      if (error) {
        if (error.code === '23505') { // Unique violation
          toast.error('Enrollment number already exists');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Student added successfully');
      setIsAddDialogOpen(false);
      setNewStudent({
        name: '',
        enrollment_no: '',
        roll_no: '',
        mobile: '',
        email: '',
        status: 'ACTIVE'
      });
      fetchClassData();
    } catch (error) {
      console.error('Error adding student:', error);
      toast.error('Failed to add student');
    }
  };

  const handleUpdateRollNo = async () => {
    if (!selectedStudent || !newRollNo) return;

    try {
      const { error } = await supabase
        .from('students')
        .update({ roll_no: parseInt(newRollNo) })
        .eq('id', selectedStudent.id);

      if (error) throw error;

      toast.success('Roll number updated');
      setIsEditRollDialogOpen(false);
      fetchClassData();
    } catch (error) {
      console.error('Error updating roll no:', error);
      toast.error('Failed to update roll number');
    }
  };

  const openEditDialog = (student: Student) => {
    setSelectedStudent(student);
    setNewRollNo(student.roll_no.toString());
    setIsEditRollDialogOpen(true);
  };

  const columns = [
    {
      key: 'roll_no',
      header: 'Roll No',
      render: (item: Student) => <span className="font-mono font-bold text-primary">{item.roll_no}</span>
    },
    {
      key: 'name',
      header: 'Student Name',
      render: (item: Student) => (
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.enrollment_no}</p>
        </div>
      )
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (item: Student) => (
        <div className="text-sm">
          <p>{item.mobile || '-'}</p>
          <p className="text-muted-foreground text-xs">{item.email || '-'}</p>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Student) => (
        <StatusBadge variant={item.status === 'ACTIVE' ? 'success' : 'warning'}>
          {item.status}
        </StatusBadge>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: Student) => (
        <Button variant="ghost" size="sm" onClick={() => openEditDialog(item)}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit Roll No
        </Button>
      )
    }
  ];

  if (loading) {
     return (
        <PageShell role="faculty">
           <div className="flex items-center justify-center h-[50vh]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
           </div>
        </PageShell>
     );
  }

  if (!classDetails) {
    return (
      <PageShell role="faculty">
        <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
          <div className="p-6 bg-muted/30 rounded-full">
            <Users className="w-12 h-12 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">No Class Assigned</h2>
          <p className="text-muted-foreground max-w-md">
            You are not currently assigned as a Class Teacher for any class. Please contact the administrator if this is a mistake.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              My Class: {classDetails.name}
            </h1>
            <p className="text-muted-foreground mt-1">
              {classDetails.department} • {classDetails.division} • Semester {classDetails.semester}
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="btn-gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Student</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Full Name *</Label>
                    <Input 
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({...newStudent, name: e.target.value})}
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Enrollment No *</Label>
                      <Input 
                        value={newStudent.enrollment_no}
                        onChange={(e) => setNewStudent({...newStudent, enrollment_no: e.target.value})}
                        placeholder="e.g. 210..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Roll No *</Label>
                      <Input 
                        type="number"
                        value={newStudent.roll_no}
                        onChange={(e) => setNewStudent({...newStudent, roll_no: e.target.value})}
                        placeholder="e.g. 1"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Mobile</Label>
                      <Input 
                        value={newStudent.mobile}
                        onChange={(e) => setNewStudent({...newStudent, mobile: e.target.value})}
                        placeholder="10 digits"
                      />
                    </div>
                    <div className="grid gap-2">
                        <Label>Status</Label>
                         <Select 
                            value={newStudent.status} 
                            onValueChange={(val) => setNewStudent({...newStudent, status: val as any})}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="YD">YD</SelectItem>
                                <SelectItem value="PASSOUT">Passout</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={newStudent.email}
                      onChange={(e) => setNewStudent({...newStudent, email: e.target.value})}
                      placeholder="student@example.com"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddStudent}>Add Student</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search and Stats */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
           <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name, roll no..." 
              className="pl-9 bg-white/5 border-border/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
             <div>Total: <span className="font-bold text-foreground">{students.length}</span></div>
             <div>Active: <span className="font-bold text-success">{students.filter(s => s.status === 'ACTIVE').length}</span></div>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card rounded-xl p-6">
            <DataTable 
                columns={columns}
                data={filteredStudents}
                keyExtractor={(item) => item.id}
                emptyMessage="No students found in this class."
            />
        </div>

        {/* Edit Roll No Dialog */}
        <Dialog open={isEditRollDialogOpen} onOpenChange={setIsEditRollDialogOpen}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Edit Roll Number</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Change roll number for <span className="font-semibold text-foreground">{selectedStudent?.name}</span>
                    </p>
                    <div className="grid gap-2">
                        <Label>New Roll No</Label>
                        <Input 
                            type="number"
                            value={newRollNo}
                            onChange={(e) => setNewRollNo(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditRollDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdateRollNo}>Update</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

      </motion.div>
    </PageShell>
  );
};

export default FacultyMyClass;

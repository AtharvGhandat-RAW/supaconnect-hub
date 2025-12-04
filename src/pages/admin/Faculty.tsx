import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Upload, MoreVertical, UserCog } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getFaculty, createFaculty, updateFaculty, type Faculty } from '@/services/faculty';
import { supabase } from '@/integrations/supabase/client';

const AdminFacultyPage: React.FC = () => {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newFaculty, setNewFaculty] = useState({
    name: '',
    email: '',
    department: 'AIML',
    designation: '',
    employee_code: '',
  });

  const fetchFaculty = async () => {
    try {
      const data = await getFaculty();
      setFaculty(data);
    } catch (error) {
      console.error('Error fetching faculty:', error);
      toast({ title: 'Error', description: 'Failed to load faculty', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const filteredFaculty = faculty.filter((f) => {
    const matchesSearch = 
      f.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.employee_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = departmentFilter === 'all' || f.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  const handleAddFaculty = async () => {
    try {
      // First create auth user and profile via edge function or direct insert
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: newFaculty.email,
        password: 'TempPass123!',
        email_confirm: true,
      });

      if (authError) throw authError;

      if (authData.user) {
        // Create profile
        await supabase.from('profiles').insert({
          id: authData.user.id,
          name: newFaculty.name,
          role: 'FACULTY',
          department: newFaculty.department,
        });

        // Create faculty record
        await createFaculty({
          profile_id: authData.user.id,
          department: newFaculty.department,
          designation: newFaculty.designation,
          employee_code: newFaculty.employee_code,
        });

        toast({ title: 'Success', description: 'Faculty added successfully' });
        setIsAddDialogOpen(false);
        setNewFaculty({ name: '', email: '', department: 'AIML', designation: '', employee_code: '' });
        fetchFaculty();
      }
    } catch (error: unknown) {
      console.error('Error adding faculty:', error);
      toast({ 
        title: 'Error', 
        description: error instanceof Error ? error.message : 'Failed to add faculty', 
        variant: 'destructive' 
      });
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      await updateFaculty(id, { status: currentStatus === 'Active' ? 'Inactive' : 'Active' });
      toast({ title: 'Success', description: 'Status updated' });
      fetchFaculty();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (f: Faculty) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <UserCog className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium text-foreground">{f.profiles?.name || 'N/A'}</span>
        </div>
      ),
    },
    { key: 'employee_code', header: 'Employee Code', render: (f: Faculty) => f.employee_code || '-' },
    { key: 'department', header: 'Department', render: (f: Faculty) => f.department || '-' },
    { key: 'designation', header: 'Designation', render: (f: Faculty) => f.designation || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (f: Faculty) => (
        <StatusBadge variant={f.status === 'Active' ? 'success' : 'danger'}>
          {f.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (f: Faculty) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleToggleStatus(f.id, f.status)}
          className="text-muted-foreground hover:text-foreground"
        >
          <MoreVertical className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Faculty Management
            </h1>
            <p className="text-muted-foreground mt-1">Manage faculty members and their information</p>
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
                  Add Faculty
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle>Add New Faculty</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={newFaculty.name}
                      onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                      placeholder="Full name"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={newFaculty.email}
                      onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                      placeholder="faculty@rit.edu"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Employee Code</Label>
                    <Input
                      value={newFaculty.employee_code}
                      onChange={(e) => setNewFaculty({ ...newFaculty, employee_code: e.target.value })}
                      placeholder="EMP001"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Designation</Label>
                    <Input
                      value={newFaculty.designation}
                      onChange={(e) => setNewFaculty({ ...newFaculty, designation: e.target.value })}
                      placeholder="Assistant Professor"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div>
                    <Label>Department</Label>
                    <Select
                      value={newFaculty.department}
                      onValueChange={(v) => setNewFaculty({ ...newFaculty, department: v })}
                    >
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
                  <Button onClick={handleAddFaculty} className="w-full btn-gradient">
                    Add Faculty
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
              placeholder="Search by name or employee code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-border/50"
            />
          </div>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-white/5 border-border/50">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="AIML">AIML</SelectItem>
              <SelectItem value="CS">Computer Science</SelectItem>
              <SelectItem value="IT">Information Technology</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={filteredFaculty}
          keyExtractor={(f) => f.id}
          isLoading={loading}
          emptyMessage="No faculty members found"
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminFacultyPage;

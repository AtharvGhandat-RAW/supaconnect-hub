import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Check, X, CalendarOff } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { getFacultyLeaves, createLeaveRequest, updateLeaveStatus, type FacultyLeave } from '@/services/leaves';
import { getFaculty, type Faculty } from '@/services/faculty';
import { createActivityLog } from '@/services/activity';
import { supabase } from '@/integrations/supabase/client';

interface LeaveWithFaculty extends FacultyLeave {
  faculty?: { profiles?: { name: string } };
}

const AdminFacultyLeavePage: React.FC = () => {
  const [leaves, setLeaves] = useState<LeaveWithFaculty[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [facultyFilter, setFacultyFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    faculty_id: '',
    date: new Date().toISOString().split('T')[0],
    leave_type: 'FULL_DAY' as 'FULL_DAY' | 'HALF_MORNING' | 'HALF_AFTERNOON',
    reason: '',
  });

  const fetchData = async () => {
    try {
      const [leavesData, facultyData] = await Promise.all([
        getFacultyLeaves(),
        getFaculty(),
      ]);
      setLeaves(leavesData || []);
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
      .channel('leaves-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty_leaves' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredLeaves = leaves.filter(leave => {
    const matchesStatus = statusFilter === 'all' || leave.status === statusFilter;
    const matchesFaculty = facultyFilter === 'all' || leave.faculty_id === facultyFilter;
    return matchesStatus && matchesFaculty;
  });

  const handleCreateLeave = async () => {
    try {
      await createLeaveRequest(formData);
      toast({ title: 'Success', description: 'Leave request created' });
      setIsAddDialogOpen(false);
      setFormData({
        faculty_id: '',
        date: new Date().toISOString().split('T')[0],
        leave_type: 'FULL_DAY',
        reason: '',
      });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create leave request', variant: 'destructive' });
    }
  };

  const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED', facultyName: string, leave: LeaveWithFaculty) => {
    try {
      await updateLeaveStatus(id, status);
      
      // Log activity
      await createActivityLog(`Leave ${status.toLowerCase()} for ${facultyName}`);
      
      // If approved, trigger substitution via edge function
      if (status === 'APPROVED') {
        try {
          const response = await supabase.functions.invoke('assign-substitute', {
            body: {
              faculty_id: leave.faculty_id,
              date: leave.date,
              window: leave.leave_type || 'FULL_DAY',
            },
          });
          
          if (response.error) {
            console.error('Substitution error:', response.error);
            toast({ title: 'Warning', description: 'Leave approved but substitution assignment failed. Please assign manually.', variant: 'default' });
          } else {
            const data = response.data;
            const assignedCount = data?.assignments?.length || 0;
            toast({ 
              title: 'Success', 
              description: assignedCount > 0 
                ? `Leave approved. ${assignedCount} substitution(s) assigned automatically.`
                : 'Leave approved. No slots needed substitution.' 
            });
          }
        } catch (subError) {
          console.error('Substitution call failed:', subError);
          toast({ title: 'Success', description: 'Leave approved. Substitution will need manual assignment.' });
        }
      } else {
        toast({ title: 'Success', description: 'Leave rejected' });
      }
      
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'FULL_DAY': return 'Full Day';
      case 'HALF_MORNING': return 'Half Day (Morning)';
      case 'HALF_AFTERNOON': return 'Half Day (Afternoon)';
      default: return type;
    }
  };

  const columns = [
    { key: 'date', header: 'Date' },
    {
      key: 'faculty',
      header: 'Faculty',
      render: (leave: LeaveWithFaculty) => (
        <div className="flex items-center gap-2">
          <CalendarOff className="w-4 h-4 text-muted-foreground" />
          <span>{leave.faculty?.profiles?.name || '-'}</span>
        </div>
      ),
    },
    {
      key: 'leave_type',
      header: 'Type',
      render: (leave: LeaveWithFaculty) => getLeaveTypeLabel(leave.leave_type),
    },
    { key: 'reason', header: 'Reason', render: (leave: LeaveWithFaculty) => leave.reason || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (leave: LeaveWithFaculty) => (
        <StatusBadge
          variant={
            leave.status === 'APPROVED' ? 'success' :
            leave.status === 'REJECTED' ? 'danger' : 'warning'
          }
        >
          {leave.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (leave: LeaveWithFaculty) => leave.status === 'PENDING' && (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStatusUpdate(leave.id, 'APPROVED', leave.faculty?.profiles?.name || '', leave)}
            className="text-success hover:text-success"
            aria-label="Approve leave"
          >
            <Check className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStatusUpdate(leave.id, 'REJECTED', leave.faculty?.profiles?.name || '', leave)}
            className="text-danger hover:text-danger"
            aria-label="Reject leave"
          >
            <X className="w-4 h-4" />
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
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Faculty Leave</h1>
            <p className="text-muted-foreground mt-1">Manage leave requests and substitutions</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gradient">
                <Plus className="w-4 h-4 mr-2" />
                Create Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50">
              <DialogHeader>
                <DialogTitle>Create Leave Request</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
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
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="bg-white/5 border-border/50"
                  />
                </div>
                <div>
                  <Label>Leave Type</Label>
                  <Select value={formData.leave_type} onValueChange={(v) => setFormData({ ...formData, leave_type: v as typeof formData.leave_type })}>
                    <SelectTrigger className="bg-white/5 border-border/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_DAY">Full Day</SelectItem>
                      <SelectItem value="HALF_MORNING">Half Day (Morning)</SelectItem>
                      <SelectItem value="HALF_AFTERNOON">Half Day (Afternoon)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reason</Label>
                  <Textarea
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    placeholder="Enter reason for leave..."
                    className="bg-white/5 border-border/50"
                  />
                </div>
                <Button onClick={handleCreateLeave} className="w-full btn-gradient">
                  Create Leave Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-white/5 border-border/50">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
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
          data={filteredLeaves}
          keyExtractor={(leave) => leave.id}
          isLoading={loading}
          emptyMessage="No leave requests found"
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminFacultyLeavePage;

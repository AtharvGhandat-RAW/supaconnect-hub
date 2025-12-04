import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, CalendarOff } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getFacultyLeaves, createLeaveRequest, type FacultyLeave } from '@/services/leaves';

const FacultyLeavePage: React.FC = () => {
  const { user } = useAuth();
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [leaves, setLeaves] = useState<FacultyLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    leave_type: 'FULL_DAY' as 'FULL_DAY' | 'HALF_MORNING' | 'HALF_AFTERNOON',
    reason: '',
  });

  useEffect(() => {
    async function fetchFacultyId() {
      if (!user) return;

      try {
        const { data } = await supabase
          .from('faculty')
          .select('id')
          .eq('profile_id', user.id)
          .single();

        if (data) {
          setFacultyId(data.id);
        }
      } catch (error) {
        console.error('Error fetching faculty:', error);
      }
    }
    fetchFacultyId();
  }, [user]);

  useEffect(() => {
    if (!facultyId) return;

    async function fetchLeaves() {
      try {
        const data = await getFacultyLeaves({ faculty_id: facultyId! });
        setLeaves(data || []);
      } catch (error) {
        console.error('Error fetching leaves:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaves();

    // Realtime subscription
    const channel = supabase
      .channel('my-leaves')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'faculty_leaves',
        filter: `faculty_id=eq.${facultyId}`,
      }, () => {
        fetchLeaves();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [facultyId]);

  const handleCreateLeave = async () => {
    if (!facultyId) return;

    try {
      await createLeaveRequest({
        faculty_id: facultyId,
        ...formData,
      });
      toast({ title: 'Success', description: 'Leave request submitted' });
      setIsAddDialogOpen(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        leave_type: 'FULL_DAY',
        reason: '',
      });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to submit leave request', variant: 'destructive' });
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
      key: 'leave_type',
      header: 'Type',
      render: (leave: FacultyLeave) => getLeaveTypeLabel(leave.leave_type),
    },
    { key: 'reason', header: 'Reason', render: (leave: FacultyLeave) => leave.reason || '-' },
    {
      key: 'status',
      header: 'Status',
      render: (leave: FacultyLeave) => (
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
  ];

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Leave</h1>
            <p className="text-muted-foreground mt-1">Request and track your leave applications</p>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-gradient">
                <Plus className="w-4 h-4 mr-2" />
                Request Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50">
              <DialogHeader>
                <DialogTitle>Request Leave</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="bg-white/5 border-border/50 mt-1"
                  />
                </div>
                <div>
                  <Label>Leave Type</Label>
                  <Select value={formData.leave_type} onValueChange={(v) => setFormData({ ...formData, leave_type: v as typeof formData.leave_type })}>
                    <SelectTrigger className="bg-white/5 border-border/50 mt-1"><SelectValue /></SelectTrigger>
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
                    className="bg-white/5 border-border/50 mt-1"
                  />
                </div>
                <Button onClick={handleCreateLeave} className="w-full btn-gradient">
                  Submit Request
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {leaves.length === 0 && !loading ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <CalendarOff className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No leave requests yet</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={leaves}
            keyExtractor={(leave) => leave.id}
            isLoading={loading}
            emptyMessage="No leave requests"
          />
        )}
      </motion.div>
    </PageShell>
  );
};

export default FacultyLeavePage;

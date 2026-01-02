import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, UserCheck, RefreshCw, Calendar, Clock, Users, CheckCircle, XCircle } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  getSubstitutionAssignments,
  createManualSubstitution,
  updateSubstitutionStatus,
  getSlotsNeedingSubstitutes,
  getAvailableFacultyForSlot,
  type SubstitutionAssignment,
} from '@/services/substitutions';
import { getFacultyLeaves, type FacultyLeave } from '@/services/leaves';
import { getFaculty, type Faculty } from '@/services/faculty';

interface AvailableFaculty {
  id: string;
  department?: string | null;
  profiles?: { name: string }[] | { name: string } | null;
}
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface SlotNeedingSub {
  id: string;
  start_time: string;
  classes?: { id: string; name: string; division: string };
  subjects?: { id: string; name: string; subject_code: string };
}

const AdminSubstitutionsPage: React.FC = () => {
  const { user } = useAuth();
  const [substitutions, setSubstitutions] = useState<SubstitutionAssignment[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<(FacultyLeave & { faculty?: { profiles?: { name: string } } })[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Manual assignment dialog state
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<(FacultyLeave & { faculty?: { profiles?: { name: string } } }) | null>(null);
  const [slotsNeedingSub, setSlotsNeedingSub] = useState<SlotNeedingSub[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<SlotNeedingSub | null>(null);
  const [availableFaculty, setAvailableFaculty] = useState<AvailableFaculty[]>([]);
  const [selectedSubFaculty, setSelectedSubFaculty] = useState<string>('');
  const [notes, setNotes] = useState('');

  const fetchData = async () => {
    try {
      const [subsData, leavesData, facultyData] = await Promise.all([
        getSubstitutionAssignments({ dateFrom: dateFilter }),
        getFacultyLeaves({ status: 'APPROVED', dateFrom: dateFilter }),
        getFaculty(),
      ]);
      setSubstitutions(subsData);
      setPendingLeaves(leavesData || []);
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
      .channel('substitutions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'substitution_assignments' }, () => {
        fetchData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty_leaves' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateFilter]);

  const filteredSubstitutions = substitutions.filter(sub => {
    return statusFilter === 'all' || sub.status === statusFilter;
  });

  const handleOpenAssignDialog = async (leave: FacultyLeave & { faculty?: { profiles?: { name: string } } }) => {
    setSelectedLeave(leave);
    try {
      const slots = await getSlotsNeedingSubstitutes(leave.faculty_id, leave.date);
      setSlotsNeedingSub(slots);
      setIsAssignDialogOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load slots', variant: 'destructive' });
    }
  };

  const handleSlotSelect = async (slot: SlotNeedingSub) => {
    setSelectedSlot(slot);
    if (selectedLeave) {
      try {
        const available = await getAvailableFacultyForSlot(
          selectedLeave.date,
          slot.start_time,
          selectedLeave.faculty_id
        );
        setAvailableFaculty(available);
      } catch (error) {
        toast({ title: 'Error', description: 'Failed to load available faculty', variant: 'destructive' });
      }
    }
  };

  const handleCreateSubstitution = async () => {
    if (!selectedLeave || !selectedSlot || !selectedSubFaculty) {
      toast({ title: 'Error', description: 'Please select all required fields', variant: 'destructive' });
      return;
    }

    try {
      await createManualSubstitution({
        src_faculty_id: selectedLeave.faculty_id,
        sub_faculty_id: selectedSubFaculty,
        class_id: selectedSlot.classes?.id || '',
        subject_id: selectedSlot.subjects?.id || '',
        date: selectedLeave.date,
        start_time: selectedSlot.start_time,
        notes,
        assigned_by: user?.id,
      });

      toast({ title: 'Success', description: 'Substitution assigned successfully' });
      setIsAssignDialogOpen(false);
      resetAssignForm();
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to assign substitution', variant: 'destructive' });
    }
  };

  const handleStatusUpdate = async (id: string, status: 'CONFIRMED' | 'CANCELLED') => {
    try {
      await updateSubstitutionStatus(id, status);
      toast({ title: 'Success', description: `Substitution ${status.toLowerCase()}` });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  };

  const resetAssignForm = () => {
    setSelectedLeave(null);
    setSelectedSlot(null);
    setSelectedSubFaculty('');
    setSlotsNeedingSub([]);
    setAvailableFaculty([]);
    setNotes('');
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'CONFIRMED': return 'success';
      case 'COMPLETED': return 'success';
      case 'PENDING': return 'warning';
      case 'CANCELLED': return 'danger';
      default: return 'default';
    }
  };

  const getAssignmentTypeBadge = (type: string) => {
    switch (type) {
      case 'AUTO': return { variant: 'info' as const, label: 'Auto' };
      case 'MANUAL': return { variant: 'warning' as const, label: 'Manual' };
      case 'TRANSFER': return { variant: 'success' as const, label: 'Transfer' };
      default: return { variant: 'default' as const, label: type };
    }
  };

  const columns = [
    {
      key: 'date',
      header: 'Date & Time',
      render: (sub: SubstitutionAssignment) => (
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{new Date(sub.date).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <Clock className="w-3 h-3" />
            <span>{sub.start_time}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'src_faculty',
      header: 'Absent Faculty',
      render: (sub: SubstitutionAssignment) => (
        <span className="text-muted-foreground">{sub.src_faculty?.profiles?.name || '-'}</span>
      ),
    },
    {
      key: 'sub_faculty',
      header: 'Substitute',
      render: (sub: SubstitutionAssignment) => (
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-success" />
          <span className="font-medium">{sub.sub_faculty?.profiles?.name || '-'}</span>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      render: (sub: SubstitutionAssignment) => (
        <span>{sub.classes?.name} {sub.classes?.division}</span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (sub: SubstitutionAssignment) => (
        <span>{sub.subjects?.name} ({sub.subjects?.subject_code})</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (sub: SubstitutionAssignment) => {
        const badge = getAssignmentTypeBadge(sub.assignment_type);
        return <StatusBadge variant={badge.variant}>{badge.label}</StatusBadge>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (sub: SubstitutionAssignment) => (
        <StatusBadge variant={getStatusBadgeVariant(sub.status) as 'default' | 'success' | 'warning' | 'danger'}>
          {sub.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (sub: SubstitutionAssignment) => sub.status === 'PENDING' && (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStatusUpdate(sub.id, 'CONFIRMED')}
            className="text-success hover:text-success"
            title="Confirm"
          >
            <CheckCircle className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleStatusUpdate(sub.id, 'CANCELLED')}
            className="text-danger hover:text-danger"
            title="Cancel"
          >
            <XCircle className="w-4 h-4" />
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
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Substitution Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage faculty substitutions for leaves and absences
            </p>
          </div>
        </div>

        {/* Pending Leave Cards */}
        {pendingLeaves.filter(l => l.status === 'APPROVED').length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-warning" />
              Approved Leaves Needing Substitutes
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pendingLeaves.filter(l => l.status === 'APPROVED').map(leave => (
                <motion.div
                  key={leave.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card p-4 rounded-xl border border-warning/30"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-foreground">
                        {leave.faculty?.profiles?.name || 'Unknown Faculty'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(leave.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <StatusBadge variant="warning" className="mt-2">
                        {leave.leave_type.replace('_', ' ')}
                      </StatusBadge>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleOpenAssignDialog(leave)}
                      className="btn-gradient"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Assign
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <Label className="text-sm text-muted-foreground">From Date</Label>
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-white/5 border-border/50 mt-1"
            />
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40 bg-white/5 border-border/50 mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Total Substitutions</p>
            <p className="text-2xl font-bold text-foreground">{substitutions.length}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-warning">{substitutions.filter(s => s.status === 'PENDING').length}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Confirmed</p>
            <p className="text-2xl font-bold text-success">{substitutions.filter(s => s.status === 'CONFIRMED').length}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Auto Assigned</p>
            <p className="text-2xl font-bold text-accent">{substitutions.filter(s => s.assignment_type === 'AUTO').length}</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredSubstitutions}
          keyExtractor={(sub) => sub.id}
          isLoading={loading}
          emptyMessage="No substitutions found"
        />

        {/* Manual Assignment Dialog */}
        <Dialog open={isAssignDialogOpen} onOpenChange={(open) => {
          setIsAssignDialogOpen(open);
          if (!open) resetAssignForm();
        }}>
          <DialogContent className="glass-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle>Assign Substitute</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {selectedLeave && (
                <div className="p-3 bg-warning/10 rounded-lg border border-warning/30">
                  <p className="text-sm font-medium">
                    {selectedLeave.faculty?.profiles?.name} is on leave
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(selectedLeave.date).toLocaleDateString()} • {selectedLeave.leave_type.replace('_', ' ')}
                  </p>
                </div>
              )}

              <div>
                <Label>Select Slot</Label>
                {slotsNeedingSub.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    All slots have been assigned substitutes.
                  </p>
                ) : (
                  <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                    {slotsNeedingSub.map(slot => (
                      <div
                        key={slot.id}
                        onClick={() => handleSlotSelect(slot)}
                        className={`p-3 rounded-lg cursor-pointer transition-all ${
                          selectedSlot?.id === slot.id
                            ? 'bg-primary/20 border border-primary/50'
                            : 'bg-white/5 border border-border/30 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{slot.start_time}</span>
                          <span className="text-sm text-muted-foreground">
                            {slot.classes?.name} {slot.classes?.division}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {slot.subjects?.name} ({slot.subjects?.subject_code})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedSlot && (
                <div>
                  <Label>Select Substitute Faculty</Label>
                  {availableFaculty.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      No faculty available at this time.
                    </p>
                  ) : (
                    <Select value={selectedSubFaculty} onValueChange={setSelectedSubFaculty}>
                      <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                        <SelectValue placeholder="Select faculty" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFaculty.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {Array.isArray(f.profiles) ? f.profiles[0]?.name : f.profiles?.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes..."
                  className="bg-white/5 border-border/50 mt-1"
                />
              </div>

              <Button
                onClick={handleCreateSubstitution}
                disabled={!selectedSlot || !selectedSubFaculty}
                className="w-full btn-gradient"
              >
                Assign Substitute
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </PageShell>
  );
};

export default AdminSubstitutionsPage;

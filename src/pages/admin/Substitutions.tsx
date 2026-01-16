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
  substitution?: { isSubstituted: boolean; subName: string; status: string } | null;
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
      // Get all approved leaves for the selected date
      const { data: leavesData } = await supabase
        .from('faculty_leaves')
        .select('*, faculty:faculty_id(id, profiles(name))')
        .eq('status', 'APPROVED')
        .eq('date', dateFilter);

      // Get substitutions history
      const subsData = await getSubstitutionAssignments({ date: dateFilter }); // Changed to exact date for better focus

      // Get Faculty list
      const facultyData = await getFaculty();
      
      setSubstitutions(subsData);
      setPendingLeaves(leavesData as any || []);
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
                
                {/* Date Picker Control at Top Level */}
                <div className="flex items-center gap-2">
                     <Calendar className="w-5 h-5 text-muted-foreground" />
                     <Input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="bg-background border-border/50 w-auto"
                     />
                </div>
            </div>

            {/* Tabs for different views - Simplified to just main view now */}
            <div className="grid gap-6">
                
            {/* 1. Absent Faculty Section */}
            <div className="glass-card rounded-xl p-6 border-l-4 border-l-destructive/50">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-destructive" />
                    Faculty On Leave ({new Date(dateFilter).toLocaleDateString()})
                </h2>
                
                {pendingLeaves.length === 0 ? (
                    <p className="text-muted-foreground italic">No faculty on approved leave for this date.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {pendingLeaves.map(leave => (
                            <div key={leave.id} className="p-4 rounded-lg bg-background/50 border border-border/50 flex justify-between items-center group hover:border-primary/50 transition-colors cursor-pointer"
                                onClick={() => handleOpenAssignDialog(leave)}>
                                <div>
                                    <p className="font-semibold">{leave.faculty?.profiles?.name}</p>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                                        {leave.leave_type.replace('_', ' ')} - Approved
                                    </span>
                                </div>
                                <Button size="sm" variant="secondary" className="group-hover:bg-primary group-hover:text-primary-foreground">
                                    Manage Lectures
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 2. All Substitutions List */}
            <div className="glass-card rounded-xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold">Today's Substitutions</h2>
                    <div className="flex gap-2">
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[150px] bg-muted/50 border-border/50">
                            <SelectValue placeholder="Filter Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="PENDING">Pending</SelectItem>
                            <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                            <SelectItem value="COMPLETED">Completed</SelectItem>
                        </SelectContent>
                        </Select>
                    </div>
                </div>
                
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="glass-card p-4 rounded-xl bg-muted/20">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-2xl font-bold text-foreground">{substitutions.length}</p>
                    </div>
                    <div className="glass-card p-4 rounded-xl bg-warning/10">
                        <p className="text-sm text-muted-foreground">Pending</p>
                        <p className="text-2xl font-bold text-warning">{substitutions.filter(s => s.status === 'PENDING').length}</p>
                    </div>
                    <div className="glass-card p-4 rounded-xl bg-success/10">
                        <p className="text-sm text-muted-foreground">Confirmed</p>
                        <p className="text-2xl font-bold text-success">{substitutions.filter(s => s.status === 'CONFIRMED').length}</p>
                    </div>
                    <div className="glass-card p-4 rounded-xl bg-accent/10">
                        <p className="text-sm text-muted-foreground">Auto Assigned</p>
                        <p className="text-2xl font-bold text-accent">{substitutions.filter(s => s.assignment_type === 'AUTO').length}</p>
                    </div>
                </div>
                
                <DataTable
                columns={columns}
                data={filteredSubstitutions}
                keyExtractor={(sub) => sub.id}
                isLoading={loading}
                emptyMessage="No substitutions found for this date"
                />
            </div>
            </div>

            {/* Assign Dialog */}
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                <DialogTitle>Manage Lectures - {selectedLeave?.faculty?.profiles?.name}</DialogTitle>
                </DialogHeader>
                
                {!selectedSlot ? (
                    // Step 1: Select Lecture
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">Select a lecture to assign a substitute:</p>
                        <div className="grid gap-3">
                            {slotsNeedingSub.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border">
                                    No lectures scheduled for this day, or all have been handled.
                                </div>
                            ) : (
                                slotsNeedingSub.map(slot => (
                                    <div key={slot.id} className={`p-4 rounded-lg border ${slot.substitution ? 'bg-green-500/5 border-green-500/20' : 'bg-card border-border'} flex justify-between items-center`}>
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-primary/10 rounded text-primary font-mono text-sm font-bold">
                                                {slot.start_time.slice(0, 5)}
                                            </div>
                                            <div>
                                                <p className="font-semibold">{slot.subjects?.name} ({slot.subjects?.subject_code})</p>
                                                <p className="text-sm text-muted-foreground">{slot.classes?.name} {slot.classes?.division}</p>
                                            </div>
                                        </div>
                                        
                                        {slot.substitution ? (
                                            <div className="text-right">
                                                <span className="text-xs font-medium text-green-500 block mb-1">Substituted</span>
                                                <p className="text-sm font-medium">{slot.substitution.subName}</p>
                                            </div>
                                        ) : (
                                            <Button size="sm" onClick={() => handleSlotSelect(slot)}>
                                                Assign Substitute
                                            </Button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    // Step 2: Select Substitute
                    <div className="space-y-4 py-4">
                        <div className="bg-muted/30 p-3 rounded-md mb-4 flex items-center justify-between">
                            <div>
                                <span className="text-xs uppercase text-muted-foreground font-bold">Selected Lecture</span>
                                <div className="font-medium text-sm">
                                    {selectedSlot.start_time.slice(0, 5)} | {selectedSlot.subjects?.name} | {selectedSlot.classes?.name}
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedSlot(null); setAvailableFaculty([]); setSelectedSubFaculty(''); }}>
                                Change
                            </Button>
                        </div>

                        <div className="space-y-3">
                            <Label>Select Substitute Faculty</Label>
                            <Select value={selectedSubFaculty} onValueChange={setSelectedSubFaculty}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select available faculty..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableFaculty.length === 0 ? (
                                        <SelectItem value="none" disabled>No available faculty found for this time slot (checking overlaps)</SelectItem>
                                    ) : (
                                        availableFaculty.map(f => (
                                            <SelectItem key={f.id} value={f.id}>
                                                {f.profiles?.name} {f.department ? `(${f.department})` : ''}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                * List only shows active faculty who are NOT teaching another class at {selectedSlot.start_time} and are NOT on leave.
                            </p>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Notes (Optional)</Label>
                            <Textarea 
                                placeholder="Reason or instructions..." 
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => { setSelectedSlot(null); setSelectedSubFaculty(''); }}>Back</Button>
                            <Button onClick={handleCreateSubstitution} disabled={!selectedSubFaculty} className="btn-gradient bg-primary text-primary-foreground">
                                Confirm Substitution
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
            </Dialog>
        </motion.div>
    </PageShell>
  );
};

export default AdminSubstitutionsPage;

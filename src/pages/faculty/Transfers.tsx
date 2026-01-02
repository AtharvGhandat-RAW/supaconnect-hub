import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRightLeft, Plus, Clock, CheckCircle, XCircle, User, Calendar, BookOpen } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  getLectureTransfers,
  getMyIncomingTransfers,
  getMyOutgoingTransfers,
  createTransferRequest,
  respondToTransfer,
  cancelTransfer,
  getAvailableFacultyForTransfer,
  type LectureTransfer,
} from '@/services/transfers';
import { getTodaySlots } from '@/services/timetable';
interface AvailableFaculty {
  id: string;
  profiles?: { name: string }[] | { name: string } | null;
}

interface TimetableSlot {
  id: string;
  start_time: string;
  day_of_week: string;
  classes?: { name: string; division: string };
  subjects?: { name: string; subject_code: string };
}

const FacultyTransfersPage: React.FC = () => {
  const { user } = useAuth();
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [incomingTransfers, setIncomingTransfers] = useState<LectureTransfer[]>([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState<LectureTransfer[]>([]);
  const [mySlots, setMySlots] = useState<TimetableSlot[]>([]);
  const [availableFaculty, setAvailableFaculty] = useState<AvailableFaculty[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Transfer form state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimetableSlot | null>(null);
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

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

  const fetchTransfers = async () => {
    if (!facultyId) return;
    
    try {
      const [incoming, outgoing] = await Promise.all([
        getMyIncomingTransfers(facultyId),
        getMyOutgoingTransfers(facultyId),
      ]);
      setIncomingTransfers(incoming);
      setOutgoingTransfers(outgoing);
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!facultyId) return;

    fetchTransfers();

    // Realtime subscription
    const channel = supabase
      .channel('my-transfers')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lecture_transfers',
      }, () => {
        fetchTransfers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [facultyId]);

  const handleOpenCreateDialog = async () => {
    if (!facultyId) return;
    
    try {
      // Fetch my today's slots
      const slots = await getTodaySlots(facultyId);
      setMySlots(slots || []);
      setIsCreateDialogOpen(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load your slots', variant: 'destructive' });
    }
  };

  const handleSlotSelect = async (slot: TimetableSlot) => {
    setSelectedSlot(slot);
    if (facultyId) {
      try {
        const available = await getAvailableFacultyForTransfer(slot.id, transferDate, facultyId);
        setAvailableFaculty(available);
      } catch (error) {
        console.error('Error fetching available faculty:', error);
      }
    }
  };

  const handleCreateTransfer = async () => {
    if (!facultyId || !selectedSlot || !selectedFaculty) {
      toast({ title: 'Error', description: 'Please select all required fields', variant: 'destructive' });
      return;
    }

    try {
      await createTransferRequest({
        from_faculty_id: facultyId,
        to_faculty_id: selectedFaculty,
        timetable_slot_id: selectedSlot.id,
        date: transferDate,
        reason,
      });
      toast({ title: 'Success', description: 'Transfer request sent' });
      setIsCreateDialogOpen(false);
      resetForm();
      fetchTransfers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to create transfer request', variant: 'destructive' });
    }
  };

  const handleRespond = async (id: string, response: 'ACCEPTED' | 'REJECTED') => {
    try {
      await respondToTransfer(id, response);
      toast({ title: 'Success', description: `Transfer ${response.toLowerCase()}` });
      fetchTransfers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to respond to transfer', variant: 'destructive' });
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelTransfer(id);
      toast({ title: 'Success', description: 'Transfer cancelled' });
      fetchTransfers();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to cancel transfer', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setSelectedSlot(null);
    setSelectedFaculty('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setAvailableFaculty([]);
    setMySlots([]);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'success';
      case 'REJECTED': return 'danger';
      case 'PENDING': return 'warning';
      case 'CANCELLED': return 'default';
      default: return 'default';
    }
  };

  const incomingColumns = [
    {
      key: 'from',
      header: 'From Faculty',
      render: (transfer: LectureTransfer) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span>{transfer.from_faculty?.profiles?.name || '-'}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date & Time',
      render: (transfer: LectureTransfer) => (
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{new Date(transfer.date).toLocaleDateString()}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {transfer.timetable_slots?.start_time}
          </span>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      render: (transfer: LectureTransfer) => (
        <span>
          {transfer.timetable_slots?.classes?.name} {transfer.timetable_slots?.classes?.division}
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (transfer: LectureTransfer) => (
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <span>{transfer.timetable_slots?.subjects?.name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (transfer: LectureTransfer) => (
        <StatusBadge variant={getStatusBadgeVariant(transfer.status) as 'default' | 'success' | 'warning' | 'danger'}>
          {transfer.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (transfer: LectureTransfer) => transfer.status === 'PENDING' && (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRespond(transfer.id, 'ACCEPTED')}
            className="text-success hover:text-success"
            title="Accept"
          >
            <CheckCircle className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRespond(transfer.id, 'REJECTED')}
            className="text-danger hover:text-danger"
            title="Reject"
          >
            <XCircle className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ];

  const outgoingColumns = [
    {
      key: 'to',
      header: 'To Faculty',
      render: (transfer: LectureTransfer) => (
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span>{transfer.to_faculty?.profiles?.name || '-'}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date & Time',
      render: (transfer: LectureTransfer) => (
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>{new Date(transfer.date).toLocaleDateString()}</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {transfer.timetable_slots?.start_time}
          </span>
        </div>
      ),
    },
    {
      key: 'class',
      header: 'Class',
      render: (transfer: LectureTransfer) => (
        <span>
          {transfer.timetable_slots?.classes?.name} {transfer.timetable_slots?.classes?.division}
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Subject',
      render: (transfer: LectureTransfer) => (
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <span>{transfer.timetable_slots?.subjects?.name}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (transfer: LectureTransfer) => (
        <StatusBadge variant={getStatusBadgeVariant(transfer.status) as 'default' | 'success' | 'warning' | 'danger'}>
          {transfer.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (transfer: LectureTransfer) => transfer.status === 'PENDING' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleCancel(transfer.id)}
          className="text-danger hover:text-danger"
          title="Cancel"
        >
          <XCircle className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
              Lecture Transfers
            </h1>
            <p className="text-muted-foreground mt-1">
              Transfer your lectures to other faculty members
            </p>
          </div>
          <Button onClick={handleOpenCreateDialog} className="btn-gradient">
            <Plus className="w-4 h-4 mr-2" />
            Request Transfer
          </Button>
        </div>

        {/* Pending Incoming Requests Alert */}
        {incomingTransfers.filter(t => t.status === 'PENDING').length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-4 rounded-xl border-l-4 border-l-warning"
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-warning" />
              <div>
                <p className="font-medium text-foreground">
                  {incomingTransfers.filter(t => t.status === 'PENDING').length} pending transfer request(s)
                </p>
                <p className="text-sm text-muted-foreground">
                  Other faculty members want to transfer their lectures to you
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <Tabs defaultValue="incoming" className="w-full">
          <TabsList className="w-full grid grid-cols-2 bg-white/5">
            <TabsTrigger value="incoming" className="data-[state=active]:bg-primary/20">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Incoming ({incomingTransfers.length})
            </TabsTrigger>
            <TabsTrigger value="outgoing" className="data-[state=active]:bg-primary/20">
              <ArrowRightLeft className="w-4 h-4 mr-2 rotate-180" />
              Outgoing ({outgoingTransfers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incoming" className="mt-6">
            <DataTable
              columns={incomingColumns}
              data={incomingTransfers}
              keyExtractor={(transfer) => transfer.id}
              isLoading={loading}
              emptyMessage="No incoming transfer requests"
            />
          </TabsContent>

          <TabsContent value="outgoing" className="mt-6">
            <DataTable
              columns={outgoingColumns}
              data={outgoingTransfers}
              keyExtractor={(transfer) => transfer.id}
              isLoading={loading}
              emptyMessage="No outgoing transfer requests"
            />
          </TabsContent>
        </Tabs>

        {/* Create Transfer Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogContent className="glass-card border-border/50 max-w-lg">
            <DialogHeader>
              <DialogTitle>Request Lecture Transfer</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="bg-white/5 border-border/50 mt-1"
                />
              </div>

              <div>
                <Label>Select Your Slot to Transfer</Label>
                {mySlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-2">
                    No slots found for today. Try selecting a different date.
                  </p>
                ) : (
                  <div className="space-y-2 mt-2 max-h-40 overflow-y-auto">
                    {mySlots.map(slot => (
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
                  <Label>Select Faculty to Transfer To</Label>
                  {availableFaculty.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-2">
                      No faculty available at this time.
                    </p>
                  ) : (
                    <Select value={selectedFaculty} onValueChange={setSelectedFaculty}>
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
                <Label>Reason (Optional)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why do you want to transfer this lecture?"
                  className="bg-white/5 border-border/50 mt-1"
                />
              </div>

              <Button
                onClick={handleCreateTransfer}
                disabled={!selectedSlot || !selectedFaculty}
                className="w-full btn-gradient"
              >
                Send Transfer Request
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </PageShell>
  );
};

export default FacultyTransfersPage;

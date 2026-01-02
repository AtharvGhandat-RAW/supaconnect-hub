import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Trash2, Edit2, CalendarOff } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { getHolidays, createHoliday, updateHoliday, deleteHoliday, type Holiday } from '@/services/holidays';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const AdminHolidaysPage: React.FC = () => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    description: '',
    holiday_type: 'HOLIDAY' as 'HOLIDAY' | 'HALF_DAY' | 'EXAM_DAY' | 'EVENT',
    is_recurring: false,
  });

  const fetchData = async () => {
    try {
      const data = await getHolidays();
      setHolidays(data);
    } catch (error) {
      console.error('Error fetching holidays:', error);
      toast({ title: 'Error', description: 'Failed to load holidays', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Realtime subscription
    const channel = supabase
      .channel('holidays-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holidays' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredHolidays = holidays.filter(holiday => {
    return typeFilter === 'all' || holiday.holiday_type === typeFilter;
  });

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.date) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    try {
      if (editingHoliday) {
        await updateHoliday(editingHoliday.id, formData);
        toast({ title: 'Success', description: 'Holiday updated successfully' });
      } else {
        await createHoliday({
          ...formData,
          created_by: user?.id,
        });
        toast({ title: 'Success', description: 'Holiday created successfully' });
      }
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save holiday';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    }
  };

  const handleEdit = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      date: holiday.date,
      name: holiday.name,
      description: holiday.description || '',
      holiday_type: holiday.holiday_type,
      is_recurring: holiday.is_recurring,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteHoliday(id);
      toast({ title: 'Success', description: 'Holiday deleted successfully' });
      setDeleteConfirmId(null);
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete holiday', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      name: '',
      description: '',
      holiday_type: 'HOLIDAY',
      is_recurring: false,
    });
    setEditingHoliday(null);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'HOLIDAY': return 'Holiday';
      case 'HALF_DAY': return 'Half Day';
      case 'EXAM_DAY': return 'Exam Day';
      case 'EVENT': return 'Event';
      default: return type;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'HOLIDAY': return 'danger';
      case 'HALF_DAY': return 'warning';
      case 'EXAM_DAY': return 'info';
      case 'EVENT': return 'success';
      default: return 'default';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (holiday: Holiday) => (
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span>{formatDate(holiday.date)}</span>
        </div>
      ),
    },
    { key: 'name', header: 'Name' },
    {
      key: 'holiday_type',
      header: 'Type',
      render: (holiday: Holiday) => (
        <StatusBadge variant={getTypeBadgeVariant(holiday.holiday_type) as 'default' | 'success' | 'warning' | 'danger' | 'info'}>
          {getTypeLabel(holiday.holiday_type)}
        </StatusBadge>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (holiday: Holiday) => (
        <span className="text-muted-foreground">{holiday.description || '-'}</span>
      ),
    },
    {
      key: 'is_recurring',
      header: 'Recurring',
      render: (holiday: Holiday) => (
        <span className={holiday.is_recurring ? 'text-success' : 'text-muted-foreground'}>
          {holiday.is_recurring ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (holiday: Holiday) => (
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(holiday)}
            className="text-primary hover:text-primary"
            aria-label="Edit holiday"
          >
            <Edit2 className="w-4 h-4" />
          </Button>
          <Dialog open={deleteConfirmId === holiday.id} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteConfirmId(holiday.id)}
                className="text-danger hover:text-danger"
                aria-label="Delete holiday"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50">
              <DialogHeader>
                <DialogTitle>Delete Holiday</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground">
                Are you sure you want to delete "{holiday.name}"? This action cannot be undone.
              </p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button variant="destructive" onClick={() => handleDelete(holiday.id)}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              Holiday Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage college holidays, exam days, and events
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="btn-gradient">
                <Plus className="w-4 h-4 mr-2" />
                Add Holiday
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-card border-border/50">
              <DialogHeader>
                <DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add New Holiday'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="bg-white/5 border-border/50 mt-1"
                  />
                </div>
                <div>
                  <Label>Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Republic Day"
                    className="bg-white/5 border-border/50 mt-1"
                  />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select
                    value={formData.holiday_type}
                    onValueChange={(v) => setFormData({ ...formData, holiday_type: v as typeof formData.holiday_type })}
                  >
                    <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOLIDAY">Holiday</SelectItem>
                      <SelectItem value="HALF_DAY">Half Day</SelectItem>
                      <SelectItem value="EXAM_DAY">Exam Day</SelectItem>
                      <SelectItem value="EVENT">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description..."
                    className="bg-white/5 border-border/50 mt-1"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Recurring Annually</Label>
                    <p className="text-xs text-muted-foreground">
                      This holiday repeats every year
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_recurring}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_recurring: checked })}
                  />
                </div>
                <Button onClick={handleSubmit} className="w-full btn-gradient">
                  {editingHoliday ? 'Update Holiday' : 'Add Holiday'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-white/5 border-border/50">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="HOLIDAY">Holiday</SelectItem>
              <SelectItem value="HALF_DAY">Half Day</SelectItem>
              <SelectItem value="EXAM_DAY">Exam Day</SelectItem>
              <SelectItem value="EVENT">Event</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Total Holidays</p>
            <p className="text-2xl font-bold text-foreground">{holidays.filter(h => h.holiday_type === 'HOLIDAY').length}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Half Days</p>
            <p className="text-2xl font-bold text-warning">{holidays.filter(h => h.holiday_type === 'HALF_DAY').length}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Exam Days</p>
            <p className="text-2xl font-bold text-accent">{holidays.filter(h => h.holiday_type === 'EXAM_DAY').length}</p>
          </div>
          <div className="glass-card p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Events</p>
            <p className="text-2xl font-bold text-success">{holidays.filter(h => h.holiday_type === 'EVENT').length}</p>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredHolidays}
          keyExtractor={(holiday) => holiday.id}
          isLoading={loading}
          emptyMessage="No holidays found. Add your first holiday!"
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminHolidaysPage;

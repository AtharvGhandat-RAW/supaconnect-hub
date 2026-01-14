import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getClasses, type Class } from '@/services/classes';
import { getStudents, type Student } from '@/services/students';
import { getBatches, createBatch, deleteBatch, type Batch, getBatchStudents } from '@/services/batches';

interface BatchesPageProps {
    role?: 'admin' | 'faculty';
}

const AdminBatches: React.FC<BatchesPageProps> = ({ role = 'admin' }) => {
    const { user } = useAuth();
    const [classes, setClasses] = useState<Class[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [batches, setBatches] = useState<Batch[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(false);

    // Create Batch State
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [newBatchName, setNewBatchName] = useState('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [rangeStart, setRangeStart] = useState('');
    const [rangeEnd, setRangeEnd] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchClasses = async () => {
             if (role === 'faculty' && user) {
                // Fetch only assigned classes for faculty
                try {
                    const { data: facultyParams } = await supabase
                        .from('faculty')
                        .select('id')
                        .eq('profile_id', user.id)
                        .single();
                    
                    if (facultyParams) {
                        const { data: allocations } = await supabase
                            .from('subject_allocations')
                            .select('class_id')
                            .eq('faculty_id', facultyParams.id);
                        
                        if (allocations && allocations.length > 0) {
                            const classIds = Array.from(new Set(allocations.map(a => a.class_id)));
                            const allClasses = await getClasses(); 
                            // filtering client side since getClasses returns all and we want to reuse the type logic
                            // or better, fetch specifically if we want to optimize, but let's filter for safety
                            const allowed = allClasses.filter(c => classIds.includes(c.id));
                            setClasses(allowed);
                        } else {
                            setClasses([]);
                        }
                    }
                } catch (e) {
                    console.error('Error fetching faculty classes', e);
                }
            } else {
                getClasses().then(setClasses).catch(console.error);
            }
        };
        fetchClasses();
    }, [role, user]);

    const fetchBatchesAndStudents = useCallback(async () => {
        setLoading(true);
        try {
            const [batchesData, studentsData] = await Promise.all([
                getBatches(selectedClass),
                getStudents({ class_id: selectedClass })
            ]);
            setBatches(batchesData || []);
            setStudents(studentsData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast({ title: 'Error', description: 'Failed to load batches/students', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [selectedClass]);

    useEffect(() => {
        if (selectedClass) {
            fetchBatchesAndStudents();
        } else {
            setBatches([]);
            setStudents([]);
        }
    }, [selectedClass, fetchBatchesAndStudents]);

    const handleCreateBatch = async () => {
        if (!newBatchName.trim()) {
            toast({ title: 'Error', description: 'Batch name is required', variant: 'destructive' });
            return;
        }
        if (selectedStudentIds.size === 0) {
            toast({ title: 'Error', description: 'Select at least one student', variant: 'destructive' });
            return;
        }

        // Check for duplicate name locally
        if (batches.some(b => b.name.toLowerCase() === newBatchName.trim().toLowerCase())) {
            toast({ title: 'Error', description: 'Batch with this name already exists', variant: 'destructive' });
            return;
        }

        setIsSubmitting(true);
        try {
            await createBatch(newBatchName, selectedClass, Array.from(selectedStudentIds));
            toast({ title: 'Success', description: 'Batch created successfully' });
            setIsCreateDialogOpen(false);
            setNewBatchName('');
            setSelectedStudentIds(new Set());
            setRangeStart('');
            setRangeEnd('');
            fetchBatchesAndStudents();
        } catch (error: unknown) {
            console.error('Error creating batch:', error);
            const message = error instanceof Error ? error.message : 'Failed to create batch. Check console for details.';
            toast({
                title: 'Error',
                description: message,
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteBatch = async (id: string) => {
        if (!confirm('Are you sure you want to delete this batch?')) return;
        try {
            await deleteBatch(id);
            toast({ title: 'Success', description: 'Batch deleted' });
            fetchBatchesAndStudents();
        } catch (error) {
            console.error('Error deleting batch:', error);
            toast({ title: 'Error', description: 'Failed to delete batch', variant: 'destructive' });
        }
    };

    const toggleStudentSelection = (id: string) => {
        const newSelection = new Set(selectedStudentIds);
        if (newSelection.has(id)) {
            newSelection.delete(id);
        } else {
            newSelection.add(id);
        }
        setSelectedStudentIds(newSelection);
    };

    const selectByRange = () => {
        const start = parseInt(rangeStart);
        const end = parseInt(rangeEnd);
        if (isNaN(start) || isNaN(end)) return;

        const newSelection = new Set(selectedStudentIds);
        students.forEach(s => {
            if (s.roll_no && s.roll_no >= start && s.roll_no <= end) {
                newSelection.add(s.id);
            }
        });
        setSelectedStudentIds(newSelection);
    };

    const selectAll = () => {
        if (selectedStudentIds.size === students.length) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(students.map(s => s.id)));
        }
    };

    return (
        <PageShell role={role}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Practical Batches</h1>
                        <p className="text-muted-foreground mt-1">Create and manage student batches for practicals</p>
                    </div>
                    <div className="flex gap-2">
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select Class" />
                            </SelectTrigger>
                            <SelectContent>
                                {classes.map(c => (
                                    <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="btn-gradient" disabled={!selectedClass}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Batch
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Create New Batch</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Batch Name</Label>
                                        <Input
                                            placeholder="e.g. Batch A"
                                            value={newBatchName}
                                            onChange={(e) => setNewBatchName(e.target.value)}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Select Students</Label>
                                        <div className="flex gap-2 items-end">
                                            <div className="grid grid-cols-2 gap-2 flex-1">
                                                <div>
                                                    <Label className="text-xs">From Roll No</Label>
                                                    <Input
                                                        type="number"
                                                        value={rangeStart}
                                                        onChange={(e) => setRangeStart(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-xs">To Roll No</Label>
                                                    <Input
                                                        type="number"
                                                        value={rangeEnd}
                                                        onChange={(e) => setRangeEnd(e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                            <Button variant="secondary" onClick={selectByRange}>Select Range</Button>
                                        </div>

                                        <div className="flex justify-between items-center mt-2">
                                            <span className="text-sm text-muted-foreground">{selectedStudentIds.size} selected</span>
                                            <Button variant="ghost" size="sm" onClick={selectAll}>
                                                {selectedStudentIds.size === students.length ? 'Deselect All' : 'Select All'}
                                            </Button>
                                        </div>

                                        <div className="border rounded-md p-2 max-h-[300px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {students.map(student => (
                                                <div
                                                    key={student.id}
                                                    className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-accent ${selectedStudentIds.has(student.id) ? 'bg-accent/50' : ''}`}
                                                    onClick={() => toggleStudentSelection(student.id)}
                                                >
                                                    <Checkbox
                                                        checked={selectedStudentIds.has(student.id)}
                                                        onCheckedChange={() => toggleStudentSelection(student.id)}
                                                    />
                                                    <div className="text-sm">
                                                        <span className="font-mono font-bold mr-2">{student.roll_no || '-'}</span>
                                                        {student.name}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isSubmitting}>Cancel</Button>
                                    <Button onClick={handleCreateBatch} disabled={isSubmitting}>
                                        {isSubmitting ? 'Creating...' : 'Create Batch'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>
                        ))}
                    </div>
                ) : !selectedClass ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Select a class to manage batches</p>
                    </div>
                ) : batches.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                        <p>No batches found for this class. Create one to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {batches.map(batch => (
                            <Card key={batch.id} className="hover:shadow-md transition-shadow">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-lg font-bold">{batch.name}</CardTitle>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/90" onClick={() => handleDeleteBatch(batch.id)}>
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground">
                                        {/* We could fetch student count here if needed, but for now just show basic info */}
                                        <p>Practical Batch</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </motion.div>
        </PageShell>
    );
};

export default AdminBatches;

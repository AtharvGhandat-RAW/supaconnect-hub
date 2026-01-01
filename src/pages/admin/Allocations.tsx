import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Trash2, RefreshCw, BookOpen, Users } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
    getAllAllocationsWithFaculty,
    createSubjectAllocation,
    deleteSubjectAllocation,
    syncAllocationsFromTimetable,
    type SubjectAllocation,
} from '@/services/allocations';
import { getFaculty, type Faculty } from '@/services/faculty';
import { getClasses, type Class } from '@/services/classes';
import { getSubjects, type Subject } from '@/services/subjects';
import { getBatches, type Batch } from '@/services/batches';

const AdminAllocationsPage: React.FC = () => {
    const [allocations, setAllocations] = useState<SubjectAllocation[]>([]);
    const [faculty, setFaculty] = useState<Faculty[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newAllocation, setNewAllocation] = useState({
        faculty_id: '',
        class_id: '',
        subject_id: '',
        batch_id: '',
    });

    const fetchData = async () => {
        try {
            const [allocData, facultyData, classData, subjectData] = await Promise.all([
                getAllAllocationsWithFaculty(),
                getFaculty(),
                getClasses(),
                getSubjects(),
            ]);
            setAllocations(allocData);
            setFaculty(facultyData.filter(f => f.status === 'Active'));
            setClasses(classData);
            setSubjects(subjectData.filter(s => s.status === 'Active'));
        } catch (error) {
            console.error('Error fetching data:', error);
            toast({ title: 'Error', description: 'Failed to load data', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (newAllocation.class_id) {
            getBatches(newAllocation.class_id)
                .then(setBatches)
                .catch(() => {
                    setBatches([]);
                    // Silently fail - batches are optional
                });
        } else {
            setBatches([]);
        }
    }, [newAllocation.class_id]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const count = await syncAllocationsFromTimetable();
            toast({
                title: 'Sync Complete',
                description: count > 0 ? `Created ${count} new allocation(s) from timetable` : 'All allocations are up to date',
            });
            fetchData();
        } catch (error) {
            console.error('Error syncing:', error);
            toast({ title: 'Error', description: 'Failed to sync allocations', variant: 'destructive' });
        } finally {
            setSyncing(false);
        }
    };

    const handleAdd = async () => {
        if (!newAllocation.faculty_id || !newAllocation.class_id || !newAllocation.subject_id) {
            toast({ title: 'Error', description: 'All fields are required', variant: 'destructive' });
            return;
        }

        try {
            await createSubjectAllocation({
                ...newAllocation,
                batch_id: (newAllocation.batch_id && newAllocation.batch_id !== 'none') ? newAllocation.batch_id : null,
            });
            toast({ title: 'Success', description: 'Allocation created' });
            setIsAddDialogOpen(false);
            setNewAllocation({ faculty_id: '', class_id: '', subject_id: '', batch_id: '' });
            fetchData();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create allocation';
            toast({ title: 'Error', description: message, variant: 'destructive' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to remove this allocation?')) return;
        try {
            await deleteSubjectAllocation(id);
            toast({ title: 'Success', description: 'Allocation removed' });
            fetchData();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to remove allocation', variant: 'destructive' });
        }
    };

    const filteredAllocations = allocations.filter((a) => {
        const faculty = a.faculty as { id: string; profiles?: { name: string } } | undefined;
        const facultyName = faculty?.profiles?.name?.toLowerCase() || '';
        const subjectName = a.subjects?.name?.toLowerCase() || '';
        const className = a.classes?.name?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        return facultyName.includes(search) || subjectName.includes(search) || className.includes(search);
    });

    // Filter subjects based on selected class year
    const filteredSubjects = newAllocation.class_id
        ? subjects.filter(s => {
            const selectedClass = classes.find(c => c.id === newAllocation.class_id);
            return selectedClass ? s.year === selectedClass.year : true;
        })
        : subjects;

    const columns = [
        {
            key: 'faculty',
            header: 'Faculty',
            render: (a: SubjectAllocation) => {
                const faculty = a.faculty as { id: string; profiles?: { name: string } } | undefined;
                return (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <Users className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-medium text-foreground">
                            {faculty?.profiles?.name || 'Unknown'}
                        </span>
                    </div>
                );
            },
        },
        {
            key: 'class',
            header: 'Class / Batch',
            render: (a: SubjectAllocation) => (
                <div>
                    <span className="text-foreground">{a.classes?.name} {a.classes?.division}</span>
                    {a.batches && (
                        <span className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full">
                            {a.batches.name}
                        </span>
                    )}
                </div>
            ),
        },
        {
            key: 'subject',
            header: 'Subject',
            render: (a: SubjectAllocation) => (
                <div>
                    <span className="font-medium text-foreground">{a.subjects?.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">({a.subjects?.subject_code})</span>
                </div>
            ),
        },
        {
            key: 'type',
            header: 'Type',
            render: (a: SubjectAllocation) => (
                <StatusBadge variant={a.subjects?.type === 'TH' ? 'default' : 'info'}>
                    {a.subjects?.type}
                </StatusBadge>
            ),
        },
        {
            key: 'actions',
            header: '',
            render: (a: SubjectAllocation) => (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(a.id)}
                    className="text-danger hover:text-danger"
                    aria-label={`Delete allocation for ${a.subjects?.name || 'subject'}`}
                >
                    <Trash2 className="w-4 h-4" />
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
                            Subject Allocations
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Assign subjects to faculty for each class
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleSync} disabled={syncing} className="border-border/50">
                            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Syncing...' : 'Sync from Timetable'}
                        </Button>

                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="btn-gradient">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Allocation
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="glass-card border-border/50">
                                <DialogHeader>
                                    <DialogTitle>New Subject Allocation</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <Label>Faculty</Label>
                                        <Select
                                            value={newAllocation.faculty_id}
                                            onValueChange={(v) => setNewAllocation({ ...newAllocation, faculty_id: v })}
                                        >
                                            <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                                                <SelectValue placeholder="Select faculty" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {faculty.map((f) => (
                                                    <SelectItem key={f.id} value={f.id}>
                                                        {f.profiles?.name || f.employee_code}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label>Class</Label>
                                        <Select
                                            value={newAllocation.class_id}
                                            onValueChange={(v) => setNewAllocation({ ...newAllocation, class_id: v, subject_id: '', batch_id: '' })}
                                        >
                                            <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                                                <SelectValue placeholder="Select class" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {classes.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>
                                                        {c.name} {c.division}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {batches.length > 0 && (
                                        <div>
                                            <Label>Batch (Optional)</Label>
                                            <Select
                                                value={newAllocation.batch_id}
                                                onValueChange={(v) => setNewAllocation({ ...newAllocation, batch_id: v })}
                                            >
                                                <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                                                    <SelectValue placeholder="Select batch (for practicals)" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">None (Whole Class)</SelectItem>
                                                    {batches.map((b) => (
                                                        <SelectItem key={b.id} value={b.id}>
                                                            {b.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}

                                    <div>
                                        <Label>Subject</Label>
                                        <Select
                                            value={newAllocation.subject_id}
                                            onValueChange={(v) => setNewAllocation({ ...newAllocation, subject_id: v })}
                                            disabled={!newAllocation.class_id}
                                        >
                                            <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                                                <SelectValue placeholder="Select subject" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {filteredSubjects.map((s) => (
                                                    <SelectItem key={s.id} value={s.id}>
                                                        {s.name} ({s.subject_code})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <Button onClick={handleAdd} className="w-full btn-gradient">
                                        Create Allocation
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* Search */}
                <div className="glass-card rounded-xl p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by faculty, class, or subject..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-white/5 border-border/50"
                        />
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-card rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-accent">{allocations.length}</div>
                        <div className="text-sm text-muted-foreground">Total Allocations</div>
                    </div>
                    <div className="glass-card rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-primary">{new Set(allocations.map(a => a.faculty_id)).size}</div>
                        <div className="text-sm text-muted-foreground">Faculty Assigned</div>
                    </div>
                    <div className="glass-card rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-success">{new Set(allocations.map(a => a.class_id)).size}</div>
                        <div className="text-sm text-muted-foreground">Classes Covered</div>
                    </div>
                    <div className="glass-card rounded-xl p-4 text-center">
                        <div className="text-2xl font-bold text-warning">{new Set(allocations.map(a => a.subject_id)).size}</div>
                        <div className="text-sm text-muted-foreground">Subjects Assigned</div>
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    columns={columns}
                    data={filteredAllocations}
                    keyExtractor={(a) => a.id}
                    isLoading={loading}
                    emptyMessage="No allocations found. Click 'Sync from Timetable' or 'Add Allocation' to create one."
                />
            </motion.div>
        </PageShell>
    );
};

export default AdminAllocationsPage;

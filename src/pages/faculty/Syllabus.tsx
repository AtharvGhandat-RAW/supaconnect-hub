import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Edit2, Trash2, ChevronDown, ChevronRight, BookOpen, AlertTriangle } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getSubjectAllocations, type SubjectAllocation } from '@/services/allocations';
import {
    getSyllabusTopics,
    createSyllabusTopic,
    updateSyllabusTopic,
    deleteSyllabusTopic,
    type SyllabusTopic
} from '@/services/syllabus';

interface SubjectWithTopics extends SubjectAllocation {
    topics?: SyllabusTopic[];
}

const FacultySyllabusPage: React.FC = () => {
    const { user } = useAuth();
    const [facultyId, setFacultyId] = useState<string | null>(null);
    const [subjects, setSubjects] = useState<SubjectWithTopics[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
    const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
    const [loadingTopics, setLoadingTopics] = useState<Record<string, boolean>>({});

    // Topic management
    const [selectedSubject, setSelectedSubject] = useState<SubjectWithTopics | null>(null);
    const [addingTopicFor, setAddingTopicFor] = useState<number | null>(null);
    const [newTopicText, setNewTopicText] = useState('');
    const [editingTopic, setEditingTopic] = useState<{ id: string; text: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            if (!user) return;

            try {
                const { data: facultyData } = await supabase
                    .from('faculty')
                    .select('id')
                    .eq('profile_id', user.id)
                    .single();

                if (facultyData) {
                    setFacultyId(facultyData.id);
                    await fetchSubjects(facultyData.id);
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                toast({ title: 'Error', description: 'Failed to load subjects', variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [user]);

    const fetchSubjects = async (fId: string) => {
        try {
            const allocations = await getSubjectAllocations(fId);
            setSubjects(allocations);
        } catch (error) {
            console.error('Error fetching subjects:', error);
            toast({ title: 'Error', description: 'Failed to load subjects', variant: 'destructive' });
        }
    };

    const loadTopicsForSubject = async (subjectId: string, allocationId: string) => {
        setLoadingTopics(prev => ({ ...prev, [allocationId]: true }));
        try {
            const topics = await getSyllabusTopics(subjectId);
            setSubjects(prev => prev.map(s => (s.id === allocationId ? { ...s, topics } : s)));
        } catch (error) {
            console.error('Error loading topics:', error);
            toast({ title: 'Error', description: 'Failed to load topics', variant: 'destructive' });
        } finally {
            setLoadingTopics(prev => ({ ...prev, [allocationId]: false }));
        }
    };

    const handleAddTopic = async () => {
        if (!selectedSubject || addingTopicFor === null || !newTopicText.trim()) return;

        try {
            await createSyllabusTopic({
                subject_id: selectedSubject.subject_id,
                unit_no: addingTopicFor,
                topic_text: newTopicText.trim(),
            });
            toast({ title: 'Success', description: 'Topic added successfully' });
            setAddingTopicFor(null);
            setNewTopicText('');
            await loadTopicsForSubject(selectedSubject.subject_id, selectedSubject.id);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add topic';
            toast({ title: 'Error', description: message, variant: 'destructive' });
        }
    };

    const handleUpdateTopic = async () => {
        if (!editingTopic || !editingTopic.text.trim() || !selectedSubject) return;

        try {
            await updateSyllabusTopic(editingTopic.id, { topic_text: editingTopic.text.trim() });
            toast({ title: 'Success', description: 'Topic updated' });
            setEditingTopic(null);
            await loadTopicsForSubject(selectedSubject.subject_id, selectedSubject.id);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to update topic', variant: 'destructive' });
        }
    };

    const handleDeleteTopic = async (topicId: string) => {
        if (!selectedSubject) return;

        try {
            await deleteSyllabusTopic(topicId, true);
            toast({ title: 'Success', description: 'Topic deleted' });
            setDeleteConfirm(null);
            await loadTopicsForSubject(selectedSubject.subject_id, selectedSubject.id);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete topic', variant: 'destructive' });
        }
    };

    const toggleUnit = (subjectId: string, unitNo: number) => {
        const key = `${subjectId}-${unitNo}`;
        setExpandedUnits(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) {
                newSet.delete(key);
            } else {
                newSet.add(key);
            }
            return newSet;
        });
    };

    const handleSubjectToggle = async (subject: SubjectWithTopics) => {
        const isCurrentlyOpen = expandedSubject === subject.id;
        const nextId = isCurrentlyOpen ? null : subject.id;
        setExpandedSubject(nextId);
        if (!isCurrentlyOpen && !subject.topics) {
            await loadTopicsForSubject(subject.subject_id, subject.id);
        }
    };

    const filteredSubjects = subjects.filter(s =>
        s.subjects?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.subjects?.subject_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getTopicsByUnit = (topics: SyllabusTopic[] | undefined, unit: number) =>
        (topics || []).filter(t => t.unit_no === unit);

    return (
        <PageShell role="faculty">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
                        Syllabus Management
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Add and manage syllabus topics for your subjects. Topics are stored globally and reused across all faculty.
                    </p>
                </div>

                {/* Search */}
                <div className="glass-card rounded-xl p-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search subjects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 bg-white/5 border-border/50"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
                                <div className="h-24 bg-muted rounded"></div>
                            </div>
                        ))}
                    </div>
                ) : filteredSubjects.length === 0 ? (
                    <div className="glass-card rounded-xl p-8 text-center">
                        <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium text-foreground mb-2">No Subjects Found</p>
                        <p className="text-muted-foreground">No subjects assigned to you</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filteredSubjects.map(subject => (
                            <div key={subject.id} className="glass-card rounded-xl overflow-hidden border border-border/30">
                                <button
                                    onClick={() => handleSubjectToggle(subject)}
                                    className="w-full p-6 text-left hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {expandedSubject === subject.id ? (
                                                <ChevronDown className="w-5 h-5 text-accent" />
                                            ) : (
                                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                                            )}
                                            <div>
                                                <h3 className="text-lg font-semibold text-foreground">
                                                    {subject.subjects?.name}
                                                    <span className="text-muted-foreground font-normal ml-2 text-sm">
                                                        ({subject.subjects?.subject_code})
                                                    </span>
                                                </h3>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {subject.classes?.name} {subject.classes?.division} • {subject.subjects?.type === 'TH' ? 'Theory' : 'Practical'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-2xl font-bold text-accent">
                                                {subject.topics?.length || 0}
                                            </div>
                                            <p className="text-xs text-muted-foreground">topics</p>
                                        </div>
                                    </div>
                                </button>

                                {expandedSubject === subject.id && (
                                    <div className="px-6 pb-6 pt-2 border-t border-border/30 space-y-4">
                                        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex gap-2">
                                            <AlertTriangle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                                            <p className="text-sm text-blue-600 dark:text-blue-400">
                                                Topics added here are stored globally and shared with all faculty assigned to this subject.
                                            </p>
                                        </div>

                                        {[1, 2, 3, 4, 5].map(unitNo => {
                                            const unitTopics = getTopicsByUnit(subject.topics, unitNo);
                                            const unitKey = `${subject.id}-${unitNo}`;
                                            const isUnitExpanded = expandedUnits.has(unitKey);

                                            return (
                                                <div key={unitNo} className="border border-border/30 rounded-lg overflow-hidden">
                                                    <button
                                                        onClick={() => toggleUnit(subject.id, unitNo)}
                                                        className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {isUnitExpanded ? (
                                                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                                            ) : (
                                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                                            )}
                                                            <span className="font-medium text-foreground">Unit {unitNo}</span>
                                                            <span className="text-xs text-muted-foreground">
                                                                ({unitTopics.length} topic{unitTopics.length !== 1 ? 's' : ''})
                                                            </span>
                                                        </div>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedSubject(subject);
                                                                setAddingTopicFor(unitNo);
                                                                setNewTopicText('');
                                                                setExpandedUnits(prev => {
                                                                    const next = new Set(prev);
                                                                    next.add(unitKey);
                                                                    return next;
                                                                });
                                                            }}
                                                            className="h-7 text-xs"
                                                        >
                                                            <Plus className="w-3 h-3 mr-1" />
                                                            Add Topic
                                                        </Button>
                                                    </button>

                                                    {isUnitExpanded && (
                                                        <div className="p-3 space-y-2 bg-black/10">
                                                            {loadingTopics[subject.id] && (
                                                                <p className="text-xs text-muted-foreground">Loading topics...</p>
                                                            )}
                                                            {/* Add topic form */}
                                                            {selectedSubject?.id === subject.id && addingTopicFor === unitNo && (
                                                                <div className="p-3 bg-accent/10 rounded-lg border border-accent/30">
                                                                    <Textarea
                                                                        value={newTopicText}
                                                                        onChange={(e) => setNewTopicText(e.target.value)}
                                                                        placeholder="Enter topic text (no character limit)..."
                                                                        className="bg-white/5 border-border/50 min-h-[80px] text-sm mb-2"
                                                                        autoFocus
                                                                    />
                                                                    <div className="flex gap-2">
                                                                        <Button size="sm" onClick={handleAddTopic} className="btn-gradient">
                                                                            Add Topic
                                                                        </Button>
                                                                        <Button size="sm" variant="ghost" onClick={() => setAddingTopicFor(null)}>
                                                                            Cancel
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {unitTopics.length === 0 && selectedSubject?.id !== subject.id ? (
                                                                <p className="text-sm text-muted-foreground text-center py-4">
                                                                    No topics in this unit
                                                                </p>
                                                            ) : (
                                                                unitTopics.map((topic, idx) => (
                                                                    <div key={topic.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5 group">
                                                                        <span className="text-xs text-muted-foreground w-6 pt-1">{idx + 1}.</span>
                                                                        {editingTopic?.id === topic.id ? (
                                                                            <div className="flex-1">
                                                                                <Textarea
                                                                                    value={editingTopic.text}
                                                                                    onChange={(e) => setEditingTopic({ ...editingTopic, text: e.target.value })}
                                                                                    className="bg-white/5 border-border/50 min-h-[60px] text-sm mb-2"
                                                                                    autoFocus
                                                                                />
                                                                                <div className="flex gap-2">
                                                                                    <Button size="sm" onClick={handleUpdateTopic}>
                                                                                        Save
                                                                                    </Button>
                                                                                    <Button size="sm" variant="ghost" onClick={() => setEditingTopic(null)}>
                                                                                        Cancel
                                                                                    </Button>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <>
                                                                                <p className="flex-1 text-sm text-foreground whitespace-pre-wrap">{topic.topic_text}</p>
                                                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        onClick={() => setEditingTopic({ id: topic.id, text: topic.topic_text })}
                                                                                        className="h-7 w-7 p-0"
                                                                                        title="Edit topic"
                                                                                    >
                                                                                        <Edit2 className="w-3 h-3" />
                                                                                    </Button>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        variant="ghost"
                                                                                        onClick={() => setDeleteConfirm(topic.id)}
                                                                                        className="h-7 w-7 p-0 text-danger hover:text-danger"
                                                                                        title="Delete topic"
                                                                                    >
                                                                                        <Trash2 className="w-3 h-3" />
                                                                                    </Button>
                                                                                </div>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Delete Confirmation Dialog */}
                <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
                    <DialogContent className="glass-card border-border/50">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-warning">
                                <AlertTriangle className="w-5 h-5" />
                                Delete Topic?
                            </DialogTitle>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                            <p className="text-sm text-foreground">
                                This will permanently delete this topic and all associated coverage history.
                            </p>
                            <div className="flex gap-2 justify-end">
                                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={() => deleteConfirm && handleDeleteTopic(deleteConfirm)}
                                >
                                    Delete Anyway
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </motion.div>
        </PageShell>
    );
};

export default FacultySyllabusPage;

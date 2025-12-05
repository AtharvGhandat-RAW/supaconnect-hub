import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, BookOpen, Edit2, ChevronDown, ChevronRight, Check, X, Trash2, FileText } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getSubjects, createSubject, updateSubject, type Subject } from '@/services/subjects';
import {
  getSyllabusTopics,
  createSyllabusTopic,
  updateSyllabusTopic,
  deleteSyllabusTopic,
  type SyllabusTopic
} from '@/services/syllabus';

const AdminSubjectsPage: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // Syllabus management state
  const [syllabusDialogOpen, setSyllabusDialogOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<SyllabusTopic[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [addingTopicFor, setAddingTopicFor] = useState<number | null>(null);
  const [newTopicText, setNewTopicText] = useState('');
  const [editingTopic, setEditingTopic] = useState<{ id: string; text: string } | null>(null);

  const [formData, setFormData] = useState({
    subject_code: '',
    name: '',
    semester: 1,
    year: 1,
    department: 'AIML',
    type: 'TH' as 'TH' | 'PR' | 'TU',
    weekly_lectures: 3,
    status: 'Active',
  });

  const fetchData = async () => {
    try {
      const data = await getSubjects();
      setSubjects(data);
    } catch (error) {
      console.error('Error fetching subjects:', error);
      toast({ title: 'Error', description: 'Failed to load subjects', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subject_code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesYear = yearFilter === 'all' || s.year.toString() === yearFilter;
    return matchesSearch && matchesYear;
  });

  const resetForm = () => {
    setFormData({
      subject_code: '',
      name: '',
      semester: 1,
      year: 1,
      department: 'AIML',
      type: 'TH',
      weekly_lectures: 3,
      status: 'Active',
    });
    setEditingSubject(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingSubject) {
        await updateSubject(editingSubject.id, formData);
        toast({ title: 'Success', description: 'Subject updated successfully' });
      } else {
        await createSubject(formData);
        toast({ title: 'Success', description: 'Subject created successfully' });
      }
      setIsAddDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save subject', variant: 'destructive' });
    }
  };

  const handleEdit = (s: Subject) => {
    setEditingSubject(s);
    setFormData({
      subject_code: s.subject_code,
      name: s.name,
      semester: s.semester,
      year: s.year,
      department: s.department || 'AIML',
      type: s.type,
      weekly_lectures: s.weekly_lectures,
      status: s.status,
    });
    setIsAddDialogOpen(true);
  };

  // Syllabus management functions
  const openSyllabusDialog = async (subject: Subject) => {
    setSelectedSubject(subject);
    setSyllabusDialogOpen(true);
    setLoadingTopics(true);
    try {
      const topicData = await getSyllabusTopics(subject.id);
      setTopics(topicData);
    } catch (error) {
      console.error('Error loading topics:', error);
      toast({ title: 'Error', description: 'Failed to load syllabus', variant: 'destructive' });
    } finally {
      setLoadingTopics(false);
    }
  };

  const handleAddTopic = async () => {
    if (!selectedSubject || addingTopicFor === null || !newTopicText.trim()) return;

    try {
      await createSyllabusTopic({
        subject_id: selectedSubject.id,
        unit_no: addingTopicFor,
        topic_text: newTopicText.trim(),
      });
      toast({ title: 'Success', description: 'Topic added' });
      setAddingTopicFor(null);
      setNewTopicText('');
      // Refresh topics
      const topicData = await getSyllabusTopics(selectedSubject.id);
      setTopics(topicData);
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
      const topicData = await getSyllabusTopics(selectedSubject.id);
      setTopics(topicData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update topic';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!selectedSubject) return;
    if (!confirm('Delete this topic? This will also remove any coverage records.')) return;

    try {
      await deleteSyllabusTopic(topicId, true);
      toast({ title: 'Success', description: 'Topic deleted' });
      const topicData = await getSyllabusTopics(selectedSubject.id);
      setTopics(topicData);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete topic', variant: 'destructive' });
    }
  };

  const toggleUnit = (unitNo: number) => {
    setExpandedUnits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitNo)) {
        newSet.delete(unitNo);
      } else {
        newSet.add(unitNo);
      }
      return newSet;
    });
  };

  const getTopicsByUnit = (unitNo: number) => topics.filter(t => t.unit_no === unitNo);

  const columns = [
    { key: 'subject_code', header: 'Code' },
    {
      key: 'name',
      header: 'Subject Name',
      render: (s: Subject) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <span className="font-medium text-foreground">{s.name}</span>
        </div>
      ),
    },
    { key: 'year', header: 'Year' },
    { key: 'semester', header: 'Sem' },
    {
      key: 'type',
      header: 'Type',
      render: (s: Subject) => (
        <StatusBadge variant={s.type === 'TH' ? 'default' : s.type === 'PR' ? 'info' : 'warning'}>
          {s.type}
        </StatusBadge>
      ),
    },
    { key: 'weekly_lectures', header: 'Weekly' },
    {
      key: 'status',
      header: 'Status',
      render: (s: Subject) => (
        <StatusBadge variant={s.status === 'Active' ? 'success' : 'outline'}>
          {s.status}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (s: Subject) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openSyllabusDialog(s)} title="Manage Syllabus">
            <FileText className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleEdit(s)} title="Edit Subject">
            <Edit2 className="w-4 h-4" />
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
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Subjects</h1>
            <p className="text-muted-foreground mt-1">Manage subjects and their syllabus (click 📄 icon to manage syllabus)</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="btn-gradient">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Subject
                </Button>
              </DialogTrigger>
              <DialogContent className="glass-card border-border/50">
                <DialogHeader>
                  <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Subject Code</Label>
                      <Input
                        value={formData.subject_code}
                        onChange={(e) => setFormData({ ...formData, subject_code: e.target.value })}
                        placeholder="CS101"
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                    <div>
                      <Label>Type</Label>
                      <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as 'TH' | 'PR' | 'TU' })}>
                        <SelectTrigger className="bg-white/5 border-border/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TH">Theory</SelectItem>
                          <SelectItem value="PR">Practical</SelectItem>
                          <SelectItem value="TU">Tutorial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Subject Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Introduction to AI"
                      className="bg-white/5 border-border/50"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Year</Label>
                      <Select value={formData.year.toString()} onValueChange={(v) => setFormData({ ...formData, year: parseInt(v) })}>
                        <SelectTrigger className="bg-white/5 border-border/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1st Year</SelectItem>
                          <SelectItem value="2">2nd Year</SelectItem>
                          <SelectItem value="3">3rd Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Semester</Label>
                      <Select value={formData.semester.toString()} onValueChange={(v) => setFormData({ ...formData, semester: parseInt(v) })}>
                        <SelectTrigger className="bg-white/5 border-border/50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6].map((s) => (
                            <SelectItem key={s} value={s.toString()}>Sem {s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Weekly Lectures</Label>
                      <Input
                        type="number"
                        value={formData.weekly_lectures}
                        onChange={(e) => setFormData({ ...formData, weekly_lectures: parseInt(e.target.value) || 0 })}
                        className="bg-white/5 border-border/50"
                      />
                    </div>
                  </div>
                  <Button onClick={handleSubmit} className="w-full btn-gradient">
                    {editingSubject ? 'Update Subject' : 'Create Subject'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white/5 border-border/50"
            />
          </div>
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-white/5 border-border/50">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              <SelectItem value="1">1st Year</SelectItem>
              <SelectItem value="2">2nd Year</SelectItem>
              <SelectItem value="3">3rd Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={columns}
          data={filteredSubjects}
          keyExtractor={(s) => s.id}
          isLoading={loading}
          emptyMessage="No subjects found"
        />

        {/* Syllabus Management Dialog */}
        <Dialog open={syllabusDialogOpen} onOpenChange={setSyllabusDialogOpen}>
          <DialogContent className="glass-card border-border/50 max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-accent" />
                Syllabus: {selectedSubject?.name}
                <span className="text-sm text-muted-foreground font-normal">({selectedSubject?.subject_code})</span>
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto mt-4 space-y-3">
              {loadingTopics ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-muted/20 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                [1, 2, 3, 4, 5].map(unitNo => {
                  const unitTopics = getTopicsByUnit(unitNo);
                  const isExpanded = expandedUnits.has(unitNo);

                  return (
                    <div key={unitNo} className="border border-border/30 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleUnit(unitNo)}
                        className="w-full p-3 flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
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
                            setAddingTopicFor(unitNo);
                            setNewTopicText('');
                          }}
                          className="h-7 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Add Topic
                        </Button>
                      </button>

                      {isExpanded && (
                        <div className="p-3 space-y-2 bg-black/10">
                          {/* Add topic form */}
                          {addingTopicFor === unitNo && (
                            <div className="p-3 bg-accent/10 rounded-lg border border-accent/30">
                              <Textarea
                                value={newTopicText}
                                onChange={(e) => setNewTopicText(e.target.value)}
                                placeholder="Enter topic text (no character limit)..."
                                className="bg-white/5 border-border/50 min-h-[80px] text-sm"
                                autoFocus
                              />
                              <div className="flex gap-2 mt-2">
                                <Button size="sm" onClick={handleAddTopic} className="btn-gradient">
                                  <Check className="w-4 h-4 mr-1" />
                                  Add
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setAddingTopicFor(null)}>
                                  <X className="w-4 h-4 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}

                          {unitTopics.length === 0 && addingTopicFor !== unitNo ? (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No topics in this unit yet
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
                                      className="bg-white/5 border-border/50 min-h-[60px] text-sm"
                                      autoFocus
                                    />
                                    <div className="flex gap-2 mt-2">
                                      <Button size="sm" onClick={handleUpdateTopic}>
                                        <Check className="w-3 h-3 mr-1" />
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
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteTopic(topic.id)}
                                        className="h-7 w-7 p-0 text-danger hover:text-danger"
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
                })
              )}
            </div>

            <div className="pt-4 border-t border-border/30 mt-4">
              <p className="text-sm text-muted-foreground text-center">
                📚 Total: {topics.length} topic{topics.length !== 1 ? 's' : ''} across all units
              </p>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </PageShell>
  );
};

export default AdminSubjectsPage;

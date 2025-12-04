import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, BookOpen, Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getSubjectAllocations, type SubjectAllocation } from '@/services/allocations';
import { getSyllabusTopics, getSyllabusProgress, createSyllabusTopic, deleteSyllabusTopic, type SyllabusTopic } from '@/services/syllabus';

interface SubjectWithProgress extends SubjectAllocation {
  progress?: {
    totalTopics: number;
    coveredTopics: number;
    percentage: number;
    unitProgress: Record<number, { total: number; covered: number }>;
  };
  topics?: SyllabusTopic[];
}

const FacultySubjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [selectedSubjectForTopic, setSelectedSubjectForTopic] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({ unit_no: 1, topic_text: '' });

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
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const fetchSubjects = async (fId: string) => {
    try {
      const allocations = await getSubjectAllocations(fId);
      
      // Fetch progress and topics for each subject
      const subjectsWithProgress = await Promise.all(
        allocations.map(async (alloc) => {
          const [progress, topics] = await Promise.all([
            getSyllabusProgress(alloc.subject_id),
            getSyllabusTopics(alloc.subject_id),
          ]);
          return { ...alloc, progress, topics };
        })
      );
      
      setSubjects(subjectsWithProgress);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  const handleAddTopic = async () => {
    if (!selectedSubjectForTopic || !newTopic.topic_text.trim()) return;

    try {
      await createSyllabusTopic({
        subject_id: selectedSubjectForTopic,
        unit_no: newTopic.unit_no,
        topic_text: newTopic.topic_text,
      });
      toast({ title: 'Success', description: 'Topic added' });
      setIsAddTopicOpen(false);
      setNewTopic({ unit_no: 1, topic_text: '' });
      setSelectedSubjectForTopic(null);
      if (facultyId) fetchSubjects(facultyId);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add topic', variant: 'destructive' });
    }
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Delete this topic?')) return;

    try {
      await deleteSyllabusTopic(topicId);
      toast({ title: 'Success', description: 'Topic deleted' });
      if (facultyId) fetchSubjects(facultyId);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete topic', variant: 'destructive' });
    }
  };

  const openAddTopic = (subjectId: string) => {
    setSelectedSubjectForTopic(subjectId);
    setIsAddTopicOpen(true);
  };

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">My Subjects</h1>
          <p className="text-muted-foreground mt-1">Manage syllabus topics and track progress</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
                <div className="h-20 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No subjects assigned yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {subjects.map(subject => (
              <Collapsible
                key={subject.id}
                open={expandedSubject === subject.id}
                onOpenChange={(open) => setExpandedSubject(open ? subject.id : null)}
              >
                <div className="glass-card rounded-xl overflow-hidden">
                  <CollapsibleTrigger className="w-full p-6 text-left hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {expandedSubject === subject.id ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {subject.subjects?.name}
                            <span className="text-muted-foreground font-normal ml-2">
                              ({subject.subjects?.subject_code})
                            </span>
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {subject.classes?.name} {subject.classes?.division} • {subject.subjects?.type}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-primary">
                          {subject.progress?.percentage || 0}%
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {subject.progress?.coveredTopics || 0}/{subject.progress?.totalTopics || 0} topics
                        </p>
                      </div>
                    </div>
                    <Progress value={subject.progress?.percentage || 0} className="h-2 mt-4" />
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-6 pb-6 pt-2 border-t border-border/30">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-medium text-foreground">Syllabus Topics</h4>
                        <Button size="sm" onClick={() => openAddTopic(subject.subject_id)}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add Topic
                        </Button>
                      </div>

                      {(!subject.topics || subject.topics.length === 0) ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No topics defined yet
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {[1, 2, 3, 4, 5].map(unit => {
                            const unitTopics = subject.topics?.filter(t => t.unit_no === unit) || [];
                            if (unitTopics.length === 0) return null;

                            return (
                              <div key={unit}>
                                <h5 className="text-sm font-medium text-muted-foreground mb-2">
                                  Unit {unit}
                                </h5>
                                <div className="space-y-1">
                                  {unitTopics.map(topic => (
                                    <div
                                      key={topic.id}
                                      className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5"
                                    >
                                      <span className="text-sm text-foreground">{topic.topic_text}</span>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDeleteTopic(topic.id)}
                                        className="text-danger hover:text-danger h-8 w-8 p-0"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        )}

        {/* Add Topic Dialog */}
        <Dialog open={isAddTopicOpen} onOpenChange={setIsAddTopicOpen}>
          <DialogContent className="glass-card border-border/50">
            <DialogHeader>
              <DialogTitle>Add Syllabus Topic</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Unit</Label>
                <Select value={newTopic.unit_no.toString()} onValueChange={(v) => setNewTopic({ ...newTopic, unit_no: parseInt(v) })}>
                  <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(u => (
                      <SelectItem key={u} value={u.toString()}>Unit {u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Topic</Label>
                <Input
                  value={newTopic.topic_text}
                  onChange={(e) => setNewTopic({ ...newTopic, topic_text: e.target.value })}
                  placeholder="Enter topic description"
                  className="bg-white/5 border-border/50 mt-1"
                />
              </div>
              <Button onClick={handleAddTopic} className="w-full btn-gradient">
                Add Topic
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </PageShell>
  );
};

export default FacultySubjectsPage;

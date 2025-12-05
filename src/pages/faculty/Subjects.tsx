import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, ChevronDown, ChevronRight, CheckCircle } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getSubjectAllocations, type SubjectAllocation } from '@/services/allocations';
import {
  getTopicsWithCoverage,
  getSyllabusProgress,
  type SyllabusTopic
} from '@/services/syllabus';

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
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());

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

      const subjectsWithProgress = await Promise.all(
        allocations.map(async (alloc) => {
          const [progress, topics] = await Promise.all([
            getSyllabusProgress(alloc.subject_id),
            getTopicsWithCoverage(alloc.subject_id),
          ]);
          return { ...alloc, progress, topics };
        })
      );

      setSubjects(subjectsWithProgress);
    } catch (error) {
      console.error('Error fetching subjects:', error);
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

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">My Subjects</h1>
          <p className="text-muted-foreground mt-1">View syllabus and track coverage progress</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
                <div className="h-24 bg-muted rounded"></div>
              </div>
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground mb-2">No Subjects Assigned</p>
            <p className="text-muted-foreground">Contact admin to assign subjects to you</p>
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
                          <p className="text-sm text-muted-foreground">
                            {subject.classes?.name} {subject.classes?.division} • {subject.subjects?.type === 'TH' ? 'Theory' : 'Practical'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-accent">
                          {subject.progress?.percentage || 0}%
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {subject.progress?.coveredTopics || 0}/{subject.progress?.totalTopics || 0} topics covered
                        </p>
                      </div>
                    </div>
                    <Progress value={subject.progress?.percentage || 0} className="h-2 mt-4" />
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="px-6 pb-6 pt-2 border-t border-border/30">
                      <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Syllabus Topics by Unit
                      </h4>

                      {subject.progress?.totalTopics === 0 ? (
                        <div className="text-center py-6 text-muted-foreground">
                          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>No syllabus defined for this subject yet.</p>
                          <p className="text-sm mt-1">Contact admin to add syllabus topics.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {[1, 2, 3, 4, 5].map(unitNo => {
                            const unitTopics = subject.topics?.filter(t => t.unit_no === unitNo) || [];
                            const unitKey = `${subject.id}-${unitNo}`;
                            const isUnitExpanded = expandedUnits.has(unitKey);
                            const unitProgress = subject.progress?.unitProgress[unitNo];

                            if (unitTopics.length === 0) return null;

                            return (
                              <div key={unitNo} className="border border-border/30 rounded-lg overflow-hidden">
                                <button
                                  onClick={() => toggleUnit(subject.id, unitNo)}
                                  className="w-full p-3 flex items-center justify-between hover:bg-white/5 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    {isUnitExpanded ? (
                                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <span className="font-medium text-foreground">Unit {unitNo}</span>
                                    <span className="text-xs text-muted-foreground">
                                      ({unitProgress?.covered || 0}/{unitProgress?.total || 0} covered)
                                    </span>
                                  </div>
                                  {unitProgress?.covered === unitProgress?.total && unitProgress?.total > 0 && (
                                    <CheckCircle className="w-4 h-4 text-success" />
                                  )}
                                </button>

                                {isUnitExpanded && (
                                  <div className="px-3 pb-3 space-y-1">
                                    {unitTopics.map((topic, idx) => (
                                      <div key={topic.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-white/5">
                                        <span className="text-xs text-muted-foreground w-5 pt-0.5">{idx + 1}.</span>
                                        <p className="flex-1 text-sm text-foreground whitespace-pre-wrap">{topic.topic_text}</p>
                                        {topic.covered_count && topic.covered_count > 0 && (
                                          <span className="text-xs bg-success/20 text-success px-1.5 py-0.5 rounded shrink-0">
                                            ✓ {topic.covered_count}x
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
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
      </motion.div>
    </PageShell>
  );
};

export default FacultySubjectsPage;

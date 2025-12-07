import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, BookOpen, ArrowLeft } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { getClasses, type Class } from '@/services/classes';
import { getSubjects, type Subject } from '@/services/subjects';
import { getSyllabusProgress, getSyllabusTopics } from '@/services/syllabus';

interface UnitProgress {
  total: number;
  covered: number;
}

const SubjectProgressCard = ({ subject, onClick }: { subject: Subject, onClick: () => void }) => {
  const [progress, setProgress] = useState<{ percentage: number; coveredTopics: number; totalTopics: number } | null>(null);

  useEffect(() => {
    getSyllabusProgress(subject.id).then(p => setProgress(p)).catch(console.error);
  }, [subject.id]);

  if (!progress) return <div className="glass-card p-6 animate-pulse h-32 rounded-xl"></div>;

  return (
    <div onClick={onClick} className="glass-card p-6 cursor-pointer hover:border-primary/50 transition-all hover:scale-[1.02] rounded-xl">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{subject.name}</h3>
          <p className="text-xs text-muted-foreground">{subject.subject_code}</p>
        </div>
        <span className={`text-lg font-bold ${progress.percentage >= 75 ? 'text-green-500' : progress.percentage >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
          {progress.percentage}%
        </span>
      </div>
      <Progress value={progress.percentage} className="h-2 mb-2" />
      <p className="text-xs text-muted-foreground text-right">
        {progress.coveredTopics}/{progress.totalTopics} topics
      </p>
    </div>
  );
};

const AdminSyllabusProgressPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [progress, setProgress] = useState<{
    totalTopics: number;
    coveredTopics: number;
    percentage: number;
    unitProgress: Record<number, UnitProgress>;
  } | null>(null);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [classData, subjectData] = await Promise.all([
          getClasses(),
          getSubjects(),
        ]);
        setClasses(classData);
        setSubjects(subjectData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  useEffect(() => {
    async function fetchProgress() {
      if (!selectedSubject) {
        setProgress(null);
        return;
      }

      try {
        const progressData = await getSyllabusProgress(selectedSubject);
        setProgress(progressData);
      } catch (error) {
        console.error('Error fetching progress:', error);
        toast({ title: 'Error', description: 'Failed to load syllabus progress', variant: 'destructive' });
      }
    }
    fetchProgress();
  }, [selectedSubject]);

  const filteredSubjects = classFilter && classFilter !== 'all'
    ? subjects.filter(s => {
      const classData = classes.find(c => c.id === classFilter);
      if (!classData) return true;
      // Match by semester AND year to be precise
      return String(s.semester) === String(classData.semester) && String(s.year) === String(classData.year);
    })
    : subjects;

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Syllabus Progress</h1>
            <p className="text-muted-foreground mt-1">Track syllabus completion across classes and subjects</p>
          </div>
          {selectedSubject && (
            <Button variant="ghost" onClick={() => setSelectedSubject('')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to All
            </Button>
          )}
        </div>

        {/* Filters */}
        {!selectedSubject && (
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-white/5 border-border/50">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Progress Display */}
        {loading ? (
          <div className="glass-card rounded-xl p-8 animate-pulse">
            <div className="h-32 bg-muted rounded"></div>
          </div>
        ) : !selectedSubject ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSubjects.length > 0 ? (
              filteredSubjects.map(s => (
                <SubjectProgressCard key={s.id} subject={s} onClick={() => setSelectedSubject(s.id)} />
              ))
            ) : (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No subjects found for the selected filter.
              </div>
            )}
          </div>
        ) : !progress || progress.totalTopics === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No syllabus topics defined for this subject</p>
            <p className="text-xs text-muted-foreground mt-2">Add topics in the Subjects section</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overall Progress */}
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">Overall Completion</h2>
                <span className="text-2xl font-bold text-primary">{progress.percentage}%</span>
              </div>
              <Progress value={progress.percentage} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {progress.coveredTopics} of {progress.totalTopics} topics covered
              </p>
            </div>

            {/* Unit-wise Progress */}
            <div className="glass-card rounded-xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">Unit-wise Progress</h2>
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map(unit => {
                  const unitData = progress.unitProgress[unit];
                  if (!unitData || unitData.total === 0) return null;

                  const unitPercentage = Math.round((unitData.covered / unitData.total) * 100);

                  return (
                    <div key={unit} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">Unit {unit}</span>
                        <span className="text-sm text-muted-foreground">
                          {unitData.covered}/{unitData.total} topics ({unitPercentage}%)
                        </span>
                      </div>
                      <Progress value={unitPercentage} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </PageShell>
  );
};

export default AdminSyllabusProgressPage;

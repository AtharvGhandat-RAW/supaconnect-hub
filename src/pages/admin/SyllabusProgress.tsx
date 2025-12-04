import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, BookOpen } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { getClasses, type Class } from '@/services/classes';
import { getSubjects, type Subject } from '@/services/subjects';
import { getSyllabusProgress, getSyllabusTopics } from '@/services/syllabus';

interface UnitProgress {
  total: number;
  covered: number;
}

const AdminSyllabusProgressPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('');
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

  const filteredSubjects = classFilter
    ? subjects.filter(s => {
        const classData = classes.find(c => c.id === classFilter);
        return classData && s.semester === classData.semester;
      })
    : subjects;

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Syllabus Progress</h1>
          <p className="text-muted-foreground mt-1">Track syllabus completion across classes and subjects</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-white/5 border-border/50">
              <SelectValue placeholder="Select Class" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedSubject} onValueChange={setSelectedSubject}>
            <SelectTrigger className="w-full sm:w-64 bg-white/5 border-border/50">
              <SelectValue placeholder="Select Subject" />
            </SelectTrigger>
            <SelectContent>
              {filteredSubjects.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.subject_code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Progress Display */}
        {loading ? (
          <div className="glass-card rounded-xl p-8 animate-pulse">
            <div className="h-32 bg-muted rounded"></div>
          </div>
        ) : !selectedSubject ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Select a class and subject to view syllabus progress</p>
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
                {[1, 2, 3, 4, 5].map(unit => {
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

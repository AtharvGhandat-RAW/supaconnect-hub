import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { getSubjectAllocations, type SubjectAllocation } from '@/services/allocations';

const FacultySubjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [facultyId, setFacultyId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectAllocation[]>([]);
  const [loading, setLoading] = useState(true);

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
      setSubjects(allocations);
    } catch (error) {
      console.error('Error fetching subjects:', error);
    }
  };

  return (
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">My Subjects</h1>
          <p className="text-muted-foreground mt-1">View your assigned subjects</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : subjects.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">No subjects assigned</h3>
            <p className="text-muted-foreground mt-2">You haven't been assigned any subjects yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjects.map((alloc) => (
              <motion.div
                key={alloc.id}
                className="glass-card p-6 hover:shadow-lg transition-all"
                whileHover={{ y: -2 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium px-2 py-1 rounded-full bg-secondary/10 text-secondary-foreground border border-secondary/20">
                    {alloc.subjects?.type}
                  </span>
                </div>
                
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {alloc.subjects?.name}
                </h3>
                <p className="text-sm font-mono text-muted-foreground mb-4">
                  {alloc.subjects?.subject_code}
                </p>

                <div className="space-y-2 pt-4 border-t border-border/50">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Class</span>
                    <span className="font-medium text-foreground">
                      {alloc.classes?.name} {alloc.classes?.division}
                    </span>
                  </div>
                  {alloc.batches && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Batch</span>
                      <span className="font-medium text-foreground">
                        {alloc.batches.name}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Semester</span>
                    <span className="font-medium text-foreground">{alloc.subjects?.semester}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </PageShell>
  );
};

export default FacultySubjectsPage;

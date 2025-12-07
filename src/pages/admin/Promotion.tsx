import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Download, FileText, Users } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { getClasses, type Class } from '@/services/classes';
import { getStudentsForPromotion, executePromotion, type PromotionStudent } from '@/services/promotion';
import { downloadCSV, generatePDFContent, printPDF } from '@/utils/export';
import ritLogo from '@/assets/rit-logo.jpg';

const AdminPromotionPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<PromotionStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [sourceClass, setSourceClass] = useState('');
  const [targetClass, setTargetClass] = useState('');
  const [step, setStep] = useState<'select' | 'review' | 'complete'>('select');

  useEffect(() => {
    async function fetchClasses() {
      try {
        const data = await getClasses();
        setClasses(data);
      } catch (error) {
        console.error('Error fetching classes:', error);
      } finally {
        setInitialLoading(false);
      }
    }
    fetchClasses();
  }, []);

  const handleLoadStudents = async () => {
    if (!sourceClass) {
      toast({ title: 'Error', description: 'Please select source class', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const data = await getStudentsForPromotion(sourceClass);
      setStudents(data);
      setStep('review');
    } catch (error) {
      console.error('Error loading students:', error);
      toast({ title: 'Error', description: 'Failed to load students', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAction = (studentId: string, action: 'PROMOTE' | 'YD') => {
    setStudents(prev =>
      prev.map(s => s.id === studentId ? { ...s, action } : s)
    );
  };

  const handleRollChange = (studentId: string, newRoll: number) => {
    setStudents(prev =>
      prev.map(s => s.id === studentId ? { ...s, newRollNo: newRoll } : s)
    );
  };

  const handleExecutePromotion = async () => {
    if (!targetClass) {
      toast({ title: 'Error', description: 'Please select target class', variant: 'destructive' });
      return;
    }

    let targetSemester = 0;
    if (targetClass !== 'COMPLETED') {
      const targetClassData = classes.find(c => c.id === targetClass);
      if (!targetClassData) return;
      targetSemester = targetClassData.semester;
    }

    setLoading(true);
    try {
      const result = await executePromotion(students, targetClass, targetSemester);
      toast({
        title: 'Success',
        description: `${result.promoted} students promoted, ${result.yearDown} marked YD`,
      });
      setStep('complete');
    } catch (error) {
      console.error('Error executing promotion:', error);
      toast({ title: 'Error', description: 'Failed to execute promotion', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportRollList = (format: 'csv' | 'pdf') => {
    const promoteStudents = students.filter(s => s.action === 'PROMOTE');

    if (format === 'csv') {
      downloadCSV(promoteStudents, 'roll_list', [
        { key: 'newRollNo', header: 'Roll No' },
        { key: 'enrollment_no', header: 'Enrollment' },
        { key: 'name', header: 'Name' },
        { key: 'mobile', header: 'Mobile' },
      ]);
    } else {
      const targetClassData = classes.find(c => c.id === targetClass);
      const htmlContent = generatePDFContent({
        title: 'Roll List',
        subtitle: `Class: ${targetClassData?.name || ''} ${targetClassData?.division || ''}`,
        logoSrc: ritLogo,
        headers: ['Roll No', 'Enrollment', 'Name', 'Mobile'],
        rows: promoteStudents.map(s => [
          s.newRollNo?.toString() || '-',
          s.enrollment_no || '-',
          s.name,
          s.mobile || '-',
        ]),
      });
      printPDF(htmlContent);
    }
    toast({ title: 'Success', description: `${format.toUpperCase()} exported` });
  };

  const sourceClassData = classes.find(c => c.id === sourceClass);

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Promotion</h1>
          <p className="text-muted-foreground mt-1">Promote students or mark Year Down (YD)</p>
        </div>

        {step === 'select' && (
          <div className="glass-card rounded-xl p-6 max-w-xl">
            <h2 className="text-lg font-semibold text-foreground mb-4">Step 1: Select Source Class</h2>
            <div className="space-y-4">
              <div>
                <Label>Source Class</Label>
                <Select value={sourceClass} onValueChange={setSourceClass}>
                  <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                    <SelectValue placeholder="Select class to promote from" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} {c.division} (Sem {c.semester})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleLoadStudents} disabled={loading || !sourceClass} className="btn-gradient">
                {loading ? 'Loading...' : 'Load Students'}
              </Button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="glass-card rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold text-foreground">
                  Step 2: Review & Assign ({students.length} students)
                </h2>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Target:</span>
                    <Select value={targetClass} onValueChange={setTargetClass}>
                      <SelectTrigger className="w-48 bg-white/5 border-border/50">
                        <SelectValue placeholder="Select target class" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes
                          .filter(c => sourceClassData && c.semester > sourceClassData.semester)
                          .map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name} {c.division} (Sem {c.semester})</SelectItem>
                          ))}
                        <SelectItem value="COMPLETED" className="text-green-500 font-medium">Completed Diploma</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">Old Roll</th>
                      <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">Name</th>
                      <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">New Roll</th>
                      <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">Action</th>
                      <th className="text-left py-2 px-3 text-sm font-semibold text-muted-foreground">Suggestion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => (
                      <tr key={student.id} className="border-b border-border/30">
                        <td className="py-2 px-3">{student.roll_no || '-'}</td>
                        <td className="py-2 px-3 font-medium">{student.name}</td>
                        <td className="py-2 px-3">
                          <Input
                            type="number"
                            value={student.newRollNo || ''}
                            onChange={(e) => handleRollChange(student.id, parseInt(e.target.value))}
                            className="w-20 bg-white/5 border-border/50"
                            disabled={student.action === 'YD'}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={student.action === 'PROMOTE' ? 'default' : 'outline'}
                              onClick={() => handleToggleAction(student.id, 'PROMOTE')}
                              className={student.action === 'PROMOTE' ? 'bg-success text-white' : ''}
                            >
                              Promote
                            </Button>
                            <Button
                              size="sm"
                              variant={student.action === 'YD' ? 'default' : 'outline'}
                              onClick={() => handleToggleAction(student.id, 'YD')}
                              className={student.action === 'YD' ? 'bg-warning text-white' : ''}
                            >
                              YD
                            </Button>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          {student.suggestion && (
                            <StatusBadge variant="warning">{student.suggestion}</StatusBadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
                <Button onClick={handleExecutePromotion} disabled={loading || !targetClass} className="btn-gradient">
                  {loading ? 'Processing...' : 'Execute Promotion'}
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'complete' && (
          <div className="glass-card rounded-xl p-8 text-center max-w-md mx-auto">
            <Users className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Promotion Complete!</h2>
            <p className="text-muted-foreground mb-6">
              {students.filter(s => s.action === 'PROMOTE').length} students promoted,{' '}
              {students.filter(s => s.action === 'YD').length} marked as Year Down
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => handleExportRollList('csv')}>
                <Download className="w-4 h-4 mr-2" />
                CSV
              </Button>
              <Button variant="outline" onClick={() => handleExportRollList('pdf')}>
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </Button>
            </div>
            <Button
              className="mt-4"
              variant="ghost"
              onClick={() => {
                setStep('select');
                setStudents([]);
                setSourceClass('');
                setTargetClass('');
              }}
            >
              Start New Promotion
            </Button>
          </div>
        )}
      </motion.div>
    </PageShell>
  );
};

export default AdminPromotionPage;

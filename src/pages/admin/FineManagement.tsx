import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Calendar, Search, Book, DollarSign } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { getClasses } from '@/services/classes';
import { toast } from '@/hooks/use-toast';
import { downloadCSV, generatePDFContent, printPDF } from '@/utils/export';
import ReportPreviewDialog from '@/components/ReportPreviewDialog';

const AdminFineManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [finePerDay, setFinePerDay] = useState<number>(100);
  const [bookName, setBookName] = useState<string>('');
  const [defaulters, setDefaulters] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');
  
  // Filters
  const [classFilter, setClassFilter] = useState('all');

  useEffect(() => {
    async function loadClasses() {
      const data = await getClasses();
      setClasses(data);
    }
    loadClasses();
  }, []);

  const generateFineList = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      
      // 1. Get dates range
      const startDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      // 2. Fetch Sessions in this month
      let sessionQuery = supabase
        .from('attendance_sessions')
        .select('id, date, class_id')
        .gte('date', startDate)
        .lte('date', endDate);

      if (classFilter !== 'all') {
        sessionQuery = sessionQuery.eq('class_id', classFilter);
      }

      const { data: sessions, error: sessionError } = await sessionQuery;
      if (sessionError) throw sessionError;
      if (!sessions.length) {
        setDefaulters([]);
        toast({ title: 'No Data', description: 'No attendance sessions found for this month.' });
        setLoading(false);
        return;
      }

      const sessionIds = sessions.map(s => s.id);
      
      // 3. Fetch Records
      const { data: records, error: recordError } = await supabase
        .from('attendance_records')
        .select(`
          status,
          session_id,
          student:students (id, name, roll_no, enrollment_no, class_id)
        `)
        .in('session_id', sessionIds);

      if (recordError) throw recordError;

      // 4. Process Logic: Group by Student -> Group by Date
      const studentMap = new Map();

      records.forEach((record: any) => {
        if (!record.student) return;
        const studentId = record.student.id;
        const session = sessions.find(s => s.id === record.session_id);
        if (!session) return;
        
        const date = session.date;

        if (!studentMap.has(studentId)) {
          studentMap.set(studentId, {
            ...record.student,
            dates: new Map() // Date -> [statuses]
          });
        }

        const studentData = studentMap.get(studentId);
        if (!studentData.dates.has(date)) {
          studentData.dates.set(date, []);
        }
        studentData.dates.get(date).push(record.status);
      });

      // 5. Calculate Absent Days (> 3)
        const result: any[] = [];
        
        studentMap.forEach((data, studentId) => {
            let absentDaysCount = 0;
            
            data.dates.forEach((statuses: string[], date: string) => {
                // Logic: A student is "Absent for the day" if they were marked ABSENT in ALL sessions recorded for them that day
                // AND there was at least one session. 
                // We ignore 'LATE' or others for strict absence? Let's treat ABSENT as strict.
                const totalSessions = statuses.length;
                const absentSessions = statuses.filter(s => s === 'ABSENT').length;
                
                if (totalSessions > 0 && absentSessions === totalSessions) {
                    absentDaysCount++;
                }
            });

            if (absentDaysCount > 3) {
                const className = classes.find(c => c.id === data.class_id)?.name || 'Unknown';
                const division = classes.find(c => c.id === data.class_id)?.division || '';
                
                result.push({
                    id: data.id,
                    name: data.name,
                    roll_no: data.roll_no,
                    class_name: `${className} ${division}`,
                    absent_days: absentDaysCount,
                    fine_amount: absentDaysCount * finePerDay
                });
            }
        });

        // Add class grouping sorting
        result.sort((a, b) => b.absent_days - a.absent_days);
        setDefaulters(result);
        
        if (result.length > 0) {
            toast({ title: 'Generated', description: `Found ${result.length} students with > 3 absent days.` });
        } else {
            toast({ title: 'Clean Record', description: 'No students found with more than 3 absent days.' });
        }

    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to generate list', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (defaulters.length === 0) return;
    
    // Create HTML for PDF
    const title = bookName || `Fine Register - ${selectedMonth}`;
    const columns = ['Roll No', 'Name', 'Class', 'Days Absent', 'Fine Amount'];
    const rows = defaulters.map(d => [
        d.roll_no,
        d.name,
        d.class_name,
        d.absent_days,
        `Rs. ${d.fine_amount}`
    ]);
    
    // Simple table generator
    const content = `
        <div style="font-family: sans-serif; padding: 20px;">
            <h1 style="text-align:center; color: #333;">${title}</h1>
            <p style="text-align:center; color: #666;">Generated on ${new Date().toLocaleDateString()}</p>
            <p style="text-align:center; color: #666;">Criteria: More than 3 Days Absent in ${selectedMonth}</p>
            <br/>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #ccc;">
                <thead style="background-color: #f0f0f0;">
                    <tr>
                        ${columns.map(c => `<th style="border: 1px solid #ccc; padding: 10px; text-align: left;">${c}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr>
                            ${row.map(cell => `<td style="border: 1px solid #ccc; padding: 10px;">${cell}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div style="margin-top: 30px; text-align: right;">
                <p><strong>Total Fine Collection:</strong> Rs. ${defaulters.reduce((sum, d) => sum + d.fine_amount, 0)}</p>
            </div>
        </div>
    `;
    
    setPreviewContent(content);
    setPreviewTitle(bookName || `Fine-Report-${selectedMonth}`);
    setShowPreview(true);
  };

  const columns = [
    { key: 'roll_no', header: 'Roll No', render: (d: any) => <span className="font-mono">{d.roll_no || '-'}</span> },
    { key: 'name', header: 'Student Name' },
    { key: 'class_name', header: 'Class' },
    { 
        key: 'absent_days', 
        header: 'Total Absent Days',
        render: (d: any) => <span className="font-bold text-destructive">{d.absent_days} Days</span>
    },
    { 
        key: 'fine_amount', 
        header: 'Fine Amount',
        render: (d: any) => <span className="font-bold text-green-600">Rs. {d.fine_amount}</span>
    }
  ];

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold font-display">Fine Management Register</h1>
                <p className="text-muted-foreground">Track habitual absentees (Subject to Departmental Policy)</p>
            </div>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                    <Label>Select Month</Label>
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            type="month" 
                            className="pl-10"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                        />
                    </div>
                </div>
                <div>
                   <Label>Filter Class</Label>
                   <Select value={classFilter} onValueChange={setClassFilter}>
                      <SelectTrigger>
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
                <div>
                    <Label>Fine Per Day (Rs.)</Label>
                    <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            type="number" 
                            className="pl-10"
                            value={finePerDay}
                            onChange={(e) => setFinePerDay(Number(e.target.value))}
                            min={0}
                        />
                    </div>
                </div>
                <Button onClick={generateFineList} disabled={loading} className="btn-gradient">
                    {loading ? 'Processing...' : 'Generate List'}
                </Button>
            </div>
            
            {defaulters.length > 0 && (
                <div className="pt-4 border-t border-border/50 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex justify-between items-center mb-4">
                        <div className="space-y-1 w-full sm:w-auto">
                             <Label>Book Name / Report Title</Label>
                             <div className="flex flex-col sm:flex-row gap-2">
                                <Input 
                                    placeholder={`Report-${selectedMonth}`}
                                    value={bookName}
                                    onChange={(e) => setBookName(e.target.value)}
                                    className="w-full sm:w-64"
                                />
                                <Button variant="outline" onClick={handleExportPDF} className="w-full sm:w-auto">
                                    <Download className="w-4 h-4 mr-2" />
                                    Export Book
                                </Button>
                             </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Students</p>
                            <p className="text-2xl font-bold">{defaulters.length}</p>
                        </div>
                    </div>
                    
                    <DataTable 
                        columns={columns}
                        data={defaulters}
                        keyExtractor={(d) => d.id}
                        emptyMessage="No students found matching criteria."
                    />
                </div>
            )}
        </div>
        <ReportPreviewDialog 
            open={showPreview} 
            onOpenChange={setShowPreview} 
            title={previewTitle} 
            htmlContent={previewContent} 
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminFineManagement;

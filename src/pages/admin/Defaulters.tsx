import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Download, FileText } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getClasses, type Class } from '@/services/classes';
import { computeDefaulters, type DefaulterStudent } from '@/services/defaulters';
import { getSettings } from '@/services/settings';
import { downloadCSV, generatePDFContent, printPDF } from '@/utils/export';
import ritLogo from '@/assets/rit-logo.jpg';

const AdminDefaultersPage: React.FC = () => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [defaulters, setDefaulters] = useState<DefaulterStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [threshold, setThreshold] = useState(75);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [classData, settings] = await Promise.all([
          getClasses(),
          getSettings(),
        ]);
        setClasses(classData);
        if (settings?.defaulter_threshold) {
          setThreshold(settings.defaulter_threshold);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setInitialLoading(false);
      }
    }
    fetchInitialData();
  }, []);

  const handleGenerate = async () => {
    if (!selectedClass) {
      toast({ title: 'Error', description: 'Please select a class', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const data = await computeDefaulters(selectedClass, dateFrom, dateTo, threshold);
      setDefaulters(data);
      if (data.length === 0) {
        toast({ title: 'No Defaulters', description: 'No students below the threshold' });
      }
    } catch (error) {
      console.error('Error computing defaulters:', error);
      toast({ title: 'Error', description: 'Failed to compute defaulters', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (defaulters.length === 0) return;
    
    downloadCSV(defaulters, `defaulters_${selectedClass}_${dateFrom}_${dateTo}`, [
      { key: 'roll_no', header: 'Roll No' },
      { key: 'name', header: 'Name' },
      { key: 'enrollment_no', header: 'Enrollment' },
      { key: 'totalLectures', header: 'Total Lectures' },
      { key: 'present', header: 'Present' },
      { key: 'absent', header: 'Absent' },
      { key: 'percentage', header: 'Attendance %' },
    ]);
    toast({ title: 'Success', description: 'CSV downloaded' });
  };

  const handleExportPDF = () => {
    if (defaulters.length === 0) return;

    const selectedClassData = classes.find(c => c.id === selectedClass);
    const className = selectedClassData ? `${selectedClassData.name} ${selectedClassData.division}` : '';

    const htmlContent = generatePDFContent({
      title: 'Defaulter List',
      subtitle: `Class: ${className} | Threshold: ${threshold}%`,
      date: `${dateFrom} to ${dateTo}`,
      logoSrc: ritLogo,
      headers: ['Roll No', 'Name', 'Enrollment', 'Total', 'Present', 'Absent', 'Attendance %'],
      rows: defaulters.map(d => [
        d.roll_no?.toString() || '-',
        d.name,
        d.enrollment_no || '-',
        d.totalLectures.toString(),
        d.present.toString(),
        d.absent.toString(),
        `${d.percentage}%`,
      ]),
      footer: `Students below ${threshold}% attendance threshold. Total: ${defaulters.length} students.`,
    });

    printPDF(htmlContent);
    toast({ title: 'Success', description: 'PDF generated' });
  };

  const columns = [
    { key: 'roll_no', header: 'Roll No', render: (d: DefaulterStudent) => d.roll_no || '-' },
    {
      key: 'name',
      header: 'Name',
      render: (d: DefaulterStudent) => (
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <span className="font-medium">{d.name}</span>
        </div>
      ),
    },
    { key: 'enrollment_no', header: 'Enrollment', render: (d: DefaulterStudent) => d.enrollment_no || '-' },
    { key: 'totalLectures', header: 'Total' },
    { key: 'present', header: 'Present' },
    { key: 'absent', header: 'Absent' },
    {
      key: 'percentage',
      header: 'Attendance %',
      render: (d: DefaulterStudent) => (
        <StatusBadge variant={d.percentage < 50 ? 'danger' : 'warning'}>
          {d.percentage}%
        </StatusBadge>
      ),
    },
  ];

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Defaulters</h1>
          <p className="text-muted-foreground mt-1">Generate list of students with low attendance</p>
        </div>

        {/* Filters */}
        <div className="glass-card rounded-xl p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label>Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="bg-white/5 border-border/50 mt-1">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.division}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-white/5 border-border/50 mt-1"
              />
            </div>
            <div>
              <Label>To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-white/5 border-border/50 mt-1"
              />
            </div>
            <div>
              <Label>Threshold %</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 75)}
                className="bg-white/5 border-border/50 mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleGenerate} disabled={loading || !selectedClass} className="w-full btn-gradient">
                {loading ? 'Generating...' : 'Generate'}
              </Button>
            </div>
          </div>
        </div>

        {/* Results */}
        {defaulters.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV} className="border-border/50">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={handleExportPDF} className="border-border/50">
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        )}

        <DataTable
          columns={columns}
          data={defaulters}
          keyExtractor={(d) => d.id}
          isLoading={loading}
          emptyMessage={selectedClass ? "No defaulters found" : "Select a class and generate the report"}
        />
      </motion.div>
    </PageShell>
  );
};

export default AdminDefaultersPage;

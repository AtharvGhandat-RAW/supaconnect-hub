import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save, Moon, Sun, Calendar, Archive, Lock, Unlock, CalendarPlus, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/useTheme';
import { getSettings, updateSettings, type Settings } from '@/services/settings';
import { getUpcomingHolidays } from '@/services/holidays';
import React, { useState, useEffect } from 'react';

// Use environment variable for the PIN, fallback to '1234' if not set
const ADMIN_MASTER_PIN = import.meta.env.VITE_ADMIN_MASTER_PIN || '1234';

const AdminSettingsPage: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const [settings, setSettings] = useState<Partial<Settings>>({
    current_academic_year: '2025-26',
    current_semester: 1,
    defaulter_threshold: 75,
    auto_substitution: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Data Access Mode State
  const [dataAccessMode, setDataAccessMode] = useState<'CURRENT' | 'ALL'>(() => {
    return (localStorage.getItem('admin_data_mode') as 'CURRENT' | 'ALL') || 'CURRENT';
  });
  const [isPinDialogOpen, setIsPinDialogOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // New Year State
  const [isNewYearDialogOpen, setIsNewYearDialogOpen] = useState(false);
  const [newAcademicYear, setNewAcademicYear] = useState('');

  useEffect(() => {
    async function fetchSettings() {
      try {
        const data = await getSettings();
        if (data) setSettings(data);
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(settings);
      toast({ title: 'Success', description: 'Settings saved successfully' });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDataAccessToggle = (enabled: boolean) => {
    if (enabled) {
        // User wants to enable ALL data -> Verify PIN
        setPendingAction(() => () => {
             setDataAccessMode('ALL');
             localStorage.setItem('admin_data_mode', 'ALL');
             toast({ title: 'Access Granted', description: 'You can now view data from all academic years.' });
        });
        setIsPinDialogOpen(true);
        setPinInput('');
        setPinError(false);
    } else {
        // User wants to revert to CURRENT data -> No Auth needed
        setDataAccessMode('CURRENT');
        localStorage.setItem('admin_data_mode', 'CURRENT');
        toast({ title: 'Data Mode Updated', description: 'Now viewing current academic year only.' });
    }
  };

  const handleStartNewYearClick = () => {
    // Determine next year suggestion
    const current = settings.current_academic_year || '2025-26';
    const parts = current.split('-');
    let suggestion = '';
    if (parts.length === 2) {
        const startYear = parseInt(parts[0]);
        if (!isNaN(startYear)) {
            suggestion = `${startYear + 1}-${(startYear + 2).toString().slice(-2)}`;
        }
    }
    setNewAcademicYear(suggestion);
    setIsNewYearDialogOpen(true);
  };

  const confirmStartNewYear = () => {
    if (!newAcademicYear) {
        toast({ title: 'Error', description: 'Academic Year cannot be empty', variant: 'destructive' });
        return;
    }
    
    setPendingAction(() => async () => {
        try {
            await updateSettings({ 
                current_academic_year: newAcademicYear,
                current_semester: 1 
            });
            setSettings(prev => ({ 
                ...prev, 
                current_academic_year: newAcademicYear,
                current_semester: 1 
            }));
            setIsNewYearDialogOpen(false);
            toast({ 
                title: 'New Academic Session Started', 
                description: `System is now operating in Academic Year ${newAcademicYear}. Semester reset to 1.` 
            });
        } catch (error) {
            console.error(error);
            toast({ title: 'Error', description: 'Failed to update academic year', variant: 'destructive' });
        }
    });
    
    // Close new year dialog and open PIN dialog
    setIsNewYearDialogOpen(false);
    setIsPinDialogOpen(true);
    setPinInput('');
    setPinError(false);
  };

  const verifyPin = () => {
      if (pinInput === ADMIN_MASTER_PIN) {
          setIsPinDialogOpen(false);
          if (pendingAction) {
              pendingAction();
              setPendingAction(null);
          }
      } else {
          setPinError(true);
          toast({ title: 'Access Denied', description: 'Incorrect PIN.', variant: 'destructive' });
      }
  };

  if (loading) {
    return (
      <PageShell role="admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading settings...</div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell role="admin">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">Configure system preferences</p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="btn-gradient">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Academic Settings */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary" />
                Academic Settings
                </h2>
                <Button variant="outline" size="sm" onClick={handleStartNewYearClick} className="text-primary hover:bg-primary/10 border-primary/20">
                    <CalendarPlus className="w-4 h-4 mr-2" />
                    Start New Session
                </Button>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Current Academic Year</Label>
                <div className="mt-1 relative">
                    <Input
                    value={settings.current_academic_year || ''}
                    readOnly
                    className="bg-white/5 border-border/50 pr-10"
                    />
                    <Lock className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">To change this, use 'Start New Session' above.</p>
              </div>
              <div>
                <Label>Current Semester</Label>
                <Input
                  type="number"
                  min={1}
                  max={6}
                  value={settings.current_semester || 1}
                  onChange={(e) => setSettings({ ...settings, current_semester: parseInt(e.target.value) || 1 })}
                  className="bg-white/5 border-border/50 mt-1"
                />
              </div>
            </div>
          </div>

          {/* Attendance Settings */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Attendance Settings</h2>
            <div className="space-y-4">
              <div>
                <Label>Defaulter Threshold (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.defaulter_threshold || 75}
                  onChange={(e) => setSettings({ ...settings, defaulter_threshold: parseInt(e.target.value) || 75 })}
                  className="bg-white/5 border-border/50 mt-1 max-w-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Students below this percentage will be flagged as defaulters
                </p>
              </div>
            </div>
          </div>

          {/* Historical Data Access (Protected) */}
          <div className={`glass-card rounded-xl p-6 border-l-4 ${dataAccessMode === 'ALL' ? 'border-l-primary' : 'border-l-muted'}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                             <Archive className="w-5 h-5 text-primary" />
                             Historical Data Archive
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Access data from previous academic years. Viewing archived data requires administrator authentication.
                        </p>
                    </div>
                    {dataAccessMode === 'ALL' ? (
                         <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold border border-primary/20 flex items-center gap-1">
                            <Unlock className="w-3 h-3" /> Unlocked
                         </div>
                    ) : (
                        <div className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-bold border border-border flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked
                         </div>
                    )}
                </div>
                
                <div className="flex items-center justify-between p-4 bg-background/50 rounded-lg border border-border/50">
                     <div className="space-y-1">
                        <Label className="text-base">View All Academic Years</Label>
                        <p className="text-xs text-muted-foreground">
                            {dataAccessMode === 'ALL' 
                                ? "You have access to all historical records." 
                                : "Currently showing only 'Current Academic Year' records across the platform."}
                        </p>
                     </div>
                     <Switch 
                        checked={dataAccessMode === 'ALL'}
                        onCheckedChange={handleDataAccessToggle}
                     />
                </div>
          </div>

          {/* Feature Toggles */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Features</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Dark Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    Toggle dark/light theme
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="w-4 h-4 text-muted-foreground" />
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                  <Moon className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto Substitution</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically assign substitute faculty for approved leaves
                  </p>
                </div>
                <Switch
                  checked={settings.auto_substitution || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, auto_substitution: checked })}
                />
              </div>
            </div>
          </div>
        </div>
        {/* New Year Dialog */}
        <Dialog open={isNewYearDialogOpen} onOpenChange={setIsNewYearDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-warning">
                        <CalendarPlus className="w-5 h-5" /> Start New Academic Session
                    </DialogTitle>
                    <DialogDescription>
                        This will update the system to a new academic year. Existing data will be preserved under the previous year's label.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 flex gap-3 items-start">
                        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="font-semibold text-warning-foreground">Important</p>
                            <p className="text-muted-foreground">Ensure that you have completed all student promotions and finalized reports for {settings.current_academic_year} before proceeding.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>New Academic Year Label</Label>
                        <Input 
                            value={newAcademicYear}
                            onChange={(e) => setNewAcademicYear(e.target.value)}
                            placeholder="e.g. 2026-27"
                            className="font-mono text-lg"
                        />
                        <p className="text-xs text-muted-foreground">This label will be applied to all new attendance and subject allocation records.</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsNewYearDialogOpen(false)}>Cancel</Button>
                    <Button onClick={confirmStartNewYear} className="btn-gradient">Continue to Authentication</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        {/* PIN Verification Dialog */}
        <Dialog open={isPinDialogOpen} onOpenChange={(open) => {
            if (!open) setPinInput(''); // Clear on close
            setIsPinDialogOpen(open);
        }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-center">Authentication Required</DialogTitle>
                    <DialogDescription className="text-center">
                        Enter Admin PIN to access historical data archives.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-6 flex flex-col items-center gap-4">
                    <div className="bg-muted/30 p-4 rounded-full">
                        <Lock className="w-8 h-8 text-primary" />
                    </div>
                    <Input 
                        type="password" 
                        className={`text-center tracking-[0.5em] font-mono font-bold text-lg h-12 ${pinError ? 'border-destructive ring-destructive/30' : ''}`}
                        placeholder="••••" 
                        maxLength={4}
                        value={pinInput}
                        onChange={(e) => {
                            setPinInput(e.target.value);
                            setPinError(false);
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
                        autoFocus
                    />
                    {pinError && <p className="text-destructive text-xs font-medium">Incorrect PIN. Please try again.</p>}
                </div>
                <DialogFooter className="sm:justify-center gap-2 w-full">
                    <Button variant="ghost" onClick={() => setIsPinDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                    <Button onClick={verifyPin} className="w-full sm:w-auto btn-gradient">Verify PIN</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </motion.div>
    </PageShell>
  );
};

export default AdminSettingsPage;

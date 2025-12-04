import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { getSettings, updateSettings, type Settings } from '@/services/settings';

const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Partial<Settings>>({
    current_academic_year: '2025-26',
    current_semester: 1,
    defaulter_threshold: 75,
    auto_substitution: true,
    ai_suggestion: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-primary" />
              Academic Settings
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Current Academic Year</Label>
                <Input
                  value={settings.current_academic_year || ''}
                  onChange={(e) => setSettings({ ...settings, current_academic_year: e.target.value })}
                  placeholder="2025-26"
                  className="bg-white/5 border-border/50 mt-1"
                />
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

          {/* Feature Toggles */}
          <div className="glass-card rounded-xl p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Features</h2>
            <div className="space-y-4">
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
              <div className="flex items-center justify-between">
                <div>
                  <Label>AI Suggestions</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable AI-powered insights and suggestions
                  </p>
                </div>
                <Switch
                  checked={settings.ai_suggestion || false}
                  onCheckedChange={(checked) => setSettings({ ...settings, ai_suggestion: checked })}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </PageShell>
  );
};

export default AdminSettingsPage;

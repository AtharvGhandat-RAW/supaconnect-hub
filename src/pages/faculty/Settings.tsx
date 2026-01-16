import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Building2, Lock, Moon, Sun, Globe, LogOut, Save, Eye, EyeOff, Bell, Shield } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { MFAEnrollment } from '@/components/auth/MFAEnrollment';
import { MFAService } from '@/services/mfa';
import { Firewall } from '@/utils/firewall';

const PREFS_KEY = 'faculty_preferences';

interface Preferences {
  language: 'en' | 'mr';
  email_notifications: boolean;
  sms_notifications: boolean;
  two_factor_auth: boolean;
  login_alerts: boolean;
}

const FacultySettingsPage: React.FC = () => {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ name: string; department: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password change state
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // MFA State
  const [showMFAEnrollment, setShowMFAEnrollment] = useState(false);

  // Preferences
  const [preferences, setPreferences] = useState<Preferences>({
    language: 'en',
    email_notifications: true,
    sms_notifications: false,
    two_factor_auth: false,
    login_alerts: true,
  });

  useEffect(() => {
    // Check actual MFA status on load
    MFAService.listFactors().then(factors => {
        const isEnabled = factors && factors.length > 0;
        setPreferences(p => ({ ...p, two_factor_auth: isEnabled }));
    }).catch(console.error);

    // Load preferences from localStorage
    const stored = localStorage.getItem(PREFS_KEY);
    if (stored) {
      try {
        setPreferences({
             ...preferences, // merge with defaults in case of new keys
             ...JSON.parse(stored)
        });
      } catch (e) {
        console.error('Error parsing preferences:', e);
      }
    }
  }, []);

  useEffect(() => {
    async function fetchProfile() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('name, department')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setProfile(data);
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, [user]);

  const savePreferences = (newPrefs: Preferences) => {
    setPreferences(newPrefs);
    localStorage.setItem(PREFS_KEY, JSON.stringify(newPrefs));
    toast({ title: 'Saved', description: 'Preferences updated' });
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({ title: 'Error', description: 'Please fill in all password fields', variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'New passwords do not match', variant: 'destructive' });
      return;
    }

    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }

    setChangingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Password changed successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password',
        variant: 'destructive'
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login/faculty');
  };

  if (loading) {
    return (
      <PageShell role="faculty">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="glass-card rounded-xl p-6 h-64"></div>
        </div>
      </PageShell>
    );
  }

  return (
    <>
    <PageShell role="faculty">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl lg:text-3xl font-display font-bold text-foreground">
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your profile and preferences
          </p>
        </div>

        {/* Profile Section */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </h2>
          <div className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <div className="flex items-center gap-2 mt-1 p-3 bg-white/5 rounded-lg border border-border/30">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{profile?.name || 'N/A'}</span>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <div className="flex items-center gap-2 mt-1 p-3 bg-white/5 rounded-lg border border-border/30">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{user?.email || 'N/A'}</span>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground">Department</Label>
              <div className="flex items-center gap-2 mt-1 p-3 bg-white/5 rounded-lg border border-border/30">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{profile?.department || 'AIML'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Preferences
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Language</Label>
                <p className="text-sm text-muted-foreground">Preferred language for messages</p>
              </div>
              <Select
                value={preferences.language}
                onValueChange={(value: 'en' | 'mr') =>
                  savePreferences({ ...preferences, language: value })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="mr">मराठी</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">Toggle dark/light theme</p>
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
          </div>
        </div>

        {/* Notifications Section */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notifications
          </h2>
          <div className="space-y-4">
             <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Email Notifications</Label>
                <p className="text-sm text-muted-foreground">Receive updates via email</p>
              </div>
              <Switch
                checked={preferences.email_notifications}
                onCheckedChange={(val) => savePreferences({...preferences, email_notifications: val})}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">SMS Alerts</Label>
                <p className="text-sm text-muted-foreground">Receive urgent alerts via SMS</p>
              </div>
              <Switch
                checked={preferences.sms_notifications}
                onCheckedChange={(val) => savePreferences({...preferences, sms_notifications: val})}
              />
            </div>
          </div>
        </div>

        {/* Advanced Security Section */ /*
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Advanced Security
          </h2>
          <div className="space-y-4">
             <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">Enable extra security layer</p>
              </div>
              <Switch
                 checked={preferences.two_factor_auth}
                 onCheckedChange={async (val) => {
                     if (val) {
                         // Enable MFA
                         if (Firewall.checkRateLimit('mfa_toggle')) {
                             setShowMFAEnrollment(true);
                         } else {
                             toast({ title: 'Rate Limit', description: 'Please wait before trying again', variant: 'destructive' });
                         }
                     } else {
                         // Disable MFA - In real app, ask for password/confirmation first
                         if (!confirm("Are you sure you want to disable 2FA? This will lower your account security.")) return;
                         
                         try {
                             const factors = await MFAService.listFactors();
                             if (factors && factors.length > 0) {
                                 // Un-enroll all factors for simplicity in this demo
                                 for (const factor of factors) {
                                     await MFAService.unenroll(factor.id);
                                 }
                                 setPreferences({...preferences, two_factor_auth: false});
                                 toast({ title: '2FA Disabled', description: 'Two-factor authentication has been turned off.' });
                             }
                         } catch (e) {
                             console.error(e);
                             toast({ title: 'Error', description: 'Failed to disable 2FA', variant: 'destructive' });
                         }
                     }
                 }}
              />
            </div>
             <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Login Alerts</Label>
                <p className="text-sm text-muted-foreground">Notify on new login detection</p>
              </div>
               <Switch
                 checked={preferences.login_alerts}
                 onCheckedChange={(val) => savePreferences({...preferences, login_alerts: val})}
              />
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="glass-card rounded-xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Security
          </h2>

          {!showPasswordSection ? (
            <Button variant="outline" onClick={() => setShowPasswordSection(true)}>
              Change Password
            </Button>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative mt-1">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="btn-gradient"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {changingPassword ? 'Changing...' : 'Update Password'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setShowPasswordSection(false);
                  setNewPassword('');
                  setConfirmPassword('');
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Logout */}
        <Button
          variant="outline"
          onClick={handleLogout}
          className="w-full border-danger/50 text-danger hover:bg-danger/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </motion.div>
    </PageShell>

    <MFAEnrollment 
        isOpen={showMFAEnrollment} 
        onClose={() => setShowMFAEnrollment(false)}
        onEnrolled={() => {
             setPreferences(p => ({ ...p, two_factor_auth: true }));
        }}
    />
    </>
  );
};


export default FacultySettingsPage;

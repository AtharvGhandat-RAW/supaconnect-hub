import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, GraduationCap } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import GlowPanel from '@/components/ui/GlowPanel';
import FloatingOrbs from '@/components/ui/FloatingOrbs';
import ritLogo from '@/assets/rit-logo.jpg';

const FacultyLoginForm: React.FC = () => {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);
    
    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        toast({
          title: 'Login Failed',
          description: error.message || 'Invalid credentials. Please try again.',
          variant: 'destructive',
        });
        return;
      }

      // Check user role from profiles table
      if (data?.user) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          await supabase.auth.signOut();
          toast({
            title: 'Profile Not Found',
            description: 'Your profile does not exist. Please contact the administrator.',
            variant: 'destructive',
          });
          return;
        }

        if (profile.role !== 'FACULTY') {
          await supabase.auth.signOut();
          toast({
            title: 'Access Denied',
            description: 'You do not have faculty privileges. Please use the Admin login.',
            variant: 'destructive',
          });
          return;
        }

        if (rememberMe) {
          localStorage.setItem('rememberFaculty', 'true');
        }
        
        toast({
          title: 'Welcome back, Professor',
          description: 'Login successful. Redirecting to dashboard...',
        });
        navigate('/faculty/dashboard');
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-violet-900/40 to-black p-4 relative overflow-hidden">
      <FloatingOrbs 
        count={5} 
        opacity={0.15}
        colors={['bg-indigo-500', 'bg-violet-600', 'bg-cyan-500']}
      />
      
      <motion.div
        className="w-full max-w-md relative z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <GlowPanel glowColor="accent" className="group">
          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-8">
            <motion.div
              className="flex justify-center mb-4"
              whileHover={{ scale: 1.05 }}
            >
              <div className="relative">
                <img
                  src={ritLogo}
                  alt="RIT Logo"
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-accent-electric/50"
                />
                <div className="absolute -bottom-1 -right-1 bg-accent-electric rounded-full p-1">
                  <GraduationCap className="w-4 h-4 text-surface-950" />
                </div>
              </div>
            </motion.div>
            <h1 className="font-display text-2xl font-bold text-white mb-1">
              Welcome back, Professor
            </h1>
            <p className="text-muted-foreground text-sm">
              RIT Polytechnic • AIML Department
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <motion.div variants={itemVariants} className="space-y-2">
              <label className="text-sm font-medium text-white/90">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type="email"
                  placeholder="faculty@rit.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus-ring"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-danger">{errors.email}</p>
              )}
            </motion.div>

            {/* Password */}
            <motion.div variants={itemVariants} className="space-y-2">
              <label className="text-sm font-medium text-white/90">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-white/5 border-white/10 text-white placeholder:text-muted-foreground focus-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-danger">{errors.password}</p>
              )}
            </motion.div>

            {/* Remember me */}
            <motion.div variants={itemVariants} className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                className="border-white/20 data-[state=checked]:bg-accent-electric"
              />
              <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                Remember me
              </label>
            </motion.div>

            {/* Submit button */}
            <motion.div variants={itemVariants}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 hover:from-indigo-500 hover:via-violet-500 hover:to-cyan-500 text-white font-semibold py-5 focus-ring transition-all duration-300"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </motion.div>
            </motion.div>
          </form>

          {/* Switch to admin */}
          <motion.div variants={itemVariants} className="mt-6 text-center">
            <Link
              to="/login/admin"
              className="text-sm text-muted-foreground hover:text-accent-electric transition-colors"
            >
              Admin login →
            </Link>
          </motion.div>
        </GlowPanel>
      </motion.div>
    </div>
  );
};

export default FacultyLoginForm;
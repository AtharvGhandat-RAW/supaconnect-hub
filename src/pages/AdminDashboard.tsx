import React from 'react';
import { motion } from 'framer-motion';
import { LogOut, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login/admin');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-secondary-700/30 to-black relative overflow-hidden">
      <div className="relative z-10 p-6 md:p-10">
        {/* Header */}
        <motion.header
          className="flex items-center justify-between mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary-600 rounded-full p-2">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold text-white">
                Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                {user?.email || 'admin@rit.edu'}
              </p>
            </div>
          </div>
          
          <Button
            variant="outline"
            onClick={handleLogout}
            className="border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </motion.header>

        {/* Placeholder content */}
        <motion.div
          className="glass-card p-8 md:p-12 text-center max-w-2xl mx-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mb-4">
            Welcome to Admin Dashboard
          </h2>
          <p className="text-muted-foreground mb-6">
            RIT Polytechnic • AIML Department
          </p>
          <div className="text-sm text-muted-foreground/70">
            Dashboard features coming soon...
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AdminDashboard;

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface RouteGuardProps {
  children: React.ReactNode;
  allowedRole: 'ADMIN' | 'FACULTY';
}

export const RouteGuard: React.FC<RouteGuardProps> = ({ children, allowedRole }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRole() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setRole(data?.role || null);
      } catch (err) {
        console.error('Error fetching role:', err);
        setRole(null);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      fetchRole();
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-secondary-700/30 to-black flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    const loginPath = allowedRole === 'ADMIN' ? '/login/admin' : '/login/faculty';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (role !== allowedRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-secondary-700/30 to-black flex items-center justify-center p-4">
        <div className="glass-card p-8 text-center max-w-md">
          <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access this page.
          </p>
          <a
            href={role === 'ADMIN' ? '/admin/dashboard' : '/faculty/dashboard'}
            className="text-accent hover:underline"
          >
            Go to your dashboard
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default RouteGuard;

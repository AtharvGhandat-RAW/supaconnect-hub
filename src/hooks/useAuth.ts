import { useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthService } from '@/utils/auth';
import { SecureLogger } from '@/utils/security';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setAuthState({
          user: session?.user ?? null,
          session: session,
          loading: false,
        });
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState({
        user: session?.user ?? null,
        session: session,
        loading: false,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      // Validate login attempt with rate limiting
      const isValid = await AuthService.validateLoginAttempt(email);
      if (!isValid) {
        return { 
          data: null, 
          error: { message: 'Too many login attempts. Please try again later.' } 
        };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        SecureLogger.logSuspiciousActivity('Failed login attempt', { email });
      }
      
      return { data, error };
    } catch (error) {
      SecureLogger.logError(error, 'signIn');
      return { 
        data: null, 
        error: { message: 'An error occurred during login. Please try again.' } 
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const success = await AuthService.logout();
      if (!success) {
        SecureLogger.logError(new Error('Logout failed'), 'signOut');
      }
      return success;
    } catch (error) {
      SecureLogger.logError(error, 'signOut');
      return false;
    }
  }, []);

  const getSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  }, []);

  return {
    user: authState.user,
    session: authState.session,
    loading: authState.loading,
    signIn,
    signOut,
    getSession,
    isAdmin: false, // Will be updated when profile integration is added
    isFaculty: false, // Will be updated when profile integration is added
  };
}

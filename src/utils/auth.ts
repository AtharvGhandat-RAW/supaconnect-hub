// Authentication and authorization utilities
import { supabase } from '@/integrations/supabase/client';
import { SecurityValidator, SecureLogger } from './security';

export const AuthService = {
  // Rate limiter for login attempts
  loginRateLimit: SecurityValidator.createRateLimiter(5, 15 * 60 * 1000), // 5 attempts per 15 minutes

  // Validate login attempt
  async validateLoginAttempt(email: string): Promise<boolean> {
    if (!SecurityValidator.isValidEmail(email)) {
      SecureLogger.logSuspiciousActivity('Invalid email format in login', email);
      return false;
    }

    if (!this.loginRateLimit(email)) {
      SecureLogger.logSuspiciousActivity('Rate limit exceeded for login', email);
      return false;
    }

    return true;
  },

  // Check if user has required role
  async checkUserRole(userId: string, requiredRole: 'ADMIN' | 'FACULTY'): Promise<boolean> {
    try {
      if (!SecurityValidator.isValidUUID(userId)) {
        return false;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error || !data) {
        SecureLogger.logError(error, 'checkUserRole', userId);
        return false;
      }

      return data.role === requiredRole || data.role === 'ADMIN'; // Admin can access everything
    } catch (error) {
      SecureLogger.logError(error, 'checkUserRole', userId);
      return false;
    }
  },

  // Check if faculty can access specific class/subject
  async checkFacultyAccess(facultyId: string, classId?: string, subjectId?: string): Promise<boolean> {
    try {
      if (!SecurityValidator.isValidUUID(facultyId)) {
        return false;
      }

      // If checking specific class/subject access
      if (classId && subjectId) {
        if (!SecurityValidator.isValidUUID(classId) || !SecurityValidator.isValidUUID(subjectId)) {
          return false;
        }

        const { data, error } = await supabase
          .from('subject_allocations')
          .select('id')
          .eq('faculty_id', facultyId)
          .eq('class_id', classId)
          .eq('subject_id', subjectId)
          .maybeSingle();

        if (error) {
          SecureLogger.logError(error, 'checkFacultyAccess');
          return false;
        }

        return !!data;
      }

      return true; // Faculty exists, general access granted
    } catch (error) {
      SecureLogger.logError(error, 'checkFacultyAccess', facultyId);
      return false;
    }
  },

  // Validate session and get user info securely
  async validateSession() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        return null;
      }

      // Get additional profile info
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, name, department')
        .eq('id', user.id)
        .single();

      return {
        id: user.id,
        email: user.email,
        profile: profile || null
      };
    } catch (error) {
      SecureLogger.logError(error, 'validateSession');
      return null;
    }
  },

  // Secure logout
  async logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        SecureLogger.logError(error, 'logout');
      }
      return !error;
    } catch (error) {
      SecureLogger.logError(error, 'logout');
      return false;
    }
  }
};

// Protected route wrapper
export const withAuth = (requiredRole?: 'ADMIN' | 'FACULTY') => {
  return async (userId?: string) => {
    if (!userId) {
      return { authorized: false, reason: 'Not authenticated' };
    }

    if (requiredRole) {
      const hasRole = await AuthService.checkUserRole(userId, requiredRole);
      if (!hasRole) {
        SecureLogger.logSuspiciousActivity('Unauthorized access attempt', { userId, requiredRole });
        return { authorized: false, reason: 'Insufficient privileges' };
      }
    }

    return { authorized: true };
  };
};

export default AuthService;
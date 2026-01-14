// Security utilities for input validation and sanitization
export const SecurityValidator = {
  // Validate UUID format
  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  // Sanitize string input
  sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/[<>\"']/g, '') // Remove potential XSS characters
      .slice(0, 255); // Limit length
  },

  // Validate email
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 100;
  },

  // Validate phone number
  isValidPhone(phone: string): boolean {
    const phoneRegex = /^[+]?[\d\s\-\(\)]{10,15}$/;
    return phoneRegex.test(phone);
  },

  // Validate academic year/semester
  isValidAcademicData(year: number, semester: number): boolean {
    return year >= 1 && year <= 4 && semester >= 1 && semester <= 8;
  },

  // Validate time format (HH:MM)
  isValidTime(time: string): boolean {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  },

  // Validate date format (YYYY-MM-DD)
  isValidDate(date: string): boolean {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return false;
    const parsedDate = new Date(date);
    return parsedDate.toISOString().split('T')[0] === date;
  },

  // Rate limiting helper
  createRateLimiter(maxRequests: number, windowMs: number) {
    const requests = new Map<string, number[]>();
    
    return (key: string): boolean => {
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!requests.has(key)) {
        requests.set(key, []);
      }
      
      const userRequests = requests.get(key)!;
      // Remove old requests outside the window
      const validRequests = userRequests.filter(time => time > windowStart);
      
      if (validRequests.length >= maxRequests) {
        return false; // Rate limit exceeded
      }
      
      validRequests.push(now);
      requests.set(key, validRequests);
      return true;
    };
  }
};

// SQL injection prevention helpers
export const QueryBuilder = {
  // Build safe query with parameterized values
  buildSelectQuery(table: string, columns: string[], filters: Record<string, any> = {}) {
    const allowedTables = ['students', 'faculty', 'classes', 'subjects', 'attendance_sessions', 'attendance_records'];
    
    if (!allowedTables.includes(table)) {
      throw new Error('Invalid table name');
    }
    
    const sanitizedColumns = columns.filter(col => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col));
    
    return {
      table,
      columns: sanitizedColumns,
      filters: this.sanitizeFilters(filters)
    };
  },

  sanitizeFilters(filters: Record<string, any>) {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(filters)) {
      // Only allow alphanumeric column names
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        continue;
      }
      
      // Sanitize values based on type
      if (typeof value === 'string') {
        sanitized[key] = this.SecurityValidator.sanitizeString(value);
      } else if (typeof value === 'number' && !isNaN(value)) {
        sanitized[key] = value;
      } else if (typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
};

// Error logging without exposing sensitive data
export const SecureLogger = {
  logError(error: any, context: string, userId?: string) {
    // Log errors securely without exposing sensitive information
    const sanitizedError = {
      message: error?.message || 'Unknown error',
      context,
      timestamp: new Date().toISOString(),
      userId: userId ? 'user_' + userId.slice(-8) : 'anonymous' // Only log partial ID
    };
    
    console.error('Secure Log:', sanitizedError);
    
    // In production, send to secure logging service
    // this.sendToLoggingService(sanitizedError);
  },

  logSuspiciousActivity(activity: string, details: any, userId?: string) {
    const suspiciousEvent = {
      type: 'SUSPICIOUS_ACTIVITY',
      activity,
      details: typeof details === 'object' ? 'object_detected' : String(details).slice(0, 50),
      userId: userId ? 'user_' + userId.slice(-8) : 'anonymous',
      timestamp: new Date().toISOString()
    };
    
    console.warn('Suspicious Activity:', suspiciousEvent);
  }
};

export { SecurityValidator as default };
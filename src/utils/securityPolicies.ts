// Content Security Policy and XSS Protection
export const CSPConfig = {
  // Content Security Policy header value
  cspHeader: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://unpkg.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.whatsapp.com",
    "media-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ')
};

// XSS Protection utilities
export const XSSProtection = {
  // Sanitize HTML content
  sanitizeHTML(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },

  // Validate and sanitize URL
  sanitizeURL(url: string): string {
    try {
      const parsedURL = new URL(url);
      // Only allow http, https, mailto protocols
      if (!['http:', 'https:', 'mailto:'].includes(parsedURL.protocol)) {
        return '';
      }
      return parsedURL.toString();
    } catch {
      return '';
    }
  },

  // Remove potentially dangerous attributes from objects
  sanitizeObject(obj: any, allowedKeys: string[]): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = {};
    for (const key of allowedKeys) {
      if (obj.hasOwnProperty(key)) {
        if (typeof obj[key] === 'string') {
          sanitized[key] = this.sanitizeHTML(obj[key]);
        } else if (typeof obj[key] === 'number' || typeof obj[key] === 'boolean') {
          sanitized[key] = obj[key];
        } else if (Array.isArray(obj[key])) {
          sanitized[key] = obj[key].filter((item: any) => 
            typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
          );
        }
      }
    }
    return sanitized;
  }
};

// SQL Injection Prevention
export const SQLInjectionPrevention = {
  // Whitelist of allowed table names
  allowedTables: [
    'students', 'faculty', 'classes', 'subjects', 'batches',
    'attendance_sessions', 'attendance_records', 'timetable_slots',
    'subject_allocations', 'faculty_leaves', 'substitution_assignments',
    'profiles', 'activity_log'
  ],

  // Whitelist of allowed column names (basic pattern)
  isValidColumnName(column: string): boolean {
    // Only allow alphanumeric characters and underscores, starting with letter or underscore
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column);
  },

  // Validate table name
  isValidTableName(table: string): boolean {
    return this.allowedTables.includes(table);
  },

  // Sanitize ORDER BY clause
  sanitizeOrderBy(orderBy: string): string {
    const parts = orderBy.trim().split(/\s+/);
    if (parts.length > 2) return 'id'; // Default safe ordering

    const column = parts[0];
    const direction = parts[1]?.toUpperCase();

    if (!this.isValidColumnName(column)) {
      return 'id'; // Default safe ordering
    }

    if (direction && !['ASC', 'DESC'].includes(direction)) {
      return column; // Just column name, no direction
    }

    return direction ? `${column} ${direction}` : column;
  }
};

// File Upload Security
export const FileUploadSecurity = {
  // Allowed file types for CSV uploads
  allowedMimeTypes: [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ],

  // Maximum file size (5MB)
  maxFileSize: 5 * 1024 * 1024,

  // Validate uploaded file
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!file) {
      return { valid: false, error: 'No file provided' };
    }

    if (file.size > this.maxFileSize) {
      return { valid: false, error: 'File size exceeds 5MB limit' };
    }

    if (!this.allowedMimeTypes.includes(file.type)) {
      return { valid: false, error: 'Invalid file type. Only CSV and Excel files allowed' };
    }

    // Check file extension as additional security
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      return { valid: false, error: 'Invalid file extension' };
    }

    return { valid: true };
  },

  // Sanitize filename
  sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 100); // Limit length
  }
};

// Environment Security
export const EnvironmentSecurity = {
  // Check if we're in production
  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  },

  // Validate environment variables
  validateEnvironment(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];

    for (const envVar of required) {
      if (!process.env[envVar]) {
        errors.push(`Missing required environment variable: ${envVar}`);
      }
    }

    // Validate Supabase URL format
    if (process.env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL.startsWith('https://')) {
      errors.push('VITE_SUPABASE_URL must use HTTPS');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
};

export default {
  CSPConfig,
  XSSProtection,
  SQLInjectionPrevention,
  FileUploadSecurity,
  EnvironmentSecurity
};
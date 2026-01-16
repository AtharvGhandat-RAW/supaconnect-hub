import { SecurityValidator } from './security';

/**
 * Client-Side Application Firewall
 * Simulates WAF capabilities by inspecting inputs and traffic patterns on the client.
 */

interface RequestLog {
  timestamp: number;
  endpoint: string;
  method: string;
}

class ApplicationFirewall {
  private requestLog: RequestLog[] = [];
  private blockedIPs: Set<string> = new Set(); // Simulated blocked IPs
  private suspiciousPatterns: RegExp[] = [
    /<script\b[^>]*>([\s\S]*?)<\/script>/gm, // XSS
    /('(''|[^'])*')|(;)|(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE){0,1}|INSERT( +INTO){0,1}|MERGE|SELECT|UPDATE|UNION( +ALL){0,1})\b)/gm, // SQLi
    /(\.\.\/)/g, // Path Traversal
  ];

  constructor() {
    console.log("🛡️ Application Firewall Initialized");
  }

  /**
   * Inspects a payload for malicious content.
   * @param payload Object or string to inspect
   * @returns boolean - true if safe, false if threat detected
   */
  inspect(payload: any): boolean {
    if (!payload) return true;
    const stringified = JSON.stringify(payload);

    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(stringified)) {
        console.warn("🛡️ Firewall Alert: Malicious pattern detected in payload", payload);
        return false;
      }
    }
    return true;
  }

  /**
   * Protects against rapid-fire requests (Client-side Rate Limiting).
   * @param endpoint The action or endpoint being accessed
   * @returns boolean - true if allowed, false if blocked
   */
  checkRateLimit(endpoint: string): boolean {
    const now = Date.now();
    // Clean old logs
    this.requestLog = this.requestLog.filter(log => now - log.timestamp < 60000); // Keep last 1 minute

    // Count requests to this endpoint
    const count = this.requestLog.filter(log => log.endpoint === endpoint).length;

    if (count > 20) { // Limit: 20 req/min per endpoint
      console.warn(`🛡️ Firewall Alert: Rate limit exceeded for ${endpoint}`);
      return false;
    }

    this.requestLog.push({ timestamp: now, endpoint, method: 'ALL' });
    return true;
  }

  /**
   * Logs a security event.
   */
  logEvent(type: 'INFO' | 'WARNING' | 'CRITICAL', message: string, details?: any) {
    const event = {
      timestamp: new Date().toISOString(),
      type,
      message,
      title: 'Security Alert',
      details
    };
    console.log(`🛡️ FIREWALL [${type}]: ${message}`, details || '');
    // In a real app, send this to a backend monitoring service
  }
}

export const Firewall = new ApplicationFirewall();

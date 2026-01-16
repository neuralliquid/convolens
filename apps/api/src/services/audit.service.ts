/**
 * Audit Service
 *
 * Provides comprehensive audit logging for security-relevant and
 * business-critical operations.
 *
 * Features:
 * - Structured audit log entries
 * - User action tracking
 * - Resource access logging
 * - Authentication event logging
 * - Data change tracking
 * - Configurable retention
 *
 * Usage:
 * await auditService.log({
 *   action: AuditAction.USER_LOGIN,
 *   userId: user.id,
 *   details: { email: user.email },
 * });
 */

import { logger } from '../utils/logger.js';
import { getCorrelationContext } from '../middleware/correlation.js';

// =============================================================================
// Types
// =============================================================================

export enum AuditAction {
  // Authentication
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  USER_LOGIN_FAILED = 'user.login_failed',
  USER_REGISTER = 'user.register',
  PASSWORD_CHANGE = 'user.password_change',
  PASSWORD_RESET_REQUEST = 'user.password_reset_request',
  TOKEN_REFRESH = 'user.token_refresh',

  // User Management
  USER_UPDATE = 'user.update',
  USER_DELETE = 'user.delete',
  USER_SETTINGS_UPDATE = 'user.settings_update',

  // Chat Operations
  CHAT_EXPORT = 'chat.export',
  CHAT_DELETE = 'chat.delete',
  CHAT_SHARE = 'chat.share',
  CHAT_SUMMARIZE = 'chat.summarize',

  // Extension Operations
  EXTENSION_CONNECT = 'extension.connect',
  EXTENSION_DATA_RECEIVED = 'extension.data_received',
  EXTENSION_ERROR = 'extension.error',

  // Administrative
  ADMIN_ACCESS = 'admin.access',
  CONFIG_CHANGE = 'admin.config_change',
  SELECTOR_UPDATE = 'admin.selector_update',

  // API Operations
  API_KEY_CREATE = 'api.key_create',
  API_KEY_REVOKE = 'api.key_revoke',
  API_RATE_LIMIT = 'api.rate_limit',

  // Security Events
  SECURITY_ALERT = 'security.alert',
  SUSPICIOUS_ACTIVITY = 'security.suspicious_activity',
  IP_BLOCKED = 'security.ip_blocked',
}

export enum AuditResult {
  SUCCESS = 'success',
  FAILURE = 'failure',
  DENIED = 'denied',
  ERROR = 'error',
}

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  result: AuditResult;
  severity?: AuditSeverity;

  // Actor information
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;

  // Context
  correlationId?: string;
  requestId?: string;
  sessionId?: string;

  // Resource affected
  resourceType?: string;
  resourceId?: string;

  // Additional details
  details?: Record<string, unknown>;

  // Security metadata
  riskScore?: number;
  isSuspicious?: boolean;
}

export interface AuditLogOptions {
  action: AuditAction;
  result?: AuditResult;
  severity?: AuditSeverity;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  riskScore?: number;
  isSuspicious?: boolean;
}

interface AuditStats {
  totalEntries: number;
  entriesByAction: Record<string, number>;
  entriesByResult: Record<string, number>;
  recentSuspiciousCount: number;
}

// =============================================================================
// Audit Service
// =============================================================================

class AuditService {
  private entries: AuditEntry[] = [];
  private readonly maxEntries: number = 10000;
  private readonly suspiciousThreshold: number = 100; // Last N entries to check

  /**
   * Log an audit entry
   */
  async log(options: AuditLogOptions): Promise<AuditEntry> {
    const context = getCorrelationContext();
    const entry: AuditEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      action: options.action,
      result: options.result ?? AuditResult.SUCCESS,
      severity: options.severity ?? this.getSeverityForAction(options.action),
      userId: options.userId ?? context?.userId,
      userEmail: options.userEmail,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      correlationId: context?.correlationId,
      requestId: context?.requestId,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      details: this.sanitizeDetails(options.details),
      riskScore: options.riskScore,
      isSuspicious: options.isSuspicious ?? false,
    };

    // Store entry
    this.entries.push(entry);

    // Enforce max entries limit
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Log to structured logger
    this.logToLogger(entry);

    // Check for suspicious patterns
    if (this.shouldAlertSuspicious(entry)) {
      entry.isSuspicious = true;
      await this.handleSuspiciousActivity(entry);
    }

    return entry;
  }

  /**
   * Log authentication event
   */
  async logAuth(
    action: AuditAction,
    userId: string | undefined,
    email: string,
    result: AuditResult,
    ipAddress?: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action,
      result,
      userId,
      userEmail: email,
      ipAddress,
      resourceType: 'authentication',
      details: {
        ...details,
        email: this.maskEmail(email),
      },
    });
  }

  /**
   * Log chat operation
   */
  async logChatOperation(
    action: AuditAction,
    userId: string,
    chatId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action,
      userId,
      resourceType: 'chat',
      resourceId: chatId,
      details,
    });
  }

  /**
   * Log extension event
   */
  async logExtension(
    action: AuditAction,
    userId: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      action,
      userId,
      resourceType: 'extension',
      details,
    });
  }

  /**
   * Log security event
   */
  async logSecurity(
    action: AuditAction,
    severity: AuditSeverity,
    details: Record<string, unknown>,
    ipAddress?: string
  ): Promise<void> {
    await this.log({
      action,
      severity,
      ipAddress,
      isSuspicious: severity === AuditSeverity.CRITICAL,
      details,
    });
  }

  /**
   * Query audit entries
   */
  query(filters: {
    userId?: string;
    action?: AuditAction;
    result?: AuditResult;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): { entries: AuditEntry[]; total: number } {
    let filtered = [...this.entries];

    if (filters.userId) {
      filtered = filtered.filter(e => e.userId === filters.userId);
    }
    if (filters.action) {
      filtered = filtered.filter(e => e.action === filters.action);
    }
    if (filters.result) {
      filtered = filtered.filter(e => e.result === filters.result);
    }
    if (filters.startDate) {
      filtered = filtered.filter(e => new Date(e.timestamp) >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(e => new Date(e.timestamp) <= filters.endDate!);
    }

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = filtered.length;
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 50;

    return {
      entries: filtered.slice(offset, offset + limit),
      total,
    };
  }

  /**
   * Get statistics
   */
  getStats(): AuditStats {
    const entriesByAction: Record<string, number> = {};
    const entriesByResult: Record<string, number> = {};
    let recentSuspiciousCount = 0;

    for (const entry of this.entries) {
      entriesByAction[entry.action] = (entriesByAction[entry.action] || 0) + 1;
      entriesByResult[entry.result] = (entriesByResult[entry.result] || 0) + 1;
    }

    // Count recent suspicious entries
    const recentEntries = this.entries.slice(-this.suspiciousThreshold);
    for (const entry of recentEntries) {
      if (entry.isSuspicious) {
        recentSuspiciousCount++;
      }
    }

    return {
      totalEntries: this.entries.length,
      entriesByAction,
      entriesByResult,
      recentSuspiciousCount,
    };
  }

  /**
   * Get entries for a specific user
   */
  getUserAuditTrail(userId: string, limit: number = 100): AuditEntry[] {
    return this.query({ userId, limit }).entries;
  }

  /**
   * Clear old entries (for testing)
   */
  clear(): void {
    this.entries = [];
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private generateId(): string {
    return 'audit_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
  }

  private getSeverityForAction(action: AuditAction): AuditSeverity {
    const criticalActions = [
      AuditAction.SECURITY_ALERT,
      AuditAction.SUSPICIOUS_ACTIVITY,
      AuditAction.IP_BLOCKED,
      AuditAction.USER_DELETE,
      AuditAction.CONFIG_CHANGE,
    ];

    const warningActions = [
      AuditAction.USER_LOGIN_FAILED,
      AuditAction.API_RATE_LIMIT,
      AuditAction.PASSWORD_RESET_REQUEST,
    ];

    if (criticalActions.includes(action)) {
      return AuditSeverity.CRITICAL;
    }
    if (warningActions.includes(action)) {
      return AuditSeverity.WARNING;
    }
    return AuditSeverity.INFO;
  }

  private sanitizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!details) return undefined;

    const sanitized = { ...details };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'accessToken', 'refreshToken'];
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***@***';

    const maskedLocal = local.length > 2
      ? local.slice(0, 2) + '***'
      : '***';

    return `${maskedLocal}@${domain}`;
  }

  private logToLogger(entry: AuditEntry): void {
    const logData = {
      type: 'audit',
      auditId: entry.id,
      action: entry.action,
      result: entry.result,
      severity: entry.severity,
      userId: entry.userId,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      correlationId: entry.correlationId,
      isSuspicious: entry.isSuspicious,
    };

    switch (entry.severity) {
      case AuditSeverity.CRITICAL:
        logger.error('AUDIT:', logData);
        break;
      case AuditSeverity.WARNING:
        logger.warn('AUDIT:', logData);
        break;
      default:
        logger.info('AUDIT:', logData);
    }
  }

  private shouldAlertSuspicious(entry: AuditEntry): boolean {
    // Check for rapid failed login attempts
    if (entry.action === AuditAction.USER_LOGIN_FAILED) {
      const recentFailures = this.entries
        .slice(-20)
        .filter(e =>
          e.action === AuditAction.USER_LOGIN_FAILED &&
          e.ipAddress === entry.ipAddress &&
          Date.now() - new Date(e.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
        );

      if (recentFailures.length >= 5) {
        return true;
      }
    }

    // Check for rapid rate limit hits
    if (entry.action === AuditAction.API_RATE_LIMIT) {
      const recentRateLimits = this.entries
        .slice(-50)
        .filter(e =>
          e.action === AuditAction.API_RATE_LIMIT &&
          e.userId === entry.userId &&
          Date.now() - new Date(e.timestamp).getTime() < 10 * 60 * 1000 // Last 10 minutes
        );

      if (recentRateLimits.length >= 10) {
        return true;
      }
    }

    return false;
  }

  private async handleSuspiciousActivity(entry: AuditEntry): Promise<void> {
    logger.warn('Suspicious activity detected', {
      type: 'security',
      auditId: entry.id,
      action: entry.action,
      userId: entry.userId,
      ipAddress: entry.ipAddress,
    });

    // In production, this could:
    // - Send alerts to security team
    // - Trigger account lockout
    // - Block IP address
    // - Create incident ticket
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const auditService = new AuditService();

// =============================================================================
// Express Middleware
// =============================================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to audit all API requests
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Store original end function
  const originalEnd = res.end.bind(res);

  // Override end to capture response with proper typing
  // res.end has multiple overloads, we handle them all
  res.end = function (
    this: Response,
    chunkOrCb?: Buffer | string | (() => void),
    encodingOrCb?: BufferEncoding | (() => void),
    cb?: () => void
  ): Response {
    // Restore original end immediately to prevent double-calling
    res.end = originalEnd;

    // Log the request (non-blocking)
    const user = (req as any).user;
    auditService.log({
      action: AuditAction.ADMIN_ACCESS, // Would be more specific in real implementation
      result: res.statusCode < 400 ? AuditResult.SUCCESS : AuditResult.FAILURE,
      userId: user?.id,
      userEmail: user?.email,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      resourceType: 'api',
      resourceId: req.path,
      details: {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
      },
    }).catch(() => {}); // Silent fail for audit

    // Call original end with proper argument handling
    if (typeof chunkOrCb === 'function') {
      return originalEnd(chunkOrCb);
    } else if (typeof encodingOrCb === 'function') {
      return originalEnd(chunkOrCb as Buffer | string | undefined, encodingOrCb);
    } else if (encodingOrCb !== undefined) {
      return originalEnd(chunkOrCb as Buffer | string | undefined, encodingOrCb, cb);
    } else {
      return originalEnd(chunkOrCb as Buffer | string | undefined, cb);
    }
  } as typeof res.end;

  next();
}

export default auditService;

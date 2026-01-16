/**
 * Rate Limiting Middleware
 *
 * Provides configurable rate limiting for API endpoints.
 * Uses in-memory storage with sliding window algorithm.
 *
 * Features:
 * - Configurable limits per endpoint or globally
 * - Sliding window algorithm for smooth rate limiting
 * - IP-based and user-based limiting
 * - Standard rate limit headers (X-RateLimit-*)
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { getCorrelationContext } from './correlation.js';

// =============================================================================
// Types
// =============================================================================

export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
  /** Message when limit is exceeded */
  message?: string;
  /** Use user ID instead of IP (requires auth) */
  keyByUser?: boolean;
  /** Custom key generator */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Custom handler when limit is exceeded */
  handler?: (req: Request, res: Response) => void;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// =============================================================================
// Rate Limit Store
// =============================================================================

class RateLimitStore {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  increment(key: string, windowMs: number): RateLimitEntry {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      // New window
      const newEntry: RateLimitEntry = {
        count: 1,
        resetAt: now + windowMs,
      };
      this.store.set(key, newEntry);
      return newEntry;
    }

    // Increment existing window
    entry.count++;
    this.store.set(key, entry);
    return entry;
  }

  get(key: string): RateLimitEntry | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() >= entry.resetAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`Rate limit cleanup: removed ${cleaned} expired entries`);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }

  getStats(): { entries: number } {
    return { entries: this.store.size };
  }
}

// Singleton store
const rateLimitStore = new RateLimitStore();

// =============================================================================
// Rate Limit Middleware Factory
// =============================================================================

/**
 * Create a rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later',
    keyByUser = false,
    keyGenerator,
    skip,
    handler,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if should skip
    if (skip && skip(req)) {
      return next();
    }

    // Generate key
    let key: string;
    if (keyGenerator) {
      key = keyGenerator(req);
    } else if (keyByUser && (req as any).user?.id) {
      key = `user:${(req as any).user.id}:${req.path}`;
    } else {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      key = `ip:${ip}:${req.path}`;
    }

    // Increment and check
    const entry = rateLimitStore.increment(key, windowMs);
    const remaining = Math.max(0, max - entry.count);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    // Check if limit exceeded
    if (entry.count > max) {
      const context = getCorrelationContext();
      logger.warn('Rate limit exceeded', {
        key,
        count: entry.count,
        max,
        correlationId: context?.correlationId,
        path: req.path,
        method: req.method,
      });

      res.setHeader('Retry-After', Math.ceil((entry.resetAt - Date.now()) / 1000));

      if (handler) {
        handler(req, res);
        return;
      }

      res.status(429).json({
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((entry.resetAt - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}

// =============================================================================
// Pre-configured Rate Limiters
// =============================================================================

/**
 * Standard API rate limiter
 * 100 requests per 15 minutes
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many API requests, please try again later',
});

/**
 * Strict rate limiter for auth endpoints
 * 5 attempts per 15 minutes
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many authentication attempts, please try again later',
});

/**
 * Extension API rate limiter
 * 60 requests per minute (more lenient for extension polling)
 */
export const extensionRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Too many extension requests, please slow down',
});

/**
 * Selector report rate limiter
 * 10 reports per hour
 */
export const selectorReportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many selector reports, please try again later',
});

// =============================================================================
// Exports
// =============================================================================

export { rateLimitStore };
export default rateLimit;

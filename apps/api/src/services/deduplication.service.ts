/**
 * Deduplication Service
 *
 * Prevents duplicate processing of the same content.
 *
 * Features:
 * - Content-hash based deduplication for uploads
 * - Time-window based deduplication for extractions
 * - Idempotency key support for API requests
 *
 * Usage:
 * if (await deduplicationService.isDuplicate(contentHash)) {
 *   return existingResult;
 * }
 */

import { createHash } from 'crypto';
import { logger } from '../utils/logger.js';
import { getCorrelationContext } from '../middleware/correlation.js';

// =============================================================================
// Types
// =============================================================================

interface DeduplicationEntry {
  hash: string;
  createdAt: number;
  expiresAt: number;
  result?: unknown;
  idempotencyKey?: string;
}

export interface DeduplicationOptions {
  /** Time-to-live for deduplication entries in ms */
  ttlMs?: number;
  /** Maximum number of entries to store */
  maxEntries?: number;
}

export interface IdempotencyResult<T> {
  isDuplicate: boolean;
  result?: T;
}

// =============================================================================
// In-Memory Deduplication Store
// =============================================================================

class DeduplicationService {
  private entries: Map<string, DeduplicationEntry> = new Map();
  private idempotencyKeys: Map<string, DeduplicationEntry> = new Map();
  private defaultTtlMs: number;
  private maxEntries: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: DeduplicationOptions = {}) {
    this.defaultTtlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes
    this.maxEntries = options.maxEntries ?? 10000;

    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if content is a duplicate
   */
  isDuplicate(hash: string): boolean {
    const entry = this.entries.get(hash);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.entries.delete(hash);
      return false;
    }

    logger.debug('Duplicate content detected', { hash, correlationId: getCorrelationContext()?.correlationId });
    return true;
  }

  /**
   * Mark content as processed
   */
  markProcessed(hash: string, result?: unknown, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs ?? this.defaultTtlMs;

    this.entries.set(hash, {
      hash,
      createdAt: now,
      expiresAt: now + ttl,
      result,
    });

    // Enforce max entries limit
    if (this.entries.size > this.maxEntries) {
      this.evictOldest();
    }
  }

  /**
   * Get cached result for duplicate content
   */
  getCachedResult<T>(hash: string): T | undefined {
    const entry = this.entries.get(hash);
    if (!entry || Date.now() > entry.expiresAt) {
      return undefined;
    }
    return entry.result as T;
  }

  /**
   * Check and handle idempotency key
   * Returns cached result if request was already processed
   */
  checkIdempotency<T>(key: string): IdempotencyResult<T> {
    const entry = this.idempotencyKeys.get(key);

    if (!entry) {
      return { isDuplicate: false };
    }

    if (Date.now() > entry.expiresAt) {
      this.idempotencyKeys.delete(key);
      return { isDuplicate: false };
    }

    logger.info('Idempotent request detected', {
      idempotencyKey: key,
      correlationId: getCorrelationContext()?.correlationId,
    });

    return {
      isDuplicate: true,
      result: entry.result as T,
    };
  }

  /**
   * Store result for idempotency key
   */
  storeIdempotencyResult<T>(key: string, result: T, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs ?? 24 * 60 * 60 * 1000; // 24 hours default for idempotency

    this.idempotencyKeys.set(key, {
      hash: key,
      idempotencyKey: key,
      createdAt: now,
      expiresAt: now + ttl,
      result,
    });

    // Enforce limits
    if (this.idempotencyKeys.size > this.maxEntries) {
      this.evictOldestIdempotency();
    }
  }

  /**
   * Generate content hash from data
   */
  generateContentHash(data: unknown): string {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate hash for chat extraction (chat ID + time window)
   */
  generateExtractionHash(chatId: string, userId: string, windowMinutes: number = 5): string {
    // Create a time bucket to group extractions within the window
    const timeBucket = Math.floor(Date.now() / (windowMinutes * 60 * 1000));
    const input = `${userId}:${chatId}:${timeBucket}`;
    return this.generateContentHash(input);
  }

  /**
   * Clean up expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [hash, entry] of this.entries) {
      if (now > entry.expiresAt) {
        this.entries.delete(hash);
        removed++;
      }
    }

    for (const [key, entry] of this.idempotencyKeys) {
      if (now > entry.expiresAt) {
        this.idempotencyKeys.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug(`Deduplication cleanup: removed ${removed} expired entries`);
    }
  }

  /**
   * Get statistics
   */
  getStats(): { entries: number; idempotencyKeys: number } {
    return {
      entries: this.entries.size,
      idempotencyKeys: this.idempotencyKeys.size,
    };
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.entries.clear();
    this.idempotencyKeys.clear();
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private evictOldest(): void {
    let oldest: { hash: string; createdAt: number } | null = null;

    for (const [hash, entry] of this.entries) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = { hash, createdAt: entry.createdAt };
      }
    }

    if (oldest) {
      this.entries.delete(oldest.hash);
    }
  }

  private evictOldestIdempotency(): void {
    let oldest: { key: string; createdAt: number } | null = null;

    for (const [key, entry] of this.idempotencyKeys) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = { key, createdAt: entry.createdAt };
      }
    }

    if (oldest) {
      this.idempotencyKeys.delete(oldest.key);
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const deduplicationService = new DeduplicationService();

// =============================================================================
// Express Middleware for Idempotency
// =============================================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to handle idempotency keys
 * Expects x-idempotency-key header
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  if (!idempotencyKey) {
    next();
    return;
  }

  // Check if we have a cached response
  const cached = deduplicationService.checkIdempotency(idempotencyKey);

  if (cached.isDuplicate && cached.result) {
    res.setHeader('x-idempotency-replayed', 'true');
    res.json(cached.result);
    return;
  }

  // Store the idempotency key for later
  (req as any).idempotencyKey = idempotencyKey;

  // Override res.json to capture the response
  const originalJson = res.json.bind(res);
  res.json = function(body: unknown) {
    // Store the result for future idempotent requests
    if (res.statusCode >= 200 && res.statusCode < 300) {
      deduplicationService.storeIdempotencyResult(idempotencyKey, body);
    }
    return originalJson(body);
  };

  next();
}

export default deduplicationService;

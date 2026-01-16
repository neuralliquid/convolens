/**
 * Cache Service
 *
 * Provides a unified caching layer with Redis support and in-memory fallback.
 * Implements a consistent API regardless of the underlying cache implementation.
 *
 * Features:
 * - Redis for distributed caching in production
 * - In-memory LRU cache for development/fallback
 * - Automatic serialization/deserialization
 * - TTL support with intelligent defaults
 * - Cache key namespacing
 * - Circuit breaker for Redis connection issues
 *
 * Usage:
 * const cached = await cacheService.get<User>('user:123');
 * if (!cached) {
 *   const user = await fetchUser(123);
 *   await cacheService.set('user:123', user, CACHE_TTL.MEDIUM);
 * }
 */

import { logger } from '../utils/logger.js';
import { getCorrelationContext } from '../middleware/correlation.js';
import { CACHE_TTL } from '../config/constants.js';
import { CircuitBreaker, getCircuitBreaker } from './circuit-breaker.service.js';
import { metrics } from './metrics.service.js';

// Dynamic import for Redis to handle cases where it's not installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisClientType = any;

// =============================================================================
// Types
// =============================================================================

export interface CacheOptions {
  /** TTL in seconds */
  ttl?: number;
  /** Namespace prefix for the key */
  namespace?: string;
  /** Skip cache read (force refresh) */
  skipRead?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  type: 'redis' | 'memory';
  connected: boolean;
}

interface MemoryCacheEntry<T> {
  value: T;
  expiresAt: number;
}

// =============================================================================
// In-Memory LRU Cache (Fallback)
// =============================================================================

class MemoryCache {
  private cache: Map<string, MemoryCacheEntry<unknown>> = new Map();
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlSeconds: number): void {
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  deletePattern(pattern: string): number {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// =============================================================================
// Cache Service
// =============================================================================

class CacheService {
  private redisClient: RedisClientType = null;
  private memoryCache: MemoryCache;
  private circuitBreaker: CircuitBreaker;
  private isRedisConnected: boolean = false;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    type: 'memory',
    connected: false,
  };

  private readonly defaultTtl: number = CACHE_TTL.MEDIUM;
  private readonly keyPrefix: string = 'ws:';

  constructor() {
    this.memoryCache = new MemoryCache(5000);
    this.circuitBreaker = getCircuitBreaker('redis-cache', {
      failureThreshold: 3,
      resetTimeout: 30000,
      successThreshold: 2,
    });

    // Start initialization but don't block constructor
    this.initPromise = this.initRedis();
  }

  /**
   * Ensure Redis is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Initialize Redis connection if configured
   */
  private async initRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      logger.info('Redis URL not configured, using in-memory cache');
      this.isInitialized = true;
      return;
    }

    try {
      // Dynamic import to handle cases where redis is not installed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports
      let redis: any = null;
      try {
        // Use eval to prevent TypeScript from analyzing the import
        redis = await (eval('import("redis")') as Promise<any>);
      } catch {
        logger.warn('Redis package not installed, using in-memory cache');
        this.isInitialized = true;
        return;
      }

      if (!redis || !redis.createClient) {
        logger.warn('Redis module invalid, using in-memory cache');
        this.isInitialized = true;
        return;
      }

      this.redisClient = redis.createClient({ url: redisUrl });

      this.redisClient.on('connect', () => {
        logger.info('Redis connected');
        this.isRedisConnected = true;
        this.stats.type = 'redis';
        this.stats.connected = true;
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Redis connection error', { error: err.message });
        this.stats.errors++;
      });

      this.redisClient.on('end', () => {
        logger.warn('Redis connection closed');
        this.isRedisConnected = false;
        this.stats.connected = false;
      });

      await this.redisClient.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis, falling back to memory cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.redisClient = null;
    } finally {
      this.isInitialized = true;
    }
  }

  /**
   * Build a cache key with namespace and prefix
   */
  private buildKey(key: string, namespace?: string): string {
    const ns = namespace ? `${namespace}:` : '';
    return `${this.keyPrefix}${ns}${key}`;
  }

  /**
   * Get a value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    await this.ensureInitialized();
    const fullKey = this.buildKey(key, options.namespace);
    const startTime = Date.now();

    if (options.skipRead) {
      return null;
    }

    try {
      let value: T | null = null;

      if (this.isRedisConnected && this.redisClient) {
        value = await this.circuitBreaker.execute(async () => {
          const data = await this.redisClient!.get(fullKey);
          return data ? JSON.parse(data) as T : null;
        });
      } else {
        value = this.memoryCache.get<T>(fullKey) ?? null;
      }

      if (value !== null) {
        this.stats.hits++;
        metrics.trackQueueProcessing('cache', true, Date.now() - startTime);
        logger.debug('Cache hit', {
          key: fullKey,
          correlationId: getCorrelationContext()?.correlationId,
        });
      } else {
        this.stats.misses++;
      }

      return value;
    } catch (error) {
      this.stats.errors++;
      logger.warn('Cache get error, using fallback', {
        key: fullKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Try memory cache as fallback
      return this.memoryCache.get<T>(fullKey) ?? null;
    }
  }

  /**
   * Set a value in cache
   */
  async set<T>(key: string, value: T, ttlSeconds?: number, options: CacheOptions = {}): Promise<void> {
    const fullKey = this.buildKey(key, options.namespace);
    const ttl = ttlSeconds ?? options.ttl ?? this.defaultTtl;

    try {
      // Always set in memory cache as backup
      this.memoryCache.set(fullKey, value, ttl);

      if (this.isRedisConnected && this.redisClient) {
        await this.circuitBreaker.execute(async () => {
          await this.redisClient!.setEx(fullKey, ttl, JSON.stringify(value));
        });
      }

      this.stats.sets++;
      logger.debug('Cache set', {
        key: fullKey,
        ttl,
        correlationId: getCorrelationContext()?.correlationId,
      });
    } catch (error) {
      this.stats.errors++;
      logger.warn('Cache set error', {
        key: fullKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Memory cache was already set, so we're still cached
    }
  }

  /**
   * Delete a value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    const fullKey = this.buildKey(key, options.namespace);

    try {
      this.memoryCache.delete(fullKey);

      if (this.isRedisConnected && this.redisClient) {
        await this.circuitBreaker.execute(async () => {
          await this.redisClient!.del(fullKey);
        });
      }

      this.stats.deletes++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.warn('Cache delete error', {
        key: fullKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   * Uses SCAN instead of KEYS to avoid blocking Redis
   */
  async deletePattern(pattern: string, namespace?: string): Promise<number> {
    const fullPattern = this.buildKey(pattern, namespace);

    try {
      let deleted = this.memoryCache.deletePattern(fullPattern);

      if (this.isRedisConnected && this.redisClient) {
        // Use SCAN instead of KEYS to avoid blocking Redis
        const keysToDelete: string[] = [];

        await this.circuitBreaker.execute(async () => {
          let cursor = 0;
          do {
            const result = await this.redisClient!.scan(cursor, {
              MATCH: fullPattern,
              COUNT: 100,
            });
            cursor = result.cursor;
            keysToDelete.push(...result.keys);
          } while (cursor !== 0);
        });

        if (keysToDelete.length > 0) {
          await this.circuitBreaker.execute(async () => {
            await this.redisClient!.del(keysToDelete);
          });
          deleted = keysToDelete.length;
        }
      }

      this.stats.deletes += deleted;
      return deleted;
    } catch (error) {
      this.stats.errors++;
      logger.warn('Cache deletePattern error', {
        pattern: fullPattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and store
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    await this.set(key, value, ttlSeconds, options);

    return value;
  }

  /**
   * Invalidate user-related caches
   */
  async invalidateUser(userId: string): Promise<void> {
    await this.deletePattern(`user:${userId}:*`);
    logger.info('Invalidated user cache', { userId });
  }

  /**
   * Invalidate chat-related caches
   */
  async invalidateChat(chatId: string): Promise<void> {
    await this.deletePattern(`chat:${chatId}:*`);
    logger.info('Invalidated chat cache', { chatId });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clear all caches
   * Uses SCAN instead of KEYS to avoid blocking Redis
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    if (this.isRedisConnected && this.redisClient) {
      try {
        // Use SCAN instead of KEYS to avoid blocking Redis
        const keysToDelete: string[] = [];
        let cursor = 0;

        do {
          const result = await this.redisClient.scan(cursor, {
            MATCH: `${this.keyPrefix}*`,
            COUNT: 100,
          });
          cursor = result.cursor;
          keysToDelete.push(...result.keys);
        } while (cursor !== 0);

        if (keysToDelete.length > 0) {
          await this.redisClient.del(keysToDelete);
        }
      } catch (error) {
        logger.error('Failed to clear Redis cache', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.isRedisConnected;
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
      this.isRedisConnected = false;
    }
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

export const cacheService = new CacheService();

// =============================================================================
// Cache Decorators (for class methods)
// =============================================================================

/**
 * Decorator to cache method results
 *
 * Usage:
 * @Cached({ ttl: 300, keyPrefix: 'users' })
 * async getUser(id: string) { ... }
 */
export function Cached(options: {
  ttl?: number;
  keyPrefix?: string;
  keyGenerator?: (...args: unknown[]) => string;
}) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const keyBase = options.keyPrefix ?? propertyKey;
      const keyArgs = options.keyGenerator
        ? options.keyGenerator(...args)
        : JSON.stringify(args);
      const cacheKey = `${keyBase}:${keyArgs}`;

      return cacheService.getOrSet(
        cacheKey,
        () => originalMethod.apply(this, args),
        options.ttl ?? CACHE_TTL.MEDIUM
      );
    };

    return descriptor;
  };
}

export default cacheService;

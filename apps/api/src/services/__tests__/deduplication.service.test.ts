import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// Mock the logger and correlation before importing the service
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/correlation.js', () => ({
  getCorrelationContext: jest.fn(() => ({ correlationId: 'test-correlation-id' })),
}));

// Import after mocking
import { deduplicationService } from '../deduplication.service.js';

describe('DeduplicationService', () => {
  beforeEach(() => {
    deduplicationService.clear();
  });

  afterEach(() => {
    deduplicationService.clear();
  });

  describe('isDuplicate', () => {
    it('should return false for new content', () => {
      const hash = 'new-content-hash';
      expect(deduplicationService.isDuplicate(hash)).toBe(false);
    });

    it('should return true for previously processed content', () => {
      const hash = 'duplicate-hash';
      deduplicationService.markProcessed(hash);

      expect(deduplicationService.isDuplicate(hash)).toBe(true);
    });

    it('should return false after entry expires', async () => {
      const hash = 'expiring-hash';
      // Mark with very short TTL
      deduplicationService.markProcessed(hash, undefined, 50);

      expect(deduplicationService.isDuplicate(hash)).toBe(true);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(deduplicationService.isDuplicate(hash)).toBe(false);
    });
  });

  describe('markProcessed', () => {
    it('should mark content as processed', () => {
      const hash = 'processed-hash';
      deduplicationService.markProcessed(hash);

      expect(deduplicationService.isDuplicate(hash)).toBe(true);
    });

    it('should store result with content', () => {
      const hash = 'result-hash';
      const result = { chatId: 'chat-123', messageCount: 10 };
      deduplicationService.markProcessed(hash, result);

      const cached = deduplicationService.getCachedResult(hash);
      expect(cached).toEqual(result);
    });

    it('should use custom TTL when provided', async () => {
      const hash = 'custom-ttl-hash';
      deduplicationService.markProcessed(hash, undefined, 100);

      expect(deduplicationService.isDuplicate(hash)).toBe(true);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(deduplicationService.isDuplicate(hash)).toBe(false);
    });
  });

  describe('getCachedResult', () => {
    it('should return undefined for non-existent hash', () => {
      const result = deduplicationService.getCachedResult('non-existent');
      expect(result).toBeUndefined();
    });

    it('should return cached result', () => {
      const hash = 'cached-hash';
      const data = { status: 'success' };
      deduplicationService.markProcessed(hash, data);

      const result = deduplicationService.getCachedResult(hash);
      expect(result).toEqual(data);
    });

    it('should return undefined after expiration', async () => {
      const hash = 'expiring-cache';
      deduplicationService.markProcessed(hash, { data: 'test' }, 50);

      await new Promise(resolve => setTimeout(resolve, 100));

      const result = deduplicationService.getCachedResult(hash);
      expect(result).toBeUndefined();
    });
  });

  describe('checkIdempotency', () => {
    it('should return isDuplicate false for new key', () => {
      const result = deduplicationService.checkIdempotency('new-key');
      expect(result.isDuplicate).toBe(false);
      expect(result.result).toBeUndefined();
    });

    it('should return isDuplicate true for existing key', () => {
      const key = 'existing-key';
      const storedResult = { response: 'cached' };
      deduplicationService.storeIdempotencyResult(key, storedResult);

      const result = deduplicationService.checkIdempotency(key);
      expect(result.isDuplicate).toBe(true);
      expect(result.result).toEqual(storedResult);
    });

    it('should return isDuplicate false after key expires', async () => {
      const key = 'expiring-key';
      deduplicationService.storeIdempotencyResult(key, { data: 'test' }, 50);

      await new Promise(resolve => setTimeout(resolve, 100));

      const result = deduplicationService.checkIdempotency(key);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('storeIdempotencyResult', () => {
    it('should store result for idempotency key', () => {
      const key = 'idempotency-key';
      const result = { id: 123, status: 'created' };
      deduplicationService.storeIdempotencyResult(key, result);

      const cached = deduplicationService.checkIdempotency(key);
      expect(cached.isDuplicate).toBe(true);
      expect(cached.result).toEqual(result);
    });
  });

  describe('generateContentHash', () => {
    it('should generate consistent hash for same content', () => {
      const content = { message: 'test content' };
      const hash1 = deduplicationService.generateContentHash(content);
      const hash2 = deduplicationService.generateContentHash(content);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = deduplicationService.generateContentHash({ a: 1 });
      const hash2 = deduplicationService.generateContentHash({ a: 2 });

      expect(hash1).not.toBe(hash2);
    });

    it('should handle string content', () => {
      const hash = deduplicationService.generateContentHash('string content');
      expect(hash).toHaveLength(64); // SHA-256 hex string
    });
  });

  describe('generateExtractionHash', () => {
    it('should generate hash from chatId, userId, and time window', () => {
      const hash = deduplicationService.generateExtractionHash('chat-123', 'user-456', 5);
      expect(hash).toHaveLength(64);
    });

    it('should generate same hash within time window', () => {
      const hash1 = deduplicationService.generateExtractionHash('chat-123', 'user-456', 60);
      const hash2 = deduplicationService.generateExtractionHash('chat-123', 'user-456', 60);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different users', () => {
      const hash1 = deduplicationService.generateExtractionHash('chat-123', 'user-1', 5);
      const hash2 = deduplicationService.generateExtractionHash('chat-123', 'user-2', 5);

      expect(hash1).not.toBe(hash2);
    });

    it('should generate different hash for different chats', () => {
      const hash1 = deduplicationService.generateExtractionHash('chat-1', 'user-123', 5);
      const hash2 = deduplicationService.generateExtractionHash('chat-2', 'user-123', 5);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      // Add entries with short TTL
      deduplicationService.markProcessed('entry1', undefined, 50);
      deduplicationService.markProcessed('entry2', undefined, 50);

      expect(deduplicationService.getStats().entries).toBe(2);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger cleanup
      deduplicationService.cleanup();

      expect(deduplicationService.getStats().entries).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return current statistics', () => {
      deduplicationService.markProcessed('hash1');
      deduplicationService.markProcessed('hash2');
      deduplicationService.storeIdempotencyResult('key1', {});

      const stats = deduplicationService.getStats();
      expect(stats.entries).toBe(2);
      expect(stats.idempotencyKeys).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      deduplicationService.markProcessed('hash1');
      deduplicationService.markProcessed('hash2');
      deduplicationService.storeIdempotencyResult('key1', {});

      deduplicationService.clear();

      const stats = deduplicationService.getStats();
      expect(stats.entries).toBe(0);
      expect(stats.idempotencyKeys).toBe(0);
    });
  });
});

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

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
import { metrics, startTimer } from '../metrics.service.js';

describe('MetricsService', () => {
  beforeEach(() => {
    metrics.reset();
  });

  describe('trackExtraction', () => {
    it('should track successful extraction', () => {
      metrics.trackExtraction(true, 'chrome-extension', 100);

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.name === 'extraction_total' && c.labels.status === 'success'
      );

      expect(counter).toBeDefined();
      expect(counter?.value).toBe(1);
    });

    it('should track failed extraction', () => {
      metrics.trackExtraction(false, 'file-upload');

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.name === 'extraction_total' && c.labels.status === 'failure'
      );

      expect(counter).toBeDefined();
      expect(counter?.value).toBe(1);
    });

    it('should track message count histogram for successful extractions', () => {
      metrics.trackExtraction(true, 'chrome-extension', 50);
      metrics.trackExtraction(true, 'chrome-extension', 150);

      const summary = metrics.getSummary();
      const histogram = summary.histograms.find(
        h => h.name === 'extraction_message_count'
      );

      expect(histogram).toBeDefined();
      expect(histogram?.count).toBe(2);
      expect(histogram?.sum).toBe(200);
    });
  });

  describe('trackApiLatency', () => {
    it('should track API request latency', () => {
      metrics.trackApiLatency('/api/chat-export', 'POST', 200, 150);

      const summary = metrics.getSummary();
      const histogram = summary.histograms.find(
        h => h.name === 'api_request_duration_ms'
      );

      expect(histogram).toBeDefined();
      expect(histogram?.count).toBe(1);
      expect(histogram?.sum).toBe(150);
    });

    it('should increment request counter', () => {
      metrics.trackApiLatency('/api/auth/login', 'POST', 200, 50);
      metrics.trackApiLatency('/api/auth/login', 'POST', 200, 60);

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.name === 'api_requests_total' && c.labels.path === '/api/auth/login'
      );

      expect(counter).toBeDefined();
      expect(counter?.value).toBe(2);
    });

    it('should normalize paths with IDs', () => {
      metrics.trackApiLatency('/api/users/123456', 'GET', 200, 30);
      metrics.trackApiLatency('/api/users/789012', 'GET', 200, 40);

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.name === 'api_requests_total' && c.labels.path === '/api/users/:id'
      );

      expect(counter).toBeDefined();
      expect(counter?.value).toBe(2);
    });

    it('should normalize paths with UUIDs', () => {
      metrics.trackApiLatency('/api/chats/550e8400-e29b-41d4-a716-446655440000', 'GET', 200, 25);

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.labels.path === '/api/chats/:id'
      );

      expect(counter).toBeDefined();
    });
  });

  describe('trackQueueDepth', () => {
    it('should set queue depth gauge', () => {
      metrics.trackQueueDepth('summarization', 5);

      const summary = metrics.getSummary();
      const gauge = summary.gauges.find(
        g => g.name === 'queue_depth' && g.labels.queue === 'summarization'
      );

      expect(gauge).toBeDefined();
      expect(gauge?.value).toBe(5);
    });

    it('should update queue depth gauge', () => {
      metrics.trackQueueDepth('summarization', 5);
      metrics.trackQueueDepth('summarization', 10);

      const summary = metrics.getSummary();
      const gauge = summary.gauges.find(
        g => g.name === 'queue_depth' && g.labels.queue === 'summarization'
      );

      expect(gauge?.value).toBe(10);
    });
  });

  describe('trackQueueProcessing', () => {
    it('should track successful queue processing', () => {
      metrics.trackQueueProcessing('summarization', true, 500);

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.name === 'queue_processed_total' &&
            c.labels.queue === 'summarization' &&
            c.labels.status === 'success'
      );

      expect(counter).toBeDefined();
      expect(counter?.value).toBe(1);
    });

    it('should track failed queue processing', () => {
      metrics.trackQueueProcessing('summarization', false, 1000);

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.name === 'queue_processed_total' &&
            c.labels.status === 'failure'
      );

      expect(counter).toBeDefined();
      expect(counter?.value).toBe(1);
    });

    it('should track processing duration', () => {
      metrics.trackQueueProcessing('email', true, 250);

      const summary = metrics.getSummary();
      const histogram = summary.histograms.find(
        h => h.name === 'queue_processing_duration_ms'
      );

      expect(histogram).toBeDefined();
      expect(histogram?.sum).toBe(250);
    });
  });

  describe('trackAiUsage', () => {
    it('should track AI request', () => {
      metrics.trackAiUsage('azure-openai', 'gpt-4', 1500, 2000, true);

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.name === 'ai_requests_total' &&
            c.labels.provider === 'azure-openai'
      );

      expect(counter).toBeDefined();
      expect(counter?.value).toBe(1);
    });

    it('should track token usage for successful requests', () => {
      metrics.trackAiUsage('azure-openai', 'gpt-4', 1500, 2000, true);
      metrics.trackAiUsage('azure-openai', 'gpt-4', 2000, 2500, true);

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.name === 'ai_tokens_total' &&
            c.labels.provider === 'azure-openai'
      );

      expect(counter).toBeDefined();
      expect(counter?.value).toBe(3500);
    });

    it('should not track tokens for failed requests', () => {
      metrics.trackAiUsage('azure-openai', 'gpt-4', 1500, 2000, false);

      const summary = metrics.getSummary();
      const counter = summary.counters.find(
        c => c.name === 'ai_tokens_total'
      );

      expect(counter).toBeUndefined();
    });

    it('should track AI request duration', () => {
      metrics.trackAiUsage('openai', 'gpt-3.5-turbo', 500, 1500, true);

      const summary = metrics.getSummary();
      const histogram = summary.histograms.find(
        h => h.name === 'ai_request_duration_ms'
      );

      expect(histogram).toBeDefined();
      expect(histogram?.sum).toBe(1500);
    });
  });

  describe('trackActiveConnections', () => {
    it('should increment connection count', () => {
      metrics.trackActiveConnections('websocket', 1);
      metrics.trackActiveConnections('websocket', 1);

      const summary = metrics.getSummary();
      const gauge = summary.gauges.find(
        g => g.name === 'active_connections' && g.labels.type === 'websocket'
      );

      expect(gauge?.value).toBe(2);
    });

    it('should decrement connection count', () => {
      metrics.trackActiveConnections('websocket', 1);
      metrics.trackActiveConnections('websocket', 1);
      metrics.trackActiveConnections('websocket', -1);

      const summary = metrics.getSummary();
      const gauge = summary.gauges.find(
        g => g.name === 'active_connections' && g.labels.type === 'websocket'
      );

      expect(gauge?.value).toBe(1);
    });
  });

  describe('getSummary', () => {
    it('should return all metrics', () => {
      metrics.trackExtraction(true, 'test', 10);
      metrics.trackQueueDepth('test', 5);
      metrics.trackApiLatency('/test', 'GET', 200, 100);

      const summary = metrics.getSummary();

      expect(summary.counters).toBeDefined();
      expect(summary.gauges).toBeDefined();
      expect(summary.histograms).toBeDefined();
    });

    it('should calculate percentiles for histograms', () => {
      // Add multiple latency measurements
      for (let i = 0; i < 100; i++) {
        metrics.trackApiLatency('/test', 'GET', 200, i * 10);
      }

      const summary = metrics.getSummary();
      const histogram = summary.histograms.find(
        h => h.name === 'api_request_duration_ms'
      );

      expect(histogram?.percentiles).toBeDefined();
      expect(histogram?.percentiles.p50).toBeGreaterThan(0);
      expect(histogram?.percentiles.p95).toBeGreaterThan(histogram?.percentiles.p50 ?? 0);
      expect(histogram?.percentiles.p99).toBeGreaterThanOrEqual(histogram?.percentiles.p95 ?? 0);
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      metrics.trackExtraction(true, 'test', 10);
      metrics.trackQueueDepth('test', 5);
      metrics.trackApiLatency('/test', 'GET', 200, 100);

      metrics.reset();

      const summary = metrics.getSummary();
      expect(summary.counters).toHaveLength(0);
      expect(summary.gauges).toHaveLength(0);
      expect(summary.histograms).toHaveLength(0);
    });
  });
});

describe('startTimer', () => {
  it('should return elapsed time', async () => {
    const getElapsed = startTimer();

    await new Promise(resolve => setTimeout(resolve, 50));

    const elapsed = getElapsed();
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(elapsed).toBeLessThan(150);
  });

  it('should return different values on multiple calls', async () => {
    const getElapsed = startTimer();

    await new Promise(resolve => setTimeout(resolve, 20));
    const elapsed1 = getElapsed();

    await new Promise(resolve => setTimeout(resolve, 20));
    const elapsed2 = getElapsed();

    expect(elapsed2).toBeGreaterThan(elapsed1);
  });
});

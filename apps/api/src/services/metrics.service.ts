/**
 * Metrics Service
 *
 * Provides lightweight metrics collection for observability.
 * Tracks extraction success rates, API latency, queue depth, and AI usage.
 *
 * In production, these metrics can be forwarded to:
 * - Azure Application Insights
 * - Prometheus/Grafana
 * - Custom dashboards
 */

import { logger } from '../utils/logger.js';
import { getCorrelationContext } from '../middleware/correlation.js';

// =============================================================================
// Types
// =============================================================================

export interface MetricLabels {
  [key: string]: string | number | boolean;
}

interface HistogramBucket {
  le: number; // less than or equal
  count: number;
}

interface Histogram {
  name: string;
  labels: MetricLabels;
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

interface Counter {
  name: string;
  labels: MetricLabels;
  value: number;
}

interface Gauge {
  name: string;
  labels: MetricLabels;
  value: number;
}

// =============================================================================
// In-Memory Metrics Storage
// =============================================================================

class MetricsCollector {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();

  // Default histogram buckets for latency (in ms)
  private defaultBuckets = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

  /**
   * Generate a unique key for a metric with labels
   */
  private getKey(name: string, labels: MetricLabels = {}): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const key = this.getKey(name, labels);
    const existing = this.counters.get(key);

    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { name, labels, value });
    }
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: MetricLabels = {}): void {
    const key = this.getKey(name, labels);
    this.gauges.set(key, { name, labels, value });
  }

  /**
   * Increment a gauge
   */
  incrementGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const key = this.getKey(name, labels);
    const existing = this.gauges.get(key);

    if (existing) {
      existing.value += value;
    } else {
      this.gauges.set(key, { name, labels, value });
    }
  }

  /**
   * Decrement a gauge
   */
  decrementGauge(name: string, labels: MetricLabels = {}, value: number = 1): void {
    this.incrementGauge(name, labels, -value);
  }

  /**
   * Observe a value in a histogram
   */
  observeHistogram(name: string, value: number, labels: MetricLabels = {}, buckets?: number[]): void {
    const key = this.getKey(name, labels);
    const bucketsToUse = buckets || this.defaultBuckets;

    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        name,
        labels,
        buckets: bucketsToUse.map(le => ({ le, count: 0 })),
        sum: 0,
        count: 0,
      };
      this.histograms.set(key, histogram);
    }

    // Update histogram
    histogram.sum += value;
    histogram.count++;

    for (const bucket of histogram.buckets) {
      if (value <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * Get all metrics as a summary object
   */
  getSummary(): {
    counters: Counter[];
    gauges: Gauge[];
    histograms: Array<Histogram & { percentiles: { p50: number; p95: number; p99: number } }>;
  } {
    const histogramsWithPercentiles = Array.from(this.histograms.values()).map(h => ({
      ...h,
      percentiles: this.calculatePercentiles(h),
    }));

    return {
      counters: Array.from(this.counters.values()),
      gauges: Array.from(this.gauges.values()),
      histograms: histogramsWithPercentiles,
    };
  }

  /**
   * Calculate approximate percentiles from histogram
   */
  private calculatePercentiles(histogram: Histogram): { p50: number; p95: number; p99: number } {
    if (histogram.count === 0) {
      return { p50: 0, p95: 0, p99: 0 };
    }

    const findPercentile = (p: number): number => {
      const target = histogram.count * (p / 100);
      for (const bucket of histogram.buckets) {
        if (bucket.count >= target) {
          return bucket.le;
        }
      }
      return histogram.buckets[histogram.buckets.length - 1]?.le || 0;
    };

    return {
      p50: findPercentile(50),
      p95: findPercentile(95),
      p99: findPercentile(99),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

const collector = new MetricsCollector();

// =============================================================================
// High-Level Metrics API
// =============================================================================

export const metrics = {
  /**
   * Track extraction attempt
   */
  trackExtraction(success: boolean, source: string, messageCount?: number): void {
    const status = success ? 'success' : 'failure';
    collector.incrementCounter('extraction_total', { status, source });

    if (success && messageCount !== undefined) {
      collector.observeHistogram('extraction_message_count', messageCount, { source });
    }

    // Log metric
    const context = getCorrelationContext();
    logger.info('Extraction tracked', {
      type: 'metric',
      metric: 'extraction_total',
      status,
      source,
      messageCount,
      correlationId: context?.correlationId,
    });
  },

  /**
   * Track API request latency
   */
  trackApiLatency(path: string, method: string, statusCode: number, durationMs: number): void {
    const labels = {
      path: normalizePathForMetrics(path),
      method,
      status: statusCode.toString(),
    };

    collector.observeHistogram('api_request_duration_ms', durationMs, labels);
    collector.incrementCounter('api_requests_total', labels);

    // Log slow requests
    if (durationMs > 1000) {
      logger.warn('Slow API request', {
        type: 'slow_request',
        path,
        method,
        statusCode,
        durationMs,
      });
    }
  },

  /**
   * Track queue operations
   */
  trackQueueDepth(queueName: string, depth: number): void {
    collector.setGauge('queue_depth', depth, { queue: queueName });
  },

  /**
   * Track queue processing
   */
  trackQueueProcessing(queueName: string, success: boolean, durationMs: number): void {
    const status = success ? 'success' : 'failure';
    collector.incrementCounter('queue_processed_total', { queue: queueName, status });
    collector.observeHistogram('queue_processing_duration_ms', durationMs, { queue: queueName });
  },

  /**
   * Track AI provider usage
   */
  trackAiUsage(provider: string, model: string, tokens: number, durationMs: number, success: boolean): void {
    const status = success ? 'success' : 'failure';
    const labels = { provider, model, status };

    collector.incrementCounter('ai_requests_total', labels);
    collector.observeHistogram('ai_request_duration_ms', durationMs, { provider, model });

    if (success) {
      collector.incrementCounter('ai_tokens_total', { provider, model }, tokens);
    }

    logger.info('AI usage tracked', {
      type: 'metric',
      metric: 'ai_usage',
      provider,
      model,
      tokens,
      durationMs,
      status,
    });
  },

  /**
   * Track active connections (WebSocket, etc.)
   */
  trackActiveConnections(type: string, delta: number): void {
    collector.incrementGauge('active_connections', { type }, delta);
  },

  /**
   * Get current metrics summary
   */
  getSummary: () => collector.getSummary(),

  /**
   * Reset all metrics (for testing)
   */
  reset: () => collector.reset(),
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Normalize API path for metrics (remove dynamic IDs)
 */
function normalizePathForMetrics(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:id')
    .replace(/\/chat_[^/]+/g, '/:chatId')
    .replace(/\/user_[^/]+/g, '/:userId');
}

/**
 * Timer utility for measuring durations
 */
export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

// =============================================================================
// Express Middleware for Automatic Latency Tracking
// =============================================================================

import { Request, Response, NextFunction } from 'express';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const getElapsed = startTimer();

  res.on('finish', () => {
    const duration = getElapsed();
    metrics.trackApiLatency(req.path, req.method, res.statusCode, duration);
  });

  next();
}

export default metrics;

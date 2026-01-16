/**
 * Circuit Breaker Service
 *
 * Implements the circuit breaker pattern to prevent cascade failures
 * when backend services are unhealthy.
 *
 * States:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Failing, requests are rejected immediately
 * - HALF_OPEN: Testing recovery, limited requests allowed
 *
 * Usage:
 * const breaker = new CircuitBreaker('azure-openai', { failureThreshold: 5 });
 * const result = await breaker.execute(() => callAzureOpenAI());
 */

import { logger } from '../utils/logger.js';
import { metrics } from './metrics.service.js';

// =============================================================================
// Types
// =============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in ms before attempting recovery */
  resetTimeout?: number;
  /** Number of successful requests to close circuit */
  successThreshold?: number;
  /** Time window for counting failures (ms) */
  windowDuration?: number;
  /** Custom function to determine if error should count as failure */
  isFailure?: (error: Error) => boolean;
}

export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure?: Date;
  lastStateChange: Date;
  totalRequests: number;
  totalFailures: number;
}

// =============================================================================
// Circuit Breaker Implementation
// =============================================================================

export class CircuitBreaker {
  private name: string;
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure?: Date;
  private lastStateChange: Date = new Date();
  private totalRequests: number = 0;
  private totalFailures: number = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;
  private readonly windowDuration: number;
  private readonly isFailure: (error: Error) => boolean;

  private failureTimestamps: number[] = [];

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30000; // 30 seconds
    this.successThreshold = options.successThreshold ?? 2;
    this.windowDuration = options.windowDuration ?? 60000; // 1 minute
    this.isFailure = options.isFailure ?? defaultIsFailure;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptRecovery()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        this.recordRejection();
        throw new CircuitOpenError(this.name, this.getTimeUntilRetry());
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Check if request is allowed without executing
   */
  isAllowed(): boolean {
    if (this.state === CircuitState.CLOSED) return true;
    if (this.state === CircuitState.HALF_OPEN) return true;
    return this.shouldAttemptRecovery();
  }

  /**
   * Get current circuit statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.failures = 0;
    this.successes = 0;
    this.failureTimestamps = [];
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private onSuccess(): void {
    this.successes++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.failures = 0;
        this.failureTimestamps = [];
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Remove old failures outside the window
      this.pruneOldFailures();
    }

    metrics.trackQueueProcessing(`circuit-${this.name}`, true, 0);
  }

  private onFailure(error: Error): void {
    if (!this.isFailure(error)) {
      // Don't count this as a circuit breaker failure
      return;
    }

    this.failures++;
    this.totalFailures++;
    this.lastFailure = new Date();
    this.failureTimestamps.push(Date.now());

    // Prune old failures
    this.pruneOldFailures();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.transitionTo(CircuitState.OPEN);
      this.successes = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we've exceeded the threshold
      if (this.getRecentFailures() >= this.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
        this.successes = 0;
      }
    }

    metrics.trackQueueProcessing(`circuit-${this.name}`, false, 0);
    logger.warn(`Circuit breaker ${this.name} recorded failure`, {
      state: this.state,
      failures: this.failures,
      recentFailures: this.getRecentFailures(),
      error: error.message,
    });
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    logger.info(`Circuit breaker ${this.name} state change: ${oldState} -> ${newState}`);

    // Track state changes as metrics
    metrics.trackQueueDepth(`circuit-${this.name}-state`, stateToNumber(newState));
  }

  private shouldAttemptRecovery(): boolean {
    if (!this.lastFailure) return true;
    const timeSinceFailure = Date.now() - this.lastFailure.getTime();
    return timeSinceFailure >= this.resetTimeout;
  }

  private getTimeUntilRetry(): number {
    if (!this.lastFailure) return 0;
    const timeSinceFailure = Date.now() - this.lastFailure.getTime();
    return Math.max(0, this.resetTimeout - timeSinceFailure);
  }

  private pruneOldFailures(): void {
    const cutoff = Date.now() - this.windowDuration;
    this.failureTimestamps = this.failureTimestamps.filter(ts => ts > cutoff);
  }

  private getRecentFailures(): number {
    this.pruneOldFailures();
    return this.failureTimestamps.length;
  }

  private recordRejection(): void {
    logger.debug(`Circuit breaker ${this.name} rejected request (circuit OPEN)`);
  }
}

// =============================================================================
// Error Classes
// =============================================================================

export class CircuitOpenError extends Error {
  public readonly serviceName: string;
  public readonly retryAfterMs: number;

  constructor(serviceName: string, retryAfterMs: number) {
    super(`Service ${serviceName} is unavailable (circuit breaker open). Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.retryAfterMs = retryAfterMs;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

function defaultIsFailure(error: Error): boolean {
  // Don't count client errors (4xx) as circuit breaker failures
  // except for rate limiting (429)
  if (error.message.includes('400') ||
      error.message.includes('401') ||
      error.message.includes('403') ||
      error.message.includes('404') ||
      error.message.includes('422')) {
    return false;
  }
  return true;
}

function stateToNumber(state: CircuitState): number {
  switch (state) {
    case CircuitState.CLOSED: return 0;
    case CircuitState.HALF_OPEN: return 1;
    case CircuitState.OPEN: return 2;
  }
}

// =============================================================================
// Circuit Breaker Registry
// =============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker by name
 */
export function getCircuitBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
  let breaker = circuitBreakers.get(name);
  if (!breaker) {
    breaker = new CircuitBreaker(name, options);
    circuitBreakers.set(name, breaker);
  }
  return breaker;
}

/**
 * Get all circuit breaker statistics
 */
export function getAllCircuitBreakerStats(): CircuitBreakerStats[] {
  return Array.from(circuitBreakers.values()).map(breaker => breaker.getStats());
}

/**
 * Reset all circuit breakers
 */
export function resetAllCircuitBreakers(): void {
  circuitBreakers.forEach(breaker => breaker.reset());
}

export default CircuitBreaker;

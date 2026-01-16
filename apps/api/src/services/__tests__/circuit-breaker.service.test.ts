import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  CircuitBreaker,
  CircuitState,
  CircuitOpenError,
  getCircuitBreaker,
  getAllCircuitBreakerStats,
  resetAllCircuitBreakers,
} from '../circuit-breaker.service.js';

// Mock the logger and metrics
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../metrics.service.js', () => ({
  metrics: {
    trackQueueProcessing: jest.fn(),
    trackQueueDepth: jest.fn(),
  },
}));

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      resetTimeout: 1000,
      successThreshold: 2,
      windowDuration: 5000,
    });
  });

  afterEach(() => {
    breaker.reset();
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(0);
    });

    it('should allow requests in CLOSED state', () => {
      expect(breaker.isAllowed()).toBe(true);
    });
  });

  describe('successful operations', () => {
    it('should execute function successfully', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should track successful requests', async () => {
      await breaker.execute(async () => 'success');
      const stats = breaker.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.successes).toBe(1);
    });

    it('should remain CLOSED after successful requests', async () => {
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');
      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
    });
  });

  describe('failure handling', () => {
    it('should count failures', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('Test error');
        });
      } catch {}

      const stats = breaker.getStats();
      expect(stats.failures).toBe(1);
      expect(stats.totalFailures).toBe(1);
    });

    it('should open circuit after threshold failures', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch {}
      }

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
    });

    it('should reject requests when circuit is OPEN', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch {}
      }

      // Verify circuit is open
      expect(breaker.getStats().state).toBe(CircuitState.OPEN);

      // Next request should throw CircuitOpenError
      await expect(
        breaker.execute(async () => 'should not run')
      ).rejects.toThrow(CircuitOpenError);
    });

    it('should not count 4xx errors as failures by default', async () => {
      try {
        await breaker.execute(async () => {
          throw new Error('Request failed with 404');
        });
      } catch {}

      const stats = breaker.getStats();
      expect(stats.failures).toBe(0);
    });
  });

  describe('recovery', () => {
    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch {}
      }

      expect(breaker.getStats().state).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next check should allow request (transition to HALF_OPEN)
      expect(breaker.isAllowed()).toBe(true);
    });

    it('should close circuit after successful requests in HALF_OPEN', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch {}
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute successful requests
      await breaker.execute(async () => 'success');
      await breaker.execute(async () => 'success');

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
    });

    it('should reopen circuit on failure in HALF_OPEN', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch {}
      }

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Execute a failing request
      try {
        await breaker.execute(async () => {
          throw new Error('Still failing');
        });
      } catch {}

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.OPEN);
    });
  });

  describe('manual reset', () => {
    it('should reset circuit to CLOSED state', async () => {
      // Trip the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(async () => {
            throw new Error('Test error');
          });
        } catch {}
      }

      expect(breaker.getStats().state).toBe(CircuitState.OPEN);

      breaker.reset();

      const stats = breaker.getStats();
      expect(stats.state).toBe(CircuitState.CLOSED);
      expect(stats.failures).toBe(0);
    });
  });

  describe('custom failure detection', () => {
    it('should use custom isFailure function', async () => {
      const customBreaker = new CircuitBreaker('custom-service', {
        failureThreshold: 2,
        isFailure: (error) => error.message.includes('critical'),
      });

      // Non-critical errors should not count
      try {
        await customBreaker.execute(async () => {
          throw new Error('minor issue');
        });
      } catch {}

      expect(customBreaker.getStats().failures).toBe(0);

      // Critical errors should count
      try {
        await customBreaker.execute(async () => {
          throw new Error('critical failure');
        });
      } catch {}

      expect(customBreaker.getStats().failures).toBe(1);
    });
  });
});

describe('CircuitOpenError', () => {
  it('should contain service name and retry information', () => {
    const error = new CircuitOpenError('my-service', 5000);

    expect(error.serviceName).toBe('my-service');
    expect(error.retryAfterMs).toBe(5000);
    expect(error.message).toContain('my-service');
    expect(error.message).toContain('5s');
  });
});

describe('Circuit Breaker Registry', () => {
  beforeEach(() => {
    resetAllCircuitBreakers();
  });

  it('should create and retrieve circuit breakers by name', () => {
    const breaker1 = getCircuitBreaker('service-a');
    const breaker2 = getCircuitBreaker('service-a');

    expect(breaker1).toBe(breaker2);
  });

  it('should create different circuit breakers for different names', () => {
    const breaker1 = getCircuitBreaker('service-a');
    const breaker2 = getCircuitBreaker('service-b');

    expect(breaker1).not.toBe(breaker2);
  });

  it('should return stats for all circuit breakers', async () => {
    getCircuitBreaker('service-a');
    getCircuitBreaker('service-b');

    const stats = getAllCircuitBreakerStats();

    expect(stats).toHaveLength(2);
    expect(stats.map(s => s.name)).toContain('service-a');
    expect(stats.map(s => s.name)).toContain('service-b');
  });

  it('should reset all circuit breakers', async () => {
    const breaker = getCircuitBreaker('service-reset', { failureThreshold: 1 });

    // Trip the circuit
    try {
      await breaker.execute(async () => {
        throw new Error('Test error');
      });
    } catch {}

    expect(breaker.getStats().state).toBe(CircuitState.OPEN);

    resetAllCircuitBreakers();

    expect(breaker.getStats().state).toBe(CircuitState.CLOSED);
  });
});

/**
 * Correlation ID Middleware
 *
 * Generates and propagates correlation IDs for distributed tracing.
 * Correlation IDs flow from Chrome extension → API → Azure services.
 *
 * Headers:
 * - x-correlation-id: Main correlation ID for end-to-end tracing
 * - x-request-id: Unique ID for this specific request
 *
 * Usage:
 * app.use(correlationMiddleware);
 */

import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

// =============================================================================
// Types
// =============================================================================

export interface CorrelationContext {
  correlationId: string;
  requestId: string;
  userId?: string;
  source?: string;
  startTime: number;
}

// =============================================================================
// Async Local Storage for Context Propagation
// =============================================================================

const asyncLocalStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Get the current correlation context
 */
export function getCorrelationContext(): CorrelationContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Get the current correlation ID (shorthand)
 */
export function getCorrelationId(): string | undefined {
  return asyncLocalStorage.getStore()?.correlationId;
}

/**
 * Get the current request ID (shorthand)
 */
export function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}

/**
 * Run a function with a specific correlation context
 */
export function runWithCorrelation<T>(context: CorrelationContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

// =============================================================================
// Middleware
// =============================================================================

/**
 * Express middleware to set up correlation context
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Get or generate correlation ID
  const correlationId =
    req.headers['x-correlation-id'] as string ||
    req.headers['x-request-id'] as string ||
    generateId('corr');

  // Always generate a new request ID for this specific request
  const requestId = generateId('req');

  // Extract user ID if available (set by auth middleware)
  const userId = (req as any).user?.id;

  // Determine source (e.g., chrome-extension, web, api)
  const source = req.headers['x-source'] as string || 'unknown';

  // Create correlation context
  const context: CorrelationContext = {
    correlationId,
    requestId,
    userId,
    source,
    startTime: Date.now(),
  };

  // Set response headers for client tracing
  res.setHeader('x-correlation-id', correlationId);
  res.setHeader('x-request-id', requestId);

  // Augment request with correlation data
  (req as any).correlationId = correlationId;
  (req as any).requestId = requestId;

  // Run the rest of the request in the correlation context
  asyncLocalStorage.run(context, () => {
    // Log request start
    logRequestStart(req);

    // Capture response finish for logging
    const originalEnd = res.end.bind(res);
    res.end = function(this: Response, ...args: any[]) {
      logRequestEnd(req, res);
      return originalEnd(...args);
    } as typeof res.end;

    next();
  });
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate a unique ID with a prefix
 */
function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().replace(/-/g, '').substring(0, 12);
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * Log request start
 */
function logRequestStart(req: Request): void {
  const context = getCorrelationContext();
  if (!context) return;

  const logData = {
    type: 'request_start',
    correlationId: context.correlationId,
    requestId: context.requestId,
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent'],
    source: context.source,
    userId: context.userId,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(logData));
}

/**
 * Log request end
 */
function logRequestEnd(req: Request, res: Response): void {
  const context = getCorrelationContext();
  if (!context) return;

  const duration = Date.now() - context.startTime;

  const logData = {
    type: 'request_end',
    correlationId: context.correlationId,
    requestId: context.requestId,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration,
    userId: context.userId,
    timestamp: new Date().toISOString(),
  };

  console.log(JSON.stringify(logData));
}

// =============================================================================
// Utility Functions for External Services
// =============================================================================

/**
 * Get headers to propagate correlation context to external services
 */
export function getCorrelationHeaders(): Record<string, string> {
  const context = getCorrelationContext();
  if (!context) return {};

  return {
    'x-correlation-id': context.correlationId,
    'x-request-id': context.requestId,
  };
}

/**
 * Create Azure-compatible trace headers
 */
export function getAzureTraceHeaders(): Record<string, string> {
  const context = getCorrelationContext();
  if (!context) return {};

  // Azure uses traceparent format for distributed tracing
  // Format: version-traceId-spanId-flags
  const traceId = context.correlationId.replace(/[^a-f0-9]/gi, '').substring(0, 32).padEnd(32, '0');
  const spanId = context.requestId.replace(/[^a-f0-9]/gi, '').substring(0, 16).padEnd(16, '0');

  return {
    'traceparent': `00-${traceId}-${spanId}-01`,
    'x-ms-client-request-id': context.requestId,
  };
}

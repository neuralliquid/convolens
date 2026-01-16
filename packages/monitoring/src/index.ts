/**
 * Error Monitoring & Observability Package
 *
 * POC Implementation: Centralized error monitoring and logging
 *
 * Provides unified error tracking, performance monitoring, and logging
 * across all applications in the monorepo.
 *
 * Integration Points:
 * - Sentry for error tracking (when configured)
 * - Custom logger for development
 * - Performance monitoring hooks
 *
 * TODO: Production Hardening
 * - Add source map support
 * - Implement session replay
 * - Add custom breadcrumbs
 * - Implement user feedback collection
 * - Add performance budgets and alerts
 *
 * Future Enhancements:
 * - Real-time dashboards
 * - Alerting integrations (Slack, PagerDuty)
 * - Cost optimization tracking
 * - User journey tracking
 */

// Types
export interface MonitoringConfig {
  dsn?: string;
  environment: 'development' | 'staging' | 'production';
  release?: string;
  sampleRate?: number;
  tracesSampleRate?: number;
  debug?: boolean;
  enabled?: boolean;
}

export interface ErrorContext {
  userId?: string;
  email?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
}

export interface PerformanceSpan {
  name: string;
  op: string;
  startTime: number;
  data?: Record<string, unknown>;
}

// Default configuration
const DEFAULT_CONFIG: MonitoringConfig = {
  environment: (process.env['NODE_ENV'] as MonitoringConfig['environment']) || 'development',
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  debug: process.env['NODE_ENV'] === 'development',
  enabled: process.env['NODE_ENV'] !== 'test',
};

// State
let config: MonitoringConfig = DEFAULT_CONFIG;
let isInitialized = false;
let sentryModule: any = null;

/**
 * Initialize the monitoring system
 */
export async function initMonitoring(userConfig: Partial<MonitoringConfig> = {}): Promise<void> {
  config = { ...DEFAULT_CONFIG, ...userConfig };

  if (!config.enabled) {
    console.info('[Monitoring] Disabled in current environment');
    return;
  }

  // Try to initialize Sentry if DSN is provided
  if (config.dsn) {
    try {
      // Dynamic import to avoid bundling Sentry if not used
      sentryModule = await import('@sentry/node');

      sentryModule.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        sampleRate: config.sampleRate,
        tracesSampleRate: config.tracesSampleRate,
        debug: config.debug,
        integrations: [
          // Add integrations as needed
        ],
        beforeSend(event: any) {
          // Filter or modify events before sending
          if (config.environment === 'development') {
            console.debug('[Monitoring] Event captured:', event.message || event.exception);
          }
          return event;
        },
      });

      console.info('[Monitoring] Sentry initialized successfully');
    } catch (error) {
      console.warn('[Monitoring] Sentry not available, using fallback logging');
    }
  } else {
    console.info('[Monitoring] No DSN configured, using console logging');
  }

  isInitialized = true;
}

/**
 * Capture an exception
 */
export function captureException(error: Error, context?: ErrorContext): string {
  const eventId = generateEventId();

  // Log to console in development
  if (config.debug || !sentryModule) {
    console.error('[Monitoring] Exception captured:', {
      eventId,
      error: error.message,
      stack: error.stack,
      context,
    });
  }

  // Send to Sentry if available
  if (sentryModule) {
    sentryModule.withScope((scope: any) => {
      if (context?.userId) scope.setUser({ id: context.userId, email: context.email });
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => scope.setTag(key, value));
      }
      if (context?.extra) scope.setExtras(context.extra);
      if (context?.level) scope.setLevel(context.level);

      sentryModule.captureException(error);
    });
  }

  return eventId;
}

/**
 * Capture a message
 */
export function captureMessage(
  message: string,
  level: ErrorContext['level'] = 'info',
  context?: Omit<ErrorContext, 'level'>
): string {
  const eventId = generateEventId();

  // Log to console
  const logMethod = level === 'error' || level === 'fatal' ? 'error' : level === 'warning' ? 'warn' : 'info';
  console[logMethod](`[Monitoring] ${message}`, context);

  // Send to Sentry if available
  if (sentryModule) {
    sentryModule.withScope((scope: any) => {
      if (context?.userId) scope.setUser({ id: context.userId, email: context.email });
      if (context?.tags) {
        Object.entries(context.tags).forEach(([key, value]) => scope.setTag(key, value));
      }
      if (context?.extra) scope.setExtras(context.extra);

      sentryModule.captureMessage(message, level);
    });
  }

  return eventId;
}

/**
 * Set user context for error tracking
 */
export function setUser(user: { id: string; email?: string; name?: string } | null): void {
  if (sentryModule) {
    sentryModule.setUser(user);
  }

  if (config.debug) {
    console.debug('[Monitoring] User context set:', user?.id || 'cleared');
  }
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}): void {
  if (sentryModule) {
    sentryModule.addBreadcrumb({
      ...breadcrumb,
      timestamp: Date.now() / 1000,
    });
  }

  if (config.debug) {
    console.debug(`[Breadcrumb] ${breadcrumb.category}: ${breadcrumb.message}`);
  }
}

/**
 * Start a performance span
 */
export function startSpan(name: string, op: string, data?: Record<string, unknown>): PerformanceSpan {
  const span: PerformanceSpan = {
    name,
    op,
    startTime: performance.now(),
    data,
  };

  if (config.debug) {
    console.debug(`[Performance] Started: ${op} - ${name}`);
  }

  return span;
}

/**
 * End a performance span
 */
export function endSpan(span: PerformanceSpan): number {
  const duration = performance.now() - span.startTime;

  if (config.debug) {
    console.debug(`[Performance] Completed: ${span.op} - ${span.name} (${duration.toFixed(2)}ms)`);
  }

  // In production, send to monitoring service
  if (sentryModule && config.tracesSampleRate && Math.random() < config.tracesSampleRate) {
    // Would create a Sentry transaction/span here
  }

  return duration;
}

/**
 * Create an error boundary wrapper for React components
 */
export function createErrorBoundary(fallback?: React.ReactNode): any {
  // Returns a higher-order component for error boundaries
  // Implementation would wrap components in try/catch and report errors
  return {
    onError: (error: Error, componentStack: string) => {
      captureException(error, {
        extra: { componentStack },
        tags: { type: 'react-error-boundary' },
      });
    },
    fallback,
  };
}

/**
 * Middleware for Express error handling
 */
export function expressErrorHandler() {
  return (error: Error, req: any, res: any, _next: any) => {
    const eventId = captureException(error, {
      extra: {
        url: req.url,
        method: req.method,
        headers: req.headers,
        query: req.query,
        body: req.body,
      },
      tags: {
        type: 'express-error',
        path: req.path,
      },
    });

    res.status(500).json({
      message: 'Internal server error',
      eventId,
    });
  };
}

/**
 * Request handler wrapper for automatic error capture
 */
export function wrapHandler<T extends (...args: any[]) => Promise<any>>(
  handler: T,
  name?: string
): T {
  return (async (...args: any[]) => {
    const span = startSpan(name || handler.name || 'anonymous', 'http.handler');

    try {
      const result = await handler(...args);
      endSpan(span);
      return result;
    } catch (error) {
      endSpan(span);
      captureException(error as Error, {
        tags: { handler: name || handler.name },
      });
      throw error;
    }
  }) as T;
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  return 'evt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Flush pending events (useful before process exit)
 */
export async function flush(timeout = 2000): Promise<boolean> {
  if (sentryModule) {
    return sentryModule.flush(timeout);
  }
  return true;
}

// Export configuration getter
export function getConfig(): MonitoringConfig {
  return { ...config };
}

// Export initialization check
export function isMonitoringInitialized(): boolean {
  return isInitialized;
}

import winston, { format } from 'winston';
import 'winston-daily-rotate-file';
import { getCorrelationContext } from '../middleware/correlation.js';

declare module 'winston' {
  interface Logger {
    error: winston.LeveledLogMethod;
    warn: winston.LeveledLogMethod;
    info: winston.LeveledLogMethod;
    http: winston.LeveledLogMethod;
    verbose: winston.LeveledLogMethod;
    debug: winston.LeveledLogMethod;
    silly: winston.LeveledLogMethod;
  }
}

const { combine, timestamp, printf, colorize, errors } = format;

// =============================================================================
// Log Formats
// =============================================================================

/**
 * Development format - human readable with colors
 */
const devFormat = printf(({ level, message, timestamp, correlationId, requestId, ...meta }) => {
  const corrPrefix = correlationId ? `[${correlationId}] ` : '';
  const reqPrefix = requestId ? `[${requestId}] ` : '';
  const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${corrPrefix}${reqPrefix}[${level}]: ${message}${metaStr}`;
});

/**
 * Production format - structured JSON for log aggregation
 */
const prodFormat = printf(({ level, message, timestamp, ...meta }) => {
  const context = getCorrelationContext();
  const logEntry = {
    timestamp,
    level,
    message,
    correlationId: context?.correlationId,
    requestId: context?.requestId,
    userId: context?.userId,
    ...meta,
  };
  return JSON.stringify(logEntry);
});

/**
 * Add correlation context to log entries
 */
const addCorrelation = format((info) => {
  const context = getCorrelationContext();
  if (context) {
    info.correlationId = context.correlationId;
    info.requestId = context.requestId;
    if (context.userId) {
      info.userId = context.userId;
    }
  }
  return info;
});

// =============================================================================
// Logger Configuration
// =============================================================================

const isProduction = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    addCorrelation(),
  ),
  defaultMeta: {
    service: 'whatssummarize-api',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console transport - colored for dev, JSON for prod
    new winston.transports.Console({
      format: isProduction
        ? prodFormat
        : combine(colorize(), devFormat)
    }),
    // Error log file
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error',
      format: prodFormat,
    }),
    // Combined log file
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: prodFormat,
    }),
  ],
  exitOnError: false,
});

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Log with additional context
 */
export function logWithContext(
  level: 'error' | 'warn' | 'info' | 'debug',
  message: string,
  context: Record<string, unknown> = {}
): void {
  const correlationContext = getCorrelationContext();
  logger.log(level, message, {
    ...context,
    correlationId: correlationContext?.correlationId,
    requestId: correlationContext?.requestId,
    userId: correlationContext?.userId,
  });
}

/**
 * Create a child logger with additional default metadata
 */
export function createChildLogger(metadata: Record<string, unknown>) {
  return logger.child(metadata);
}

/**
 * Log API latency metrics
 */
export function logLatency(
  operation: string,
  durationMs: number,
  metadata: Record<string, unknown> = {}
): void {
  logger.info(`${operation} completed`, {
    operation,
    durationMs,
    type: 'latency_metric',
    ...metadata,
  });
}

/**
 * Log error with stack trace and context
 */
export function logError(
  message: string,
  error: Error,
  context: Record<string, unknown> = {}
): void {
  logger.error(message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    type: 'error',
    ...context,
  });
}

export default logger;

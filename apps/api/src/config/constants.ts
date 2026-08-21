/**
 * Application Constants
 *
 * BUG-2 FIX: Graceful JWT_SECRET handling with development fallback
 *
 * TODO: Production Hardening
 * - Use secrets management service (AWS Secrets Manager, HashiCorp Vault)
 * - Implement key rotation
 * - Add secret validation and complexity requirements
 *
 * Security Notes:
 * - In production, ALWAYS set JWT_SECRET via environment variable
 * - Never commit actual secrets to version control
 * - Use different secrets for each environment
 */

// Environment detection
const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'

/**
 * JWT Configuration with graceful fallback
 *
 * Security: Fails fast in production if JWT_SECRET is not set
 * Development: Uses a placeholder with warning for local development
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET

  if (secret) {
    // Validate secret strength in production
    if (!isDevelopment && !isTest && secret.length < 32) {
      console.warn(
        '[Security Warning] JWT_SECRET should be at least 32 characters for production use'
      )
    }
    return secret
  }

  // Development/Test fallback
  if (isDevelopment || isTest) {
    console.warn(
      '\n' +
      '⚠️  [Security Warning] JWT_SECRET not set - using development placeholder\n' +
      '   Set JWT_SECRET in your .env file for production use\n' +
      '   Example: JWT_SECRET=your-super-secret-key-at-least-32-chars\n'
    )
    return 'development-jwt-secret-do-not-use-in-production'
  }

  // Fail fast in production
  throw new Error(
    'JWT_SECRET environment variable is required in production.\n' +
    'Please set JWT_SECRET in your environment variables.'
  )
}

export const JWT_SECRET = getJwtSecret()
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
export const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d'

// WebSocket Events
export const WS_EVENTS = {
  NEW_MESSAGE: 'new_message',
  MESSAGE_UPDATED: 'message_updated',
  GROUP_UPDATED: 'group_updated',
  USER_CONNECTED: 'user_connected',
  USER_DISCONNECTED: 'user_disconnected',
  ERROR: 'error',
  // Chrome Extension events
  EXTENSION_CONNECTED: 'extension_connected',
  EXTENSION_CHAT_DATA: 'extension_chat_data',
} as const

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES]

// Default Pagination
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// File Upload Configuration
export const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10) // 10MB default

export const ALLOWED_FILE_TYPES = [
  'text/plain',
  'application/json',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

// Cache TTL in seconds
export const CACHE_TTL = {
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 3600,       // 1 hour
  VERY_LONG: 86400, // 1 day
} as const

// Rate Limiting
export const RATE_LIMIT = {
  WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
  MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  AUTH_MAX_ATTEMPTS: 5, // Max login attempts per window
} as const

// API URLs
export const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000'
export const API_PREFIX = process.env.API_PREFIX || '/api'

// Feature Flags
export const FEATURES = {
  REGISTRATION_ENABLED: process.env.FEATURE_REGISTRATION !== 'false',
  EMAIL_VERIFICATION: process.env.FEATURE_EMAIL_VERIFICATION === 'true',
  PASSWORD_RESET: process.env.FEATURE_PASSWORD_RESET === 'true',
  AI_SUMMARY: process.env.FEATURE_AI_SUMMARY !== 'false',
  CHROME_EXTENSION: process.env.FEATURE_CHROME_EXTENSION !== 'false',
} as const

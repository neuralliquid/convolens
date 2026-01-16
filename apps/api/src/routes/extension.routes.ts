/**
 * Extension Routes
 *
 * API endpoints for Chrome extension support.
 * Includes selector management and extension configuration.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { cacheService } from '../services/cache.service.js';
import { CACHE_TTL } from '../config/constants.js';
import { extensionRateLimit, selectorReportRateLimit } from '../middleware/rate-limit.js';

// =============================================================================
// Input Validation
// =============================================================================

interface ValidationError {
  field: string;
  message: string;
}

function validateSelectorReport(body: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.discovered !== undefined && typeof body.discovered !== 'object') {
    errors.push({ field: 'discovered', message: 'must be an object' });
  }

  if (body.userAgent !== undefined && typeof body.userAgent !== 'string') {
    errors.push({ field: 'userAgent', message: 'must be a string' });
  }

  if (body.userAgent && body.userAgent.length > 500) {
    errors.push({ field: 'userAgent', message: 'must be less than 500 characters' });
  }

  if (body.timestamp !== undefined) {
    const date = new Date(body.timestamp);
    if (isNaN(date.getTime())) {
      errors.push({ field: 'timestamp', message: 'must be a valid ISO date string' });
    }
  }

  return errors;
}

function validateSelectorUpdate(body: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!body.primary && !body.fallback) {
    errors.push({ field: 'body', message: 'primary or fallback selectors required' });
  }

  const validateSelectorSet = (set: any, name: string) => {
    if (set && typeof set !== 'object') {
      errors.push({ field: name, message: 'must be an object' });
      return;
    }

    if (set) {
      for (const [key, value] of Object.entries(set)) {
        if (typeof value !== 'string') {
          errors.push({ field: `${name}.${key}`, message: 'must be a string' });
        }
        if (typeof value === 'string' && value.length > 500) {
          errors.push({ field: `${name}.${key}`, message: 'must be less than 500 characters' });
        }
      }
    }
  };

  validateSelectorSet(body.primary, 'primary');
  validateSelectorSet(body.fallback, 'fallback');

  if (body.version !== undefined && typeof body.version !== 'string') {
    errors.push({ field: 'version', message: 'must be a string' });
  }

  return errors;
}

function validationMiddleware(validator: (body: any) => ValidationError[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors = validator(req.body);
    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
      });
      return;
    }
    next();
  };
}

const router = Router();

// =============================================================================
// Types
// =============================================================================

interface SelectorSet {
  chatList: string;
  messageList: string;
  messageContainer: string;
  messageText: string;
  messageTime: string;
  senderName: string;
  chatHeader: string;
  contactName: string;
  scrollableMessageList: string;
}

interface SelectorConfig {
  version: string;
  updatedAt: string;
  primary: SelectorSet;
  fallback: SelectorSet;
}

interface SelectorReport {
  discovered: Partial<SelectorSet>;
  userAgent: string;
  timestamp: string;
  extensionVersion?: string;
}

// =============================================================================
// Selector Configuration Store
// =============================================================================

// In-memory selector configuration
// In production, this would be stored in a database
let selectorConfig: SelectorConfig = {
  version: '1.0.0',
  updatedAt: new Date().toISOString(),
  primary: {
    chatList: '[data-testid="chat-list"]',
    messageList: '[data-testid="conversation-panel-messages"]',
    messageContainer: '[data-testid="msg-container"]',
    messageText: '[data-testid="msg-text"]',
    messageTime: '[data-testid="msg-meta"]',
    senderName: '[data-testid="msg-sender"]',
    chatHeader: '[data-testid="conversation-header"]',
    contactName: '[data-testid="conversation-info-header-chat-title"]',
    scrollableMessageList: '[data-testid="conversation-panel-body"]',
  },
  fallback: {
    chatList: '.copyable-area [role="listitem"]',
    messageList: '.message-list',
    messageContainer: '.message-in, .message-out',
    messageText: '.selectable-text span[dir="ltr"]',
    messageTime: '.copyable-text span[dir="auto"]',
    senderName: 'span[dir="auto"]._ahxt',
    chatHeader: 'header._ao8g',
    contactName: 'span[dir="auto"]._ao3e',
    scrollableMessageList: '._asmz',
  },
};

// Selector reports for analysis (kept in memory, would be database in production)
const selectorReports: SelectorReport[] = [];
const MAX_REPORTS = 100;

// =============================================================================
// Routes
// =============================================================================

/**
 * @route GET /api/extension/selectors
 * @description Get current WhatsApp Web selectors
 * @access Public (extension use)
 */
router.get('/selectors', extensionRateLimit, async (req: Request, res: Response): Promise<void> => {
  try {
    const extensionVersion = req.headers['x-extension-version'] as string;

    // Check cache first
    const cacheKey = `selectors:${extensionVersion || 'default'}`;
    const cached = await cacheService.get<SelectorConfig>(cacheKey);

    if (cached) {
      res.json({ selectors: cached });
      return;
    }

    // Cache and return
    await cacheService.set(cacheKey, selectorConfig, CACHE_TTL.LONG);

    res.json({ selectors: selectorConfig });
  } catch (error) {
    logger.error('Error fetching selectors:', error);
    res.status(500).json({ error: 'Failed to fetch selectors' });
  }
});

/**
 * @route POST /api/extension/selectors/report
 * @description Report discovered selectors from extension
 * @access Public (extension use)
 */
router.post(
  '/selectors/report',
  selectorReportRateLimit,
  validationMiddleware(validateSelectorReport),
  async (req: Request, res: Response) => {
  try {
    const report: SelectorReport = {
      discovered: req.body.discovered || {},
      userAgent: req.body.userAgent || '',
      timestamp: req.body.timestamp || new Date().toISOString(),
      extensionVersion: req.headers['x-extension-version'] as string,
    };

    // Store report (limited to MAX_REPORTS)
    selectorReports.push(report);
    if (selectorReports.length > MAX_REPORTS) {
      selectorReports.shift();
    }

    logger.info('Selector report received', {
      discovered: Object.keys(report.discovered),
      extensionVersion: report.extensionVersion,
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('Error processing selector report:', error);
    res.status(500).json({ error: 'Failed to process report' });
  }
});

/**
 * @route GET /api/extension/selectors/reports
 * @description Get selector reports (admin only)
 * @access Private (would need admin auth)
 */
router.get('/selectors/reports', extensionRateLimit, async (_req: Request, res: Response) => {
  // In production, this would require admin authentication
  try {
    res.json({
      reports: selectorReports,
      count: selectorReports.length,
    });
  } catch (error) {
    logger.error('Error fetching selector reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * @route PUT /api/extension/selectors
 * @description Update selectors (admin only)
 * @access Private (would need admin auth)
 */
router.put(
  '/selectors',
  extensionRateLimit,
  validationMiddleware(validateSelectorUpdate),
  async (req: Request, res: Response) => {
    // In production, this would require admin authentication
    try {
      const { primary, fallback, version } = req.body;

      // Update selectors
      if (primary) {
        selectorConfig.primary = { ...selectorConfig.primary, ...primary };
      }
      if (fallback) {
        selectorConfig.fallback = { ...selectorConfig.fallback, ...fallback };
      }
      if (version) {
        selectorConfig.version = version;
      }

      selectorConfig.updatedAt = new Date().toISOString();

      // Invalidate cache
      await cacheService.deletePattern('selectors:*');

      logger.info('Selectors updated', {
        version: selectorConfig.version,
        updatedFields: {
          primary: primary ? Object.keys(primary) : [],
          fallback: fallback ? Object.keys(fallback) : [],
        },
      });

      res.json({
        success: true,
        selectors: selectorConfig,
      });
    } catch (error) {
      logger.error('Error updating selectors:', error);
      res.status(500).json({ error: 'Failed to update selectors' });
    }
  }
);

/**
 * @route GET /api/extension/config
 * @description Get extension configuration
 * @access Public
 */
router.get('/config', extensionRateLimit, async (_req: Request, res: Response) => {
  try {
    res.json({
      minVersion: '1.0.0',
      latestVersion: '1.0.0',
      updateRequired: false,
      features: {
        autoExtract: true,
        offlineSync: true,
        selectorAutoUpdate: true,
      },
      endpoints: {
        selectors: '/api/extension/selectors',
        chatExport: '/api/chat-export/extension',
      },
    });
  } catch (error) {
    logger.error('Error fetching extension config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});

export { router as default };

import { Router, Request, Response, NextFunction } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { parseWhatsAppExport, isValidWhatsAppExport } from '../services/chat-export.service.js';
import { logger } from '../utils/logger.js';
import { deduplicationService } from '../services/deduplication.service.js';
import { metrics } from '../services/metrics.service.js';

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
      user?: {
        id: string;
        email: string;
        name?: string;
      };
    }
  }
}

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt')) {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed'));
    }
  },
});

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate extracted chat message structure
 */
interface ExtractedMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: string;
  isOutgoing: boolean;
  isMedia: boolean;
  mediaType?: 'image' | 'video' | 'audio' | 'document' | 'sticker';
  replyTo?: string;
}

interface ExtensionChatData {
  chatName: string;
  chatId: string;
  extractedAt: string;
  messageCount: number;
  messages: ExtractedMessage[];
  source: 'chrome-extension';
  version: string;
  isGroup: boolean;
}

function isValidExtensionChatData(data: unknown): data is ExtensionChatData {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Required string fields
  if (typeof obj.chatName !== 'string' || obj.chatName.length === 0) return false;
  if (typeof obj.chatId !== 'string' || obj.chatId.length === 0) return false;
  if (typeof obj.extractedAt !== 'string') return false;
  if (typeof obj.version !== 'string') return false;

  // Required number field
  if (typeof obj.messageCount !== 'number' || obj.messageCount < 0) return false;

  // Required boolean
  if (typeof obj.isGroup !== 'boolean') return false;

  // Source must be chrome-extension
  if (obj.source !== 'chrome-extension') return false;

  // Messages must be an array
  if (!Array.isArray(obj.messages)) return false;

  // Validate each message
  for (const msg of obj.messages) {
    if (!isValidMessage(msg)) return false;
  }

  return true;
}

function isValidMessage(msg: unknown): msg is ExtractedMessage {
  if (!msg || typeof msg !== 'object') return false;

  const obj = msg as Record<string, unknown>;

  // Required string fields
  if (typeof obj.id !== 'string' || obj.id.length === 0) return false;
  if (typeof obj.text !== 'string') return false;
  if (typeof obj.sender !== 'string') return false;
  if (typeof obj.timestamp !== 'string') return false;

  // Required boolean fields
  if (typeof obj.isOutgoing !== 'boolean') return false;
  if (typeof obj.isMedia !== 'boolean') return false;

  // Optional fields validation
  if (obj.mediaType !== undefined) {
    const validTypes = ['image', 'video', 'audio', 'document', 'sticker'];
    if (!validTypes.includes(obj.mediaType as string)) return false;
  }

  if (obj.replyTo !== undefined && typeof obj.replyTo !== 'string') return false;

  return true;
}

/**
 * Sanitize string to prevent XSS
 */
function sanitizeString(str: string, maxLength: number = 10000): string {
  return str
    .slice(0, maxLength)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// =============================================================================
// Routes
// =============================================================================

/**
 * @route POST /api/chat-export/upload
 * @description Upload and process a WhatsApp chat export file
 * @access Private
 */
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const fileContent = req.file.buffer.toString('utf-8');

      // Validate it's a valid WhatsApp export
      if (!isValidWhatsAppExport(fileContent)) {
        return res.status(400).json({
          error: 'Invalid file format. Please upload a valid WhatsApp chat export.'
        });
      }

      const chatData = await parseWhatsAppExport(fileContent);

      // TODO: Store chatData in the database
      // await saveChatData(chatData, userId);

      res.status(200).json({
        message: 'File processed successfully',
        data: {
          messageCount: chatData.messages.length,
          participants: chatData.participants,
          dateRange: {
            start: chatData.messages[0]?.timestamp,
            end: chatData.messages[chatData.messages.length - 1]?.timestamp,
          },
        },
      });
    } catch (error) {
      logger.error('Error processing chat export:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to process file';
      res.status(500).json({ error: errorMessage });
    }
  }
);

/**
 * @route POST /api/chat-export/extension
 * @description Receive chat data from Chrome extension
 * @access Private
 */
router.post(
  '/extension',
  authenticateToken,
  async (req, res) => {
    const startTime = Date.now();
    let success = false;

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const chatData = req.body;

      // Validate the chat data structure
      if (!isValidExtensionChatData(chatData)) {
        logger.warn(`Invalid extension chat data from user ${userId}`);
        metrics.trackExtraction(false, 'chrome-extension');
        return res.status(400).json({
          error: 'Invalid chat data format. Please ensure the extension is up to date.'
        });
      }

      // Additional validation: check message count matches array length
      if (chatData.messageCount !== chatData.messages.length) {
        logger.warn(`Message count mismatch from user ${userId}: claimed ${chatData.messageCount}, got ${chatData.messages.length}`);
        metrics.trackExtraction(false, 'chrome-extension');
        return res.status(400).json({
          error: 'Message count mismatch'
        });
      }

      // Check for duplicate extraction (same chat within 5 minute window)
      const extractionHash = deduplicationService.generateExtractionHash(chatData.chatId, userId, 5);
      if (deduplicationService.isDuplicate(extractionHash)) {
        const cachedResult = deduplicationService.getCachedResult<{ chatId: string }>(extractionHash);
        logger.info(`Duplicate extraction detected for chat ${chatData.chatId} from user ${userId}`);
        return res.status(200).json({
          message: 'Chat data already received (duplicate)',
          data: cachedResult || { chatId: chatData.chatId },
          duplicate: true,
        });
      }

      // Sanitize chat name to prevent XSS
      const sanitizedChatName = sanitizeString(chatData.chatName, 200);

      logger.info(`Received extension chat data: ${sanitizedChatName} with ${chatData.messages.length} messages from user ${userId}`);

      // TODO: Store chatData in the database
      // await saveChatData(chatData, userId);

      // TODO: Queue for AI summarization
      // await queueForSummarization(chatData, userId);

      const result = {
        chatId: chatData.chatId,
        chatName: sanitizedChatName,
        messageCount: chatData.messages.length,
        receivedAt: new Date().toISOString(),
      };

      // Mark as processed for deduplication
      deduplicationService.markProcessed(extractionHash, result);

      success = true;
      metrics.trackExtraction(true, 'chrome-extension', chatData.messages.length);

      res.status(200).json({
        message: 'Chat data received successfully',
        data: result,
      });
    } catch (error) {
      logger.error('Error processing extension chat data:', error);
      metrics.trackExtraction(false, 'chrome-extension');
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to process chat data';
      res.status(500).json({ error: errorMessage });
    }
  }
);

export { router as default };

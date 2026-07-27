import { Router, Request } from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { parseWhatsAppExport, isValidWhatsAppExport } from '../services/chat-export.service.js';
import { logger } from '../utils/logger.js';
import { metrics } from '../services/metrics.service.js';
import { conversationIntakeService } from '../services/conversation-intake.service.js';

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
  if (Number.isNaN(Date.parse(obj.timestamp))) return false;

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
 * Bound connector-provided labels and remove control characters.
 */
function sanitizeString(str: string, maxLength: number = 10000): string {
  return str
    .slice(0, maxLength)
    .split('')
    .map((character) => (character >= ' ' && character !== '\u007F' ? character : ' '))
    .join('')
    .trim();
}

// =============================================================================
// Routes
// =============================================================================

/**
 * @route POST /api/chat-export/upload
 * @description Upload and process a WhatsApp chat export file
 * @access Private
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
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
        error: 'Invalid file format. Please upload a valid WhatsApp chat export.',
      });
    }

    const chatData = await parseWhatsAppExport(fileContent);
    if (chatData.messages.length === 0) {
      return res.status(400).json({
        error: 'No WhatsApp messages could be read from this export.',
      });
    }

    const saved = await conversationIntakeService.save({
      userId,
      sourcePlatform: 'whatsapp',
      sourceKind: 'upload',
      displayName: req.file.originalname.replace(/\.txt$/i, '') || 'WhatsApp export',
      isGroup: chatData.participants.length > 2,
      participants: chatData.participants,
      provenance: {
        originalFileName: req.file.originalname,
        connectorVersion: chatData.metadata.version,
        captureInitiatedBy: 'user',
        consentBasis: 'user-selected-conversation',
      },
      messages: chatData.messages.map((message) => ({
        senderName: message.sender,
        content: message.content,
        sentAt: message.timestamp,
        isMedia: message.isMedia,
      })),
    });

    return res.status(200).json({
      message: saved.duplicate
        ? 'Conversation was already received'
        : 'File processed successfully',
      duplicate: saved.duplicate,
      data: {
        intakeId: saved.conversation.id,
        displayName: saved.conversation.displayName,
        messageCount: chatData.messages.length,
        participants: chatData.participants,
        receivedAt: saved.conversation.receivedAt,
        dashboardUrl: `/dashboard/conversations/${saved.conversation.id}`,
        dateRange: {
          start: chatData.messages[0]?.timestamp,
          end: chatData.messages[chatData.messages.length - 1]?.timestamp,
        },
      },
    });
  } catch (error) {
    logger.error('Error processing chat export:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process file';
    return res.status(500).json({ error: errorMessage });
  }
});

/**
 * @route POST /api/chat-export/extension
 * @description Receive chat data from Chrome extension
 * @access Private
 */
router.post('/extension', authenticateToken, async (req, res) => {
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
        error: 'Invalid chat data format. Please ensure the extension is up to date.',
      });
    }

    // Additional validation: check message count matches array length
    if (chatData.messageCount !== chatData.messages.length) {
      logger.warn(
        `Message count mismatch from user ${userId}: claimed ${chatData.messageCount}, got ${chatData.messages.length}`
      );
      metrics.trackExtraction(false, 'chrome-extension');
      return res.status(400).json({
        error: 'Message count mismatch',
      });
    }

    // Limit the connector-provided label before logging and persistence.
    const sanitizedChatName = sanitizeString(chatData.chatName, 200);

    logger.info(
      `Received extension chat data: ${sanitizedChatName} with ${chatData.messages.length} messages from user ${userId}`
    );

    const saved = await conversationIntakeService.save({
      userId,
      sourcePlatform: 'whatsapp',
      sourceKind: 'extension',
      sourceConversationId: chatData.chatId,
      displayName: sanitizedChatName,
      isGroup: chatData.isGroup,
      participants: [...new Set(chatData.messages.map((message) => message.sender))],
      sourceExtractedAt: new Date(chatData.extractedAt),
      provenance: {
        connectorVersion: chatData.version,
        captureInitiatedBy: 'user',
        consentBasis: 'user-selected-conversation',
      },
      messages: chatData.messages.map((message) => ({
        sourceMessageId: message.id,
        senderName: message.sender,
        content: message.text,
        sentAt: new Date(message.timestamp),
        isOutgoing: message.isOutgoing,
        isMedia: message.isMedia,
        mediaType: message.mediaType,
        replyToSourceMessageId: message.replyTo,
      })),
    });

    const result = {
      chatId: chatData.chatId,
      intakeId: saved.conversation.id,
      chatName: saved.conversation.displayName,
      messageCount: chatData.messages.length,
      receivedAt: saved.conversation.receivedAt,
      dashboardUrl: `/dashboard/conversations/${saved.conversation.id}`,
    };

    metrics.trackExtraction(true, 'chrome-extension', chatData.messages.length);

    return res.status(200).json({
      message: saved.duplicate
        ? 'Conversation was already received'
        : 'Chat data received successfully',
      data: result,
      duplicate: saved.duplicate,
    });
  } catch (error) {
    logger.error('Error processing extension chat data:', error);
    metrics.trackExtraction(false, 'chrome-extension');
    const errorMessage = error instanceof Error ? error.message : 'Failed to process chat data';
    return res.status(500).json({ error: errorMessage });
  }
});

/**
 * @route GET /api/chat-export
 * @description List durable conversation intakes for the current user
 * @access Private
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const conversations = await conversationIntakeService.listForUser(userId);
    return res.json({ data: { conversations } });
  } catch (error) {
    logger.error('Error listing conversation intakes:', error);
    return res.status(500).json({ error: 'Failed to load conversations' });
  }
});

/**
 * @route GET /api/chat-export/:id
 * @description Get one durable conversation intake for the current user
 * @access Private
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const conversation = await conversationIntakeService.getForUser(userId, req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json({
      data: {
        conversation: {
          id: conversation.id,
          sourcePlatform: conversation.sourcePlatform,
          sourceKind: conversation.sourceKind,
          sourceConversationId: conversation.sourceConversationId,
          displayName: conversation.displayName,
          isGroup: conversation.isGroup,
          participants: conversation.participants || [],
          status: conversation.status,
          errorCode: conversation.errorCode,
          sourceExtractedAt: conversation.sourceExtractedAt,
          provenance: conversation.provenance,
          receivedAt: conversation.receivedAt,
          updatedAt: conversation.updatedAt,
          messages: conversation.messages.map((message) => ({
            id: message.id,
            position: message.position,
            sourceMessageId: message.sourceMessageId,
            senderName: message.senderName,
            content: message.content,
            sentAt: message.sentAt,
            isOutgoing: message.isOutgoing,
            isMedia: message.isMedia,
            mediaType: message.mediaType,
            replyToSourceMessageId: message.replyToSourceMessageId,
          })),
        },
      },
    });
  } catch (error) {
    logger.error('Error loading conversation intake:', error);
    return res.status(500).json({ error: 'Failed to load conversation' });
  }
});

/**
 * @route DELETE /api/chat-export/:id
 * @description Delete one durable conversation intake owned by the current user
 * @access Private
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const deleted = await conversationIntakeService.deleteForUser(userId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    return res.json({ message: 'Conversation deleted' });
  } catch (error) {
    logger.error('Error deleting conversation intake:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export { router as default };

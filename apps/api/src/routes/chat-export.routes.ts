import { Router, Request, type NextFunction, type Response } from 'express';
import multer from 'multer';

import { authenticateToken } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { parseWhatsAppExport, isValidWhatsAppExport } from '../services/chat-export.service.js';
import { conversationIntakeService } from '../services/conversation-intake.service.js';
import {
  ConversationSummaryError,
  conversationSummaryService,
} from '../services/conversation-summary.service.js';
import {
  MessageTranscriptError,
  messageTranscriptService,
} from '../services/message-transcript.service.js';
import { metrics } from '../services/metrics.service.js';
import {
  XtoxTranscriptionError,
  xtoxTranscriptionService,
} from '../services/xtox-transcription.service.js';
import { logger } from '../utils/logger.js';

const router: Router = Router();
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
const configuredVoiceNoteMaxBytes = Number.parseInt(
  process.env.VOICE_NOTE_MAX_BYTES || `${25 * 1024 * 1024}`,
  10
);
const voiceNoteMaxBytes =
  Number.isFinite(configuredVoiceNoteMaxBytes) && configuredVoiceNoteMaxBytes > 0
    ? Math.min(configuredVoiceNoteMaxBytes, 100 * 1024 * 1024)
    : 25 * 1024 * 1024;
const voiceNoteUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: voiceNoteMaxBytes,
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const audioExtension = /\.(?:opus|ogg|mp3|wav|m4a|aac|flac)$/i.test(file.originalname);
    if (file.mimetype.startsWith('audio/') || audioExtension) cb(null, true);
    else cb(new Error('Only supported audio files are allowed'));
  },
});
const configuredVoiceNoteTranscriptionsPerHour = Number.parseInt(
  process.env.VOICE_NOTE_TRANSCRIPTIONS_PER_HOUR || '10',
  10
);
const voiceNoteTranscriptionsPerHour =
  Number.isFinite(configuredVoiceNoteTranscriptionsPerHour) &&
  configuredVoiceNoteTranscriptionsPerHour > 0
    ? Math.min(configuredVoiceNoteTranscriptionsPerHour, 100)
    : 10;
const voiceNoteRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: voiceNoteTranscriptionsPerHour,
  message: 'Voice-note transcription limit reached. Please try again later.',
  keyGenerator: (req) => `voice-transcription:${req.user?.id || 'unknown'}`,
});

function requireVoiceTranscriptionReady(_req: Request, res: Response, next: NextFunction): void {
  try {
    xtoxTranscriptionService.assertReady();
    next();
  } catch (error) {
    if (error instanceof XtoxTranscriptionError) {
      res.status(503).json({
        error: 'Voice-note transcription is not available yet.',
        code: error.code,
      });
      return;
    }
    next(error);
  }
}

function receiveVoiceNote(req: Request, res: Response, next: NextFunction): void {
  voiceNoteUpload.single('file')(req, res, (error: unknown) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'Voice-note file exceeds the configured size limit.' });
      return;
    }
    res.status(400).json({ error: 'Only one supported audio file is allowed.' });
  });
}

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
  senderRef?: string;
}

interface ExtractedParticipant {
  ref: string;
  rawDisplayName?: string;
  rawUsername?: string;
  normalizedPhone?: string;
  platformUserId?: string;
  isSelf: boolean;
  extractionMethod: string;
  confidence: string;
}

interface ExtensionChatData {
  chatName: string;
  chatId: string;
  sourceConversationId?: string;
  extractedAt: string;
  messageCount: number;
  messages: ExtractedMessage[];
  source: 'chrome-extension';
  version: string;
  isGroup: boolean;
  payloadVersion?: 2;
  participants?: ExtractedParticipant[];
  diagnostics?: ExtractionDiagnostics;
}

interface ExtractionDiagnostics {
  messageContainerCount: number;
  extractedMessageCount: number;
  metadataPathCounts: Record<'container' | 'ancestor' | 'descendant' | 'none', number>;
  senderMethodCounts: Record<
    'metadata' | 'sender-element' | 'conversation-header' | 'outgoing' | 'fallback',
    number
  >;
  timestampMethodCounts: Record<'metadata' | 'visible-time' | 'fallback', number>;
}

export function isValidExtensionChatData(data: unknown): data is ExtensionChatData {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  // Required string fields
  if (typeof obj.chatName !== 'string' || obj.chatName.length === 0) return false;
  if (typeof obj.chatId !== 'string' || obj.chatId.length === 0) return false;
  if (
    obj.sourceConversationId !== undefined &&
    (typeof obj.sourceConversationId !== 'string' ||
      obj.sourceConversationId.length > 500 ||
      !/^whatsapp:[0-9][0-9a-z.-]*@(g\.us|c\.us|s\.whatsapp\.net|lid)$/i.test(
        obj.sourceConversationId
      ))
  )
    return false;
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

  if (obj.payloadVersion !== undefined && obj.payloadVersion !== 2) return false;
  if (obj.payloadVersion === 2 && !Array.isArray(obj.participants)) return false;
  if (obj.participants !== undefined) {
    if (!Array.isArray(obj.participants)) return false;
    const refs = new Set<string>();
    for (const participant of obj.participants) {
      if (!isValidParticipant(participant) || refs.has(participant.ref)) return false;
      refs.add(participant.ref);
    }
    if (obj.messages.some((message) => message.senderRef && !refs.has(message.senderRef)))
      return false;
  }
  if (obj.diagnostics !== undefined && !isValidExtractionDiagnostics(obj.diagnostics)) return false;

  return true;
}

function isValidExtractionDiagnostics(value: unknown): value is ExtractionDiagnostics {
  if (!value || typeof value !== 'object') return false;
  const diagnostics = value as Record<string, unknown>;
  if (
    !isNonNegativeInteger(diagnostics.messageContainerCount) ||
    !isNonNegativeInteger(diagnostics.extractedMessageCount)
  )
    return false;
  return (
    isCountMap(diagnostics.metadataPathCounts, ['container', 'ancestor', 'descendant', 'none']) &&
    isCountMap(diagnostics.senderMethodCounts, [
      'metadata',
      'sender-element',
      'conversation-header',
      'outgoing',
      'fallback',
    ]) &&
    isCountMap(diagnostics.timestampMethodCounts, ['metadata', 'visible-time', 'fallback'])
  );
}

function isCountMap(value: unknown, keys: string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  const counts = value as Record<string, unknown>;
  return (
    Object.keys(counts).every((key) => keys.includes(key)) &&
    keys.every((key) => isNonNegativeInteger(counts[key]))
  );
}

function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValidParticipant(value: unknown): value is ExtractedParticipant {
  if (!value || typeof value !== 'object') return false;
  const participant = value as Record<string, unknown>;
  if (
    typeof participant.ref !== 'string' ||
    participant.ref.length === 0 ||
    participant.ref.length > 100 ||
    typeof participant.isSelf !== 'boolean'
  )
    return false;
  if (
    typeof participant.extractionMethod !== 'string' ||
    typeof participant.confidence !== 'string'
  )
    return false;
  return ['rawDisplayName', 'rawUsername', 'normalizedPhone', 'platformUserId'].every(
    (field) => participant[field] === undefined || typeof participant[field] === 'string'
  );
}

/**
 * Preserve the v1 participant list during the v2 rollout. An observation may
 * intentionally lack a raw label (for example, a numbered fallback), so use
 * the corresponding synthesized message sender in that case.
 */
export function getLegacyParticipantLabels(chatData: ExtensionChatData): string[] {
  if (!chatData.participants) {
    return [...new Set(chatData.messages.map((message) => message.sender))];
  }

  return [
    ...new Set(
      chatData.participants
        .map(
          (participant) =>
            participant.rawDisplayName ||
            chatData.messages.find((message) => message.senderRef === participant.ref)?.sender
        )
        .filter((name): name is string => Boolean(name))
    ),
  ];
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
  if (
    obj.senderRef !== undefined &&
    (typeof obj.senderRef !== 'string' || obj.senderRef.length > 100)
  )
    return false;

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
        sourceMessageId: message.id,
        senderName: message.sender,
        content: message.content,
        sentAt: message.timestamp,
        isMedia: message.isMedia,
        mediaType: message.mediaType,
      })),
    });
    const persisted = await conversationIntakeService.ensureRawArtifact(
      saved.conversation,
      userId,
      { body: req.file.buffer, contentType: 'text/plain' }
    );

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
        persistence: {
          rawArtifact: persisted.rawArtifactStatus,
          normalizedMessages: 'stored',
          status: persisted.status,
        },
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

    // Limit the connector-provided label before persistence. It is never logged.
    const sanitizedChatName = sanitizeString(chatData.chatName, 200);

    logger.info('Received extension chat data', {
      source: chatData.source,
      connectorVersion: chatData.version,
      payloadVersion: chatData.payloadVersion || 1,
      messageCount: chatData.messages.length,
      isGroup: chatData.isGroup,
    });
    if (chatData.diagnostics) {
      logger.info('Extension intake diagnostics', {
        source: chatData.source,
        connectorVersion: chatData.version,
        diagnostics: chatData.diagnostics,
      });
    }

    const saved = await conversationIntakeService.save({
      userId,
      sourcePlatform: 'whatsapp',
      sourceKind: 'extension',
      sourceConversationId: chatData.sourceConversationId,
      sourceConversationIdentityStable: Boolean(chatData.sourceConversationId),
      displayName: sanitizedChatName,
      isGroup: chatData.isGroup,
      // Keep the legacy label list while also preserving structured capture evidence.
      participants: getLegacyParticipantLabels(chatData),
      participantEvidence: chatData.participants,
      sourceExtractedAt: new Date(chatData.extractedAt),
      provenance: {
        connectorVersion: chatData.version,
        captureInitiatedBy: 'user',
        consentBasis: 'user-selected-conversation',
      },
      messages: chatData.messages.map((message) => ({
        sourceMessageId: message.id,
        senderName: message.sender,
        senderRef: message.senderRef,
        content: message.text,
        sentAt: new Date(message.timestamp),
        isOutgoing: message.isOutgoing,
        isMedia: message.isMedia,
        mediaType: message.mediaType,
        replyToSourceMessageId: message.replyTo,
      })),
    });
    const persisted = await conversationIntakeService.ensureRawArtifact(
      saved.conversation,
      userId,
      { body: JSON.stringify(chatData), contentType: 'application/json' }
    );

    const result = {
      chatId: chatData.chatId,
      intakeId: saved.conversation.id,
      chatName: saved.conversation.displayName,
      messageCount: chatData.messages.length,
      receivedAt: saved.conversation.receivedAt,
      dashboardUrl: `/dashboard/conversations/${saved.conversation.id}`,
      reconciliationRequired: saved.reconciliationRequired,
      persistence: {
        rawArtifact: persisted.rawArtifactStatus,
        normalizedMessages: 'stored',
        status: persisted.status,
      },
    };

    metrics.trackExtraction(true, 'chrome-extension', chatData.messages.length);

    return res.status(200).json({
      message: saved.duplicate
        ? 'Conversation was already received'
        : saved.reconciliationRequired
          ? 'Chat stored separately and requires duplicate reconciliation'
          : 'Chat data received successfully',
      data: result,
      duplicate: saved.duplicate,
      reconciliationRequired: saved.reconciliationRequired,
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
 * @route GET /api/chat-export/:id/summary
 * @description Get the persisted catch-up summary for an owned conversation
 * @access Private
 */
router.get('/:id/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const conversation = await conversationIntakeService.getForUser(userId, req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });
    const summary = await conversationSummaryService.getForUser(userId, req.params.id);
    return res.json({ data: { summary } });
  } catch (error) {
    logger.error('Error loading conversation summary:', error);
    return res.status(500).json({ error: 'Failed to load conversation summary' });
  }
});

/**
 * @route POST /api/chat-export/:id/summary
 * @description Generate and persist a grounded catch-up summary
 * @access Private
 */
router.post('/:id/summary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (req.body?.regenerate !== undefined && typeof req.body.regenerate !== 'boolean') {
      return res.status(400).json({ error: 'regenerate must be a boolean' });
    }

    const result = await conversationSummaryService.generateForUser(
      userId,
      req.params.id,
      req.body?.regenerate === true
    );
    return res.status(result.cached ? 200 : 201).json({
      message: result.cached ? 'Existing catch-up loaded' : 'Catch-up generated',
      cached: result.cached,
      data: { summary: result.summary },
    });
  } catch (error) {
    if (error instanceof ConversationSummaryError) {
      if (error.code === 'CONVERSATION_NOT_FOUND') {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      if (error.code === 'AI_PROVIDER_NOT_CONFIGURED') {
        return res.status(503).json({
          error: 'AI summarization is not configured yet. Ask your ConvoLens administrator.',
          code: error.code,
        });
      }
      if (error.code === 'CONVERSATION_TOO_LARGE') {
        return res.status(413).json({
          error: 'This conversation is too large to summarize in one catch-up.',
          code: error.code,
        });
      }
      if (error.code === 'NO_MESSAGES_TO_SUMMARIZE') {
        return res.status(400).json({ error: 'This conversation has no messages to summarize.' });
      }
    }
    logger.error('Error generating conversation summary:', error);
    return res
      .status(502)
      .json({ error: 'The catch-up could not be generated. Please try again.' });
  }
});

/**
 * @route POST /api/chat-export/:id/messages/:messageId/transcript
 * @description Transcribe one owned audio message without retaining raw audio in ConvoLens
 * @access Private
 */
router.post(
  '/:id/messages/:messageId/transcript',
  authenticateToken,
  requireVoiceTranscriptionReady,
  voiceNoteRateLimit,
  receiveVoiceNote,
  async (req, res) => {
    let transcriptionClaimId: string | undefined;
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      if (!req.file) return res.status(400).json({ error: 'No voice-note file uploaded' });
      if (req.body?.modelProcessingConsent !== 'true') {
        return res.status(400).json({
          error: 'Explicit model-processing consent is required for this voice note.',
          code: 'MODEL_PROCESSING_CONSENT_REQUIRED',
        });
      }

      transcriptionClaimId = await messageTranscriptService.acquireClaimForUser(
        userId,
        req.params.id,
        req.params.messageId
      );
      const upstreamAuthorization = req.header('x-xtox-authorization') || '';
      const result = await xtoxTranscriptionService.transcribe({
        bytes: req.file.buffer,
        fileName: req.file.originalname,
        contentType: req.file.mimetype || 'application/octet-stream',
        mystiraAuthorization: upstreamAuthorization,
        ...(typeof req.body?.language === 'string' && req.body.language.trim()
          ? { language: req.body.language.trim() }
          : {}),
      });
      const transcript = await messageTranscriptService.saveForUser({
        userId,
        intakeId: req.params.id,
        messageId: req.params.messageId,
        text: result.text,
        providerTranscriptId: result.id,
        language: result.language,
        durationSeconds: result.duration,
        modelProcessingConsentAt: new Date(),
      });

      return res.status(201).json({
        message: 'Voice note transcribed',
        data: {
          transcript: {
            id: transcript.id,
            text: transcript.text,
            language: transcript.language,
            durationMs: transcript.durationMs,
            generatedAt: transcript.generatedAt,
          },
        },
      });
    } catch (error) {
      if (error instanceof MessageTranscriptError) {
        if (error.code === 'CONVERSATION_NOT_FOUND' || error.code === 'MESSAGE_NOT_FOUND') {
          return res.status(404).json({ error: 'Audio message not found' });
        }
        if (error.code === 'MESSAGE_NOT_AUDIO') {
          return res.status(400).json({ error: 'The selected message is not an audio message.' });
        }
        if (error.code === 'TRANSCRIPTION_IN_PROGRESS') {
          return res.status(409).json({
            error: 'This voice note is already being transcribed.',
            code: error.code,
          });
        }
        return res.status(502).json({
          error: 'The transcription service returned an invalid transcript.',
          code: 'TRANSCRIPTION_RESULT_INVALID',
        });
      }
      if (error instanceof XtoxTranscriptionError) {
        if (error.code === 'XTOX_AUTH_REJECTED') {
          return res.status(401).json({
            error: 'Your Mystira session is not authorized for transcription.',
            code: error.code,
          });
        }
        if (error.code === 'XTOX_REJECTED_AUDIO') {
          return res.status(422).json({
            error: 'The transcription service could not process this audio file.',
            code: error.code,
          });
        }
        if (error.code === 'XTOX_INVALID_RESPONSE') {
          return res.status(502).json({
            error: 'The transcription service returned an invalid response.',
            code: error.code,
          });
        }
        if (error.code === 'XTOX_TIMEOUT' || error.upstreamStatus === 504) {
          return res.status(504).json({
            error: 'The transcription service timed out.',
            code: error.code,
          });
        }
        return res.status(503).json({
          error: 'Voice-note transcription is not available yet.',
          code: error.code,
        });
      }
      logger.error('Voice-note transcription failed', {
        error: error instanceof Error ? error.message : 'unknown_error',
      });
      return res.status(500).json({ error: 'Voice-note transcription failed' });
    } finally {
      if (transcriptionClaimId) {
        await messageTranscriptService
          .releaseClaim(req.params.messageId, transcriptionClaimId)
          .catch(() => logger.error('Voice-note transcription claim release failed'));
      }
    }
  }
);

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
          sourceConversationIdentityStable: conversation.sourceConversationIdentityStable,
          displayName: conversation.displayName,
          isGroup: conversation.isGroup,
          participants: conversation.participants || [],
          participantEvidence: conversation.participantEvidence || [],
          contentHashVersion: conversation.contentHashVersion,
          reconciliationStatus: conversation.reconciliationStatus,
          reconciliationCandidateIds: conversation.reconciliationCandidateIds || [],
          status: conversation.status,
          errorCode: conversation.errorCode,
          rawArtifact: {
            status: conversation.rawArtifactStatus,
            sha256: conversation.rawArtifactSha256,
            size: conversation.rawArtifactSize,
          },
          sourceExtractedAt: conversation.sourceExtractedAt,
          provenance: conversation.provenance,
          receivedAt: conversation.receivedAt,
          updatedAt: conversation.updatedAt,
          messages: conversation.messages.map((message) => ({
            id: message.id,
            position: message.position,
            sourceMessageId: message.sourceMessageId,
            senderName: message.senderName,
            senderRef: message.senderRef,
            content: message.content,
            sentAt: message.sentAt,
            isOutgoing: message.isOutgoing,
            isMedia: message.isMedia,
            mediaType: message.mediaType,
            replyToSourceMessageId: message.replyToSourceMessageId,
            transcript: message.transcript
              ? {
                  id: message.transcript.id,
                  text: message.transcript.text,
                  language: message.transcript.language,
                  durationMs: message.transcript.durationMs,
                  generatedAt: message.transcript.generatedAt,
                }
              : null,
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

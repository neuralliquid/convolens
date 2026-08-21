import type { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import { ConversationIntake } from '../db/entities/ConversationIntake';
import { ConversationMessage } from '../db/entities/ConversationMessage';
import { MessageTranscript } from '../db/entities/MessageTranscript';

export type MessageTranscriptErrorCode =
  | 'CONVERSATION_NOT_FOUND'
  | 'MESSAGE_NOT_FOUND'
  | 'MESSAGE_NOT_AUDIO'
  | 'TRANSCRIPT_EMPTY'
  | 'TRANSCRIPT_TOO_LARGE';

const MAX_TRANSCRIPT_CHARACTERS = 1_000_000;

export class MessageTranscriptError extends Error {
  constructor(public readonly code: MessageTranscriptErrorCode) {
    super(code);
  }
}

export interface SaveMessageTranscriptInput {
  userId: string;
  intakeId: string;
  messageId: string;
  text: string;
  providerTranscriptId?: string;
  language?: string;
  durationSeconds?: number;
  modelProcessingConsentAt: Date;
}

export class MessageTranscriptService {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async requireOwnedAudioMessage(
    userId: string,
    intakeId: string,
    messageId: string
  ): Promise<ConversationMessage> {
    const conversation = await this.dataSource.getRepository(ConversationIntake).findOne({
      where: { id: intakeId, userId },
      select: { id: true },
    });
    if (!conversation) throw new MessageTranscriptError('CONVERSATION_NOT_FOUND');

    const message = await this.dataSource
      .getRepository(ConversationMessage)
      .findOneBy({ id: messageId, intakeId });
    if (!message) throw new MessageTranscriptError('MESSAGE_NOT_FOUND');
    if (!message.isMedia || message.mediaType?.toLowerCase() !== 'audio') {
      throw new MessageTranscriptError('MESSAGE_NOT_AUDIO');
    }
    return message;
  }

  async saveForUser(input: SaveMessageTranscriptInput): Promise<MessageTranscript> {
    await this.requireOwnedAudioMessage(input.userId, input.intakeId, input.messageId);

    const text = input.text.trim();
    if (!text) throw new MessageTranscriptError('TRANSCRIPT_EMPTY');
    if (text.length > MAX_TRANSCRIPT_CHARACTERS) {
      throw new MessageTranscriptError('TRANSCRIPT_TOO_LARGE');
    }

    const repository = this.dataSource.getRepository(MessageTranscript);
    const values = {
      messageId: input.messageId,
      intakeId: input.intakeId,
      userId: input.userId,
      text,
      provider: 'xtox',
      providerTranscriptId: input.providerTranscriptId ?? null,
      language: input.language ?? null,
      durationMs:
        input.durationSeconds === undefined
          ? null
          : Math.max(0, Math.round(input.durationSeconds * 1000)),
      modelProcessingConsentAt: input.modelProcessingConsentAt,
      generatedAt: new Date(),
    };

    await repository.upsert(values, { conflictPaths: ['messageId'] });
    return repository.findOneByOrFail({ messageId: input.messageId });
  }
}

export const messageTranscriptService = new MessageTranscriptService();

import type { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import { ConversationIntake } from '../db/entities/ConversationIntake';
import type { ConversationMessage } from '../db/entities/ConversationMessage';
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
      relations: { messages: true },
    });
    if (!conversation) throw new MessageTranscriptError('CONVERSATION_NOT_FOUND');

    const message = conversation.messages.find((candidate) => candidate.id === messageId);
    if (!message) throw new MessageTranscriptError('MESSAGE_NOT_FOUND');
    if (!message.isMedia || message.mediaType !== 'audio') {
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
    const existing = await repository.findOneBy({ messageId: input.messageId });
    const values = {
      messageId: input.messageId,
      intakeId: input.intakeId,
      userId: input.userId,
      text,
      provider: 'xtox',
      providerTranscriptId: input.providerTranscriptId,
      language: input.language,
      durationMs:
        input.durationSeconds === undefined
          ? undefined
          : Math.max(0, Math.round(input.durationSeconds * 1000)),
      modelProcessingConsentAt: input.modelProcessingConsentAt,
      generatedAt: new Date(),
    };

    if (existing) {
      repository.merge(existing, values);
      return repository.save(existing);
    }
    return repository.save(repository.create(values));
  }
}

export const messageTranscriptService = new MessageTranscriptService();

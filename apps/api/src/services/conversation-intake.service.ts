import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import {
  ConversationIntake,
  type ConversationProvenance,
  type ConversationSourceKind,
} from '../db/entities/ConversationIntake';
import { ConversationMessage } from '../db/entities/ConversationMessage';

export interface ConversationMessageInput {
  sourceMessageId?: string;
  senderName: string;
  content: string;
  sentAt: Date;
  isOutgoing?: boolean;
  isMedia?: boolean;
  mediaType?: string;
  replyToSourceMessageId?: string;
}

export interface ConversationIntakeInput {
  userId: string;
  sourcePlatform: string;
  sourceKind: ConversationSourceKind;
  sourceConversationId?: string;
  displayName: string;
  isGroup: boolean;
  participants: string[];
  sourceExtractedAt?: Date;
  provenance?: ConversationProvenance;
  messages: ConversationMessageInput[];
}

export interface ConversationIntakeSummary {
  id: string;
  sourcePlatform: string;
  sourceKind: ConversationSourceKind;
  displayName: string;
  isGroup: boolean;
  participants: string[];
  status: string;
  messageCount: number;
  sourceExtractedAt?: Date;
  receivedAt: Date;
}

export interface SaveConversationResult {
  conversation: ConversationIntake;
  duplicate: boolean;
}

function normalizeHashValue(value: string): string {
  return value.normalize('NFKC').replace(/\r\n/g, '\n').trim();
}

export function createConversationContentHash(
  input: Pick<ConversationIntakeInput, 'sourcePlatform' | 'messages'>
): string {
  const canonical = {
    sourcePlatform: input.sourcePlatform.toLowerCase(),
    messages: input.messages.map((message) => ({
      senderName: normalizeHashValue(message.senderName),
      content: normalizeHashValue(message.content),
      sentAt: message.sentAt.toISOString(),
      isMedia: Boolean(message.isMedia),
      mediaType: message.mediaType || null,
    })),
  };

  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export class ConversationIntakeService {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  async save(input: ConversationIntakeInput): Promise<SaveConversationResult> {
    const contentHash = createConversationContentHash(input);
    const intakeRepository = this.dataSource.getRepository(ConversationIntake);
    const existing = await intakeRepository.findOne({
      where: { userId: input.userId, contentHash },
      relations: { messages: true },
      order: { messages: { position: 'ASC' } },
    });

    if (existing) {
      return { conversation: existing, duplicate: true };
    }

    try {
      const conversation = await this.dataSource.transaction(async (manager) => {
        const intake = manager.create(ConversationIntake, {
          userId: input.userId,
          sourcePlatform: input.sourcePlatform,
          sourceKind: input.sourceKind,
          sourceConversationId: input.sourceConversationId,
          displayName: input.displayName.trim().slice(0, 255),
          isGroup: input.isGroup,
          participants: [
            ...new Set(input.participants.map((value) => value.trim()).filter(Boolean)),
          ].sort((a, b) => a.localeCompare(b)),
          contentHash,
          status: 'received',
          sourceExtractedAt: input.sourceExtractedAt,
          provenance: input.provenance,
        });
        const savedIntake = await manager.save(intake);
        const messages = input.messages.map((message, position) =>
          manager.create(ConversationMessage, {
            intakeId: savedIntake.id,
            position,
            sourceMessageId: message.sourceMessageId,
            senderName: message.senderName.trim().slice(0, 255) || 'Unknown',
            content: message.content,
            sentAt: message.sentAt,
            isOutgoing: Boolean(message.isOutgoing),
            isMedia: Boolean(message.isMedia),
            mediaType: message.mediaType,
            replyToSourceMessageId: message.replyToSourceMessageId,
          })
        );

        if (messages.length > 0) {
          await manager.save(messages, { chunk: 500 });
        }

        savedIntake.messages = messages;
        return savedIntake;
      });

      return { conversation, duplicate: false };
    } catch (error) {
      // A concurrent identical intake can win the unique constraint race.
      const duplicate = await intakeRepository.findOne({
        where: { userId: input.userId, contentHash },
        relations: { messages: true },
        order: { messages: { position: 'ASC' } },
      });
      if (duplicate) {
        return { conversation: duplicate, duplicate: true };
      }
      throw error;
    }
  }

  async listForUser(userId: string): Promise<ConversationIntakeSummary[]> {
    const conversations = (await this.dataSource
      .getRepository(ConversationIntake)
      .createQueryBuilder('intake')
      .loadRelationCountAndMap('intake.messageCount', 'intake.messages')
      .where('intake.userId = :userId', { userId })
      .orderBy('intake.receivedAt', 'DESC')
      .take(100)
      .getMany()) as Array<ConversationIntake & { messageCount: number }>;

    return conversations.map((conversation) => ({
      id: conversation.id,
      sourcePlatform: conversation.sourcePlatform,
      sourceKind: conversation.sourceKind,
      displayName: conversation.displayName,
      isGroup: conversation.isGroup,
      participants: conversation.participants || [],
      status: conversation.status,
      messageCount: conversation.messageCount,
      sourceExtractedAt: conversation.sourceExtractedAt,
      receivedAt: conversation.receivedAt,
    }));
  }

  async getForUser(userId: string, id: string): Promise<ConversationIntake | null> {
    return this.dataSource.getRepository(ConversationIntake).findOne({
      where: { id, userId },
      relations: { messages: true },
      order: { messages: { position: 'ASC' } },
    });
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const result = await this.dataSource.getRepository(ConversationIntake).delete({ id, userId });
    return result.affected === 1;
  }
}

export const conversationIntakeService = new ConversationIntakeService();

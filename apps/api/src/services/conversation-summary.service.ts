import { QueryFailedError, type DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import {
  ConversationSummary,
  type ConversationSummaryContent,
  type SummaryActionItem,
  type SummaryEvidenceItem,
} from '../db/entities/ConversationSummary';
import type { ConversationMessage } from '../db/entities/ConversationMessage';
import { ConversationIntake } from '../db/entities/ConversationIntake';
import { catchUpGenerator, type CatchUpGenerator } from './ai/catch-up-generator.service';

export type ConversationSummaryErrorCode =
  | 'AI_PROVIDER_NOT_CONFIGURED'
  | 'CONVERSATION_NOT_FOUND'
  | 'CONVERSATION_TOO_LARGE'
  | 'NO_MESSAGES_TO_SUMMARIZE';

export class ConversationSummaryError extends Error {
  constructor(public readonly code: ConversationSummaryErrorCode) {
    super(code);
  }
}

interface EvidenceReference {
  messageId: string;
  position: number;
  senderName: string;
  sentAt: Date;
}

interface SummaryEvidenceResponse {
  text: string;
  evidence: EvidenceReference[];
}

interface SummaryActionResponse extends SummaryEvidenceResponse {
  owner?: string;
  due?: string;
}

export interface ConversationSummaryResponse {
  id: string;
  intakeId: string;
  overview: string;
  overviewEvidence: EvidenceReference[];
  keyTopics: SummaryEvidenceResponse[];
  decisions: SummaryEvidenceResponse[];
  actionItems: SummaryActionResponse[];
  openQuestions: SummaryEvidenceResponse[];
  importantLinks: Array<{
    url: string;
    label?: string;
    evidence: EvidenceReference[];
  }>;
  scope: {
    messageCount: number;
    periodStart: Date;
    periodEnd: Date;
  };
  generatedAt: Date;
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as { code?: string };
  return driverError.code === '23505' || driverError.code === 'SQLITE_CONSTRAINT';
}

function evidenceFor(
  positions: number[],
  messages: Map<number, ConversationMessage>
): EvidenceReference[] {
  return positions
    .map((position) => messages.get(position))
    .filter((message): message is ConversationMessage => Boolean(message))
    .map((message) => ({
      messageId: message.id,
      position: message.position,
      senderName: message.senderName,
      sentAt: message.sentAt,
    }));
}

function evidenceItems(
  items: SummaryEvidenceItem[],
  messages: Map<number, ConversationMessage>
): SummaryEvidenceResponse[] {
  return items.map((item) => ({ text: item.text, evidence: evidenceFor(item.evidence, messages) }));
}

function actionItems(
  items: SummaryActionItem[],
  messages: Map<number, ConversationMessage>
): SummaryActionResponse[] {
  return items.map((item) => ({
    text: item.text,
    evidence: evidenceFor(item.evidence, messages),
    ...(item.owner ? { owner: item.owner } : {}),
    ...(item.due ? { due: item.due } : {}),
  }));
}

function toResponse(
  summary: ConversationSummary,
  messages: ConversationMessage[]
): ConversationSummaryResponse {
  const byPosition = new Map(messages.map((message) => [message.position, message]));
  return {
    id: summary.id,
    intakeId: summary.intakeId,
    overview: summary.content.overview,
    overviewEvidence: evidenceFor(summary.content.overviewEvidence, byPosition),
    keyTopics: evidenceItems(summary.content.keyTopics, byPosition),
    decisions: evidenceItems(summary.content.decisions, byPosition),
    actionItems: actionItems(summary.content.actionItems, byPosition),
    openQuestions: evidenceItems(summary.content.openQuestions, byPosition),
    importantLinks: summary.content.importantLinks.map((link) => ({
      url: link.url,
      label: link.label,
      evidence: evidenceFor(link.evidence, byPosition),
    })),
    scope: {
      messageCount: summary.sourceMessageCount,
      periodStart: summary.periodStart,
      periodEnd: summary.periodEnd,
    },
    generatedAt: summary.generatedAt,
  };
}

export class ConversationSummaryService {
  constructor(
    private readonly dataSource: DataSource = AppDataSource,
    private readonly generator: CatchUpGenerator = catchUpGenerator
  ) {}

  getProviderStatus() {
    return this.generator.getProviderInfo();
  }

  async getForUser(userId: string, intakeId: string): Promise<ConversationSummaryResponse | null> {
    const summary = await this.dataSource.getRepository(ConversationSummary).findOne({
      where: { intakeId, userId },
      relations: { intake: { messages: true } },
      order: { intake: { messages: { position: 'ASC' } } },
    });
    return summary ? toResponse(summary, summary.intake.messages) : null;
  }

  async generateForUser(
    userId: string,
    intakeId: string,
    regenerate = false
  ): Promise<{ summary: ConversationSummaryResponse; cached: boolean }> {
    const conversation = await this.dataSource.getRepository(ConversationIntake).findOne({
      where: { id: intakeId, userId },
      relations: { messages: true },
      order: { messages: { position: 'ASC' } },
    });
    if (!conversation) throw new ConversationSummaryError('CONVERSATION_NOT_FOUND');
    if (conversation.messages.length === 0) {
      throw new ConversationSummaryError('NO_MESSAGES_TO_SUMMARIZE');
    }

    const repository = this.dataSource.getRepository(ConversationSummary);
    const existing = await repository.findOneBy({ intakeId, userId });
    if (existing && !regenerate && existing.sourceContentHash === conversation.contentHash) {
      return { summary: toResponse(existing, conversation.messages), cached: true };
    }

    if (!this.generator.getProviderInfo().configured) {
      throw new ConversationSummaryError('AI_PROVIDER_NOT_CONFIGURED');
    }

    let generated;
    try {
      generated = await this.generator.generate(
        conversation.messages.map((message) => ({
          position: message.position,
          timestamp: message.sentAt,
          sender: message.senderName,
          content: message.content,
          isMedia: message.isMedia,
        }))
      );
    } catch (error) {
      if (
        error instanceof Error &&
        [
          'AI_PROVIDER_NOT_CONFIGURED',
          'CONVERSATION_TOO_LARGE',
          'NO_MESSAGES_TO_SUMMARIZE',
        ].includes(error.message)
      ) {
        throw new ConversationSummaryError(error.message as ConversationSummaryErrorCode);
      }
      throw error;
    }

    const timestamps = conversation.messages.map((message) => message.sentAt.getTime());
    const values = {
      intakeId,
      userId,
      content: generated.content as ConversationSummaryContent,
      provider: generated.provider,
      model: generated.model,
      sourceMessageCount: conversation.messages.length,
      sourceContentHash: conversation.contentHash,
      periodStart: new Date(Math.min(...timestamps)),
      periodEnd: new Date(Math.max(...timestamps)),
      generatedAt: new Date(),
    };

    let saved: ConversationSummary;
    if (existing) {
      repository.merge(existing, values);
      saved = await repository.save(existing);
    } else {
      try {
        saved = await repository.save(repository.create(values));
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const winner = await repository.findOneByOrFail({ intakeId, userId });
        return { summary: toResponse(winner, conversation.messages), cached: true };
      }
    }

    return { summary: toResponse(saved, conversation.messages), cached: false };
  }
}

export const conversationSummaryService = new ConversationSummaryService();

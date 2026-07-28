import { createHash } from 'node:crypto';
import { IsNull, type DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import {
  ConversationIntake,
  type ConversationParticipantEvidence,
  type ConversationProvenance,
  type ConversationSourceKind,
} from '../db/entities/ConversationIntake';
import { ConversationMessage } from '../db/entities/ConversationMessage';

const COMPATIBILITY_BACKFILL_BATCH_SIZE = 100;

export interface ConversationMessageInput {
  sourceMessageId?: string;
  senderName: string;
  senderRef?: string;
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
  sourceConversationIdentityStable?: boolean;
  displayName: string;
  isGroup: boolean;
  participants: string[];
  participantEvidence?: ConversationParticipantEvidence[];
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
  reconciliationRequired: boolean;
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

function stableParticipantKey(
  participant: ConversationParticipantEvidence | undefined
): string | null {
  return stableParticipantKeys(participant)[0] || null;
}

function stableParticipantKeys(participant: ConversationParticipantEvidence | undefined): string[] {
  if (!participant) return [];
  if (participant.isSelf) return ['self'];
  return [
    participant.platformUserId ? `platform:${participant.platformUserId}` : undefined,
    participant.normalizedPhone ? `phone:${participant.normalizedPhone}` : undefined,
    participant.rawUsername ? `username:${participant.rawUsername}` : undefined,
  ].filter((value): value is string => Boolean(value));
}

function participantsShareStableEvidence(
  first: ConversationParticipantEvidence,
  second: ConversationParticipantEvidence
): boolean {
  const secondKeys = new Set(stableParticipantKeys(second));
  return stableParticipantKeys(first).some((key) => secondKeys.has(key));
}

function participantMap(input: Pick<ConversationIntakeInput, 'participantEvidence'>) {
  return new Map(
    (input.participantEvidence || []).map((participant) => [participant.ref, participant])
  );
}

export function createConversationContentHashV2(input: ConversationIntakeInput): string {
  if (!input.sourceConversationIdentityStable || !input.sourceConversationId) {
    throw new Error('A stable source conversation identity is required for a v2 content hash');
  }
  const participants = participantMap(input);
  const canonical = {
    owner: normalizeHashValue(input.userId),
    sourcePlatform: input.sourcePlatform.toLowerCase(),
    sourceConversationId: normalizeHashValue(input.sourceConversationId),
    messages: input.messages.map((message) => ({
      participant: stableParticipantKey(
        message.senderRef ? participants.get(message.senderRef) : undefined
      ),
      content: normalizeHashValue(message.content),
      sentAt: message.sentAt.toISOString(),
      isOutgoing: Boolean(message.isOutgoing),
      isMedia: Boolean(message.isMedia),
      mediaType: message.mediaType || null,
    })),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function createConversationCompatibilityHash(
  input: Pick<ConversationIntakeInput, 'messages'>
): string {
  const canonical = input.messages.map((message) => ({
    content: normalizeCompatibilityContent(message),
    sentAt: message.sentAt.toISOString(),
    isOutgoing: Boolean(message.isOutgoing),
    isMedia: Boolean(message.isMedia),
    mediaType: normalizeCompatibilityMediaType(message),
  }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function normalizeCompatibilityMediaType(message: ConversationMessageInput): string | null {
  const content = normalizeCompatibilityContent(message);
  if (
    message.isMedia &&
    content === '' &&
    (message.mediaType === 'image' || message.mediaType === 'video')
  ) {
    return 'visual';
  }
  return message.mediaType || null;
}

function normalizeCompatibilityContent(message: ConversationMessageInput): string {
  const normalized = normalizeHashValue(message.content);
  return message.isMedia && /^\[(?:image|video|audio|document|sticker|media)\]$/i.test(normalized)
    ? ''
    : normalized;
}

function storedCompatibilityHash(conversation: ConversationIntake): string {
  return createConversationCompatibilityHash({
    messages: conversation.messages.map((message) => ({
      senderName: message.senderName,
      senderRef: message.senderRef,
      content: message.content,
      sentAt: message.sentAt,
      isOutgoing: message.isOutgoing,
      isMedia: message.isMedia,
      mediaType: message.mediaType,
    })),
  });
}

function hasConflictingStableEvidence(
  candidate: ConversationIntake,
  input: ConversationIntakeInput
): boolean {
  const existingParticipants = new Map(
    (candidate.participantEvidence || []).map((participant) => [participant.ref, participant])
  );
  const incomingParticipants = participantMap(input);
  return input.messages.some((message, position) => {
    const existingMessage = candidate.messages[position];
    const existingParticipant = existingMessage?.senderRef
      ? existingParticipants.get(existingMessage.senderRef)
      : undefined;
    const incomingParticipant = message.senderRef
      ? incomingParticipants.get(message.senderRef)
      : undefined;
    if (!existingParticipant || !incomingParticipant) return false;
    const existingKeys = stableParticipantKeys(existingParticipant);
    const incomingKeys = stableParticipantKeys(incomingParticipant);
    return Boolean(
      existingKeys.length > 0 &&
        incomingKeys.length > 0 &&
        !participantsShareStableEvidence(existingParticipant, incomingParticipant)
    );
  });
}

function findParticipantEvidenceMatch(
  participants: ConversationParticipantEvidence[],
  observation: ConversationParticipantEvidence
): ConversationParticipantEvidence | undefined {
  const stableKeys = stableParticipantKeys(observation);
  return participants.find((participant) => {
    const existingKeys = stableParticipantKeys(participant);
    return (
      (stableKeys.length > 0 && participantsShareStableEvidence(participant, observation)) ||
      (participant.ref === observation.ref &&
        (stableKeys.length === 0 || existingKeys.length === 0))
    );
  });
}

function mergeParticipantEvidence(
  existing: ConversationParticipantEvidence[] = [],
  incoming: ConversationParticipantEvidence[] = []
): ConversationParticipantEvidence[] {
  const merged = existing.map((participant) => ({ ...participant }));
  for (const observation of incoming) {
    const match = findParticipantEvidenceMatch(merged, observation);
    if (!match) {
      merged.push({
        ...observation,
        preferredDisplayName: observation.rawDisplayName,
        rawLabels: observation.rawDisplayName ? [observation.rawDisplayName] : [],
      });
      continue;
    }
    match.rawLabels = [
      ...new Set(
        [...(match.rawLabels || []), match.rawDisplayName, observation.rawDisplayName].filter(
          (value): value is string => Boolean(value)
        )
      ),
    ];
    match.preferredDisplayName =
      observation.rawDisplayName || match.preferredDisplayName || match.rawDisplayName;
    match.normalizedPhone = match.normalizedPhone || observation.normalizedPhone;
    match.platformUserId = match.platformUserId || observation.platformUserId;
    match.rawUsername = match.rawUsername || observation.rawUsername;
  }
  return merged;
}

function applyCorrectedVisualMediaEvidence(
  conversation: ConversationIntake,
  input: ConversationIntakeInput
): ConversationMessage[] {
  return conversation.messages.filter((message, position) => {
    const incoming = input.messages[position];
    if (
      message.isMedia &&
      incoming?.isMedia &&
      message.mediaType === 'image' &&
      incoming.mediaType === 'video' &&
      normalizeCompatibilityContent(message) === '' &&
      normalizeCompatibilityContent(incoming) === ''
    ) {
      message.mediaType = 'video';
      return true;
    }
    return false;
  });
}

function initializeParticipantEvidence(
  observations: ConversationParticipantEvidence[] = []
): ConversationParticipantEvidence[] {
  return observations.map((observation) => ({
    ...observation,
    preferredDisplayName: observation.rawDisplayName,
    rawLabels: observation.rawDisplayName ? [observation.rawDisplayName] : [],
  }));
}

function shouldRequireReconciliation(
  candidate: ConversationIntake,
  usesStableV2: boolean,
  sourceConversationId: string | undefined
): boolean {
  if (!usesStableV2) return true;
  if (!candidate.sourceConversationIdentityStable) return true;
  return candidate.sourceConversationId === sourceConversationId;
}

export class ConversationIntakeService {
  constructor(private readonly dataSource: DataSource = AppDataSource) {}

  private async updateDuplicate(
    conversation: ConversationIntake,
    input: ConversationIntakeInput,
    compatibilityHash: string,
    applyMediaCorrections = false
  ): Promise<SaveConversationResult> {
    conversation.participantEvidence = mergeParticipantEvidence(
      conversation.participantEvidence,
      input.participantEvidence
    );
    conversation.compatibilityHash = conversation.compatibilityHash || compatibilityHash;
    if (applyMediaCorrections) {
      const correctedMessages = applyCorrectedVisualMediaEvidence(conversation, input);
      if (correctedMessages.length > 0) {
        await this.dataSource.getRepository(ConversationMessage).save(correctedMessages);
      }
    }
    await this.dataSource.getRepository(ConversationIntake).save(conversation);
    return {
      conversation,
      duplicate: true,
      reconciliationRequired: conversation.reconciliationStatus === 'required',
    };
  }

  async save(input: ConversationIntakeInput): Promise<SaveConversationResult> {
    const usesStableV2 = Boolean(
      input.sourceConversationIdentityStable && input.sourceConversationId
    );
    const legacyContentHash = createConversationContentHash(input);
    const contentHash = usesStableV2 ? createConversationContentHashV2(input) : legacyContentHash;
    const compatibilityHash = createConversationCompatibilityHash(input);
    const intakeRepository = this.dataSource.getRepository(ConversationIntake);
    const exactLookupOptions = {
      relations: { messages: true },
      order: { messages: { position: 'ASC' as const } },
    };
    const legacyScopedMatch = usesStableV2
      ? await intakeRepository.findOne({
          where: {
            userId: input.userId,
            sourcePlatform: input.sourcePlatform,
            sourceConversationId: input.sourceConversationId,
            contentHash: legacyContentHash,
          },
          ...exactLookupOptions,
        })
      : null;
    const existing =
      legacyScopedMatch ||
      (await intakeRepository.findOne({
        where: { userId: input.userId, contentHash },
        ...exactLookupOptions,
      }));

    if (existing) {
      return this.updateDuplicate(existing, input, compatibilityHash);
    }

    const exactCompatibilityCandidates = await intakeRepository.find({
      where: {
        userId: input.userId,
        sourcePlatform: input.sourcePlatform,
        compatibilityHash,
      },
      relations: { messages: true },
      order: { messages: { position: 'ASC' } },
    });
    const unbackfilledCandidates = await intakeRepository.find({
      where: {
        userId: input.userId,
        sourcePlatform: input.sourcePlatform,
        compatibilityHash: IsNull(),
      },
      relations: { messages: true },
      order: { receivedAt: 'ASC', messages: { position: 'ASC' } },
      take: COMPATIBILITY_BACKFILL_BATCH_SIZE + 1,
    });
    const hasDeferredCompatibilityCandidates =
      unbackfilledCandidates.length > COMPATIBILITY_BACKFILL_BATCH_SIZE;
    const candidatesNeedingBackfill = unbackfilledCandidates.slice(
      0,
      COMPATIBILITY_BACKFILL_BATCH_SIZE
    );
    for (const candidate of candidatesNeedingBackfill) {
      candidate.compatibilityHash = storedCompatibilityHash(candidate);
    }
    if (candidatesNeedingBackfill.length > 0) {
      await intakeRepository.save(candidatesNeedingBackfill);
    }
    const semanticCandidates = [
      ...exactCompatibilityCandidates,
      ...candidatesNeedingBackfill,
    ].filter((candidate) => candidate.compatibilityHash === compatibilityHash);
    const sameStableConversation = usesStableV2
      ? semanticCandidates.filter(
          (candidate) =>
            candidate.sourceConversationIdentityStable &&
            candidate.sourceConversationId === input.sourceConversationId
        )
      : [];
    const compatibleCandidates = sameStableConversation.filter(
      (candidate) => !hasConflictingStableEvidence(candidate, input)
    );
    if (sameStableConversation.length === 1 && compatibleCandidates.length === 1) {
      const duplicate = compatibleCandidates[0];
      return this.updateDuplicate(duplicate, input, compatibilityHash, true);
    }

    const reconciliationCandidates = semanticCandidates.filter((candidate) =>
      shouldRequireReconciliation(candidate, usesStableV2, input.sourceConversationId)
    );
    const reconciliationRequired =
      reconciliationCandidates.length > 0 || hasDeferredCompatibilityCandidates;

    try {
      const conversation = await this.dataSource.transaction(async (manager) => {
        const intake = manager.create(ConversationIntake, {
          userId: input.userId,
          sourcePlatform: input.sourcePlatform,
          sourceKind: input.sourceKind,
          sourceConversationId: input.sourceConversationId,
          sourceConversationIdentityStable: usesStableV2,
          displayName: input.displayName.trim().slice(0, 255),
          isGroup: input.isGroup,
          participants: [
            ...new Set(input.participants.map((value) => value.trim()).filter(Boolean)),
          ].sort((a, b) => a.localeCompare(b)),
          participantEvidence: initializeParticipantEvidence(input.participantEvidence),
          contentHash,
          contentHashVersion: usesStableV2 ? 2 : 1,
          compatibilityHash,
          reconciliationStatus: reconciliationRequired ? 'required' : 'none',
          reconciliationCandidateIds: reconciliationRequired
            ? reconciliationCandidates.map((candidate) => candidate.id)
            : undefined,
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
            senderRef: message.senderRef,
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

      return { conversation, duplicate: false, reconciliationRequired };
    } catch (error) {
      // A concurrent identical intake can win the unique constraint race.
      const duplicate = await intakeRepository.findOne({
        where: { userId: input.userId, contentHash },
        relations: { messages: true },
        order: { messages: { position: 'ASC' } },
      });
      if (duplicate) {
        return {
          conversation: duplicate,
          duplicate: true,
          reconciliationRequired: duplicate.reconciliationStatus === 'required',
        };
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

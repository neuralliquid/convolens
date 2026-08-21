import { createHash, randomUUID } from 'node:crypto';
import {
  In,
  IsNull,
  QueryFailedError,
  type DataSource,
  type EntityManager,
  type Repository,
} from 'typeorm';
import { AppDataSource } from '../config/database';
import {
  ConversationIntake,
  type ConversationParticipantEvidence,
  type ConversationProvenance,
  type ConversationSourceKind,
} from '../db/entities/ConversationIntake';
import { ConversationMessage } from '../db/entities/ConversationMessage';
import { BatonPublishAttempt } from '../db/entities/BatonPublishAttempt';
import { TicketCandidate } from '../db/entities/TicketCandidate';
import { AZURE_UPLOAD_TOTAL_TIMEOUT_MS, StorageService } from './storage/storage.service';
import { BATON_AMBIGUOUS_HOLD_MS, BATON_PUBLISH_LEASE_MS } from './ticket-candidate.service';

const COMPATIBILITY_BACKFILL_BATCH_SIZE = 100;
const VISUAL_MEDIA_FIX_VERSION = '1.0.13';
// Longer than the bounded 24-second Blob write, but short enough that a crashed
// claim can be reclaimed and persisted inside the callers' 60-second window.
export const RAW_ARTIFACT_CLAIM_LEASE_MS = 30_000;
export const RAW_ARTIFACT_DELETE_GRACE_MS = 2_000;
const compatibilityQueues = new Map<string, Promise<void>>();
const rawArtifactQueues = new Map<string, Promise<void>>();

export function createPostgresCompatibilityAdvisoryLockKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

async function withLocalCompatibilityLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = compatibilityQueues.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  compatibilityQueues.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (compatibilityQueues.get(key) === queued) {
      compatibilityQueues.delete(key);
    }
  }
}

async function withLocalRawArtifactLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = rawArtifactQueues.get(key) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => gate);
  rawArtifactQueues.set(key, queued);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (rawArtifactQueues.get(key) === queued) {
      rawArtifactQueues.delete(key);
    }
  }
}

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
  rawArtifactStatus: string;
  messageCount: number;
  sourceExtractedAt?: Date;
  receivedAt: Date;
}

export interface SaveConversationResult {
  conversation: ConversationIntake;
  duplicate: boolean;
  reconciliationRequired: boolean;
}

export interface RawConversationArtifact {
  body: Buffer | string;
  contentType: 'application/json' | 'text/plain';
}

function normalizeHashValue(value: string): string {
  return value.normalize('NFKC').replace(/\r\n/g, '\n').trim();
}

function normalizeStableSourceConversationId(value: string): string {
  return normalizeHashValue(value)
    .toLowerCase()
    .replace(/@c\.us$/, '@s.whatsapp.net');
}

function sourceConversationAliases(value: string): string[] {
  const canonical = normalizeStableSourceConversationId(value);
  return canonical.endsWith('@s.whatsapp.net')
    ? [canonical, canonical.replace(/@s\.whatsapp\.net$/, '@c.us')]
    : [canonical];
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
    participant.platformUserId
      ? `platform:${participant.platformUserId.toLowerCase().replace(/@c\.us$/, '@s.whatsapp.net')}`
      : undefined,
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
  return createCompatibilityHash(input, false);
}

function createLegacyVisualCompatibilityHash(
  input: Pick<ConversationIntakeInput, 'messages'>
): string {
  return createCompatibilityHash(input, true);
}

function createCompatibilityHash(
  input: Pick<ConversationIntakeInput, 'messages'>,
  mapVideoToLegacyImage: boolean
): string {
  const canonical = input.messages.map((message) => ({
    content: normalizeCompatibilityContent(message),
    sentAt: message.sentAt.toISOString(),
    isOutgoing: Boolean(message.isOutgoing),
    isMedia: Boolean(message.isMedia),
    mediaType:
      mapVideoToLegacyImage && message.isMedia && message.mediaType === 'video'
        ? 'image'
        : message.mediaType || null,
  }));
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
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

function isPhoneOnlyDisplayName(value: string | undefined, normalizedPhone: string | undefined) {
  if (!value || !normalizedPhone) return false;
  const normalizePhoneCharacters = (candidate: string) => candidate.replace(/[^+\d]/g, '');
  return normalizePhoneCharacters(value) === normalizePhoneCharacters(normalizedPhone);
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
      observation.rawDisplayName &&
      !isPhoneOnlyDisplayName(observation.rawDisplayName, observation.normalizedPhone)
        ? observation.rawDisplayName
        : match.preferredDisplayName || match.rawDisplayName || observation.rawDisplayName;
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
      incoming.mediaType === 'video'
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
  return Boolean(
    candidate.sourceConversationId &&
      sourceConversationId &&
      normalizeStableSourceConversationId(candidate.sourceConversationId) ===
        normalizeStableSourceConversationId(sourceConversationId)
  );
}

function parseConnectorVersion(value: string | undefined): number[] | null {
  const match = value?.match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? match.slice(1).map(Number) : null;
}

function compareConnectorVersions(first: number[], second: number[]): number {
  for (let index = 0; index < 3; index++) {
    if (first[index] !== second[index]) return first[index] - second[index];
  }
  return 0;
}

function isLegacyVisualCorrectionCandidate(
  candidate: ConversationIntake,
  input: ConversationIntakeInput,
  legacyVisualCompatibilityHash: string
): boolean {
  if (candidate.compatibilityHash !== legacyVisualCompatibilityHash) return false;
  const candidateVersion = parseConnectorVersion(candidate.provenance?.connectorVersion);
  const incomingVersion = parseConnectorVersion(input.provenance?.connectorVersion);
  const fixVersion = parseConnectorVersion(VISUAL_MEDIA_FIX_VERSION)!;
  if (
    !candidateVersion ||
    !incomingVersion ||
    compareConnectorVersions(candidateVersion, fixVersion) >= 0 ||
    compareConnectorVersions(incomingVersion, fixVersion) < 0
  ) {
    return false;
  }
  return candidate.messages.some(
    (message, position) =>
      message.isMedia &&
      message.mediaType === 'image' &&
      input.messages[position]?.isMedia &&
      input.messages[position]?.mediaType === 'video'
  );
}

function isContentHashUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) return false;
  const driverError = error.driverError as {
    code?: string;
    constraint?: string;
    message?: string;
  };
  if (driverError.code === '23505') {
    return driverError.constraint === 'UQ_conversation_intakes_user_content_hash';
  }
  return Boolean(
    driverError.code === 'SQLITE_CONSTRAINT' &&
      /conversation_intakes\.userId.*conversation_intakes\.contentHash/i.test(
        driverError.message || error.message
      )
  );
}

export class ConversationIntakeService {
  constructor(
    private readonly dataSource: DataSource = AppDataSource,
    private readonly storage: StorageService = new StorageService()
  ) {}

  async ensureRawArtifact(
    conversation: ConversationIntake,
    userId: string,
    artifact: RawConversationArtifact
  ): Promise<ConversationIntake> {
    return withLocalRawArtifactLock(conversation.id, () =>
      this.ensureRawArtifactLocked(conversation, userId, artifact)
    );
  }

  private async ensureRawArtifactLocked(
    conversation: ConversationIntake,
    userId: string,
    artifact: RawConversationArtifact
  ): Promise<ConversationIntake> {
    const buffer = Buffer.isBuffer(artifact.body) ? artifact.body : Buffer.from(artifact.body);
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const repository = this.dataSource.getRepository(ConversationIntake);
    const current = await repository.findOneByOrFail({ id: conversation.id });
    // A duplicate normalized intake retains the exact first accepted raw evidence.
    // Connector-generated ids and extraction timestamps may differ on a retry,
    // so replacing the artifact would create unowned blobs and weaken provenance.
    if (current.rawArtifactStatus === 'stored' && current.rawArtifactKey) {
      return this.retryStoredRawArtifactCleanup(repository, current);
    }

    const ownerScope = createHash('sha256').update(userId).digest('hex').slice(0, 32);
    const extension = artifact.contentType === 'application/json' ? 'json' : 'txt';
    const claimId = randomUUID();
    // A claim-specific segment prevents a late, expired writer from deleting or
    // overwriting the artifact selected by a newer lease for the same payload.
    const key = `raw-intakes/${ownerScope}/${conversation.id}/${claimId}/${sha256}.${extension}`;
    const claimedAt = new Date();
    let cleanupKeys = current.rawArtifactCleanupKeys || [];
    let claim = await repository.update(
      {
        id: conversation.id,
        rawArtifactKey: IsNull(),
        rawArtifactStatus: In(['pending', 'failed', 'not-recorded']),
      },
      {
        rawArtifactKey: key,
        rawArtifactSha256: sha256,
        rawArtifactSize: buffer.length,
        rawArtifactStatus: 'pending',
        rawArtifactClaimId: claimId,
        rawArtifactClaimedAt: claimedAt,
        errorCode: null,
      }
    );

    if (claim.affected !== 1) {
      const claimed = await repository.findOneByOrFail({ id: conversation.id });
      if (claimed.rawArtifactStatus === 'stored' && claimed.rawArtifactKey) {
        return this.retryStoredRawArtifactCleanup(repository, claimed);
      }

      // A retry may resume the same first artifact after a failed write, but a
      // different duplicate payload must never replace its provenance.
      if (claimed.rawArtifactStatus === 'failed' && claimed.rawArtifactSha256 === sha256) {
        const nextCleanupKeys = this.appendRawArtifactCleanupKey(
          claimed.rawArtifactCleanupKeys,
          claimed.rawArtifactKey
        );
        claim = await repository.update(
          {
            id: conversation.id,
            rawArtifactStatus: 'failed',
            rawArtifactSha256: sha256,
          },
          {
            rawArtifactKey: key,
            rawArtifactSha256: sha256,
            rawArtifactSize: buffer.length,
            rawArtifactStatus: 'pending',
            rawArtifactClaimId: claimId,
            rawArtifactClaimedAt: claimedAt,
            rawArtifactCleanupKeys: nextCleanupKeys,
            status: 'received',
            errorCode: null,
          }
        );
        if (claim.affected === 1) {
          cleanupKeys = nextCleanupKeys;
        }
      }

      const claimExpired =
        claimed.rawArtifactStatus === 'pending' &&
        (!claimed.rawArtifactClaimedAt ||
          claimed.rawArtifactClaimedAt.getTime() <= Date.now() - RAW_ARTIFACT_CLAIM_LEASE_MS);
      if (claim.affected !== 1 && claimExpired && claimed.rawArtifactSha256 === sha256) {
        const nextCleanupKeys = this.appendRawArtifactCleanupKey(
          claimed.rawArtifactCleanupKeys,
          claimed.rawArtifactKey
        );
        claim = await repository.update(
          {
            id: conversation.id,
            rawArtifactStatus: 'pending',
            rawArtifactClaimId: claimed.rawArtifactClaimId || IsNull(),
          },
          {
            rawArtifactKey: key,
            rawArtifactSha256: sha256,
            rawArtifactSize: buffer.length,
            rawArtifactClaimId: claimId,
            rawArtifactClaimedAt: claimedAt,
            rawArtifactCleanupKeys: nextCleanupKeys,
            status: 'received',
            errorCode: null,
          }
        );
        if (claim.affected === 1) {
          cleanupKeys = nextCleanupKeys;
        }
      }

      if (claim.affected !== 1) {
        if (claimed.rawArtifactStatus === 'pending' && claimed.rawArtifactKey) {
          if (claimExpired && claimed.rawArtifactSha256 !== sha256) {
            throw new Error(
              'The first raw artifact claim expired; recovery requires the exact original raw payload'
            );
          }
          const resolved = await this.waitForRawArtifact(conversation.id);
          if (resolved) return resolved;
          return this.ensureRawArtifactLocked(conversation, userId, artifact);
        }
        throw new Error(
          'The first raw artifact failed and cannot be replaced by a different duplicate payload'
        );
      }
    }

    try {
      await this.storage.uploadFile(key, buffer, {
        contentType: artifact.contentType,
        metadata: { intakeId: conversation.id },
      });
      const finalized = await repository.update(
        { id: conversation.id, rawArtifactStatus: 'pending', rawArtifactClaimId: claimId },
        {
          rawArtifactStatus: 'stored',
          rawArtifactClaimId: null,
          rawArtifactClaimedAt: null,
          status: 'received',
          errorCode: null,
        }
      );
      if (finalized.affected !== 1) {
        await this.storage.deleteFile(key);
        const resolved = await this.waitForRawArtifact(conversation.id);
        if (resolved) return resolved;
        return this.ensureRawArtifactLocked(conversation, userId, artifact);
      }
      if (cleanupKeys.length > 0) {
        // The ledger remains durable until every superseded object is gone.
        // A cleanup outage must not turn a stored intake back into a failed one.
        const cleaned = await this.deleteRawArtifactKeys(cleanupKeys);
        if (cleaned) {
          await repository
            .update(
              { id: conversation.id, rawArtifactStatus: 'stored', rawArtifactKey: key },
              { rawArtifactCleanupKeys: null }
            )
            .catch(() => undefined);
        }
      }
    } catch (error) {
      await repository.update(
        { id: conversation.id, rawArtifactStatus: 'pending', rawArtifactClaimId: claimId },
        {
          rawArtifactStatus: 'failed',
          rawArtifactClaimId: null,
          rawArtifactClaimedAt: null,
          status: 'failed',
          errorCode: 'raw_artifact_write_failed',
        }
      );
      throw error;
    }

    return (await repository.findOneByOrFail({ id: conversation.id })) as ConversationIntake;
  }

  private async waitForRawArtifact(id: string): Promise<ConversationIntake | null> {
    const repository = this.dataSource.getRepository(ConversationIntake);
    const deadline = Date.now() + RAW_ARTIFACT_CLAIM_LEASE_MS * 2;
    while (Date.now() < deadline) {
      const current = await repository.findOneByOrFail({ id });
      if (current.rawArtifactStatus === 'stored') return current;
      if (current.rawArtifactStatus === 'failed') {
        throw new Error('The first raw artifact write failed');
      }
      if (current.rawArtifactStatus === 'deleting') {
        throw new Error('Conversation deletion started during the raw artifact write');
      }
      if (
        current.rawArtifactStatus === 'pending' &&
        (!current.rawArtifactClaimedAt ||
          current.rawArtifactClaimedAt.getTime() <= Date.now() - RAW_ARTIFACT_CLAIM_LEASE_MS)
      ) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for the first raw artifact write');
  }

  private appendRawArtifactCleanupKey(
    cleanupKeys: string[] | null | undefined,
    key: string | null | undefined
  ): string[] {
    return Array.from(new Set([...(cleanupKeys || []), ...(key ? [key] : [])]));
  }

  private async deleteRawArtifactKeys(keys: string[]): Promise<boolean> {
    try {
      for (const key of Array.from(new Set(keys))) {
        await this.storage.deleteFile(key);
      }
      return true;
    } catch {
      return false;
    }
  }

  private async retryStoredRawArtifactCleanup(
    repository: Repository<ConversationIntake>,
    conversation: ConversationIntake
  ): Promise<ConversationIntake> {
    const cleanupKeys = conversation.rawArtifactCleanupKeys || [];
    if (cleanupKeys.length === 0) return conversation;
    const cleaned = await this.deleteRawArtifactKeys(cleanupKeys);
    if (!cleaned) return conversation;
    const cleared = await repository
      .update(
        {
          id: conversation.id,
          rawArtifactStatus: 'stored',
          rawArtifactKey: conversation.rawArtifactKey,
        },
        { rawArtifactCleanupKeys: null }
      )
      .catch(() => undefined);
    if (cleared?.affected === 1) conversation.rawArtifactCleanupKeys = null;
    return conversation;
  }

  private async updateDuplicate(
    conversation: ConversationIntake,
    input: ConversationIntakeInput,
    compatibilityHash: string,
    contentHash: string,
    options: {
      applyMediaCorrections?: boolean;
      persistVerifiedStableScope?: boolean;
    } = {},
    repositoryProvider: DataSource | EntityManager = this.dataSource
  ): Promise<SaveConversationResult> {
    conversation.participantEvidence = mergeParticipantEvidence(
      conversation.participantEvidence,
      input.participantEvidence
    );
    conversation.compatibilityHash = conversation.compatibilityHash || compatibilityHash;
    if (options.persistVerifiedStableScope) {
      conversation.sourceConversationId = input.sourceConversationId;
      conversation.sourceConversationIdentityStable = true;
    } else if (
      conversation.sourceConversationIdentityStable &&
      conversation.sourceConversationId &&
      input.sourceConversationIdentityStable &&
      input.sourceConversationId &&
      normalizeStableSourceConversationId(conversation.sourceConversationId) ===
        input.sourceConversationId
    ) {
      conversation.sourceConversationId = input.sourceConversationId;
    }
    const correctedMessages = options.applyMediaCorrections
      ? applyCorrectedVisualMediaEvidence(conversation, input)
      : [];
    if (correctedMessages.length > 0) {
      conversation.compatibilityHash = compatibilityHash;
      conversation.contentHash = contentHash;
    }
    const intakeUpdate = await repositoryProvider.getRepository(ConversationIntake).update(
      { id: conversation.id, userId: conversation.userId },
      {
        participantEvidence: conversation.participantEvidence,
        compatibilityHash: conversation.compatibilityHash,
        contentHash: conversation.contentHash,
        sourceConversationId: conversation.sourceConversationId,
        sourceConversationIdentityStable: conversation.sourceConversationIdentityStable,
      }
    );
    if (intakeUpdate.affected !== 1) {
      throw new Error('The conversation intake was deleted before it could be updated.');
    }
    if (correctedMessages.length > 0) {
      await Promise.all(
        correctedMessages.map((message) =>
          repositoryProvider
            .getRepository(ConversationMessage)
            .update({ id: message.id, intakeId: conversation.id }, { mediaType: 'video' })
        )
      );
    }
    return {
      conversation,
      duplicate: true,
      reconciliationRequired: conversation.reconciliationStatus === 'required',
    };
  }

  async save(input: ConversationIntakeInput): Promise<SaveConversationResult> {
    if (input.sourceConversationIdentityStable && input.sourceConversationId) {
      input = {
        ...input,
        sourceConversationId: normalizeStableSourceConversationId(input.sourceConversationId),
      };
    }
    const usesStableV2 = Boolean(
      input.sourceConversationIdentityStable && input.sourceConversationId
    );
    const legacyContentHash = createConversationContentHash(input);
    const contentHash = usesStableV2 ? createConversationContentHashV2(input) : legacyContentHash;
    const compatibilityHash = createConversationCompatibilityHash(input);
    const legacyVisualCompatibilityHash = createLegacyVisualCompatibilityHash(input);
    const intakeRepository = this.dataSource.getRepository(ConversationIntake);
    const exactLookupOptions = {
      relations: { messages: true },
      order: { messages: { position: 'ASC' as const } },
    };
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
      await Promise.all(
        candidatesNeedingBackfill.map((candidate) =>
          intakeRepository.update(
            { id: candidate.id, compatibilityHash: IsNull() },
            { compatibilityHash: candidate.compatibilityHash }
          )
        )
      );
    }
    const compatibilityLockKey = [
      input.userId,
      input.sourcePlatform.toLowerCase(),
      legacyVisualCompatibilityHash,
    ]
      .map((value) => normalizeHashValue(value))
      .join('\u0000');

    try {
      return await withLocalCompatibilityLock(compatibilityLockKey, () =>
        this.dataSource.transaction(async (manager) => {
          if (manager.connection.options.type === 'postgres') {
            await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
              createPostgresCompatibilityAdvisoryLockKey(compatibilityLockKey),
            ]);
          }

          // The compatibility lock serializes semantically equivalent captures even when their
          // v2 hashes differ. Recheck after acquiring it so a concurrent winner is visible.
          const transactionRepository = manager.getRepository(ConversationIntake);
          const lockedLegacyScopedMatch = usesStableV2
            ? await transactionRepository.findOne({
                where: {
                  userId: input.userId,
                  sourcePlatform: input.sourcePlatform,
                  sourceConversationId: In(sourceConversationAliases(input.sourceConversationId!)),
                  contentHash: legacyContentHash,
                },
                ...exactLookupOptions,
              })
            : null;
          const lockedExisting =
            lockedLegacyScopedMatch ||
            (await transactionRepository.findOne({
              where: { userId: input.userId, contentHash },
              ...exactLookupOptions,
            }));
          if (lockedExisting) {
            return this.updateDuplicate(
              lockedExisting,
              input,
              compatibilityHash,
              contentHash,
              { persistVerifiedStableScope: lockedExisting === lockedLegacyScopedMatch },
              manager
            );
          }

          const lockedExactCompatibilityCandidates = await transactionRepository.find({
            where: {
              userId: input.userId,
              sourcePlatform: input.sourcePlatform,
              compatibilityHash: In([compatibilityHash, legacyVisualCompatibilityHash]),
            },
            relations: { messages: true },
            order: { messages: { position: 'ASC' } },
          });
          const lockedSemanticCandidates = [
            ...lockedExactCompatibilityCandidates,
            ...candidatesNeedingBackfill,
          ].filter(
            (candidate, index, candidates) =>
              (candidate.compatibilityHash === compatibilityHash ||
                candidate.compatibilityHash === legacyVisualCompatibilityHash) &&
              candidates.findIndex((other) => other.id === candidate.id) === index
          );
          const lockedSameStableConversation = usesStableV2
            ? lockedSemanticCandidates.filter(
                (candidate) =>
                  candidate.sourceConversationIdentityStable &&
                  candidate.sourceConversationId &&
                  normalizeStableSourceConversationId(candidate.sourceConversationId) ===
                    input.sourceConversationId
              )
            : [];
          const lockedCompatibleCandidates = lockedSameStableConversation.filter(
            (candidate) =>
              !hasConflictingStableEvidence(candidate, input) &&
              (candidate.compatibilityHash === compatibilityHash ||
                isLegacyVisualCorrectionCandidate(candidate, input, legacyVisualCompatibilityHash))
          );
          const lockedHasUnscopedSemanticCandidates = lockedSemanticCandidates.some(
            (candidate) => !candidate.sourceConversationIdentityStable
          );
          if (
            lockedSameStableConversation.length === 1 &&
            lockedCompatibleCandidates.length === 1 &&
            !lockedHasUnscopedSemanticCandidates &&
            !hasDeferredCompatibilityCandidates
          ) {
            return this.updateDuplicate(
              lockedCompatibleCandidates[0],
              input,
              compatibilityHash,
              contentHash,
              {
                applyMediaCorrections:
                  lockedCompatibleCandidates[0].compatibilityHash !== compatibilityHash,
              },
              manager
            );
          }

          const lockedReconciliationCandidates = lockedSemanticCandidates.filter((candidate) =>
            shouldRequireReconciliation(candidate, usesStableV2, input.sourceConversationId)
          );
          const lockedReconciliationRequired =
            lockedReconciliationCandidates.length > 0 || hasDeferredCompatibilityCandidates;

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
            reconciliationStatus: lockedReconciliationRequired ? 'required' : 'none',
            reconciliationCandidateIds: lockedReconciliationRequired
              ? lockedReconciliationCandidates.map((candidate) => candidate.id)
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
          return {
            conversation: savedIntake,
            duplicate: false,
            reconciliationRequired: lockedReconciliationRequired,
          };
        })
      );
    } catch (error) {
      // A concurrent identical intake can win the unique constraint race.
      if (!isContentHashUniqueConstraintError(error)) throw error;
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
      rawArtifactStatus: conversation.rawArtifactStatus,
      messageCount: conversation.messageCount,
      sourceExtractedAt: conversation.sourceExtractedAt,
      receivedAt: conversation.receivedAt,
    }));
  }

  async getForUser(userId: string, id: string): Promise<ConversationIntake | null> {
    return this.dataSource.getRepository(ConversationIntake).findOne({
      where: { id, userId },
      relations: { messages: { transcript: true } },
      order: { messages: { position: 'ASC' } },
    });
  }

  async deleteForUser(userId: string, id: string): Promise<boolean> {
    const repository = this.dataSource.getRepository(ConversationIntake);
    let conversation: ConversationIntake | null = null;

    // Compare-and-swap the complete claim identity into a tombstone. If another
    // replica changes the key/claim/status after our read, retry from its new
    // snapshot so deletion never loses a superseded artifact key.
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = await repository.findOneBy({ id, userId });
      if (!candidate) return false;
      // Bound to a const so the truthy check still narrows inside the transaction
      // callback, where narrowing of a property read would otherwise be lost.
      const batonPublishClaimId = candidate.batonPublishClaimId;
      if (batonPublishClaimId) {
        const claimActive =
          candidate.batonPublishClaimedAt &&
          candidate.batonPublishClaimedAt.getTime() > Date.now() - BATON_PUBLISH_LEASE_MS;
        if (claimActive) {
          throw new Error('A Baton publication is in progress; retry deletion after it completes');
        }
        const reclaimed = await this.dataSource.transaction(async (manager) => {
          const cleared = await manager.getRepository(ConversationIntake).update(
            {
              id,
              userId,
              rawArtifactStatus: candidate.rawArtifactStatus,
              batonPublishClaimId,
              batonPublishClaimedAt: candidate.batonPublishClaimedAt || IsNull(),
            },
            { batonPublishClaimId: null, batonPublishClaimedAt: null }
          );
          if (cleared.affected !== 1) return { cleared: false, reanchored: false };
          const strandedBoundary = await manager
            .getRepository(BatonPublishAttempt)
            .createQueryBuilder('attempt')
            .innerJoin(TicketCandidate, 'ticket', 'ticket.id = attempt.candidateId')
            .where('ticket.intakeId = :id', { id })
            .andWhere('ticket.userId = :userId', { userId })
            .andWhere('(ticket.publishStatus != :succeeded OR ticket.batonTaskId IS NULL)', {
              succeeded: 'succeeded',
            })
            .andWhere('attempt.errorCode IN (:...errorCodes)', {
              errorCodes: ['baton_create_started', 'baton_ambiguous'],
            })
            .orderBy('attempt.createdAt', 'DESC')
            .getOne();
          // The query filters errorCode to two literals, so a null one is
          // unreachable. Folding it into the guard keeps the CAS typed without
          // widening the where clause, and returns exactly what a no-match
          // update would have returned anyway.
          if (!strandedBoundary?.errorCode) return { cleared: true, reanchored: false };
          const reanchored = await manager
            .getRepository(BatonPublishAttempt)
            .update(
              { id: strandedBoundary.id, errorCode: strandedBoundary.errorCode },
              { status: 'failed', errorCode: 'baton_ambiguous', completedAt: new Date() }
            );
          return { cleared: true, reanchored: reanchored.affected === 1 };
        });
        if (reclaimed.reanchored) {
          throw new Error(
            'A Baton publication is still within its reconciliation safety window; retry deletion later'
          );
        }
        if (reclaimed.cleared) continue;
        continue;
      }
      const unresolvedBoundaries = await this.dataSource
        .getRepository(BatonPublishAttempt)
        .createQueryBuilder('attempt')
        .innerJoin(TicketCandidate, 'ticket', 'ticket.id = attempt.candidateId')
        .where('ticket.intakeId = :id', { id })
        .andWhere('ticket.userId = :userId', { userId })
        .andWhere('(ticket.publishStatus != :succeeded OR ticket.batonTaskId IS NULL)', {
          succeeded: 'succeeded',
        })
        .andWhere('attempt.errorCode IN (:...errorCodes)', {
          errorCodes: ['baton_create_started', 'baton_ambiguous'],
        })
        .orderBy('attempt.createdAt', 'DESC')
        .getMany();
      const createStartedBoundary = unresolvedBoundaries.find(
        (boundary) => boundary.errorCode === 'baton_create_started'
      );
      if (createStartedBoundary) {
        const reanchored = await this.dataSource
          .getRepository(BatonPublishAttempt)
          .update(
            { id: createStartedBoundary.id, errorCode: 'baton_create_started' },
            { status: 'failed', errorCode: 'baton_ambiguous', completedAt: new Date() }
          );
        if (reanchored.affected !== 1) continue;
        throw new Error(
          'A Baton publication is still within its reconciliation safety window; retry deletion later'
        );
      }
      const holdStartedAt = Date.now() - BATON_AMBIGUOUS_HOLD_MS;
      const ambiguousBoundary = unresolvedBoundaries.find(
        (boundary) =>
          boundary.errorCode === 'baton_ambiguous' &&
          (boundary.completedAt || boundary.createdAt).getTime() > holdStartedAt
      );
      if (ambiguousBoundary) {
        throw new Error(
          'A Baton publication is still within its reconciliation safety window; retry deletion later'
        );
      }
      const marked = await repository.update(
        {
          id,
          userId,
          rawArtifactStatus: candidate.rawArtifactStatus,
          rawArtifactClaimId: candidate.rawArtifactClaimId || IsNull(),
          rawArtifactKey: candidate.rawArtifactKey || IsNull(),
          batonPublishClaimId: IsNull(),
        },
        { rawArtifactStatus: 'deleting' }
      );
      if (marked.affected === 1) {
        conversation = candidate;
        break;
      }
    }
    if (!conversation) {
      throw new Error('Conversation artifact changed too often to start deletion safely');
    }
    if (conversation.rawArtifactClaimId && conversation.rawArtifactClaimedAt) {
      const cleanupSafeAt =
        conversation.rawArtifactClaimedAt.getTime() +
        AZURE_UPLOAD_TOTAL_TIMEOUT_MS +
        RAW_ARTIFACT_DELETE_GRACE_MS;
      const remainingUploadWindow = cleanupSafeAt - Date.now();
      if (remainingUploadWindow > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingUploadWindow));
      }
    }
    const artifactKeys = this.appendRawArtifactCleanupKey(
      conversation.rawArtifactCleanupKeys,
      conversation.rawArtifactKey
    );
    for (const artifactKey of artifactKeys) {
      await this.storage.deleteFile(artifactKey);
    }
    const result = await repository.delete({ id, userId });
    return result.affected === 1;
  }
}

export const conversationIntakeService = new ConversationIntakeService();

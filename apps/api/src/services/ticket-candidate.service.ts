import { createHash, randomUUID } from 'node:crypto';
import { In, IsNull, type DataSource } from 'typeorm';
import { AppDataSource } from '../config/database';
import { BatonPublishAttempt } from '../db/entities/BatonPublishAttempt';
import { ConversationIntake } from '../db/entities/ConversationIntake';
import { TicketCandidate, type TicketCandidateConfidence } from '../db/entities/TicketCandidate';
import { BatonMcpClient, type BatonMcpTask } from './baton-mcp.client';

const HIGH_SIGNAL = /^(?:todo|action(?: item)?|follow[- ]?up)\s*[:-]\s*(.+)$/i;
const MEDIUM_SIGNAL = /^(?:please|can you|could you|we need to|i will|i'll|let's)\b[\s,:-]*(.+)$/i;
export const BATON_PUBLISH_LEASE_MS = 90_000;
export const BATON_AMBIGUOUS_HOLD_MS = 60_000;
export const CONVOLENS_BATON_PROJECT_ID = 'd20d739a-89b0-4a48-8f9b-dcb0724c149d';
export const BATON_MCP_RESOURCE = 'https://mcp.baton.celladoresystems.com/mcp';

export class TicketCandidateConflict extends Error {}
export class TicketCandidateValidation extends Error {}
class BatonReconciliationPending extends Error {}

const BATON_PROJECT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeBatonProjectId(projectId?: string): string | null {
  const normalized = projectId?.trim() || '';
  if (!normalized) return null;
  if (!BATON_PROJECT_ID.test(normalized)) {
    throw new TicketCandidateValidation('Baton project ID must be a valid UUID');
  }
  return normalized;
}

interface PublishResult {
  candidate: TicketCandidate;
  duplicate: boolean;
}

export type PersonalTodoCandidate = Omit<TicketCandidate, 'intake'> & {
  sourceContext: {
    conversationId: string;
    conversationName: string;
    catchUpHref: string;
    evidenceLinks: Array<{ messageId: string; href: string }>;
  };
};

export class TicketCandidateService {
  constructor(
    private readonly dataSource: DataSource = AppDataSource,
    private readonly batonResource = process.env.BATON_OAUTH_MCP_ENABLED === 'true'
      ? process.env.BATON_MCP_RESOURCE || BATON_MCP_RESOURCE
      : '',
    private readonly fetcher: typeof fetch = fetch,
    private readonly defaultProjectId = process.env.BATON_DEFAULT_PROJECT_ID || CONVOLENS_BATON_PROJECT_ID,
    private readonly batonWebBaseUrl = process.env.BATON_WEB_BASE_URL || ''
  ) {}

  private normalizePinnedProjectId(projectId?: string): string | null {
    const normalized = normalizeBatonProjectId(projectId);
    if (normalized && normalized !== this.defaultProjectId) {
      throw new TicketCandidateValidation('Only the configured ConvoLens Baton project is allowed');
    }
    return normalized;
  }

  async generate(userId: string, intakeId: string): Promise<TicketCandidate[]> {
    const intake = await this.dataSource.getRepository(ConversationIntake).findOne({
      where: { id: intakeId, userId },
      relations: { messages: true },
    });
    if (!intake) throw new TicketCandidateValidation('Conversation not found');
    const repository = this.dataSource.getRepository(TicketCandidate);
    for (const message of [...intake.messages].sort((a, b) => a.position - b.position)) {
      if (message.isMedia) continue;
      const text = message.content.trim().replace(/\s+/g, ' ');
      const match = HIGH_SIGNAL.exec(text) || MEDIUM_SIGNAL.exec(text);
      if (!match) continue;
      const title = (match[1] || text).trim().slice(0, 200);
      if (title.length < 3) continue;
      const confidence: TicketCandidateConfidence = HIGH_SIGNAL.test(text) ? 'high' : 'medium';
      const fingerprint = createHash('sha256')
        .update(`${intakeId}\u0000${message.position}\u0000${title.toLowerCase()}`)
        .digest('hex');
      const idempotencyKey = `convolens-${fingerprint.slice(0, 32)}`;
      await repository
        .createQueryBuilder()
        .insert()
        .into(TicketCandidate)
        .values({
          intakeId,
          userId,
          fingerprint,
          title,
          confidence,
          idempotencyKey,
          projectId: this.normalizePinnedProjectId(this.defaultProjectId),
          description: `Evidence retained in ConvoLens at stored message ${message.position + 1}.`,
          evidence: [
            {
              messageId: message.id,
              position: message.position,
              senderName: message.senderName,
              sentAt: message.sentAt.toISOString(),
            },
          ],
          status: 'pending',
          revision: 1,
          publishStatus: 'not_requested',
        })
        .orIgnore()
        .execute();
    }
    return this.list(userId, intakeId);
  }

  list(userId: string, intakeId: string): Promise<TicketCandidate[]> {
    return this.dataSource.getRepository(TicketCandidate).find({
      where: { userId, intakeId },
      relations: { publishAttempts: true },
      order: { createdAt: 'ASC' },
    });
  }

  async listPersonalTodos(userId: string): Promise<PersonalTodoCandidate[]> {
    const candidates = await this.dataSource.getRepository(TicketCandidate).find({
      where: { userId },
      relations: { intake: true, publishAttempts: true },
      order: { updatedAt: 'DESC' },
    });
    return candidates.map((candidate) => {
      const { intake, ...safeCandidate } = candidate;
      const conversationHref = `/dashboard/conversations/${candidate.intakeId}`;
      return {
        ...safeCandidate,
        sourceContext: {
          conversationId: candidate.intakeId,
          conversationName: intake.displayName,
          catchUpHref: `${conversationHref}#catch-up`,
          evidenceLinks: candidate.evidence.map((item) => ({
            messageId: item.messageId,
            href: `${conversationHref}#message-${item.messageId}`,
          })),
        },
      };
    });
  }

  async update(
    userId: string,
    id: string,
    expectedRevision: number,
    changes: { title?: string; description?: string; projectId?: string }
  ): Promise<TicketCandidate> {
    const title = changes.title?.trim();
    if (title !== undefined && (title.length < 3 || title.length > 200)) {
      throw new TicketCandidateValidation('Title must be between 3 and 200 characters');
    }
    if (changes.description !== undefined && changes.description.length > 4000) {
      throw new TicketCandidateValidation('Description must be at most 4000 characters');
    }
    const partial: Partial<TicketCandidate> = { revision: expectedRevision + 1 };
    if (title !== undefined) partial.title = title;
    if (changes.description !== undefined) partial.description = changes.description.trim();
    if (changes.projectId !== undefined) {
      partial.projectId = this.normalizePinnedProjectId(changes.projectId);
    }
    const result = await this.dataSource
      .getRepository(TicketCandidate)
      .update({ id, userId, status: 'pending', revision: expectedRevision }, partial);
    if (result.affected !== 1)
      throw new TicketCandidateConflict('Candidate changed; reload before editing');
    return this.get(userId, id);
  }

  async decide(
    userId: string,
    id: string,
    expectedRevision: number,
    decision: 'accepted' | 'rejected',
    projectId?: string
  ): Promise<TicketCandidate> {
    const normalizedProjectId = this.normalizePinnedProjectId(projectId);
    if (decision === 'accepted' && !normalizedProjectId) {
      throw new TicketCandidateValidation('Choose a Baton project before accepting');
    }
    const result = await this.dataSource.getRepository(TicketCandidate).update(
      { id, userId, status: 'pending', revision: expectedRevision },
      {
        status: decision,
        projectId: decision === 'accepted' ? normalizedProjectId : null,
        decidedAt: new Date(),
        revision: expectedRevision + 1,
      }
    );
    if (result.affected !== 1)
      throw new TicketCandidateConflict('Candidate changed; reload before deciding');
    return this.get(userId, id);
  }

  async revoke(userId: string, id: string, expectedRevision: number): Promise<TicketCandidate> {
    const result = await this.dataSource.getRepository(TicketCandidate).update(
      {
        id,
        userId,
        status: 'accepted',
        publishStatus: 'not_requested',
        revision: expectedRevision,
      },
      { status: 'pending', decidedAt: null, revision: expectedRevision + 1 }
    );
    if (result.affected !== 1) {
      throw new TicketCandidateConflict(
        'Only an unpublished accepted draft can be returned to review; reload and try again'
      );
    }
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const candidate = await this.get(userId, id);
    if (candidate.status === 'published' || candidate.publishStatus !== 'not_requested') {
      throw new TicketCandidateConflict(
        'A draft with Baton publication history cannot be deleted from ConvoLens'
      );
    }
    const result = await this.dataSource.getRepository(TicketCandidate).delete({ id, userId });
    if (result.affected !== 1)
      throw new TicketCandidateConflict('Draft changed; reload and try again');
  }

  async publish(userId: string, id: string, batonToken: string): Promise<PublishResult> {
    if (!this.batonResource)
      throw new TicketCandidateValidation('Baton publishing is not configured');
    if (!batonToken)
      throw new TicketCandidateValidation('A current Mystira session is required for Baton');
    const repository = this.dataSource.getRepository(TicketCandidate);
    const current = await this.get(userId, id);
    if (current.publishStatus === 'succeeded' && current.batonTaskId) {
      return { candidate: current, duplicate: true };
    }
    if (current.status !== 'accepted' || !current.projectId) {
      throw new TicketCandidateValidation('Only an accepted candidate with a project can publish');
    }
    const claimId = randomUUID();
    await this.acquireIntakePublishClaim(userId, current.intakeId, claimId);
    try {
      await this.acquireCandidatePublishClaim(current, claimId);
      const claimedCurrent = await this.get(userId, id);
      const attemptRepository = this.dataSource.getRepository(BatonPublishAttempt);
      const recordedSuccess = (claimedCurrent.publishAttempts || [])
        .filter((candidateAttempt) => candidateAttempt.batonTaskId && candidateAttempt.completedAt)
        .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
      if (recordedSuccess?.batonTaskId) {
        const finalized = await repository.update(
          { id, userId, publishStatus: 'pending', publishClaimId: claimId },
          {
            status: 'published',
            publishStatus: 'succeeded',
            publishClaimId: null,
            publishClaimedAt: null,
            batonTaskId: recordedSuccess.batonTaskId,
            batonTaskUrl: this.batonTaskUrl(recordedSuccess.batonTaskId),
            publishedAt: recordedSuccess.completedAt || new Date(),
            lastPublishErrorCode: null,
          }
        );
        if (finalized.affected !== 1) {
          throw new TicketCandidateConflict('Recorded Baton task could not finalize locally');
        }
        return { candidate: await this.get(userId, id), duplicate: true };
      }
      const attemptNumber = (await attemptRepository.countBy({ candidateId: id })) + 1;
      const attempt = await attemptRepository.save(
        attemptRepository.create({ candidateId: id, userId, attemptNumber, status: 'pending' })
      );
      let createStarted = false;
      let reconcilingAmbiguousCreate = false;
      try {
        const lastAmbiguousCreate = (claimedCurrent.publishAttempts || [])
          .filter((candidateAttempt) =>
            ['baton_create_started', 'baton_ambiguous'].includes(candidateAttempt.errorCode || '')
          )
          .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
        let ambiguousCreateStartedAt =
          lastAmbiguousCreate?.completedAt || lastAmbiguousCreate?.createdAt;
        if (lastAmbiguousCreate?.errorCode === 'baton_create_started') {
          ambiguousCreateStartedAt = new Date();
          await attemptRepository.update(
            { id: lastAmbiguousCreate.id, errorCode: 'baton_create_started' },
            {
              status: 'failed',
              errorCode: 'baton_ambiguous',
              completedAt: ambiguousCreateStartedAt,
            }
          );
        }
        reconcilingAmbiguousCreate = ambiguousCreateStartedAt
          ? Date.now() - ambiguousCreateStartedAt.getTime() < BATON_AMBIGUOUS_HOLD_MS
          : false;
        let duplicate: BatonMcpTask | null;
        if (reconcilingAmbiguousCreate) {
          duplicate = await this.reconcileAmbiguousCreate(
            claimedCurrent.projectId!,
            claimedCurrent.title,
            claimedCurrent.idempotencyKey,
            batonToken
          );
          if (!duplicate) {
            throw new BatonReconciliationPending(
              'Baton is still reconciling the prior publish; retry after the safety window'
            );
          }
        } else {
          duplicate = await this.findDuplicate(
            claimedCurrent.projectId!,
            claimedCurrent.title,
            claimedCurrent.idempotencyKey,
            batonToken
          );
        }
        createStarted = !duplicate;
        if (createStarted) {
          await this.persistCreateBoundary(
            userId,
            claimedCurrent.intakeId,
            id,
            claimId,
            attempt.id
          );
        }
        const task = duplicate || (await this.createBatonTask(claimedCurrent, batonToken));
        const completedAt = new Date();
        await this.finalizePublish(
          userId,
          id,
          claimId,
          attempt.id,
          task.id,
          Boolean(duplicate),
          completedAt
        );
        return { candidate: await this.get(userId, id), duplicate: Boolean(duplicate) };
      } catch (error) {
        const code =
          createStarted || reconcilingAmbiguousCreate ? 'baton_ambiguous' : 'baton_unavailable';
        await this.recordPublishFailure(
          userId,
          id,
          claimId,
          attempt.id,
          reconcilingAmbiguousCreate && !createStarted ? 'baton_reconciling' : code,
          code
        );
        throw error;
      }
    } finally {
      await this.releaseIntakePublishClaim(userId, current.intakeId, claimId);
    }
  }

  async publishAsAdmin(id: string, batonToken: string): Promise<PublishResult> {
    const candidate = await this.dataSource.getRepository(TicketCandidate).findOneBy({ id });
    if (!candidate) throw new TicketCandidateValidation('Candidate not found');
    return this.publish(candidate.userId, id, batonToken);
  }

  private async get(userId: string, id: string): Promise<TicketCandidate> {
    const candidate = await this.dataSource.getRepository(TicketCandidate).findOne({
      where: { id, userId },
      relations: { publishAttempts: true },
    });
    if (!candidate) throw new TicketCandidateValidation('Candidate not found');
    return candidate;
  }

  private async acquireCandidatePublishClaim(
    candidate: TicketCandidate,
    claimId: string
  ): Promise<void> {
    const repository = this.dataSource.getRepository(TicketCandidate);
    const claimedAt = new Date();
    let result = await repository.update(
      {
        id: candidate.id,
        userId: candidate.userId,
        status: 'accepted',
        publishStatus: In(['not_requested', 'failed']),
      },
      { publishStatus: 'pending', publishClaimId: claimId, publishClaimedAt: claimedAt }
    );
    if (result.affected === 1) return;
    const current = await repository.findOneByOrFail({
      id: candidate.id,
      userId: candidate.userId,
    });
    const stale =
      current.publishStatus === 'pending' &&
      (!current.publishClaimedAt ||
        current.publishClaimedAt.getTime() <= Date.now() - BATON_PUBLISH_LEASE_MS);
    if (stale) {
      result = await repository.update(
        {
          id: candidate.id,
          userId: candidate.userId,
          status: 'accepted',
          publishStatus: 'pending',
          publishClaimId: current.publishClaimId || IsNull(),
        },
        { publishClaimId: claimId, publishClaimedAt: claimedAt }
      );
      if (result.affected === 1) return;
    }
    throw new TicketCandidateConflict('Candidate publication is already in progress');
  }

  private async persistCreateBoundary(
    userId: string,
    intakeId: string,
    candidateId: string,
    claimId: string,
    attemptId: string
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const claimedAt = new Date();
      const intake = await manager
        .getRepository(ConversationIntake)
        .update(
          { id: intakeId, userId, batonPublishClaimId: claimId },
          { batonPublishClaimedAt: claimedAt }
        );
      const candidate = await manager.getRepository(TicketCandidate).update(
        {
          id: candidateId,
          userId,
          publishStatus: 'pending',
          publishClaimId: claimId,
        },
        { publishClaimedAt: claimedAt }
      );
      const attempt = await manager
        .getRepository(BatonPublishAttempt)
        .update(
          { id: attemptId, candidateId, userId, status: 'pending' },
          { errorCode: 'baton_create_started' }
        );
      if (intake.affected !== 1 || candidate.affected !== 1 || attempt.affected !== 1) {
        throw new TicketCandidateConflict('Baton publication claim changed before create');
      }
    });
  }

  private async finalizePublish(
    userId: string,
    candidateId: string,
    claimId: string,
    attemptId: string,
    taskId: string,
    duplicate: boolean,
    completedAt: Date
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const attempt = await manager.getRepository(BatonPublishAttempt).update(
        { id: attemptId, candidateId, userId, status: 'pending' },
        {
          status: duplicate ? 'duplicate' : 'succeeded',
          batonTaskId: taskId,
          responseStatus: duplicate ? 200 : 201,
          errorCode: null,
          completedAt,
        }
      );
      const candidate = await manager.getRepository(TicketCandidate).update(
        { id: candidateId, userId, publishStatus: 'pending', publishClaimId: claimId },
        {
          status: 'published',
          publishStatus: 'succeeded',
          publishClaimId: null,
          publishClaimedAt: null,
          batonTaskId: taskId,
          batonTaskUrl: this.batonTaskUrl(taskId),
          publishedAt: completedAt,
          lastPublishErrorCode: null,
        }
      );
      if (attempt.affected !== 1 || candidate.affected !== 1) {
        throw new TicketCandidateConflict(
          'Baton task created but local finalization must reconcile'
        );
      }
    });
  }

  private async recordPublishFailure(
    userId: string,
    candidateId: string,
    claimId: string,
    attemptId: string,
    attemptErrorCode: string,
    candidateErrorCode: string
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const candidate = await manager.getRepository(TicketCandidate).update(
        { id: candidateId, userId, publishStatus: 'pending', publishClaimId: claimId },
        {
          publishStatus: 'failed',
          publishClaimId: null,
          publishClaimedAt: null,
          lastPublishErrorCode: candidateErrorCode,
        }
      );
      if (candidate.affected !== 1) return;
      await manager
        .getRepository(BatonPublishAttempt)
        .update(
          { id: attemptId, candidateId, userId, status: 'pending' },
          { status: 'failed', errorCode: attemptErrorCode, completedAt: new Date() }
        );
    });
  }

  private async acquireIntakePublishClaim(
    userId: string,
    intakeId: string,
    claimId: string
  ): Promise<void> {
    const repository = this.dataSource.getRepository(ConversationIntake);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const intake = await repository.findOneBy({ id: intakeId, userId });
      if (!intake || intake.rawArtifactStatus === 'deleting') {
        throw new TicketCandidateConflict('Conversation deletion has started');
      }
      const active =
        intake.batonPublishClaimId &&
        intake.batonPublishClaimedAt &&
        intake.batonPublishClaimedAt.getTime() > Date.now() - BATON_PUBLISH_LEASE_MS;
      if (active) throw new TicketCandidateConflict('Another Baton publication is in progress');
      const claimed = await repository.update(
        {
          id: intakeId,
          userId,
          rawArtifactStatus: intake.rawArtifactStatus,
          batonPublishClaimId: intake.batonPublishClaimId || IsNull(),
          batonPublishClaimedAt: intake.batonPublishClaimedAt || IsNull(),
        },
        { batonPublishClaimId: claimId, batonPublishClaimedAt: new Date() }
      );
      if (claimed.affected === 1) return;
    }
    throw new TicketCandidateConflict('Conversation changed too often to start publication safely');
  }

  private releaseIntakePublishClaim(
    userId: string,
    intakeId: string,
    claimId: string
  ): Promise<unknown> {
    return this.dataSource
      .getRepository(ConversationIntake)
      .update(
        { id: intakeId, userId, batonPublishClaimId: claimId },
        { batonPublishClaimId: null, batonPublishClaimedAt: null }
      );
  }

  private async reconcileAmbiguousCreate(
    projectId: string,
    query: string,
    idempotencyKey: string,
    token: string
  ): Promise<BatonMcpTask | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const duplicate = await this.findDuplicate(projectId, query, idempotencyKey, token);
      if (duplicate) return duplicate;
      if (attempt < 2) await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
    }
    return null;
  }

  private batonTaskUrl(taskId: string): string | null {
    return this.batonWebBaseUrl
      ? `${this.batonWebBaseUrl.replace(/\/$/, '')}/tasks/${taskId}`
      : null;
  }

  private async findDuplicate(
    projectId: string,
    query: string,
    idempotencyKey: string,
    token: string
  ): Promise<BatonMcpTask | null> {
    const client = new BatonMcpClient(this.batonResource, this.fetcher);
    const tasks = await client.searchTasks(projectId, query, token);
    return tasks.find((task) => (task.trace_id ?? task.traceId) === idempotencyKey) || null;
  }

  private async createBatonTask(candidate: TicketCandidate, token: string): Promise<BatonMcpTask> {
    const evidence = candidate.evidence
      .map((span) => `message ${span.position + 1} at ${span.sentAt}`)
      .join(', ');
    const description = [
      candidate.description?.trim(),
      `ConvoLens intake ${candidate.intakeId}; redacted evidence ${evidence}.`,
    ]
      .filter(Boolean)
      .join('\n');
    return new BatonMcpClient(this.batonResource, this.fetcher).createTask(
      {
        projectId: candidate.projectId!,
        idempotencyKey: candidate.idempotencyKey,
        title: candidate.title,
        description,
        priority: 'medium',
        traceId: candidate.idempotencyKey,
      },
      token
    );
  }
}

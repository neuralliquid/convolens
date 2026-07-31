import { createHash, randomUUID } from 'node:crypto';
import { In, IsNull, type DataSource, type Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { BatonPublishAttempt } from '../db/entities/BatonPublishAttempt';
import { ConversationIntake } from '../db/entities/ConversationIntake';
import { TicketCandidate, type TicketCandidateConfidence } from '../db/entities/TicketCandidate';

const HIGH_SIGNAL = /^(?:todo|action(?: item)?|follow[- ]?up)\s*[:\-]\s*(.+)$/i;
const MEDIUM_SIGNAL = /^(?:please|can you|could you|we need to|i will|i'll|let's)\b[\s,:-]*(.+)$/i;
const BATON_TIMEOUT_MS = 15_000;
export const BATON_PUBLISH_LEASE_MS = 90_000;
export const BATON_AMBIGUOUS_HOLD_MS = 60_000;

export class TicketCandidateConflict extends Error {}
export class TicketCandidateValidation extends Error {}
class BatonReconciliationPending extends Error {}

interface BatonTask {
  id: string;
  context?: string | null;
}

interface PublishResult {
  candidate: TicketCandidate;
  duplicate: boolean;
}

export class TicketCandidateService {
  constructor(
    private readonly dataSource: DataSource = AppDataSource,
    private readonly batonBaseUrl = process.env.BATON_BASE_URL || '',
    private readonly fetcher: typeof fetch = fetch,
    private readonly defaultProjectId = process.env.BATON_DEFAULT_PROJECT_ID || ''
  ) {}

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
          projectId: this.defaultProjectId || null,
          description: `Evidence from ${intake.displayName}, stored message ${message.position + 1}.`,
          evidence: [
            {
              messageId: message.id,
              position: message.position,
              senderName: message.senderName,
              sentAt: message.sentAt.toISOString(),
            },
          ],
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
    if (changes.projectId !== undefined) partial.projectId = changes.projectId.trim();
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
    if (decision === 'accepted' && !projectId?.trim()) {
      throw new TicketCandidateValidation('Choose a Baton project before accepting');
    }
    const result = await this.dataSource.getRepository(TicketCandidate).update(
      { id, userId, status: 'pending', revision: expectedRevision },
      {
        status: decision,
        projectId: decision === 'accepted' ? projectId!.trim() : null,
        decidedAt: new Date(),
        revision: expectedRevision + 1,
      }
    );
    if (result.affected !== 1)
      throw new TicketCandidateConflict('Candidate changed; reload before deciding');
    return this.get(userId, id);
  }

  async publish(userId: string, id: string, batonToken: string): Promise<PublishResult> {
    if (!this.batonBaseUrl)
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
      const attemptRepository = this.dataSource.getRepository(BatonPublishAttempt);
      const recordedSuccess = (current.publishAttempts || [])
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
            batonTaskUrl: `${this.batonBaseUrl.replace(/\/$/, '')}/api/tasks/${recordedSuccess.batonTaskId}`,
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
      const marker = `[convolens:${current.idempotencyKey}]`;
      let createStarted = false;
      let reconcilingAmbiguousCreate = false;
      try {
        const lastAmbiguousCreate = (current.publishAttempts || [])
          .filter((candidateAttempt) => candidateAttempt.errorCode === 'baton_ambiguous')
          .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];
        reconcilingAmbiguousCreate = Boolean(
          lastAmbiguousCreate?.completedAt &&
            Date.now() - lastAmbiguousCreate.completedAt.getTime() < BATON_AMBIGUOUS_HOLD_MS
        );
        let duplicate: BatonTask | null;
        if (reconcilingAmbiguousCreate) {
          duplicate = await this.reconcileAmbiguousCreate(current.projectId, marker, batonToken);
          if (!duplicate) {
            throw new BatonReconciliationPending(
              'Baton is still reconciling the prior publish; retry after the safety window'
            );
          }
        } else {
          duplicate = await this.findDuplicate(current.projectId, marker, batonToken);
        }
        createStarted = !duplicate;
        const task = duplicate || (await this.createBatonTask(current, marker, batonToken));
        const completedAt = new Date();
        await attemptRepository.update(attempt.id, {
          status: duplicate ? 'duplicate' : 'succeeded',
          batonTaskId: task.id,
          responseStatus: duplicate ? 200 : 201,
          completedAt,
        });
        const finalized = await repository.update(
          { id, userId, publishStatus: 'pending', publishClaimId: claimId },
          {
            status: 'published',
            publishStatus: 'succeeded',
            publishClaimId: null,
            publishClaimedAt: null,
            batonTaskId: task.id,
            batonTaskUrl: `${this.batonBaseUrl.replace(/\/$/, '')}/api/tasks/${task.id}`,
            publishedAt: completedAt,
            lastPublishErrorCode: null,
          }
        );
        if (finalized.affected !== 1) {
          throw new TicketCandidateConflict(
            'Baton task created but local finalization must reconcile'
          );
        }
        return { candidate: await this.get(userId, id), duplicate: Boolean(duplicate) };
      } catch (error) {
        const code =
          createStarted || reconcilingAmbiguousCreate ? 'baton_ambiguous' : 'baton_unavailable';
        await attemptRepository.update(attempt.id, {
          status: 'failed',
          errorCode: reconcilingAmbiguousCreate && !createStarted ? 'baton_reconciling' : code,
          completedAt: new Date(),
        });
        await repository.update(
          { id, userId, publishStatus: 'pending', publishClaimId: claimId },
          {
            publishStatus: 'failed',
            publishClaimId: null,
            publishClaimedAt: null,
            lastPublishErrorCode: code,
          }
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
    marker: string,
    token: string
  ): Promise<BatonTask | null> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const duplicate = await this.findDuplicate(projectId, marker, token);
      if (duplicate) return duplicate;
      if (attempt < 2) await new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000));
    }
    return null;
  }

  private async findDuplicate(
    projectId: string,
    marker: string,
    token: string
  ): Promise<BatonTask | null> {
    const url = new URL(`${this.batonBaseUrl.replace(/\/$/, '')}/api/tasks`);
    url.searchParams.set('projectId', projectId);
    url.searchParams.set('search', marker);
    const response = await this.batonFetch(url, token);
    if (!response.ok) throw new Error(`Baton duplicate check failed (${response.status})`);
    const tasks = (await response.json()) as BatonTask[];
    return tasks.find((task) => task.context?.includes(marker)) || null;
  }

  private async createBatonTask(
    candidate: TicketCandidate,
    marker: string,
    token: string
  ): Promise<BatonTask> {
    const evidence = candidate.evidence
      .map((span) => `message ${span.position + 1} at ${span.sentAt}`)
      .join(', ');
    const response = await this.batonFetch(
      `${this.batonBaseUrl.replace(/\/$/, '')}/api/tasks`,
      token,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: candidate.projectId,
          title: candidate.title,
          description: candidate.description || null,
          priority: 'medium',
          status: 'todo',
          ownerType: 'unassigned',
          workType: 'feature',
          outcomeType: 'follow_up',
          confidence: 'well_defined',
          executionMode: 'human_agent',
          triggeredBy: 'convolens',
          traceId: candidate.idempotencyKey,
          context: `${marker}\nConvoLens intake ${candidate.intakeId}; evidence ${evidence}.`,
        }),
      }
    );
    if (!response.ok) throw new Error(`Baton task creation failed (${response.status})`);
    return (await response.json()) as BatonTask;
  }

  private batonFetch(
    input: string | URL,
    token: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BATON_TIMEOUT_MS);
    return this.fetcher(input, {
      ...init,
      signal: controller.signal,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    }).finally(() => clearTimeout(timeout));
  }
}

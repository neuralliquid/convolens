import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { BatonPublishAttempt } from '../../db/entities/BatonPublishAttempt';
import { ConversationIntake } from '../../db/entities/ConversationIntake';
import { ConversationMessage } from '../../db/entities/ConversationMessage';
import { MessageTranscript } from '../../db/entities/MessageTranscript';
import { TicketCandidate } from '../../db/entities/TicketCandidate';
import { ConversationIntakeService } from '../conversation-intake.service';
import {
  BATON_PUBLISH_LEASE_MS,
  TicketCandidateConflict,
  TicketCandidateService,
  TicketCandidateValidation,
} from '../ticket-candidate.service';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

describe('TicketCandidateService', () => {
  let dataSource: DataSource;
  let intakeId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [
        ConversationIntake,
        ConversationMessage,
        MessageTranscript,
        TicketCandidate,
        BatonPublishAttempt,
      ],
    });
    await dataSource.initialize();
  });

  beforeEach(async () => {
    await dataSource.getRepository(BatonPublishAttempt).clear();
    await dataSource.getRepository(TicketCandidate).clear();
    await dataSource.getRepository(ConversationMessage).clear();
    await dataSource.getRepository(ConversationIntake).clear();
    const saved = await new ConversationIntakeService(dataSource).save({
      userId: 'user-1',
      sourcePlatform: 'whatsapp',
      sourceKind: 'extension',
      displayName: 'Delivery chat',
      isGroup: true,
      participants: [],
      messages: [
        {
          senderName: 'A',
          content: 'General discussion',
          sentAt: new Date('2026-07-31T10:00:00Z'),
          isOutgoing: false,
          isMedia: false,
        },
        {
          senderName: 'B',
          content: 'TODO: Verify the deployment',
          sentAt: new Date('2026-07-31T10:01:00Z'),
          isOutgoing: true,
          isMedia: false,
        },
        {
          senderName: 'A',
          content: 'Can you attach the acceptance evidence?',
          sentAt: new Date('2026-07-31T10:02:00Z'),
          isOutgoing: false,
          isMedia: false,
        },
      ],
    });
    intakeId = saved.conversation.id;
  });

  afterAll(() => dataSource.destroy());

  it('generates evidence-linked deterministic candidates idempotently', async () => {
    const service = new TicketCandidateService(dataSource, '', fetch, PROJECT_ID);
    const first = await service.generate('user-1', intakeId);
    const second = await service.generate('user-1', intakeId);
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(
      first.map((candidate) => [
        candidate.title,
        candidate.confidence,
        candidate.evidence[0].position,
      ])
    ).toEqual([
      ['Verify the deployment', 'high', 1],
      ['attach the acceptance evidence?', 'medium', 2],
    ]);
    expect(first.every((candidate) => candidate.projectId === PROJECT_ID)).toBe(true);
  });

  it('lists only the current user drafts with navigable source context', async () => {
    const service = new TicketCandidateService(dataSource, '', fetch, PROJECT_ID);
    const [candidate] = await service.generate('user-1', intakeId);
    const otherIntake = await new ConversationIntakeService(dataSource).save({
      userId: 'user-2',
      sourcePlatform: 'whatsapp',
      sourceKind: 'upload',
      displayName: 'Private other chat',
      isGroup: false,
      participants: [],
      messages: [
        {
          senderName: 'Other',
          content: 'TODO: Never expose this',
          sentAt: new Date('2026-08-03T11:00:00Z'),
          isOutgoing: false,
          isMedia: false,
        },
      ],
    });
    await service.generate('user-2', otherIntake.conversation.id);

    const todos = await service.listPersonalTodos('user-1');

    expect(todos).toHaveLength(2);
    expect(todos.map((todo) => todo.userId)).toEqual(['user-1', 'user-1']);
    const todo = todos.find((item) => item.id === candidate.id)!;
    expect(todo.sourceContext).toEqual({
      conversationId: intakeId,
      conversationName: 'Delivery chat',
      catchUpHref: `/dashboard/conversations/${intakeId}#catch-up`,
      evidenceLinks: [
        {
          messageId: candidate.evidence[0].messageId,
          href: `/dashboard/conversations/${intakeId}#message-${candidate.evidence[0].messageId}`,
        },
      ],
    });
    expect((todo as unknown as { intake?: unknown }).intake).toBeUndefined();
  });

  it('revokes or deletes only drafts that have never entered publication', async () => {
    const service = new TicketCandidateService(dataSource, '', fetch, PROJECT_ID);
    const [candidate, deletable] = await service.generate('user-1', intakeId);
    const accepted = await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);
    const revoked = await service.revoke('user-1', candidate.id, accepted.revision);
    expect(revoked.status).toBe('pending');
    expect(revoked.revision).toBe(accepted.revision + 1);

    await service.remove('user-1', deletable.id);
    expect(await service.list('user-1', intakeId)).toHaveLength(1);

    await dataSource.getRepository(TicketCandidate).update(candidate.id, {
      status: 'accepted',
      publishStatus: 'failed',
    });
    await expect(service.remove('user-1', candidate.id)).rejects.toBeInstanceOf(
      TicketCandidateConflict
    );
    await expect(service.revoke('user-1', candidate.id, revoked.revision)).rejects.toBeInstanceOf(
      TicketCandidateConflict
    );
  });

  it('uses revision CAS and never publishes before acceptance', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await expect(service.publish('user-1', candidate.id, 'token')).rejects.toThrow(
      'Only an accepted candidate'
    );
    const edited = await service.update('user-1', candidate.id, 1, { title: 'Edited task' });
    await expect(
      service.update('user-1', candidate.id, 1, { title: 'Stale edit' })
    ).rejects.toBeInstanceOf(TicketCandidateConflict);
    expect(edited.revision).toBe(2);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('requires a fresh acceptance after editing', async () => {
    const service = new TicketCandidateService(dataSource, '', fetch, PROJECT_ID);
    const [candidate] = await service.generate('user-1', intakeId);
    const accepted = await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);

    await expect(
      service.update('user-1', candidate.id, accepted.revision, { title: 'Changed after review' })
    ).rejects.toBeInstanceOf(TicketCandidateConflict);
  });

  it('rejects invalid Baton project IDs before persistence', async () => {
    const service = new TicketCandidateService(dataSource);
    const [candidate] = await service.generate('user-1', intakeId);

    await expect(
      service.update('user-1', candidate.id, 1, { projectId: 'not-a-project-uuid' })
    ).rejects.toBeInstanceOf(TicketCandidateValidation);
    await expect(
      service.decide('user-1', candidate.id, 1, 'accepted', 'x'.repeat(37))
    ).rejects.toBeInstanceOf(TicketCandidateValidation);

    const stored = await dataSource.getRepository(TicketCandidate).findOneByOrFail({
      id: candidate.id,
    });
    expect(stored.projectId).toBeNull();
    expect(stored.status).toBe('pending');
    expect(stored.revision).toBe(1);
  });

  it('publishes one accepted candidate once and returns the persisted result on replay', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task-1' }), { status: 201 }));
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID,
      'https://baton-ui.example'
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);
    const first = await service.publish('user-1', candidate.id, 'mystira-token');
    const replay = await service.publish('user-1', candidate.id, 'mystira-token');
    expect(first.candidate.batonTaskId).toBe('task-1');
    expect(first.candidate.batonTaskUrl).toBe('https://baton-ui.example/tasks/task-1');
    expect(first.duplicate).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(first.candidate.publishAttempts[0].status).toBe('succeeded');
  });

  it('persists a retryable outage and reconciles an ambiguous duplicate on retry', async () => {
    const fetcher = jest.fn<typeof fetch>().mockRejectedValueOnce(new Error('network down'));
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);
    await expect(service.publish('user-1', candidate.id, 'token')).rejects.toThrow('network down');
    const stored = await dataSource
      .getRepository(TicketCandidate)
      .findOneByOrFail({ id: candidate.id });
    expect(stored.publishStatus).toBe('failed');
    const marker = `[convolens:${stored.idempotencyKey}]`;
    fetcher.mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'task-existing', context: marker }]), { status: 200 })
    );
    const recovered = await service.publish('user-1', candidate.id, 'token');
    expect(recovered.duplicate).toBe(true);
    expect(recovered.candidate.batonTaskId).toBe('task-existing');
    expect(recovered.candidate.publishAttempts.map((attempt) => attempt.status).sort()).toEqual([
      'duplicate',
      'failed',
    ]);
  });

  it('reclaims stale candidate and intake publication leases', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'task-reclaimed' }), { status: 201 })
      );
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);
    const staleAt = new Date(Date.now() - BATON_PUBLISH_LEASE_MS - 1_000);
    await dataSource.getRepository(TicketCandidate).update(candidate.id, {
      publishStatus: 'pending',
      publishClaimId: 'stale-candidate-claim',
      publishClaimedAt: staleAt,
    });
    await dataSource.getRepository(ConversationIntake).update(intakeId, {
      batonPublishClaimId: 'stale-intake-claim',
      batonPublishClaimedAt: staleAt,
    });

    const result = await service.publish('user-1', candidate.id, 'token');

    expect(result.candidate.batonTaskId).toBe('task-reclaimed');
    const intake = await dataSource
      .getRepository(ConversationIntake)
      .findOneByOrFail({ id: intakeId });
    expect(intake.batonPublishClaimId).toBeNull();
  });

  it('does not reclaim an intake lease renewed during the stale-claim CAS', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);
    const repository = dataSource.getRepository(ConversationIntake);
    const staleAt = new Date(Date.now() - BATON_PUBLISH_LEASE_MS - 1_000);
    await repository.update(intakeId, {
      batonPublishClaimId: 'renewed-intake-claim',
      batonPublishClaimedAt: staleAt,
    });
    const originalUpdate = Object.getPrototypeOf(repository).update.bind(
      repository
    ) as typeof repository.update;
    let renewed = false;
    const updateSpy = jest
      .spyOn(repository, 'update')
      .mockImplementation(async (criteria, partial) => {
        if (
          !renewed &&
          typeof criteria === 'object' &&
          'batonPublishClaimId' in criteria &&
          criteria.batonPublishClaimId === 'renewed-intake-claim' &&
          partial.batonPublishClaimId !== null
        ) {
          renewed = true;
          await originalUpdate(intakeId, { batonPublishClaimedAt: new Date() });
        }
        return originalUpdate(criteria, partial);
      });

    try {
      await expect(service.publish('user-1', candidate.id, 'token')).rejects.toThrow(
        'Another Baton publication is in progress'
      );
    } finally {
      updateSpy.mockRestore();
    }

    const stored = await repository.findOneByOrFail({ id: intakeId });
    expect(renewed).toBe(true);
    expect(stored.batonPublishClaimId).toBe('renewed-intake-claim');
    expect(stored.batonPublishClaimedAt!.getTime()).toBeGreaterThan(staleAt.getTime());
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('fences a delayed publisher after its stale claim is reclaimed', async () => {
    let releaseOriginalLookup!: (response: Response) => void;
    let markOriginalLookupStarted!: () => void;
    const originalLookupStarted = new Promise<void>((resolve) => {
      markOriginalLookupStarted = resolve;
    });
    const originalLookup = new Promise<Response>((resolve) => {
      releaseOriginalLookup = resolve;
    });
    let lookupCount = 0;
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'task-fenced' }), { status: 201 });
      }
      lookupCount += 1;
      if (lookupCount === 1) {
        markOriginalLookupStarted();
        return originalLookup;
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);

    const originalPublish = service.publish('user-1', candidate.id, 'token');
    await originalLookupStarted;
    const staleAt = new Date(Date.now() - BATON_PUBLISH_LEASE_MS - 1_000);
    await dataSource.getRepository(TicketCandidate).update(candidate.id, {
      publishClaimedAt: staleAt,
    });
    await dataSource.getRepository(ConversationIntake).update(intakeId, {
      batonPublishClaimedAt: staleAt,
    });

    const recovered = await service.publish('user-1', candidate.id, 'token');
    releaseOriginalLookup(new Response(JSON.stringify([]), { status: 200 }));

    await expect(originalPublish).rejects.toBeInstanceOf(TicketCandidateConflict);
    expect(recovered.candidate.batonTaskId).toBe('task-fenced');
    expect(fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1);
  });

  it('finalizes a recorded Baton success before any remote retry', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);
    const staleAt = new Date(Date.now() - BATON_PUBLISH_LEASE_MS - 1_000);
    await dataSource.getRepository(TicketCandidate).update(candidate.id, {
      publishStatus: 'pending',
      publishClaimId: 'crashed-candidate-claim',
      publishClaimedAt: staleAt,
    });
    await dataSource.getRepository(ConversationIntake).update(intakeId, {
      batonPublishClaimId: 'crashed-intake-claim',
      batonPublishClaimedAt: staleAt,
    });
    await dataSource.getRepository(BatonPublishAttempt).save({
      candidateId: candidate.id,
      userId: 'user-1',
      attemptNumber: 1,
      status: 'failed',
      batonTaskId: 'task-recorded',
      responseStatus: 201,
      errorCode: 'baton_ambiguous',
      completedAt: new Date(),
    });

    const recovered = await service.publish('user-1', candidate.id, 'token');

    expect(recovered.candidate.batonTaskId).toBe('task-recorded');
    expect(recovered.candidate.publishStatus).toBe('succeeded');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('holds an ambiguous create for reconciliation instead of issuing a second POST', async () => {
    let allowCreateSuccess = false;
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockRejectedValueOnce(new Error('connection lost after POST'))
      .mockImplementation(async (_input, init) =>
        init?.method === 'POST' && allowCreateSuccess
          ? new Response(JSON.stringify({ id: 'task-after-window' }), { status: 201 })
          : new Response(JSON.stringify([]), { status: 200 })
      );
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);
    await expect(service.publish('user-1', candidate.id, 'token')).rejects.toThrow(
      'connection lost after POST'
    );

    await expect(service.publish('user-1', candidate.id, 'token')).rejects.toThrow(
      'still reconciling'
    );

    expect(fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1);
    const stored = await dataSource
      .getRepository(TicketCandidate)
      .findOneByOrFail({ id: candidate.id });
    expect(stored.lastPublishErrorCode).toBe('baton_ambiguous');
    const attempts = await dataSource
      .getRepository(BatonPublishAttempt)
      .find({ where: { candidateId: candidate.id }, order: { attemptNumber: 'ASC' } });
    expect(attempts.map((attempt) => attempt.errorCode)).toEqual([
      'baton_ambiguous',
      'baton_reconciling',
    ]);

    await dataSource.getRepository(BatonPublishAttempt).update(attempts[0].id, {
      completedAt: new Date(Date.now() - 61_000),
    });
    allowCreateSuccess = true;
    const afterWindow = await service.publish('user-1', candidate.id, 'token');
    expect(afterWindow.candidate.batonTaskId).toBe('task-after-window');
    expect(fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(2);
  }, 15_000);

  it('reconciles a durable create boundary after a crash before issuing another POST', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }));
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);
    const staleAt = new Date(Date.now() - BATON_PUBLISH_LEASE_MS - 1_000);
    await dataSource.getRepository(TicketCandidate).update(candidate.id, {
      publishStatus: 'pending',
      publishClaimId: 'crashed-candidate-claim',
      publishClaimedAt: staleAt,
    });
    await dataSource.getRepository(ConversationIntake).update(intakeId, {
      batonPublishClaimId: 'crashed-intake-claim',
      batonPublishClaimedAt: staleAt,
    });
    await dataSource.getRepository(BatonPublishAttempt).save({
      candidateId: candidate.id,
      userId: 'user-1',
      attemptNumber: 1,
      status: 'pending',
      errorCode: 'baton_create_started',
      createdAt: staleAt,
    });

    await expect(service.publish('user-1', candidate.id, 'token')).rejects.toThrow(
      'still reconciling'
    );

    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls.every((call) => call[1]?.method !== 'POST')).toBe(true);
    const stored = await dataSource
      .getRepository(TicketCandidate)
      .findOneByOrFail({ id: candidate.id });
    expect(stored.lastPublishErrorCode).toBe('baton_ambiguous');
    const attempts = await dataSource
      .getRepository(BatonPublishAttempt)
      .find({ where: { candidateId: candidate.id }, order: { attemptNumber: 'ASC' } });
    expect(attempts[0].errorCode).toBe('baton_ambiguous');
    expect(attempts[0].completedAt!.getTime()).toBeGreaterThan(staleAt.getTime());
    expect(attempts[1].errorCode).toBe('baton_reconciling');
  }, 10_000);

  it('preserves the ambiguous window when reconciliation lookup fails', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockRejectedValueOnce(new Error('connection lost after POST'))
      .mockRejectedValueOnce(new Error('duplicate lookup unavailable'))
      .mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }));
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      PROJECT_ID
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', PROJECT_ID);
    await expect(service.publish('user-1', candidate.id, 'token')).rejects.toThrow(
      'connection lost after POST'
    );
    await expect(service.publish('user-1', candidate.id, 'token')).rejects.toThrow(
      'duplicate lookup unavailable'
    );

    const afterLookupFailure = await dataSource
      .getRepository(TicketCandidate)
      .findOneByOrFail({ id: candidate.id });
    expect(afterLookupFailure.lastPublishErrorCode).toBe('baton_ambiguous');
    await expect(service.publish('user-1', candidate.id, 'token')).rejects.toThrow(
      'still reconciling'
    );
    expect(fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1);
  }, 15_000);
});

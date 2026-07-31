import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';
import { BatonPublishAttempt } from '../../db/entities/BatonPublishAttempt';
import { ConversationIntake } from '../../db/entities/ConversationIntake';
import { ConversationMessage } from '../../db/entities/ConversationMessage';
import { TicketCandidate } from '../../db/entities/TicketCandidate';
import { ConversationIntakeService } from '../conversation-intake.service';
import { TicketCandidateConflict, TicketCandidateService } from '../ticket-candidate.service';

describe('TicketCandidateService', () => {
  let dataSource: DataSource;
  let intakeId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [ConversationIntake, ConversationMessage, TicketCandidate, BatonPublishAttempt],
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
    const service = new TicketCandidateService(dataSource, '', fetch, 'project-1');
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
    expect(first.every((candidate) => candidate.projectId === 'project-1')).toBe(true);
  });

  it('uses revision CAS and never publishes before acceptance', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      'project-1'
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

  it('publishes one accepted candidate once and returns the persisted result on replay', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'task-1' }), { status: 201 }));
    const service = new TicketCandidateService(
      dataSource,
      'https://baton.example',
      fetcher,
      'project-1'
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', 'project-1');
    const first = await service.publish('user-1', candidate.id, 'mystira-token');
    const replay = await service.publish('user-1', candidate.id, 'mystira-token');
    expect(first.candidate.batonTaskId).toBe('task-1');
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
      'project-1'
    );
    const [candidate] = await service.generate('user-1', intakeId);
    await service.decide('user-1', candidate.id, 1, 'accepted', 'project-1');
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
});

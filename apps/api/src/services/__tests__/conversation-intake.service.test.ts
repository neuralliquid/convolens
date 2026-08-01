import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource, IsNull } from 'typeorm';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { ConversationIntake } from '../../db/entities/ConversationIntake';
import { ConversationMessage } from '../../db/entities/ConversationMessage';
import { BatonPublishAttempt } from '../../db/entities/BatonPublishAttempt';
import { TicketCandidate } from '../../db/entities/TicketCandidate';
import {
  ConversationIntakeService,
  RAW_ARTIFACT_CLAIM_LEASE_MS,
  RAW_ARTIFACT_DELETE_GRACE_MS,
  createConversationCompatibilityHash,
  createConversationContentHash,
  createConversationContentHashV2,
  createPostgresCompatibilityAdvisoryLockKey,
  type ConversationIntakeInput,
} from '../conversation-intake.service';
import { AZURE_UPLOAD_TOTAL_TIMEOUT_MS, StorageService } from '../storage/storage.service';
import { BATON_AMBIGUOUS_HOLD_MS, BATON_PUBLISH_LEASE_MS } from '../ticket-candidate.service';

const baseInput: ConversationIntakeInput = {
  userId: 'mystira-user-1',
  sourcePlatform: 'whatsapp',
  sourceKind: 'extension',
  sourceConversationId: 'unstable-chat-id',
  displayName: 'Alpha Group',
  isGroup: true,
  participants: ['Hans', 'Irma'],
  sourceExtractedAt: new Date('2026-07-25T08:05:00.000Z'),
  messages: [
    {
      sourceMessageId: 'unstable-message-id',
      senderName: 'Hans',
      content: 'Morning!',
      sentAt: new Date('2026-07-25T08:00:00.000Z'),
      isOutgoing: false,
      isMedia: false,
    },
    {
      senderName: 'Irma',
      content: 'Ready for alpha.',
      sentAt: new Date('2026-07-25T08:01:00.000Z'),
      isOutgoing: true,
      isMedia: false,
    },
  ],
};

function stableInput(
  sourceConversationId = 'whatsapp:120363123456789@g.us',
  rawDisplayName = '+27821234567',
  normalizedPhone = '+27821234567'
): ConversationIntakeInput {
  return {
    ...baseInput,
    sourceConversationId,
    sourceConversationIdentityStable: true,
    participants: [rawDisplayName],
    participantEvidence: [
      {
        ref: 'participant_1',
        rawDisplayName,
        normalizedPhone,
        isSelf: false,
        extractionMethod: 'metadata',
        confidence: 'high',
      },
    ],
    messages: baseInput.messages.map((message) => ({
      ...message,
      senderName: rawDisplayName,
      senderRef: 'participant_1',
    })),
  };
}

describe('ConversationIntakeService', () => {
  let dataSource: DataSource;
  let service: ConversationIntakeService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [ConversationIntake, ConversationMessage, TicketCandidate, BatonPublishAttempt],
    });
    await dataSource.initialize();
    service = new ConversationIntakeService(dataSource);
  });

  beforeEach(async () => {
    await dataSource.getRepository(BatonPublishAttempt).clear();
    await dataSource.getRepository(TicketCandidate).clear();
    await dataSource.getRepository(ConversationMessage).clear();
    await dataSource.getRepository(ConversationIntake).clear();
  });

  it('bounds crash recovery plus a replacement upload below caller timeouts', () => {
    expect(RAW_ARTIFACT_CLAIM_LEASE_MS).toBeGreaterThan(AZURE_UPLOAD_TOTAL_TIMEOUT_MS);
    expect(RAW_ARTIFACT_CLAIM_LEASE_MS + AZURE_UPLOAD_TOTAL_TIMEOUT_MS).toBeLessThan(60_000);
    expect(AZURE_UPLOAD_TOTAL_TIMEOUT_MS + RAW_ARTIFACT_DELETE_GRACE_MS + 15_000).toBeLessThan(
      60_000
    );
  });

  it('encodes compatibility advisory lock keys as PostgreSQL-safe deterministic text', () => {
    const rawKey = ['owner-a', 'whatsapp', 'compatibility-hash'].join('\u0000');
    const encoded = createPostgresCompatibilityAdvisoryLockKey(rawKey);

    expect(encoded).toMatch(/^[a-f0-9]{64}$/);
    expect(encoded).not.toContain('\u0000');
    expect(createPostgresCompatibilityAdvisoryLockKey(rawKey)).toBe(encoded);
    expect(createPostgresCompatibilityAdvisoryLockKey(`${rawKey}-other`)).not.toBe(encoded);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('stores messages and returns a user-scoped list and detail', async () => {
    const saved = await service.save(baseInput);

    expect(saved.duplicate).toBe(false);
    expect(saved.conversation.messages).toHaveLength(2);

    const list = await service.listForUser(baseInput.userId);
    expect(list).toEqual([
      expect.objectContaining({
        id: saved.conversation.id,
        displayName: 'Alpha Group',
        messageCount: 2,
        participants: ['Hans', 'Irma'],
      }),
    ]);

    const detail = await service.getForUser(baseInput.userId, saved.conversation.id);
    expect(detail?.messages.map((message) => message.content)).toEqual([
      'Morning!',
      'Ready for alpha.',
    ]);
    expect(await service.getForUser('other-user', saved.conversation.id)).toBeNull();
  });

  it('stores an integrity-addressed raw artifact and deletes it with the intake', async () => {
    const artifactRoot = await mkdtemp(resolve(tmpdir(), 'convolens-artifact-test-'));
    try {
      const artifactService = new ConversationIntakeService(
        dataSource,
        new StorageService({ provider: 'local', localBasePath: artifactRoot })
      );
      const saved = await artifactService.save(baseInput);
      const persisted = await artifactService.ensureRawArtifact(
        saved.conversation,
        baseInput.userId,
        { body: '{"fixture":true}', contentType: 'application/json' }
      );

      expect(persisted.rawArtifactStatus).toBe('stored');
      expect(persisted.rawArtifactSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(persisted.rawArtifactKey).toMatch(
        /^raw-intakes\/[a-f0-9]{32}\/[a-f0-9-]+\/[a-f0-9-]{36}\/[a-f0-9]{64}\.json$/
      );
      expect(await readFile(resolve(artifactRoot, persisted.rawArtifactKey!), 'utf8')).toBe(
        '{"fixture":true}'
      );

      const duplicate = await artifactService.save({
        ...baseInput,
        messages: baseInput.messages.map((message, index) => ({
          ...message,
          sourceMessageId: `retry-${index}`,
        })),
      });
      const retained = await artifactService.ensureRawArtifact(
        duplicate.conversation,
        baseInput.userId,
        { body: '{"fixture":"retry"}', contentType: 'application/json' }
      );
      expect(retained.rawArtifactKey).toBe(persisted.rawArtifactKey);
      expect(await readFile(resolve(artifactRoot, retained.rawArtifactKey!), 'utf8')).toBe(
        '{"fixture":true}'
      );

      expect(await artifactService.deleteForUser(baseInput.userId, persisted.id)).toBe(true);
      await expect(
        readFile(resolve(artifactRoot, persisted.rawArtifactKey!))
      ).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await rm(artifactRoot, { recursive: true, force: true });
    }
  });

  it('serializes concurrent raw-artifact claims and retains the first evidence', async () => {
    const uploads: Array<{ key: string; body: string }> = [];
    const storage = {
      uploadFile: jest.fn(async (key: string, body: Buffer) => {
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
        uploads.push({ key, body: body.toString('utf8') });
      }),
    } as unknown as StorageService;
    const artifactService = new ConversationIntakeService(dataSource, storage);
    const saved = await artifactService.save(baseInput);

    const [first, second] = await Promise.all([
      artifactService.ensureRawArtifact(saved.conversation, baseInput.userId, {
        body: '{"capture":1}',
        contentType: 'application/json',
      }),
      artifactService.ensureRawArtifact(saved.conversation, baseInput.userId, {
        body: '{"capture":2}',
        contentType: 'application/json',
      }),
    ]);

    expect(uploads).toHaveLength(1);
    expect(uploads[0].body).toBe('{"capture":1}');
    expect(second.rawArtifactKey).toBe(first.rawArtifactKey);
    expect(second.rawArtifactStatus).toBe('stored');
  });

  it('reclaims an expired pending raw-artifact lease without reusing its key', async () => {
    const uploads: string[] = [];
    const storage = {
      uploadFile: jest.fn(async (key: string) => {
        uploads.push(key);
      }),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;
    const artifactService = new ConversationIntakeService(dataSource, storage);
    const saved = await artifactService.save(baseInput);
    const repository = dataSource.getRepository(ConversationIntake);
    const replacement = '{"replacement":true}';
    await repository.update(saved.conversation.id, {
      rawArtifactKey: `raw-intakes/stale/${saved.conversation.id}/stale/artifact.json`,
      rawArtifactSha256: createHash('sha256').update(replacement).digest('hex'),
      rawArtifactSize: 8,
      rawArtifactStatus: 'pending',
      rawArtifactClaimId: '00000000-0000-4000-8000-000000000000',
      rawArtifactClaimedAt: new Date(Date.now() - 240_000),
      errorCode: 'raw_artifact_write_failed',
    });

    const persisted = await artifactService.ensureRawArtifact(
      saved.conversation,
      baseInput.userId,
      { body: replacement, contentType: 'application/json' }
    );

    expect(uploads).toEqual([persisted.rawArtifactKey]);
    expect(persisted.rawArtifactKey).not.toContain('/stale/');
    expect(persisted.rawArtifactStatus).toBe('stored');
    expect(persisted.rawArtifactClaimId).toBeNull();
    expect(persisted.rawArtifactClaimedAt).toBeNull();
    expect(persisted.errorCode).toBeNull();
  });

  it('fails closed rather than replacing an expired claim with different raw bytes', async () => {
    const storage = {
      uploadFile: jest.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;
    const artifactService = new ConversationIntakeService(dataSource, storage);
    const saved = await artifactService.save(baseInput);
    const originalKey = `raw-intakes/original/${saved.conversation.id}/claim/artifact.json`;
    await dataSource.getRepository(ConversationIntake).update(saved.conversation.id, {
      rawArtifactKey: originalKey,
      rawArtifactSha256: createHash('sha256').update('original').digest('hex'),
      rawArtifactSize: 8,
      rawArtifactStatus: 'pending',
      rawArtifactClaimId: '00000000-0000-4000-8000-000000000002',
      rawArtifactClaimedAt: new Date(Date.now() - 240_000),
    });

    await expect(
      artifactService.ensureRawArtifact(saved.conversation, baseInput.userId, {
        body: 'different',
        contentType: 'text/plain',
      })
    ).rejects.toThrow('recovery requires the exact original raw payload');
    const retained = await dataSource
      .getRepository(ConversationIntake)
      .findOneByOrFail({ id: saved.conversation.id });
    expect(retained.rawArtifactKey).toBe(originalKey);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('reclaims a pending claim when its lease expires during the wait', async () => {
    const storage = {
      uploadFile: jest.fn().mockResolvedValue(undefined),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    } as unknown as StorageService;
    const artifactService = new ConversationIntakeService(dataSource, storage);
    const saved = await artifactService.save(baseInput);
    const afterWait = '{"after-wait":true}';
    await dataSource.getRepository(ConversationIntake).update(saved.conversation.id, {
      rawArtifactKey: `raw-intakes/pending/${saved.conversation.id}/pending/artifact.json`,
      rawArtifactSha256: createHash('sha256').update(afterWait).digest('hex'),
      rawArtifactSize: 8,
      rawArtifactStatus: 'pending',
      rawArtifactClaimId: '00000000-0000-4000-8000-000000000001',
      rawArtifactClaimedAt: new Date(Date.now() - (RAW_ARTIFACT_CLAIM_LEASE_MS - 100)),
    });

    const persisted = await artifactService.ensureRawArtifact(
      saved.conversation,
      baseInput.userId,
      { body: afterWait, contentType: 'application/json' }
    );

    expect(persisted.rawArtifactStatus).toBe('stored');
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
  });

  it('clears the persisted write error after a successful same-artifact retry', async () => {
    const uploadFile = jest
      .fn()
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValueOnce(undefined);
    const deleteFile = jest
      .fn()
      .mockRejectedValueOnce(new Error('cleanup unavailable'))
      .mockResolvedValue(undefined);
    const artifactService = new ConversationIntakeService(dataSource, {
      uploadFile,
      deleteFile,
    } as unknown as StorageService);
    const saved = await artifactService.save(baseInput);
    const artifact = { body: '{"retry":true}', contentType: 'application/json' as const };

    await expect(
      artifactService.ensureRawArtifact(saved.conversation, baseInput.userId, artifact)
    ).rejects.toThrow('storage unavailable');
    const failed = await dataSource
      .getRepository(ConversationIntake)
      .findOneByOrFail({ id: saved.conversation.id });
    expect(failed.errorCode).toBe('raw_artifact_write_failed');
    const failedKey = failed.rawArtifactKey;

    const retried = await artifactService.ensureRawArtifact(
      saved.conversation,
      baseInput.userId,
      artifact
    );
    expect(retried.rawArtifactStatus).toBe('stored');
    expect(retried.errorCode).toBeNull();
    expect(uploadFile).toHaveBeenCalledTimes(2);
    expect(retried.rawArtifactKey).not.toBe(failedKey);
    expect(uploadFile.mock.calls[1][0]).toBe(retried.rawArtifactKey);
    expect(deleteFile).toHaveBeenCalledWith(failedKey);
    expect(retried.rawArtifactCleanupKeys).toEqual([failedKey]);

    const afterCleanupRecovery = await artifactService.ensureRawArtifact(
      saved.conversation,
      baseInput.userId,
      artifact
    );
    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(afterCleanupRecovery.rawArtifactCleanupKeys).toBeNull();
  });

  it('can retry deletion when the artifact is already absent after a database error', async () => {
    const artifactRoot = await mkdtemp(resolve(tmpdir(), 'convolens-delete-retry-test-'));
    try {
      const artifactService = new ConversationIntakeService(
        dataSource,
        new StorageService({ provider: 'local', localBasePath: artifactRoot })
      );
      const saved = await artifactService.save(baseInput);
      const persisted = await artifactService.ensureRawArtifact(
        saved.conversation,
        baseInput.userId,
        { body: 'deletion retry', contentType: 'text/plain' }
      );
      const repository = dataSource.getRepository(ConversationIntake);
      const deleteSpy = jest
        .spyOn(repository, 'delete')
        .mockRejectedValueOnce(new Error('db down'));

      await expect(artifactService.deleteForUser(baseInput.userId, persisted.id)).rejects.toThrow(
        'db down'
      );
      expect(await artifactService.deleteForUser(baseInput.userId, persisted.id)).toBe(true);
      expect(deleteSpy).toHaveBeenCalledTimes(2);
    } finally {
      await rm(artifactRoot, { recursive: true, force: true });
    }
  });

  it('tombstones deletion so a concurrent late upload cleans itself up', async () => {
    let releaseUpload!: () => void;
    let reportUploadStarted!: () => void;
    const uploadGate = new Promise<void>((resolvePromise) => {
      releaseUpload = resolvePromise;
    });
    const uploadStarted = new Promise<void>((resolvePromise) => {
      reportUploadStarted = resolvePromise;
    });
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const storage = {
      uploadFile: jest.fn(async () => {
        reportUploadStarted();
        await uploadGate;
      }),
      deleteFile,
    } as unknown as StorageService;
    const artifactService = new ConversationIntakeService(dataSource, storage);
    const saved = await artifactService.save(baseInput);

    const persistence = artifactService.ensureRawArtifact(saved.conversation, baseInput.userId, {
      body: '{"late":true}',
      contentType: 'application/json',
    });
    const persistenceAssertion = expect(persistence).rejects.toThrow(
      /deletion started|Could not find any entity/
    );
    await uploadStarted;
    await dataSource.getRepository(ConversationIntake).update(saved.conversation.id, {
      rawArtifactClaimedAt: new Date(
        Date.now() - AZURE_UPLOAD_TOTAL_TIMEOUT_MS - RAW_ARTIFACT_DELETE_GRACE_MS
      ),
    });
    const deletion = artifactService.deleteForUser(baseInput.userId, saved.conversation.id);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
    releaseUpload();

    expect(await deletion).toBe(true);
    await persistenceAssertion;
    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(deleteFile.mock.calls[1][0]).toBe(deleteFile.mock.calls[0][0]);
    expect(await artifactService.getForUser(baseInput.userId, saved.conversation.id)).toBeNull();
  });

  it('never claims a null-key intake after deletion is tombstoned', async () => {
    const uploadFile = jest.fn().mockResolvedValue(undefined);
    const artifactService = new ConversationIntakeService(dataSource, {
      uploadFile,
    } as unknown as StorageService);
    const saved = await artifactService.save(baseInput);
    await dataSource.getRepository(ConversationIntake).update(saved.conversation.id, {
      rawArtifactStatus: 'deleting',
      rawArtifactKey: undefined,
    });

    await expect(
      artifactService.ensureRawArtifact(saved.conversation, baseInput.userId, {
        body: '{"tooLate":true}',
        contentType: 'application/json',
      })
    ).rejects.toThrow('cannot be replaced');
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('retains the tombstoned row until Blob cleanup succeeds', async () => {
    const deleteFile = jest
      .fn()
      .mockRejectedValueOnce(new Error('blob delete unavailable'))
      .mockResolvedValueOnce(undefined);
    const artifactService = new ConversationIntakeService(dataSource, {
      uploadFile: jest.fn().mockResolvedValue(undefined),
      deleteFile,
    } as unknown as StorageService);
    const saved = await artifactService.save(baseInput);
    await artifactService.ensureRawArtifact(saved.conversation, baseInput.userId, {
      body: '{"durableCleanup":true}',
      contentType: 'application/json',
    });

    await expect(
      artifactService.deleteForUser(baseInput.userId, saved.conversation.id)
    ).rejects.toThrow('blob delete unavailable');
    const retained = await dataSource
      .getRepository(ConversationIntake)
      .findOneByOrFail({ id: saved.conversation.id });
    expect(retained.rawArtifactStatus).toBe('deleting');

    expect(await artifactService.deleteForUser(baseInput.userId, saved.conversation.id)).toBe(true);
    expect(deleteFile).toHaveBeenCalledTimes(2);
  });

  it('retries the tombstone CAS when another replica wins a claim first', async () => {
    const deleteFile = jest.fn().mockResolvedValue(undefined);
    const artifactService = new ConversationIntakeService(dataSource, {
      deleteFile,
    } as unknown as StorageService);
    const saved = await artifactService.save(baseInput);
    const repository = dataSource.getRepository(ConversationIntake);
    const update = repository.update.bind(repository);
    const supersededKey = `raw-intakes/raced/${saved.conversation.id}/old/artifact.json`;
    const racedKey = `raw-intakes/raced/${saved.conversation.id}/claim/artifact.json`;
    await update(saved.conversation.id, {
      rawArtifactKey: supersededKey,
      rawArtifactSha256: createHash('sha256').update('raced').digest('hex'),
      rawArtifactSize: 5,
      rawArtifactStatus: 'pending',
      rawArtifactClaimId: '00000000-0000-4000-8000-000000000098',
      rawArtifactClaimedAt: new Date(
        Date.now() - AZURE_UPLOAD_TOTAL_TIMEOUT_MS - RAW_ARTIFACT_DELETE_GRACE_MS
      ),
    });
    jest.spyOn(repository, 'update').mockImplementationOnce(async (criteria, partialEntity) => {
      await update(saved.conversation.id, {
        rawArtifactKey: racedKey,
        rawArtifactCleanupKeys: [supersededKey],
        rawArtifactSha256: createHash('sha256').update('raced').digest('hex'),
        rawArtifactSize: 5,
        rawArtifactStatus: 'pending',
        rawArtifactClaimId: '00000000-0000-4000-8000-000000000099',
        rawArtifactClaimedAt: new Date(
          Date.now() - AZURE_UPLOAD_TOTAL_TIMEOUT_MS - RAW_ARTIFACT_DELETE_GRACE_MS
        ),
      });
      return update(criteria, partialEntity);
    });

    expect(await artifactService.deleteForUser(baseInput.userId, saved.conversation.id)).toBe(true);
    expect(deleteFile).toHaveBeenCalledWith(supersededKey);
    expect(deleteFile).toHaveBeenCalledWith(racedKey);
    expect(deleteFile).toHaveBeenCalledTimes(2);
    expect(await repository.findOneBy({ id: saved.conversation.id })).toBeNull();
  });

  it('deduplicates stable content even when connector IDs change', async () => {
    const first = await service.save(baseInput);
    const second = await service.save({
      ...baseInput,
      sourceConversationId: 'another-generated-chat-id',
      sourceExtractedAt: new Date('2026-07-25T09:00:00.000Z'),
      messages: baseInput.messages.map((message, index) => ({
        ...message,
        sourceMessageId: `another-generated-message-${index}`,
      })),
    });

    expect(second.duplicate).toBe(true);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(await dataSource.getRepository(ConversationIntake).count()).toBe(1);
    expect(await dataSource.getRepository(ConversationMessage).count()).toBe(2);
  });

  it('does not report duplicate success when an existing-intake transaction fails', async () => {
    await service.save(stableInput());
    jest
      .spyOn(dataSource, 'transaction')
      .mockRejectedValueOnce(new Error('participant evidence update failed'));

    await expect(service.save(stableInput())).rejects.toThrow('participant evidence update failed');
  });

  it('allows the same conversation for a different user', async () => {
    await service.save(baseInput);
    await service.save({ ...baseInput, userId: 'mystira-user-2' });

    expect(await dataSource.getRepository(ConversationIntake).count()).toBe(2);
  });

  it('deletes only the owning user conversation and cascades its messages', async () => {
    const owned = await service.save(baseInput);
    const otherUser = await service.save({ ...baseInput, userId: 'mystira-user-2' });

    expect(await service.deleteForUser('mystira-user-2', owned.conversation.id)).toBe(false);
    expect(await service.getForUser(baseInput.userId, owned.conversation.id)).not.toBeNull();

    expect(await service.deleteForUser(baseInput.userId, owned.conversation.id)).toBe(true);
    expect(await service.getForUser(baseInput.userId, owned.conversation.id)).toBeNull();
    expect(await dataSource.getRepository(ConversationMessage).count()).toBe(2);
    expect(await service.getForUser('mystira-user-2', otherUser.conversation.id)).not.toBeNull();
  });

  it('blocks deletion while a Baton publication lease is active', async () => {
    const saved = await service.save(baseInput);
    await dataSource.getRepository(ConversationIntake).update(saved.conversation.id, {
      batonPublishClaimId: 'active-publish-claim',
      batonPublishClaimedAt: new Date(),
    });

    await expect(service.deleteForUser(baseInput.userId, saved.conversation.id)).rejects.toThrow(
      'Baton publication is in progress'
    );
    expect(await service.getForUser(baseInput.userId, saved.conversation.id)).not.toBeNull();
  });

  it('reclaims a stale Baton publication lease before deletion', async () => {
    const saved = await service.save(baseInput);
    await dataSource.getRepository(ConversationIntake).update(saved.conversation.id, {
      batonPublishClaimId: 'stale-publish-claim',
      batonPublishClaimedAt: new Date(Date.now() - BATON_PUBLISH_LEASE_MS - 1_000),
    });

    expect(await service.deleteForUser(baseInput.userId, saved.conversation.id)).toBe(true);
    expect(await service.getForUser(baseInput.userId, saved.conversation.id)).toBeNull();
  });

  it('preserves an ambiguous Baton create boundary until its reconciliation window expires', async () => {
    const saved = await service.save(baseInput);
    const candidate = await dataSource.getRepository(TicketCandidate).save({
      intakeId: saved.conversation.id,
      userId: baseInput.userId,
      fingerprint: 'ambiguous-delete-fingerprint',
      title: 'Preserve ambiguous publish',
      confidence: 'high',
      evidence: [],
      status: 'accepted',
      revision: 1,
      publishStatus: 'failed',
      idempotencyKey: 'ambiguous-delete-marker',
      lastPublishErrorCode: 'baton_ambiguous',
    });
    const boundary = await dataSource.getRepository(BatonPublishAttempt).save({
      candidateId: candidate.id,
      userId: baseInput.userId,
      attemptNumber: 1,
      status: 'failed',
      errorCode: 'baton_ambiguous',
      completedAt: new Date(),
    });

    await expect(service.deleteForUser(baseInput.userId, saved.conversation.id)).rejects.toThrow(
      'reconciliation safety window'
    );
    expect(await service.getForUser(baseInput.userId, saved.conversation.id)).not.toBeNull();
    expect(
      await dataSource.getRepository(TicketCandidate).findOneBy({ id: candidate.id })
    ).not.toBeNull();
    expect(
      await dataSource.getRepository(BatonPublishAttempt).findOneBy({ id: boundary.id })
    ).not.toBeNull();

    await dataSource.getRepository(BatonPublishAttempt).update(boundary.id, {
      completedAt: new Date(Date.now() - BATON_AMBIGUOUS_HOLD_MS - 1_000),
    });
    expect(await service.deleteForUser(baseInput.userId, saved.conversation.id)).toBe(true);
    expect(
      await dataSource.getRepository(TicketCandidate).findOneBy({ id: candidate.id })
    ).toBeNull();
    expect(
      await dataSource.getRepository(BatonPublishAttempt).findOneBy({ id: boundary.id })
    ).toBeNull();
  });

  it('re-anchors a stale create-started boundary before deletion can discard it', async () => {
    const saved = await service.save(baseInput);
    const candidate = await dataSource.getRepository(TicketCandidate).save({
      intakeId: saved.conversation.id,
      userId: baseInput.userId,
      fingerprint: 'create-started-delete-fingerprint',
      title: 'Preserve create-started publish',
      confidence: 'high',
      evidence: [],
      status: 'accepted',
      revision: 1,
      publishStatus: 'pending',
      idempotencyKey: 'create-started-delete-marker',
    });
    const staleAt = new Date(Date.now() - BATON_PUBLISH_LEASE_MS - 1_000);
    const boundary = await dataSource.getRepository(BatonPublishAttempt).save({
      candidateId: candidate.id,
      userId: baseInput.userId,
      attemptNumber: 1,
      status: 'pending',
      errorCode: 'baton_create_started',
    });
    await dataSource.getRepository(BatonPublishAttempt).update(boundary.id, { createdAt: staleAt });
    await dataSource.getRepository(ConversationIntake).update(saved.conversation.id, {
      batonPublishClaimId: 'crashed-publisher',
      batonPublishClaimedAt: staleAt,
    });

    await expect(service.deleteForUser(baseInput.userId, saved.conversation.id)).rejects.toThrow(
      'reconciliation safety window'
    );
    const reanchored = await dataSource
      .getRepository(BatonPublishAttempt)
      .findOneByOrFail({ id: boundary.id });
    expect(reanchored.errorCode).toBe('baton_ambiguous');
    expect(reanchored.completedAt!.getTime()).toBeGreaterThan(staleAt.getTime());
    expect(await service.getForUser(baseInput.userId, saved.conversation.id)).not.toBeNull();
  });

  it('re-anchors expired ambiguity stranded behind a stale recovery lease', async () => {
    const saved = await service.save(baseInput);
    const candidate = await dataSource.getRepository(TicketCandidate).save({
      intakeId: saved.conversation.id,
      userId: baseInput.userId,
      fingerprint: 'stranded-ambiguity-delete-fingerprint',
      title: 'Preserve stranded ambiguity',
      confidence: 'high',
      evidence: [],
      status: 'accepted',
      revision: 1,
      publishStatus: 'failed',
      idempotencyKey: 'stranded-ambiguity-delete-marker',
      lastPublishErrorCode: 'baton_ambiguous',
    });
    const staleAt = new Date(Date.now() - BATON_PUBLISH_LEASE_MS - 1_000);
    const boundary = await dataSource.getRepository(BatonPublishAttempt).save({
      candidateId: candidate.id,
      userId: baseInput.userId,
      attemptNumber: 1,
      status: 'failed',
      errorCode: 'baton_ambiguous',
      completedAt: staleAt,
    });
    await dataSource.getRepository(ConversationIntake).update(saved.conversation.id, {
      batonPublishClaimId: 'crashed-recovery-publisher',
      batonPublishClaimedAt: staleAt,
    });

    await expect(service.deleteForUser(baseInput.userId, saved.conversation.id)).rejects.toThrow(
      'reconciliation safety window'
    );
    const reanchored = await dataSource
      .getRepository(BatonPublishAttempt)
      .findOneByOrFail({ id: boundary.id });
    expect(reanchored.errorCode).toBe('baton_ambiguous');
    expect(reanchored.completedAt!.getTime()).toBeGreaterThan(staleAt.getTime());
    expect(await service.getForUser(baseInput.userId, saved.conversation.id)).not.toBeNull();
  });

  it('allows deletion after an ambiguous Baton publication was reconciled successfully', async () => {
    const saved = await service.save(baseInput);
    const candidate = await dataSource.getRepository(TicketCandidate).save({
      intakeId: saved.conversation.id,
      userId: baseInput.userId,
      fingerprint: 'reconciled-delete-fingerprint',
      title: 'Delete reconciled publish',
      confidence: 'high',
      evidence: [],
      status: 'published',
      revision: 1,
      publishStatus: 'succeeded',
      idempotencyKey: 'reconciled-delete-marker',
      batonTaskId: '77777777-7777-4777-8777-777777777777',
    });
    await dataSource.getRepository(BatonPublishAttempt).save({
      candidateId: candidate.id,
      userId: baseInput.userId,
      attemptNumber: 1,
      status: 'failed',
      errorCode: 'baton_ambiguous',
      completedAt: new Date(),
    });

    expect(await service.deleteForUser(baseInput.userId, saved.conversation.id)).toBe(true);
    expect(
      await dataSource.getRepository(TicketCandidate).findOneBy({ id: candidate.id })
    ).toBeNull();
  });

  it('does not clear a Baton lease renewed during stale deletion cleanup', async () => {
    const saved = await service.save(baseInput);
    const repository = dataSource.getRepository(ConversationIntake);
    const staleAt = new Date(Date.now() - BATON_PUBLISH_LEASE_MS - 1_000);
    await repository.update(saved.conversation.id, {
      batonPublishClaimId: 'renewed-publish-claim',
      batonPublishClaimedAt: staleAt,
    });
    const originalTransaction = Object.getPrototypeOf(dataSource).transaction.bind(
      dataSource
    ) as typeof dataSource.transaction;
    let renewed = false;
    const transactionSpy = jest
      .spyOn(dataSource, 'transaction')
      .mockImplementation(async (operation: Parameters<typeof originalTransaction>[0]) => {
        if (!renewed) {
          renewed = true;
          await repository.update(saved.conversation.id, { batonPublishClaimedAt: new Date() });
        }
        return originalTransaction(operation);
      });

    try {
      await expect(service.deleteForUser(baseInput.userId, saved.conversation.id)).rejects.toThrow(
        'Baton publication is in progress'
      );
    } finally {
      transactionSpy.mockRestore();
    }

    const stored = await repository.findOneByOrFail({ id: saved.conversation.id });
    expect(renewed).toBe(true);
    expect(stored.rawArtifactStatus).not.toBe('deleting');
    expect(stored.batonPublishClaimId).toBe('renewed-publish-claim');
    expect(stored.batonPublishClaimedAt!.getTime()).toBeGreaterThan(staleAt.getTime());
  });

  it('excludes generated source IDs from the durable content hash', () => {
    const firstHash = createConversationContentHash(baseInput);
    const secondHash = createConversationContentHash({
      ...baseInput,
      messages: baseInput.messages.map((message) => ({
        ...message,
        sourceMessageId: `changed-${message.sourceMessageId || 'none'}`,
      })),
    });

    expect(secondHash).toBe(firstHash);
  });

  it('orders synchronized compatibility metadata for the service lookup predicate', () => {
    const compatibilityIndex = dataSource
      .getMetadata(ConversationIntake)
      .indices.find((index) => index.givenName === 'IDX_conversation_intakes_compatibility_scope');

    expect(compatibilityIndex?.columns.map((column) => column.propertyName)).toEqual([
      'userId',
      'sourcePlatform',
      'compatibilityHash',
      'sourceConversationId',
    ]);
  });

  it('deduplicates a scoped phone-only intake after its display name is enriched', async () => {
    const first = await service.save(stableInput());
    const enriched = stableInput('whatsapp:120363123456789@g.us', 'Greg Wright', '+27821234567');
    const second = await service.save(enriched);

    expect(second.duplicate).toBe(true);
    expect(second.reconciliationRequired).toBe(false);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(second.conversation.participantEvidence?.[0]).toEqual(
      expect.objectContaining({
        preferredDisplayName: 'Greg Wright',
        normalizedPhone: '+27821234567',
        rawLabels: expect.arrayContaining(['+27821234567', 'Greg Wright']),
      })
    );
  });

  it('matches an enriched platform id when the stable phone still overlaps', async () => {
    const first = await service.save(stableInput());
    const enriched = stableInput('whatsapp:120363123456789@g.us', 'Greg Wright', '+27821234567');
    enriched.participantEvidence![0].platformUserId = '27821234567@s.whatsapp.net';
    const second = await service.save(enriched);

    expect(second.duplicate).toBe(true);
    expect(second.reconciliationRequired).toBe(false);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(second.conversation.participantEvidence?.[0].platformUserId).toBe(
      '27821234567@s.whatsapp.net'
    );
  });

  it('canonicalizes equivalent WhatsApp participant JID domains', async () => {
    const legacy = stableInput();
    delete legacy.participantEvidence![0].normalizedPhone;
    legacy.participantEvidence![0].platformUserId = '27821234567@c.us';
    const first = await service.save(legacy);
    const current = stableInput();
    delete current.participantEvidence![0].normalizedPhone;
    current.participantEvidence![0].platformUserId = '27821234567@s.whatsapp.net';

    const second = await service.save(current);

    expect(second.duplicate).toBe(true);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(await dataSource.getRepository(ConversationIntake).count()).toBe(1);
  });

  it('canonicalizes equivalent WhatsApp direct-chat JID domains', async () => {
    const legacyInput = stableInput('whatsapp:27821234567@c.us');
    const first = await service.save(legacyInput);
    await dataSource.getRepository(ConversationIntake).update(first.conversation.id, {
      sourceConversationId: 'whatsapp:27821234567@c.us',
      contentHash: createConversationContentHashV2(legacyInput),
    });
    const second = await service.save(stableInput('whatsapp:27821234567@s.whatsapp.net'));

    expect(second.duplicate).toBe(true);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(second.conversation.sourceConversationId).toBe('whatsapp:27821234567@s.whatsapp.net');
    expect(await dataSource.getRepository(ConversationIntake).count()).toBe(1);
  });

  it('serializes concurrent compatibility matches whose v2 hashes differ', async () => {
    const phoneOnly = stableInput();
    const enriched = stableInput('whatsapp:120363123456789@g.us', 'Greg Wright', '+27821234567');
    enriched.participantEvidence![0].platformUserId = '27821234567@s.whatsapp.net';

    expect(createConversationContentHashV2(enriched)).not.toBe(
      createConversationContentHashV2(phoneOnly)
    );
    const captures = await Promise.all([service.save(phoneOnly), service.save(enriched)]);

    expect(new Set(captures.map((capture) => capture.conversation.id)).size).toBe(1);
    expect(captures.filter((capture) => capture.duplicate)).toHaveLength(1);
    expect(await dataSource.getRepository(ConversationIntake).count()).toBe(1);
  });

  it('serializes concurrent duplicate evidence enrichment without losing either update', async () => {
    const original = await service.save(stableInput());
    await dataSource
      .getRepository(ConversationIntake)
      .createQueryBuilder()
      .update()
      .set({ compatibilityHash: () => 'NULL' })
      .where('id = :id', { id: original.conversation.id })
      .execute();
    const named = stableInput('whatsapp:120363123456789@g.us', 'Greg Wright', '+27821234567');
    const identified = stableInput();
    identified.participantEvidence![0].platformUserId = '27821234567@s.whatsapp.net';

    await Promise.all([service.save(named), service.save(identified)]);

    const persisted = await service.getForUser(baseInput.userId, original.conversation.id);
    expect(await dataSource.getRepository(ConversationIntake).count()).toBe(1);
    expect(persisted?.participantEvidence?.[0]).toEqual(
      expect.objectContaining({
        preferredDisplayName: 'Greg Wright',
        normalizedPhone: '+27821234567',
        platformUserId: '27821234567@s.whatsapp.net',
      })
    );
  });

  it('enriches a name-only participant by ref without duplicating the evidence row', async () => {
    const nameOnly = stableInput('whatsapp:120363123456789@g.us', 'Greg Wright');
    delete nameOnly.participantEvidence![0].normalizedPhone;
    const first = await service.save(nameOnly);
    const enriched = stableInput('whatsapp:120363123456789@g.us', 'Greg Wright', '+27821234567');
    const second = await service.save(enriched);

    expect(second.duplicate).toBe(true);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(second.conversation.participantEvidence).toHaveLength(1);
    expect(second.conversation.participantEvidence?.[0].normalizedPhone).toBe('+27821234567');
  });

  it('preserves every initially referenced participant evidence row', async () => {
    const input = stableInput();
    input.participantEvidence!.push({
      ...input.participantEvidence![0],
      ref: 'participant_2',
      rawDisplayName: 'Greg Wright',
      platformUserId: '27821234567@s.whatsapp.net',
    });
    input.messages[1] = {
      ...input.messages[1],
      senderRef: 'participant_2',
      senderName: 'Greg Wright · +27821234567',
    };

    const saved = await service.save(input);

    expect(saved.conversation.participantEvidence?.map((participant) => participant.ref)).toEqual([
      'participant_1',
      'participant_2',
    ]);
    expect(saved.conversation.messages.map((message) => message.senderRef)).toEqual([
      'participant_1',
      'participant_2',
    ]);
  });

  it('requires reconciliation when a historical unscoped intake matches semantically', async () => {
    const historical = await service.save(baseInput);
    const captured = await service.save(stableInput());

    expect(captured.duplicate).toBe(false);
    expect(captured.reconciliationRequired).toBe(true);
    expect(captured.conversation.reconciliationCandidateIds).toEqual([historical.conversation.id]);
  });

  it('requires reconciliation when an unscoped recapture matches a stable intake', async () => {
    const stable = await service.save(stableInput());
    const unscoped = stableInput();
    delete unscoped.sourceConversationId;
    unscoped.sourceConversationIdentityStable = false;
    const captured = await service.save(unscoped);

    expect(captured.duplicate).toBe(false);
    expect(captured.reconciliationRequired).toBe(true);
    expect(captured.conversation.reconciliationCandidateIds).toEqual([stable.conversation.id]);
  });

  it('preserves reconciliation state when the separated capture repeats exactly', async () => {
    await service.save(baseInput);
    const captured = await service.save(stableInput());
    const repeated = await service.save(stableInput());

    expect(repeated.duplicate).toBe(true);
    expect(repeated.conversation.id).toBe(captured.conversation.id);
    expect(repeated.reconciliationRequired).toBe(true);
  });

  it('reuses a scoped v1 intake when the same source identity upgrades to v2', async () => {
    const legacy = stableInput();
    legacy.sourceConversationIdentityStable = false;
    const first = await service.save(legacy);

    const upgraded = await service.save(stableInput());

    expect(first.conversation.contentHashVersion).toBe(1);
    expect(upgraded.duplicate).toBe(true);
    expect(upgraded.conversation.id).toBe(first.conversation.id);
    expect(upgraded.conversation.sourceConversationIdentityStable).toBe(true);

    const enriched = stableInput('whatsapp:120363123456789@g.us', 'Greg Wright', '+27821234567');
    const enrichedCapture = await service.save(enriched);
    expect(enrichedCapture.duplicate).toBe(true);
    expect(enrichedCapture.conversation.id).toBe(first.conversation.id);
  });

  it('keeps identical ordered messages in distinct stable conversations separate', async () => {
    const first = await service.save(stableInput('whatsapp:120363111111111@g.us'));
    const second = await service.save(stableInput('whatsapp:120363222222222@g.us'));

    expect(first.conversation.id).not.toBe(second.conversation.id);
    expect(second.duplicate).toBe(false);
    expect(second.reconciliationRequired).toBe(false);
  });

  it('does not collapse conflicting stable participant evidence', async () => {
    await service.save(stableInput());
    const conflicting = await service.save(
      stableInput('whatsapp:120363123456789@g.us', 'Other participant', '+27829999999')
    );

    expect(conflicting.duplicate).toBe(false);
    expect(conflicting.reconciliationRequired).toBe(true);
  });

  it('does not auto-deduplicate when multiple compatibility candidates exist', async () => {
    await service.save(stableInput());
    await service.save(
      stableInput('whatsapp:120363123456789@g.us', 'Other participant', '+27829999999')
    );
    const third = await service.save(
      stableInput('whatsapp:120363123456789@g.us', 'Third participant', '+27828888888')
    );

    expect(third.duplicate).toBe(false);
    expect(third.reconciliationRequired).toBe(true);
    expect(third.conversation.reconciliationCandidateIds).toHaveLength(2);
  });

  it('does not auto-deduplicate while matching unscoped history exists', async () => {
    const stable = await service.save(stableInput());
    const historical = stableInput();
    delete historical.sourceConversationId;
    historical.sourceConversationIdentityStable = false;
    const unscoped = await service.save(historical);
    const enriched = stableInput();
    enriched.participantEvidence![0].platformUserId = '27821234567@c.us';

    const recapture = await service.save(enriched);

    expect(recapture.duplicate).toBe(false);
    expect(recapture.reconciliationRequired).toBe(true);
    expect(recapture.conversation.reconciliationCandidateIds).toEqual(
      expect.arrayContaining([stable.conversation.id, unscoped.conversation.id])
    );
  });

  it('bounds compatibility backfill and warns while older candidates remain', async () => {
    const intakeRepository = dataSource.getRepository(ConversationIntake);
    const messageRepository = dataSource.getRepository(ConversationMessage);
    const stable = await service.save(stableInput('whatsapp:bounded-backfill@g.us'));
    const historical = Array.from({ length: 101 }, (_, index) =>
      intakeRepository.create({
        userId: baseInput.userId,
        sourcePlatform: baseInput.sourcePlatform,
        sourceKind: baseInput.sourceKind,
        displayName: `Historical ${index}`,
        isGroup: false,
        participants: [],
        contentHash: index.toString(16).padStart(64, '0'),
        contentHashVersion: 1,
        reconciliationStatus: 'none',
        status: 'received',
      })
    );
    await intakeRepository.save(historical, { chunk: 100 });
    await messageRepository.save(
      historical.map((intake, index) =>
        messageRepository.create({
          intakeId: intake.id,
          position: 0,
          senderName: 'Historical sender',
          content: `Historical message ${index}`,
          sentAt: new Date(`2026-07-24T08:${String(index % 60).padStart(2, '0')}:00.000Z`),
          isOutgoing: false,
          isMedia: false,
        })
      ),
      { chunk: 100 }
    );

    const enriched = stableInput('whatsapp:bounded-backfill@g.us');
    enriched.participantEvidence![0].platformUserId = 'bounded-backfill@c.us';
    const captured = await service.save(enriched);

    expect(captured.duplicate).toBe(false);
    expect(captured.reconciliationRequired).toBe(true);
    expect(captured.conversation.id).not.toBe(stable.conversation.id);
    expect(captured.conversation.reconciliationCandidateIds).toContain(stable.conversation.id);
    expect(await intakeRepository.countBy({ compatibilityHash: IsNull() })).toBeGreaterThan(0);
  });

  it('creates deterministic v2 and compatibility hashes without mutable labels', () => {
    const phoneOnly = stableInput();
    const enriched = stableInput('whatsapp:120363123456789@g.us', 'Greg Wright', '+27821234567');
    expect(createConversationContentHashV2(enriched)).toBe(
      createConversationContentHashV2(phoneOnly)
    );
    expect(createConversationCompatibilityHash(enriched)).toBe(
      createConversationCompatibilityHash(phoneOnly)
    );
    expect(
      createConversationContentHashV2(
        stableInput('whatsapp:120363987654321@g.us', 'Greg Wright', '+27821234567')
      )
    ).not.toBe(createConversationContentHashV2(enriched));
  });

  it('normalizes legacy captionless media placeholders for compatibility', () => {
    const legacy = stableInput();
    legacy.messages[0] = {
      ...legacy.messages[0],
      content: '[image]',
      isMedia: true,
      mediaType: 'image',
    };
    const current = stableInput();
    current.messages[0] = {
      ...current.messages[0],
      content: '',
      isMedia: true,
      mediaType: 'image',
    };

    expect(createConversationCompatibilityHash(current)).toBe(
      createConversationCompatibilityHash(legacy)
    );
  });

  it('keeps current image and video evidence distinct when the media has a caption', () => {
    const legacy = stableInput();
    legacy.messages[0] = {
      ...legacy.messages[0],
      content: 'Project clip',
      isMedia: true,
      mediaType: 'image',
    };
    const corrected = stableInput();
    corrected.messages[0] = {
      ...corrected.messages[0],
      content: 'Project clip',
      isMedia: true,
      mediaType: 'video',
    };

    expect(createConversationCompatibilityHash(corrected)).not.toBe(
      createConversationCompatibilityHash(legacy)
    );
  });

  it('persists a corrected video type for compatibility-deduplicated captioned media', async () => {
    const legacy = stableInput();
    legacy.provenance = {
      connectorVersion: '1.0.12',
      captureInitiatedBy: 'user',
      consentBasis: 'user-selected-conversation',
    };
    legacy.messages[0] = {
      ...legacy.messages[0],
      content: 'Project clip',
      isMedia: true,
      mediaType: 'image',
    };
    const first = await service.save(legacy);
    const corrected = stableInput();
    corrected.provenance = {
      connectorVersion: '1.0.13',
      captureInitiatedBy: 'user',
      consentBasis: 'user-selected-conversation',
    };
    corrected.messages[0] = {
      ...corrected.messages[0],
      content: 'Project clip',
      isMedia: true,
      mediaType: 'video',
    };

    const second = await service.save(corrected);

    expect(second.duplicate).toBe(true);
    expect(second.conversation.id).toBe(first.conversation.id);
    expect(second.conversation.messages[0].mediaType).toBe('video');
    expect(second.conversation.messages[0].content).toBe('Project clip');

    const currentImage = stableInput();
    currentImage.provenance = {
      connectorVersion: '1.0.13',
      captureInitiatedBy: 'user',
      consentBasis: 'user-selected-conversation',
    };
    currentImage.messages[0] = { ...legacy.messages[0] };
    const third = await service.save(currentImage);

    expect(third.duplicate).toBe(false);
    expect(third.conversation.id).not.toBe(first.conversation.id);
    expect(await dataSource.getRepository(ConversationIntake).count()).toBe(2);
  });

  it('does not collapse a current image and current video with otherwise identical tuples', async () => {
    const image = stableInput();
    image.provenance = {
      connectorVersion: '1.0.13',
      captureInitiatedBy: 'user',
      consentBasis: 'user-selected-conversation',
    };
    image.messages[0] = {
      ...image.messages[0],
      content: 'Project asset',
      isMedia: true,
      mediaType: 'image',
    };
    const first = await service.save(image);
    const video = stableInput();
    video.provenance = image.provenance;
    video.messages[0] = { ...image.messages[0], mediaType: 'video' };

    const second = await service.save(video);

    expect(second.duplicate).toBe(false);
    expect(second.reconciliationRequired).toBe(true);
    expect(second.conversation.id).not.toBe(first.conversation.id);
    expect(await dataSource.getRepository(ConversationIntake).count()).toBe(2);
  });
});

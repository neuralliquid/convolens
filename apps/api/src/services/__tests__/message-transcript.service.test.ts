import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';

import { ConversationIntake } from '../../db/entities/ConversationIntake';
import { ConversationMessage } from '../../db/entities/ConversationMessage';
import { MessageTranscript } from '../../db/entities/MessageTranscript';
import {
  MESSAGE_TRANSCRIPTION_CLAIM_LEASE_MS,
  MessageTranscriptError,
  MessageTranscriptService,
} from '../message-transcript.service';

describe('MessageTranscriptService', () => {
  let dataSource: DataSource;
  let service: MessageTranscriptService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [ConversationIntake, ConversationMessage, MessageTranscript],
    });
    await dataSource.initialize();
    service = new MessageTranscriptService(dataSource);
  });

  beforeEach(async () => {
    await dataSource.getRepository(ConversationIntake).clear();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  async function seedMessage(mediaType: string | undefined = 'audio') {
    const intakeRepository = dataSource.getRepository(ConversationIntake);
    const messageRepository = dataSource.getRepository(ConversationMessage);
    const intake = await intakeRepository.save(
      intakeRepository.create({
        userId: 'user-1',
        sourcePlatform: 'whatsapp',
        sourceKind: 'upload',
        displayName: 'Voice notes',
        isGroup: false,
        contentHash: 'a'.repeat(64),
        contentHashVersion: 1,
        reconciliationStatus: 'none',
        status: 'received',
        rawArtifactStatus: 'not-recorded',
      })
    );
    const message = await messageRepository.save(
      messageRepository.create({
        intakeId: intake.id,
        position: 0,
        senderName: 'Hans',
        content: '<attached: voice-note.opus>',
        sentAt: new Date('2026-08-21T00:00:00.000Z'),
        isOutgoing: false,
        isMedia: Boolean(mediaType),
        mediaType,
      })
    );
    return { intake, message };
  }

  it('stores one consent-anchored transcript outside the message record', async () => {
    const { intake, message } = await seedMessage();
    const consentAt = new Date('2026-08-21T01:00:00.000Z');

    const transcript = await service.saveForUser({
      userId: 'user-1',
      intakeId: intake.id,
      messageId: message.id,
      text: '  This is the voice note.  ',
      providerTranscriptId: 'xtox-transcript-1',
      language: 'en',
      durationSeconds: 1.234,
      modelProcessingConsentAt: consentAt,
    });

    expect(transcript).toMatchObject({
      intakeId: intake.id,
      messageId: message.id,
      userId: 'user-1',
      text: 'This is the voice note.',
      provider: 'xtox',
      providerTranscriptId: 'xtox-transcript-1',
      language: 'en',
      durationMs: 1234,
      modelProcessingConsentAt: consentAt,
    });
    expect(
      (await dataSource.getRepository(ConversationMessage).findOneByOrFail({ id: message.id }))
        .content
    ).toBe('<attached: voice-note.opus>');
  });

  it('atomically replaces concurrent transcripts without creating duplicate rows', async () => {
    const { intake, message } = await seedMessage();
    const common = {
      userId: 'user-1',
      intakeId: intake.id,
      messageId: message.id,
      modelProcessingConsentAt: new Date(),
    };

    await Promise.all([
      service.saveForUser({ ...common, text: 'First result' }),
      service.saveForUser({ ...common, text: 'Second result' }),
    ]);

    const repository = dataSource.getRepository(MessageTranscript);
    expect(await repository.countBy({ messageId: message.id })).toBe(1);
    expect((await repository.findOneByOrFail({ messageId: message.id })).text).toMatch(
      /^(First|Second) result$/
    );
  });

  it('clears nullable provider metadata when a replacement omits it', async () => {
    const { intake, message } = await seedMessage();
    const common = {
      userId: 'user-1',
      intakeId: intake.id,
      messageId: message.id,
      modelProcessingConsentAt: new Date(),
    };
    await service.saveForUser({
      ...common,
      text: 'First result',
      providerTranscriptId: 'provider-1',
      language: 'en',
      durationSeconds: 2,
    });

    const replacement = await service.saveForUser({ ...common, text: 'Replacement' });

    expect(replacement).toMatchObject({
      text: 'Replacement',
      providerTranscriptId: null,
      language: null,
      durationMs: null,
    });
  });

  it('rejects empty and oversized transcript results', async () => {
    const { intake, message } = await seedMessage();
    const common = {
      userId: 'user-1',
      intakeId: intake.id,
      messageId: message.id,
      modelProcessingConsentAt: new Date(),
    };

    await expect(service.saveForUser({ ...common, text: '   ' })).rejects.toMatchObject({
      code: 'TRANSCRIPT_EMPTY',
    });
    await expect(
      service.saveForUser({ ...common, text: 'x'.repeat(1_000_001) })
    ).rejects.toMatchObject({ code: 'TRANSCRIPT_TOO_LARGE' });
  });

  it('serializes provider work with a crash-expiring per-message claim', async () => {
    const { intake, message } = await seedMessage();
    const firstClaim = await service.acquireClaimForUser('user-1', intake.id, message.id);

    await expect(
      service.acquireClaimForUser('user-1', intake.id, message.id)
    ).rejects.toMatchObject({ code: 'TRANSCRIPTION_IN_PROGRESS' });

    await dataSource.getRepository(ConversationMessage).update(message.id, {
      transcriptionClaimedAt: new Date(Date.now() - MESSAGE_TRANSCRIPTION_CLAIM_LEASE_MS - 1),
    });
    const replacementClaim = await service.acquireClaimForUser('user-1', intake.id, message.id);
    expect(replacementClaim).not.toBe(firstClaim);
    await service.releaseClaim(message.id, replacementClaim);
  });

  it('rejects cross-owner and non-audio writes', async () => {
    const audio = await seedMessage();
    await expect(
      service.saveForUser({
        userId: 'user-2',
        intakeId: audio.intake.id,
        messageId: audio.message.id,
        text: 'Not allowed',
        modelProcessingConsentAt: new Date(),
      })
    ).rejects.toMatchObject<MessageTranscriptError>({ code: 'CONVERSATION_NOT_FOUND' });

    await dataSource.getRepository(ConversationIntake).delete({ id: audio.intake.id });
    const text = await seedMessage('document');
    await expect(
      service.saveForUser({
        userId: 'user-1',
        intakeId: text.intake.id,
        messageId: text.message.id,
        text: 'Not audio',
        modelProcessingConsentAt: new Date(),
      })
    ).rejects.toMatchObject<MessageTranscriptError>({ code: 'MESSAGE_NOT_AUDIO' });
  });

  it('deletes the transcript when its conversation is deleted', async () => {
    const { intake, message } = await seedMessage();
    await service.saveForUser({
      userId: 'user-1',
      intakeId: intake.id,
      messageId: message.id,
      text: 'Ephemeral enrichment',
      modelProcessingConsentAt: new Date(),
    });

    await dataSource.getRepository(ConversationIntake).delete({ id: intake.id });

    expect(await dataSource.getRepository(MessageTranscript).count()).toBe(0);
  });
});

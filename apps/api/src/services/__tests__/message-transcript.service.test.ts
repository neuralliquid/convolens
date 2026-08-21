import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';
import { ConversationIntake } from '../../db/entities/ConversationIntake';
import { ConversationMessage } from '../../db/entities/ConversationMessage';
import { MessageTranscript } from '../../db/entities/MessageTranscript';
import { MessageTranscriptError, MessageTranscriptService } from '../message-transcript.service';

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

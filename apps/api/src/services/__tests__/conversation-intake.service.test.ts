import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';
import { ConversationIntake } from '../../db/entities/ConversationIntake';
import { ConversationMessage } from '../../db/entities/ConversationMessage';
import {
  ConversationIntakeService,
  createConversationCompatibilityHash,
  createConversationContentHash,
  createConversationContentHashV2,
  type ConversationIntakeInput,
} from '../conversation-intake.service';

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
      entities: [ConversationIntake, ConversationMessage],
    });
    await dataSource.initialize();
    service = new ConversationIntakeService(dataSource);
  });

  beforeEach(async () => {
    await dataSource.getRepository(ConversationMessage).clear();
    await dataSource.getRepository(ConversationIntake).clear();
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

  it('normalizes corrected image and video detection for captionless legacy media', () => {
    const legacy = stableInput();
    legacy.messages[0] = {
      ...legacy.messages[0],
      content: '[image]',
      isMedia: true,
      mediaType: 'image',
    };
    const corrected = stableInput();
    corrected.messages[0] = {
      ...corrected.messages[0],
      content: '',
      isMedia: true,
      mediaType: 'video',
    };

    expect(createConversationCompatibilityHash(corrected)).toBe(
      createConversationCompatibilityHash(legacy)
    );
  });
});

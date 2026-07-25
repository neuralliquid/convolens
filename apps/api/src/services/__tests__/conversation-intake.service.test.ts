import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';
import { ConversationIntake } from '../../db/entities/ConversationIntake';
import { ConversationMessage } from '../../db/entities/ConversationMessage';
import {
  ConversationIntakeService,
  createConversationContentHash,
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
});

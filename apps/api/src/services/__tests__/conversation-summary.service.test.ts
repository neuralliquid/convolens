import { DataSource } from 'typeorm';
import { ConversationIntake } from '../../db/entities/ConversationIntake';
import { ConversationMessage } from '../../db/entities/ConversationMessage';
import { MessageTranscript } from '../../db/entities/MessageTranscript';
import { ConversationSummary } from '../../db/entities/ConversationSummary';
import {
  ConversationSummaryService,
  ConversationSummaryError,
} from '../conversation-summary.service';
import type {
  CatchUpGenerationResult,
  CatchUpGenerator,
  CatchUpSourceMessage,
} from '../ai/catch-up-generator.service';

class FakeGenerator implements CatchUpGenerator {
  calls = 0;

  getProviderInfo() {
    return { provider: 'openai', configured: true, model: 'test-model' };
  }

  async generate(messages: CatchUpSourceMessage[]): Promise<CatchUpGenerationResult> {
    this.calls += 1;
    return {
      provider: 'openai',
      model: 'test-model',
      content: {
        version: 1,
        overview: 'The group agreed on the launch plan.',
        overviewEvidence: [messages[0].position, messages[1].position],
        keyTopics: [{ text: 'Launch planning', evidence: [messages[0].position] }],
        decisions: [{ text: 'Launch on Friday', evidence: [messages[1].position] }],
        actionItems: [],
        openQuestions: [],
        importantLinks: [],
      },
    };
  }
}

describe('ConversationSummaryService', () => {
  let dataSource: DataSource;
  let intakeId: string;
  let firstMessageId: string;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      entities: [ConversationIntake, ConversationMessage, MessageTranscript, ConversationSummary],
    });
    await dataSource.initialize();
    const intake = await dataSource.getRepository(ConversationIntake).save({
      userId: 'user-one',
      sourcePlatform: 'whatsapp',
      sourceKind: 'upload',
      displayName: 'Launch team',
      isGroup: true,
      participants: ['Ayesha', 'Thabo'],
      contentHash: 'a'.repeat(64),
      contentHashVersion: 1,
      reconciliationStatus: 'none',
      status: 'received',
      rawArtifactStatus: 'not-recorded',
    });
    intakeId = intake.id;
    const savedMessages = await dataSource.getRepository(ConversationMessage).save([
      {
        intakeId,
        position: 0,
        senderName: 'Ayesha',
        content: 'Can we launch Friday?',
        sentAt: new Date('2026-08-03T08:00:00.000Z'),
        isOutgoing: false,
        isMedia: false,
      },
      {
        intakeId,
        position: 1,
        senderName: 'Thabo',
        content: 'Yes, Friday is confirmed.',
        sentAt: new Date('2026-08-03T08:05:00.000Z'),
        isOutgoing: false,
        isMedia: false,
      },
    ]);
    firstMessageId = savedMessages[0].id;
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('persists, grounds, and caches a summary for its owner', async () => {
    const generator = new FakeGenerator();
    const service = new ConversationSummaryService(dataSource, generator);

    const first = await service.generateForUser('user-one', intakeId);
    const second = await service.generateForUser('user-one', intakeId);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(generator.calls).toBe(1);
    expect(first.summary.keyTopics[0].evidence[0].messageId).toBe(firstMessageId);
    expect(first.summary.scope).toMatchObject({ messageCount: 2 });
    expect(await service.getForUser('user-two', intakeId)).toBeNull();
  });

  it('does not reveal whether another user owns an intake', async () => {
    const service = new ConversationSummaryService(dataSource, new FakeGenerator());
    await expect(service.generateForUser('user-two', intakeId)).rejects.toEqual(
      new ConversationSummaryError('CONVERSATION_NOT_FOUND')
    );
  });
});

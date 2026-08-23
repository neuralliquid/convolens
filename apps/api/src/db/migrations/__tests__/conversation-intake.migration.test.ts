import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';

import { CONVERSATION_MIGRATIONS } from '../../../config/migrations';
import { CreateConversationIntake1753400000000 } from '../1753400000000-CreateConversationIntake';
import { AddConversationFidelity1753660000000 } from '../1753660000000-AddConversationFidelity';
import { AddIntakeArtifactsAndSelectorReports1754000000000 } from '../1754000000000-AddIntakeArtifactsAndSelectorReports';
import { AddRawArtifactCleanupKeys1754100000000 } from '../1754100000000-AddRawArtifactCleanupKeys';
import { AddTicketCandidatesAndBatonAttempts1754200000000 } from '../1754200000000-AddTicketCandidatesAndBatonAttempts';
import { AddConversationSummaries1754300000000 } from '../1754300000000-AddConversationSummaries';
import { AddMessageTranscripts1754400000000 } from '../1754400000000-AddMessageTranscripts';

describe('CreateConversationIntake migration', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: false,
      migrationsRun: false,
      entities: [],
      migrations: [
        CreateConversationIntake1753400000000,
        AddConversationFidelity1753660000000,
        AddIntakeArtifactsAndSelectorReports1754000000000,
        AddRawArtifactCleanupKeys1754100000000,
        AddTicketCandidatesAndBatonAttempts1754200000000,
        AddConversationSummaries1754300000000,
        AddMessageTranscripts1754400000000,
      ],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('creates durable intake and message tables with the idempotency index', async () => {
    expect(CONVERSATION_MIGRATIONS).toEqual([
      CreateConversationIntake1753400000000,
      AddConversationFidelity1753660000000,
      AddIntakeArtifactsAndSelectorReports1754000000000,
      AddRawArtifactCleanupKeys1754100000000,
      AddTicketCandidatesAndBatonAttempts1754200000000,
      AddConversationSummaries1754300000000,
      AddMessageTranscripts1754400000000,
    ]);
    const queryRunner = dataSource.createQueryRunner();
    const intakeTable = await queryRunner.getTable('conversation_intakes');
    const messageTable = await queryRunner.getTable('conversation_messages');
    const selectorReportTable = await queryRunner.getTable('extension_selector_reports');
    const candidateTable = await queryRunner.getTable('ticket_candidates');
    const publishAttemptTable = await queryRunner.getTable('baton_publish_attempts');
    const summaryTable = await queryRunner.getTable('conversation_summaries');
    const transcriptTable = await queryRunner.getTable('message_transcripts');
    await queryRunner.release();

    expect(intakeTable).toBeDefined();
    expect(messageTable).toBeDefined();
    expect(selectorReportTable).toBeDefined();
    expect(candidateTable).toBeDefined();
    expect(publishAttemptTable).toBeDefined();
    expect(summaryTable).toBeDefined();
    expect(transcriptTable).toBeDefined();
    expect(intakeTable?.findColumnByName('rawArtifactStatus')).toBeDefined();
    expect(intakeTable?.findColumnByName('rawArtifactCleanupKeys')).toBeDefined();
    expect(intakeTable?.findColumnByName('batonPublishClaimId')).toBeDefined();
    expect(intakeTable?.findColumnByName('batonPublishClaimedAt')).toBeDefined();
    expect(candidateTable?.findColumnByName('publishClaimId')).toBeDefined();
    expect(candidateTable?.findColumnByName('publishClaimedAt')).toBeDefined();
    expect(
      intakeTable?.indices.some(
        (index) => index.name === 'UQ_conversation_intakes_user_content_hash' && index.isUnique
      )
    ).toBe(true);
    expect(intakeTable?.findColumnByName('contentHashVersion')).toBeDefined();
    expect(intakeTable?.findColumnByName('participantEvidence')).toBeDefined();
    expect(
      intakeTable?.indices.find(
        (index) => index.name === 'IDX_conversation_intakes_compatibility_scope'
      )?.columnNames
    ).toEqual(['userId', 'sourcePlatform', 'compatibilityHash', 'sourceConversationId']);
    expect(messageTable?.findColumnByName('senderRef')).toBeDefined();
    expect(messageTable?.findColumnByName('transcriptionClaimId')).toBeDefined();
    expect(messageTable?.findColumnByName('transcriptionClaimedAt')).toBeDefined();
    expect(
      messageTable?.foreignKeys.some(
        (foreignKey) =>
          foreignKey.name === 'FK_conversation_messages_intake' && foreignKey.onDelete === 'CASCADE'
      )
    ).toBe(true);
    expect(
      summaryTable?.foreignKeys.some(
        (foreignKey) =>
          foreignKey.name === 'FK_conversation_summaries_intake' &&
          foreignKey.onDelete === 'CASCADE'
      )
    ).toBe(true);
    expect(
      summaryTable?.indices.some(
        (index) => index.name === 'UQ_conversation_summaries_intake' && index.isUnique
      )
    ).toBe(true);
    expect(
      transcriptTable?.foreignKeys.some(
        (foreignKey) =>
          foreignKey.name === 'FK_message_transcripts_message' && foreignKey.onDelete === 'CASCADE'
      )
    ).toBe(true);
    expect(
      transcriptTable?.indices.some(
        (index) => index.name === 'UQ_message_transcripts_message' && index.isUnique
      )
    ).toBe(true);
  });
});

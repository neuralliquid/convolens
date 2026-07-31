import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { DataSource } from 'typeorm';
import { CreateConversationIntake1753400000000 } from '../1753400000000-CreateConversationIntake';
import { AddConversationFidelity1753660000000 } from '../1753660000000-AddConversationFidelity';
import { AddIntakeArtifactsAndSelectorReports1754000000000 } from '../1754000000000-AddIntakeArtifactsAndSelectorReports';
import { CONVERSATION_MIGRATIONS } from '../../../config/migrations';

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
    ]);
    const queryRunner = dataSource.createQueryRunner();
    const intakeTable = await queryRunner.getTable('conversation_intakes');
    const messageTable = await queryRunner.getTable('conversation_messages');
    const selectorReportTable = await queryRunner.getTable('extension_selector_reports');
    await queryRunner.release();

    expect(intakeTable).toBeDefined();
    expect(messageTable).toBeDefined();
    expect(selectorReportTable).toBeDefined();
    expect(intakeTable?.findColumnByName('rawArtifactStatus')).toBeDefined();
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
    expect(
      messageTable?.foreignKeys.some(
        (foreignKey) =>
          foreignKey.name === 'FK_conversation_messages_intake' && foreignKey.onDelete === 'CASCADE'
      )
    ).toBe(true);
  });
});

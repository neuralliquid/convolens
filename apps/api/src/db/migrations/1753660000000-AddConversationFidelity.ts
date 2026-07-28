import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddConversationFidelity1753660000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('conversation_intakes', [
      new TableColumn({
        name: 'sourceConversationIdentityStable',
        type: 'boolean',
        default: false,
      }),
      new TableColumn({ name: 'participantEvidence', type: 'text', isNullable: true }),
      new TableColumn({ name: 'contentHashVersion', type: 'integer', default: 1 }),
      new TableColumn({
        name: 'compatibilityHash',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({
        name: 'reconciliationStatus',
        type: 'varchar',
        length: '50',
        default: "'none'",
      }),
      new TableColumn({ name: 'reconciliationCandidateIds', type: 'text', isNullable: true }),
    ]);
    await queryRunner.addColumn(
      'conversation_messages',
      new TableColumn({ name: 'senderRef', type: 'varchar', length: '100', isNullable: true })
    );
    await queryRunner.createIndex(
      'conversation_intakes',
      new TableIndex({
        name: 'IDX_conversation_intakes_compatibility_scope',
        columnNames: ['userId', 'sourcePlatform', 'compatibilityHash', 'sourceConversationId'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'conversation_intakes',
      'IDX_conversation_intakes_compatibility_scope'
    );
    await queryRunner.dropColumn('conversation_messages', 'senderRef');
    for (const name of [
      'reconciliationCandidateIds',
      'reconciliationStatus',
      'compatibilityHash',
      'contentHashVersion',
      'participantEvidence',
      'sourceConversationIdentityStable',
    ]) {
      await queryRunner.dropColumn('conversation_intakes', name);
    }
  }
}

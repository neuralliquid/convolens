import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class AddMessageTranscripts1754400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dateType =
      queryRunner.connection.options.type === 'postgres' ? 'timestamptz' : 'datetime';

    await queryRunner.addColumns('conversation_messages', [
      new TableColumn({
        name: 'transcriptionClaimId',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
      new TableColumn({
        name: 'transcriptionClaimedAt',
        type: dateType,
        isNullable: true,
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'message_transcripts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'messageId', type: 'uuid' },
          { name: 'intakeId', type: 'uuid' },
          { name: 'userId', type: 'varchar', length: '255' },
          { name: 'text', type: 'text' },
          { name: 'provider', type: 'varchar', length: '50', default: "'xtox'" },
          { name: 'providerTranscriptId', type: 'varchar', length: '255', isNullable: true },
          { name: 'language', type: 'varchar', length: '20', isNullable: true },
          { name: 'durationMs', type: 'integer', isNullable: true },
          { name: 'modelProcessingConsentAt', type: dateType },
          { name: 'generatedAt', type: dateType },
          { name: 'updatedAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );

    await queryRunner.createIndices('message_transcripts', [
      new TableIndex({
        name: 'UQ_message_transcripts_message',
        columnNames: ['messageId'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_message_transcripts_user_intake',
        columnNames: ['userId', 'intakeId'],
      }),
    ]);

    await queryRunner.createForeignKeys('message_transcripts', [
      new TableForeignKey({
        name: 'FK_message_transcripts_message',
        columnNames: ['messageId'],
        referencedTableName: 'conversation_messages',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_message_transcripts_intake',
        columnNames: ['intakeId'],
        referencedTableName: 'conversation_intakes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('message_transcripts', true);
    await queryRunner.dropColumns('conversation_messages', [
      'transcriptionClaimId',
      'transcriptionClaimedAt',
    ]);
  }
}

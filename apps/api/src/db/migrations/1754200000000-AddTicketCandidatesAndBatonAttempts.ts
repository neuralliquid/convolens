import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddTicketCandidatesAndBatonAttempts1754200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dateType =
      queryRunner.connection.options.type === 'postgres' ? 'timestamptz' : 'datetime';
    await queryRunner.createTable(
      new Table({
        name: 'ticket_candidates',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'intakeId', type: 'uuid' },
          { name: 'userId', type: 'varchar', length: '255' },
          { name: 'fingerprint', type: 'varchar', length: '64' },
          { name: 'title', type: 'varchar', length: '200' },
          { name: 'description', type: 'text', isNullable: true },
          { name: 'confidence', type: 'varchar', length: '20' },
          { name: 'evidence', type: 'text' },
          { name: 'projectId', type: 'varchar', length: '36', isNullable: true },
          { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
          { name: 'revision', type: 'integer', default: '1' },
          { name: 'publishStatus', type: 'varchar', length: '20', default: "'not_requested'" },
          { name: 'idempotencyKey', type: 'varchar', length: '100' },
          { name: 'batonTaskId', type: 'varchar', length: '36', isNullable: true },
          { name: 'batonTaskUrl', type: 'varchar', length: '500', isNullable: true },
          { name: 'lastPublishErrorCode', type: 'varchar', length: '100', isNullable: true },
          { name: 'decidedAt', type: dateType, isNullable: true },
          { name: 'publishedAt', type: dateType, isNullable: true },
          { name: 'createdAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );
    await queryRunner.createForeignKey(
      'ticket_candidates',
      new TableForeignKey({
        name: 'FK_ticket_candidates_intake',
        columnNames: ['intakeId'],
        referencedTableName: 'conversation_intakes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
    await queryRunner.createIndex(
      'ticket_candidates',
      new TableIndex({
        name: 'UQ_ticket_candidates_intake_fingerprint',
        columnNames: ['intakeId', 'fingerprint'],
        isUnique: true,
      })
    );
    await queryRunner.createIndex(
      'ticket_candidates',
      new TableIndex({
        name: 'IDX_ticket_candidates_user_intake',
        columnNames: ['userId', 'intakeId'],
      })
    );

    await queryRunner.createTable(
      new Table({
        name: 'baton_publish_attempts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'candidateId', type: 'uuid' },
          { name: 'userId', type: 'varchar', length: '255' },
          { name: 'attemptNumber', type: 'integer' },
          { name: 'status', type: 'varchar', length: '20' },
          { name: 'responseStatus', type: 'integer', isNullable: true },
          { name: 'batonTaskId', type: 'varchar', length: '36', isNullable: true },
          { name: 'errorCode', type: 'varchar', length: '100', isNullable: true },
          { name: 'completedAt', type: dateType, isNullable: true },
          { name: 'createdAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );
    await queryRunner.createForeignKey(
      'baton_publish_attempts',
      new TableForeignKey({
        name: 'FK_baton_publish_attempts_candidate',
        columnNames: ['candidateId'],
        referencedTableName: 'ticket_candidates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('baton_publish_attempts', true);
    await queryRunner.dropTable('ticket_candidates', true);
  }
}

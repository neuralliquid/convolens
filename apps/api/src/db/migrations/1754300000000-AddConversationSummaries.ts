import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddConversationSummaries1754300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dateType =
      queryRunner.connection.options.type === 'postgres' ? 'timestamptz' : 'datetime';

    await queryRunner.createTable(
      new Table({
        name: 'conversation_summaries',
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
          { name: 'content', type: 'text' },
          { name: 'provider', type: 'varchar', length: '50' },
          { name: 'model', type: 'varchar', length: '100', isNullable: true },
          { name: 'sourceMessageCount', type: 'integer' },
          { name: 'sourceContentHash', type: 'varchar', length: '64' },
          { name: 'periodStart', type: dateType },
          { name: 'periodEnd', type: dateType },
          { name: 'generatedAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
          { name: 'updatedAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );

    await queryRunner.createIndices('conversation_summaries', [
      new TableIndex({
        name: 'UQ_conversation_summaries_intake',
        columnNames: ['intakeId'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_conversation_summaries_user_generated',
        columnNames: ['userId', 'generatedAt'],
      }),
    ]);

    await queryRunner.createForeignKey(
      'conversation_summaries',
      new TableForeignKey({
        name: 'FK_conversation_summaries_intake',
        columnNames: ['intakeId'],
        referencedTableName: 'conversation_intakes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('conversation_summaries', true);
  }
}

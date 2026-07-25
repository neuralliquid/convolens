import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateConversationIntake1753400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dateType =
      queryRunner.connection.options.type === 'postgres' ? 'timestamptz' : 'datetime';

    await queryRunner.createTable(
      new Table({
        name: 'conversation_intakes',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'userId', type: 'varchar', length: '255' },
          { name: 'sourcePlatform', type: 'varchar', length: '50' },
          { name: 'sourceKind', type: 'varchar', length: '50' },
          {
            name: 'sourceConversationId',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          { name: 'displayName', type: 'varchar', length: '255' },
          { name: 'isGroup', type: 'boolean', default: false },
          { name: 'participants', type: 'text', isNullable: true },
          { name: 'contentHash', type: 'varchar', length: '64' },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'received'",
          },
          {
            name: 'errorCode',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          { name: 'sourceExtractedAt', type: dateType, isNullable: true },
          { name: 'provenance', type: 'text', isNullable: true },
          {
            name: 'receivedAt',
            type: dateType,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: dateType,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndices('conversation_intakes', [
      new TableIndex({
        name: 'IDX_conversation_intakes_user_received',
        columnNames: ['userId', 'receivedAt'],
      }),
      new TableIndex({
        name: 'UQ_conversation_intakes_user_content_hash',
        columnNames: ['userId', 'contentHash'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_conversation_intakes_status',
        columnNames: ['status'],
      }),
    ]);

    await queryRunner.createTable(
      new Table({
        name: 'conversation_messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'intakeId', type: 'uuid' },
          { name: 'position', type: 'integer' },
          {
            name: 'sourceMessageId',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          { name: 'senderName', type: 'varchar', length: '255' },
          { name: 'content', type: 'text' },
          { name: 'sentAt', type: dateType },
          { name: 'isOutgoing', type: 'boolean', default: false },
          { name: 'isMedia', type: 'boolean', default: false },
          {
            name: 'mediaType',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'replyToSourceMessageId',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
        ],
      }),
      true
    );

    await queryRunner.createIndices('conversation_messages', [
      new TableIndex({
        name: 'UQ_conversation_messages_intake_position',
        columnNames: ['intakeId', 'position'],
        isUnique: true,
      }),
      new TableIndex({
        name: 'IDX_conversation_messages_intake_sent',
        columnNames: ['intakeId', 'sentAt'],
      }),
    ]);

    await queryRunner.createForeignKey(
      'conversation_messages',
      new TableForeignKey({
        name: 'FK_conversation_messages_intake',
        columnNames: ['intakeId'],
        referencedTableName: 'conversation_intakes',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('conversation_messages', true);
    await queryRunner.dropTable('conversation_intakes', true);
  }
}

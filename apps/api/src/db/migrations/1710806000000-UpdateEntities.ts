import { MigrationInterface, QueryRunner, Table, TableForeignKey } from 'typeorm';

export class UpdateEntities1710806000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type for user roles if using PostgreSQL
    await queryRunner.query(`
      CREATE TYPE "user_role_enum" AS ENUM ('admin', 'user');
    `);

    // Create users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'email',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'password',
            type: 'varchar',
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['admin', 'user'],
            default: 'user',
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'lastLogin',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Create groups table
    await queryRunner.createTable(
      new Table({
        name: 'groups',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '100',
            isUnique: true,
            isNullable: true,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'color',
            type: 'varchar',
            length: '7',
            default: '#3b82f6',
          },
          {
            name: 'avatarUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'isArchived',
            type: 'boolean',
            default: false,
          },
          {
            name: 'ownerId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'simple-json',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'archivedAt',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create messages table
    await queryRunner.createTable(
      new Table({
        name: 'messages',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'content',
            type: 'text',
          },
          {
            name: 'senderName',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'senderId',
            type: 'uuid',
            isNullable: true,
          },
          {
            name: 'isMedia',
            type: 'boolean',
            default: false,
          },
          {
            name: 'mediaUrl',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'simple-json',
            isNullable: true,
          },
          {
            name: 'groupId',
            type: 'uuid',
          },
          {
            name: 'createdAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create group_members join table
    await queryRunner.createTable(
      new Table({
        name: 'group_members',
        columns: [
          {
            name: 'groupId',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'userId',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'joinedAt',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    // Add foreign keys
    await queryRunner.createForeignKeys('messages', [
      new TableForeignKey({
        columnNames: ['senderId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        columnNames: ['groupId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'groups',
        onDelete: 'CASCADE',
      }),
    ]);

    await queryRunner.createForeignKey(
      'groups',
      new TableForeignKey({
        columnNames: ['ownerId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKeys('group_members', [
      new TableForeignKey({
        columnNames: ['groupId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'groups',
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        columnNames: ['userId'],
        referencedColumnNames: ['id'],
        referencedTableName: 'users',
        onDelete: 'CASCADE',
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys first
    const messagesTable = await queryRunner.getTable('messages');
    const groupsTable = await queryRunner.getTable('groups');
    const groupMembersTable = await queryRunner.getTable('group_members');

    if (messagesTable) {
      const senderFk = messagesTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('senderId') !== -1,
      );
      const groupFk = messagesTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('groupId') !== -1,
      );
      
      if (senderFk) await queryRunner.dropForeignKey('messages', senderFk);
      if (groupFk) await queryRunner.dropForeignKey('messages', groupFk);
    }

    if (groupsTable) {
      const ownerFk = groupsTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('ownerId') !== -1,
      );
      if (ownerFk) await queryRunner.dropForeignKey('groups', ownerFk);
    }

    if (groupMembersTable) {
      const groupFk = groupMembersTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('groupId') !== -1,
      );
      const userFk = groupMembersTable.foreignKeys.find(
        (fk) => fk.columnNames.indexOf('userId') !== -1,
      );
      
      if (groupFk) await queryRunner.dropForeignKey('group_members', groupFk);
      if (userFk) await queryRunner.dropForeignKey('group_members', userFk);
    }

    // Drop tables
    await queryRunner.dropTable('group_members', true);
    await queryRunner.dropTable('messages', true);
    await queryRunner.dropTable('groups', true);
    await queryRunner.dropTable('users', true);

    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "user_role_enum";`);
  }
}

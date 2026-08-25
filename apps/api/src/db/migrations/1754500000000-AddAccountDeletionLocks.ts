import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class AddAccountDeletionLocks1754500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dateType =
      queryRunner.connection.options.type === 'postgres' ? 'timestamptz' : 'datetime';

    await queryRunner.createTable(
      new Table({
        name: 'account_deletion_locks',
        columns: [
          { name: 'userId', type: 'varchar', length: '255', isPrimary: true },
          { name: 'startedAt', type: dateType },
          { name: 'heartbeatAt', type: dateType },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('account_deletion_locks', true);
  }
}

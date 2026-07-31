import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class AddIntakeArtifactsAndSelectorReports1754000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('conversation_intakes', [
      new TableColumn({
        name: 'rawArtifactKey',
        type: 'varchar',
        length: '1000',
        isNullable: true,
      }),
      new TableColumn({
        name: 'rawArtifactSha256',
        type: 'varchar',
        length: '64',
        isNullable: true,
      }),
      new TableColumn({ name: 'rawArtifactSize', type: 'integer', isNullable: true }),
      new TableColumn({
        name: 'rawArtifactStatus',
        type: 'varchar',
        length: '50',
        default: "'pending'",
      }),
      new TableColumn({
        name: 'rawArtifactClaimId',
        type: 'varchar',
        length: '36',
        isNullable: true,
      }),
      new TableColumn({
        name: 'rawArtifactClaimedAt',
        type: queryRunner.connection.options.type === 'postgres' ? 'timestamptz' : 'datetime',
        isNullable: true,
      }),
    ]);
    // Existing normalized-only intakes must not be presented as if a Blob
    // write is still in progress. New rows retain the pending default.
    await queryRunner.query(
      `UPDATE "conversation_intakes" SET "rawArtifactStatus" = 'not-recorded' WHERE "rawArtifactKey" IS NULL`
    );

    const dateType =
      queryRunner.connection.options.type === 'postgres' ? 'timestamptz' : 'datetime';
    await queryRunner.createTable(
      new Table({
        name: 'extension_selector_reports',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'discovered', type: 'text' },
          { name: 'userAgent', type: 'varchar', length: '500', default: "''" },
          { name: 'extensionVersion', type: 'varchar', length: '50', isNullable: true },
          { name: 'observedAt', type: dateType },
          { name: 'createdAt', type: dateType, default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true
    );
    await queryRunner.createIndex(
      'extension_selector_reports',
      new TableIndex({
        name: 'IDX_extension_selector_reports_observed',
        columnNames: ['observedAt'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('extension_selector_reports', true);
    for (const column of [
      'rawArtifactStatus',
      'rawArtifactClaimedAt',
      'rawArtifactClaimId',
      'rawArtifactSize',
      'rawArtifactSha256',
      'rawArtifactKey',
    ]) {
      await queryRunner.dropColumn('conversation_intakes', column);
    }
  }
}

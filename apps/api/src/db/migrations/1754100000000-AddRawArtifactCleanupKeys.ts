import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRawArtifactCleanupKeys1754100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'conversation_intakes',
      new TableColumn({
        name: 'rawArtifactCleanupKeys',
        type: 'text',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('conversation_intakes', 'rawArtifactCleanupKeys');
  }
}

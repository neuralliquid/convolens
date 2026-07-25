import { DataSource } from 'typeorm';
import { AppDataSource } from '../../src/config/database';

export async function setupTestDatabase(): Promise<DataSource> {
  // Create a test database connection
  const testDataSource = new DataSource({
    ...AppDataSource.options,
    database: ':memory:', // Use in-memory SQLite for tests
    synchronize: true, // Auto-create schema
    dropSchema: true, // Drop schema each time connection is set up
    migrationsRun: false,
    logging: false, // Disable logging for tests
  });

  await testDataSource.initialize();

  return testDataSource;
}

export async function teardownTestDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

// Test database connection for use in tests
export function getTestDataSource(): DataSource {
  if (!AppDataSource.isInitialized) {
    throw new Error('Test database not initialized. Call setupTestDatabase first.');
  }
  return AppDataSource;
}

// Helper to reset the database between tests
export async function resetTestDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await setupTestDatabase();
    return;
  }

  // Get all entities
  const entities = AppDataSource.entityMetadatas;

  // Create a query runner
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    await queryRunner.startTransaction();

    // Disable foreign key checks
    await queryRunner.query('PRAGMA foreign_keys = OFF');

    // Truncate all tables
    for (const entity of entities) {
      await queryRunner.query(`DELETE FROM ${entity.tableName}`);
    }

    // Re-enable foreign key checks
    await queryRunner.query('PRAGMA foreign_keys = ON');

    await queryRunner.commitTransaction();
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
  }
}

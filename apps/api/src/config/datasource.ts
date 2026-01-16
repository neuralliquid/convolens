import { DataSource } from 'typeorm';
import { User } from '../db/entities/User';
import { Group } from '../db/entities/Group';
import { Message } from '../db/entities/Message';
import { logger } from '../utils/logger';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Database configuration
export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: process.env.DATABASE_PATH || 'database.sqlite',
  synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables in dev/test
  logging: process.env.NODE_ENV === 'development' ? 'all' : ['error', 'warn'],
  logger: isProduction ? 'file' : 'debug',
  entities: [User, Group, Message],
  migrations: ['dist/db/migrations/*.js'],
  migrationsRun: process.env.NODE_ENV === 'production',
  migrationsTableName: 'migrations',
  cache: {
    duration: 1000 * 30, // 30 seconds
  },
  // Enable WAL mode for better concurrency in SQLite
  extra: {
    connection: {
      pragma: 'journal_mode = WAL',
    },
  },
});

// Initialize the data source
export const initializeDataSource = async (): Promise<void> => {
  try {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
      logger.info('Data Source has been initialized!');
    }
  } catch (error) {
    logger.error('Error during Data Source initialization:', error);
    process.exit(1);
  }
};

// For TypeORM CLI
export default AppDataSource;

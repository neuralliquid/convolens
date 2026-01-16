import { DataSource } from 'typeorm';
import { Message } from '../db/entities/Message';
import { Group } from '../db/entities/Group';
import { User } from '../db/entities/User';
import { logger } from '../utils/logger';

export const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  synchronize: process.env.NODE_ENV !== 'production', // Auto-create tables in dev/test
  logging: process.env.NODE_ENV === 'development',
  entities: [Message, Group, User],
  migrations: ['dist/db/migrations/*.js'],
  migrationsRun: process.env.NODE_ENV === 'production',
  subscribers: [],
  cache: {
    duration: 1000 * 30, // 30 seconds
  },
  // Enable WAL mode for better concurrency
  extra: {
    connection: {
      pragma: 'journal_mode = WAL',
    },
  },
});

export const initializeDatabase = async (): Promise<void> => {
  if (AppDataSource.isInitialized) {
    logger.info('Database already initialized');
    return;
  }

  try {
    await AppDataSource.initialize();
    logger.info('Database connection established');
    
    // Run migrations in production
    if (process.env.NODE_ENV === 'production') {
      await AppDataSource.runMigrations();
      logger.info('Database migrations completed');
    }
  } catch (error) {
    logger.error('Error initializing database:', error);
    process.exit(1);
  }
};

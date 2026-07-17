import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';
import { Message } from '../db/entities/Message';
import { Group } from '../db/entities/Group';
import { User } from '../db/entities/User';
import { logger } from '../utils/logger';

const isProduction = process.env.NODE_ENV === 'production';
const dbType = process.env.DB_TYPE || 'sqlite';
const migrationsRun = process.env.DB_MIGRATIONS_RUN === undefined
  ? isProduction
  : process.env.DB_MIGRATIONS_RUN === 'true';

const commonOptions = {
  synchronize: !isProduction && process.env.DB_SYNCHRONIZE !== 'false',
  logging: process.env.DB_LOGGING === 'true' || process.env.NODE_ENV === 'development',
  entities: [Message, Group, User],
  migrations: ['dist/db/migrations/*.js'],
  migrationsRun,
  subscribers: [],
  cache: {
    duration: 1000 * 30,
  },
};

const sqliteOptions: DataSourceOptions = {
  ...commonOptions,
  type: 'sqlite',
  database: process.env.DATABASE_PATH || 'database.sqlite',
  extra: {
    connection: {
      pragma: 'journal_mode = WAL',
    },
  },
};

const postgresOptions: DataSourceOptions = {
  ...commonOptions,
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number.parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'convolens',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

const getDataSourceOptions = (): DataSourceOptions => {
  if (dbType === 'postgres') {
    return postgresOptions;
  }

  return sqliteOptions;
};

export const AppDataSource = new DataSource(getDataSourceOptions());

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

import { DataSource, type DataSourceOptions } from 'typeorm';
import { User } from '../db/entities/User';
import { Group } from '../db/entities/Group';
import { Message } from '../db/entities/Message';
import { ConversationIntake } from '../db/entities/ConversationIntake';
import { ConversationMessage } from '../db/entities/ConversationMessage';
import { CreateConversationIntake1753400000000 } from '../db/migrations/1753400000000-CreateConversationIntake';
import { logger } from '../utils/logger';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const dbType = process.env.DB_TYPE || 'sqlite';
const migrationsRun =
  process.env.DB_MIGRATIONS_RUN === undefined
    ? isProduction
    : process.env.DB_MIGRATIONS_RUN === 'true';

const commonOptions = {
  synchronize: !isProduction && process.env.DB_SYNCHRONIZE !== 'false',
  logging:
    process.env.DB_LOGGING === 'true' || process.env.NODE_ENV === 'development'
      ? 'all'
      : ['error', 'warn'],
  logger: isProduction ? 'file' : 'debug',
  entities: [User, Group, Message, ConversationIntake, ConversationMessage],
  migrations: [CreateConversationIntake1753400000000],
  migrationsRun,
  migrationsTableName: 'migrations',
  cache: {
    duration: 1000 * 30,
  },
} satisfies Partial<DataSourceOptions>;

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
  extra: {
    max: Number.parseInt(process.env.DB_POOL_MAX || '10', 10),
    connectionTimeoutMillis: Number.parseInt(process.env.DB_CONNECTION_TIMEOUT_MS || '5000', 10),
    idleTimeoutMillis: Number.parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    options: '-c statement_timeout=30000',
  },
};

const getDataSourceOptions = (): DataSourceOptions => {
  if (dbType === 'postgres') {
    return postgresOptions;
  }

  return sqliteOptions;
};

// Database configuration
export const AppDataSource = new DataSource(getDataSourceOptions());

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

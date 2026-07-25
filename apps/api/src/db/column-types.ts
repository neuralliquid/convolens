import type { ColumnType } from 'typeorm';

export const dateColumnType: ColumnType =
  process.env.DB_TYPE === 'postgres' ? 'timestamptz' : 'datetime';

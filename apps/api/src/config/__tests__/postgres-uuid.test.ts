import { DataSource } from 'typeorm';

import { postgresNativeUuidOptions } from '../postgres-uuid';

describe('PostgreSQL UUID configuration', () => {
  it('uses the native UUID generator without installing extensions', () => {
    const dataSource = new DataSource({
      type: 'postgres',
      entities: [],
      ...postgresNativeUuidOptions,
    });

    expect(dataSource.options).toMatchObject({
      uuidExtension: 'pgcrypto',
      installExtensions: false,
    });
    expect((dataSource.driver as unknown as { uuidGenerator: string }).uuidGenerator).toBe(
      'gen_random_uuid()'
    );
  });
});

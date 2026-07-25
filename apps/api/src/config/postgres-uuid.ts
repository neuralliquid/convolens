export const postgresNativeUuidOptions = {
  // PostgreSQL 13+ provides gen_random_uuid() natively. Avoid requiring
  // extension allow-listing on managed PostgreSQL services.
  uuidExtension: 'pgcrypto',
  installExtensions: false,
} as const;

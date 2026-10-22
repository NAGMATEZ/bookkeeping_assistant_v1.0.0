import { defineConfig } from 'drizzle-kit';

import { resolveDatabaseConfig } from './src/lib/db-config';

const { url, authToken } = resolveDatabaseConfig();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url,
    authToken,
  },
  strict: true,
  verbose: true,
});
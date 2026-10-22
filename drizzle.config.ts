import { defineConfig } from 'drizzle-kit';

import { resolveDatabaseConfig } from './src/lib/db-config';

const { url } = resolveDatabaseConfig();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'turso',
  dbCredentials: {
    url,
  },
  strict: true,
  verbose: true,
});
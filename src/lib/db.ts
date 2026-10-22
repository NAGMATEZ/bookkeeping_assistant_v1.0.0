import { resolve } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/db/schema";
import { resolveDatabaseConfig } from "@/lib/db-config";
import { ensureLegacyMigrationBaseline } from "@/lib/migrations";

export type Database = LibSQLDatabase<typeof schema>;

type DatabaseInstance = { client: Client; db: Database };

async function createInstance(): Promise<DatabaseInstance> {
  const { url } = resolveDatabaseConfig();

  const client = createClient({ url });
  await client.execute("PRAGMA foreign_keys = ON");

  const database = drizzle(client, { schema });

  // Apply pending Drizzle migrations on boot so an existing database upgrades in place.
  // Tests run their own migrations against isolated in-memory databases.
  if (process.env.NODE_ENV !== "test" && process.env.NEXT_PHASE !== "phase-production-build") {
    const migrationsFolder = resolve(process.cwd(), "drizzle");
    await ensureLegacyMigrationBaseline(client, migrationsFolder);
    await migrate(database, { migrationsFolder });
  }

  return { client, db: database };
}

const globalForDb = globalThis as unknown as {
  __bookkeepingDbInstance?: Promise<DatabaseInstance>;
};

const instancePromise = globalForDb.__bookkeepingDbInstance ?? createInstance();

if (process.env.NODE_ENV === "development") {
  globalForDb.__bookkeepingDbInstance = instancePromise;
}

const instance = await instancePromise.catch((error: unknown) => {
  if (globalForDb.__bookkeepingDbInstance === instancePromise) {
    delete globalForDb.__bookkeepingDbInstance;
  }
  throw error;
});

export const client = instance.client;
export const db = instance.db;
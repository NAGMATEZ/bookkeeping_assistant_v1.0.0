import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";

import * as schema from "@/db/schema";

export type Database = LibSQLDatabase<typeof schema>;

type DatabaseInstance = { client: Client; db: Database };

async function createInstance(): Promise<DatabaseInstance> {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not set");
  }
  if (!authToken) {
    throw new Error("TURSO_AUTH_TOKEN is not set");
  }

  const client = createClient({ url, authToken });
  await client.execute("PRAGMA foreign_keys = ON");

  return { client, db: drizzle(client, { schema }) };
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
import { resolve } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

import * as schema from "@/db/schema";
import { resolveDatabaseConfig } from "@/lib/db-config";
import { ensureLegacyMigrationBaseline } from "@/lib/migrations";

export type Database = LibSQLDatabase<typeof schema>;

type DatabaseInstance = { client: Client; db: Database };

async function connect(): Promise<DatabaseInstance> {
  const { url, authToken } = resolveDatabaseConfig();

  const client = createClient({ url, authToken });
  await client.execute("PRAGMA foreign_keys = ON");

  const database = drizzle(client, { schema });

  // Apply pending Drizzle migrations before the first query so an existing database
  // upgrades in place. Tests migrate their own isolated in-memory databases instead.
  if (process.env.NODE_ENV !== "test") {
    const migrationsFolder = resolve(process.cwd(), "drizzle");
    await ensureLegacyMigrationBaseline(client, migrationsFolder);
    await migrate(database, { migrationsFolder });
  }

  return { client, db: database };
}

// The connection is opened lazily on the first query. `next build` imports this module
// while collecting page data, and that must not require database env vars or a network
// round-trip; every page is force-dynamic and connects at request time.
function createLazyClient(): Client {
  let connection: Promise<DatabaseInstance> | undefined;

  const getConnection = (): Promise<DatabaseInstance> => {
    if (!connection) {
      connection = connect().catch((error: unknown) => {
        connection = undefined;
        throw error;
      });
    }
    return connection;
  };

  return new Proxy({} as Client, {
    get(_target, property: string | symbol) {
      if (property === "close") {
        return () => {
          void getConnection().then(({ client }) => client.close());
        };
      }
      return (...args: unknown[]) =>
        getConnection().then(({ client }) => {
          const member: unknown = Reflect.get(client, property);
          return typeof member === "function" ? member.apply(client, args) : member;
        });
    },
  });
}

function createDatabase(): DatabaseInstance {
  const client = createLazyClient();
  return { client, db: drizzle(client, { schema }) };
}

const globalForDb = globalThis as unknown as {
  __bookkeepingDb?: DatabaseInstance;
};

const instance = globalForDb.__bookkeepingDb ?? createDatabase();

if (process.env.NODE_ENV === "development") {
  globalForDb.__bookkeepingDb = instance;
}

export const client = instance.client;
export const db = instance.db;

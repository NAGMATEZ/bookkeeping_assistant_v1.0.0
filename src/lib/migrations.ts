import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Client } from "@libsql/client";

const LEGACY_TABLES = ["invoices", "transactions", "settings"] as const;
const JOURNAL_TABLE = "__drizzle_migrations";

type MigrationJournal = {
  entries?: Array<{ when?: unknown }>;
};

async function hasLegacySchema(client: Client): Promise<boolean> {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?)",
    args: [...LEGACY_TABLES],
  });
  return result.rows.length === LEGACY_TABLES.length;
}

async function journalEntryCount(client: Client): Promise<number> {
  const table = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    args: [JOURNAL_TABLE],
  });
  if (table.rows.length === 0) {
    return 0;
  }
  const count = await client.execute(`SELECT COUNT(*) AS c FROM ${JOURNAL_TABLE}`);
  return Number((count.rows[0] as Record<string, unknown> | undefined)?.c ?? 0);
}

async function firstMigrationTimestamp(migrationsFolder: string): Promise<number> {
  const raw = await readFile(resolve(migrationsFolder, "meta/_journal.json"), "utf8");
  const journal = JSON.parse(raw) as MigrationJournal;
  const when = journal.entries?.[0]?.when;
  if (typeof when !== "number") {
    throw new Error("drizzle/meta/_journal.json does not contain a valid first migration timestamp");
  }
  return when;
}

/**
 * Databases created by the pre-migration app already contain all three tables but have no
 * Drizzle migration journal. Without a baseline the migrator would try to run the initial
 * CREATE TABLE migration again and fail. Mark the first (already reflected) migration as
 * applied so only later migrations run.
 */
export async function ensureLegacyMigrationBaseline(
  client: Client,
  migrationsFolder: string,
): Promise<void> {
  if (!(await hasLegacySchema(client))) {
    return;
  }
  if ((await journalEntryCount(client)) > 0) {
    return;
  }

  const baselineTimestamp = await firstMigrationTimestamp(migrationsFolder);
  await client.execute(`CREATE TABLE IF NOT EXISTS ${JOURNAL_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`);
  await client.execute({
    sql: `INSERT INTO ${JOURNAL_TABLE} (hash, created_at)
          SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM ${JOURNAL_TABLE})`,
    args: ["legacy-schema-baseline", baselineTimestamp],
  });
}

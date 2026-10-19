import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { Client } from "@libsql/client";

const LEGACY_TABLES = ["invoices", "transactions", "settings"] as const;
const JOURNAL_TABLE = "__drizzle_migrations";

type MigrationJournal = {
  entries?: Array<{ when?: unknown; tag?: unknown }>;
};

type TableColumn = { name: string };

const VERSION_UPDATE_COLUMNS: Record<string, Array<[name: string, definition: string]>> = {
  invoices: [
    ["net_minor", "integer DEFAULT 0 NOT NULL"],
    ["vat_minor", "integer DEFAULT 0 NOT NULL"],
    ["gross_minor", "integer DEFAULT 0 NOT NULL"],
    ["content_hash", "text"],
    ["source_image_mime", "text"],
  ],
  transactions: [
    ["net_minor", "integer"],
    ["gross_minor", "integer"],
    ["source", "text DEFAULT 'manual' NOT NULL"],
  ],
};

async function hasLegacySchema(client: Client): Promise<boolean> {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?)",
    args: [...LEGACY_TABLES],
  });
  return result.rows.length === LEGACY_TABLES.length;
}

async function tableColumns(client: Client, table: string): Promise<Set<string>> {
  const result = await client.execute(`PRAGMA table_info(${table})`);
  return new Set(result.rows.map((row) => (row as unknown as TableColumn).name));
}

async function hasVersionUpdateColumns(client: Client): Promise<boolean> {
  for (const [table, columns] of Object.entries(VERSION_UPDATE_COLUMNS)) {
    const existing = await tableColumns(client, table);
    if (columns.some(([name]) => !existing.has(name))) {
      return false;
    }
  }
  return true;
}

async function ensureVersionUpdateColumns(client: Client): Promise<void> {
  for (const [table, columns] of Object.entries(VERSION_UPDATE_COLUMNS)) {
    const existing = await tableColumns(client, table);
    for (const [name, definition] of columns) {
      if (!existing.has(name)) {
        try {
          await client.execute(`ALTER TABLE ${table} ADD ${name} ${definition}`);
        } catch (error) {
          if (!/duplicate column name/i.test((error as Error).message)) {
            throw error;
          }
        }
      }
    }
  }
}

async function backfillVersionUpdateColumns(client: Client): Promise<void> {
  const invoiceColumns = await tableColumns(client, "invoices");

  await client.execute(
    `UPDATE invoices
     SET content_hash = CASE
       WHEN source_image LIKE 'sha256:%' THEN substr(source_image, 8)
       ELSE source_image
     END
     WHERE content_hash IS NULL AND source_image IS NOT NULL`,
  );
  if (invoiceColumns.has("image_hash")) {
    await client.execute(
      `UPDATE invoices
       SET content_hash = CASE
         WHEN image_hash LIKE 'sha256:%' THEN substr(image_hash, 8)
         ELSE image_hash
       END
       WHERE content_hash IS NULL AND image_hash IS NOT NULL`,
    );
  }
  await client.execute(
    "UPDATE invoices SET source_image = NULL WHERE content_hash IS NOT NULL AND source_image LIKE 'sha256:%'",
  );
  if (invoiceColumns.has("image_data")) {
    await client.execute(
      "UPDATE invoices SET source_image = image_data WHERE source_image IS NULL AND image_data IS NOT NULL",
    );
  }

  if (invoiceColumns.has("net_total_minor")) {
    await client.execute(
      "UPDATE invoices SET net_minor = net_total_minor WHERE net_total_minor IS NOT NULL",
    );
    if (invoiceColumns.has("tax_minor")) {
      await client.execute(
        "UPDATE invoices SET vat_minor = tax_minor WHERE tax_minor IS NOT NULL",
      );
    }
    await client.execute(
      "UPDATE invoices SET net_minor = total_minor WHERE net_minor = 0 AND total_minor <> 0 AND net_total_minor IS NULL",
    );
  } else {
    await client.execute(
      "UPDATE invoices SET net_minor = total_minor WHERE net_minor = 0 AND total_minor <> 0",
    );
  }
  await client.execute(
    "UPDATE invoices SET gross_minor = total_minor WHERE gross_minor = 0 AND total_minor <> 0",
  );
}

async function ensureJournalTable(client: Client): Promise<void> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS ${JOURNAL_TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)`,
  );
}

async function migrationTimestamp(
  migrationsFolder: string,
  tagPrefix: string,
): Promise<number> {
  const raw = await readFile(resolve(migrationsFolder, "meta/_journal.json"), "utf8");
  const journal = JSON.parse(raw) as MigrationJournal;
  const entry = journal.entries?.find(
    (candidate) => typeof candidate.tag === "string" && candidate.tag.startsWith(tagPrefix),
  );
  if (typeof entry?.when !== "number") {
    throw new Error(`drizzle/meta/_journal.json does not contain migration ${tagPrefix}`);
  }
  return entry.when;
}

async function markAppliedThrough(
  client: Client,
  migrationsFolder: string,
  tagPrefix: string,
): Promise<void> {
  const target = await migrationTimestamp(migrationsFolder, tagPrefix);
  const current = await client.execute(`SELECT MAX(created_at) AS latest FROM ${JOURNAL_TABLE}`);
  const latest = Number((current.rows[0] as Record<string, unknown> | undefined)?.latest ?? 0);
  if (latest >= target) {
    return;
  }

  await client.execute({
    sql: `INSERT INTO ${JOURNAL_TABLE} (hash, created_at) VALUES (?, ?)`,
    args: [`legacy-upgrade-${tagPrefix}`, target],
  });
}

/**
 * Databases created by earlier builds already contain the core tables but may lack a Drizzle
 * journal, may carry a journal timestamp from an unrelated schema revision, or may have only
 * part of the version-update columns. Normalizing the schema here makes the migrator's view
 * of "already applied" match the actual database, so it never replays CREATE TABLE or
 * duplicate ADD COLUMN statements.
 */
export async function ensureLegacyMigrationBaseline(
  client: Client,
  migrationsFolder: string,
): Promise<void> {
  if (!(await hasLegacySchema(client))) {
    return;
  }

  if (!(await hasVersionUpdateColumns(client))) {
    await ensureVersionUpdateColumns(client);
    await backfillVersionUpdateColumns(client);
  }
  await ensureJournalTable(client);
  await markAppliedThrough(client, migrationsFolder, "0001");
}

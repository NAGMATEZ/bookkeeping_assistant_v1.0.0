// spec: a database created by the pre-migration app has the three tables but no Drizzle journal,
//   and some databases were partially upgraded with an unrelated journal timestamp. Boot migration
//   must normalize the existing schema instead of replaying CREATE TABLE / duplicate ADD COLUMN.
// expected (hand-derived): the first database gets the 0001 columns plus a 5000 backfill; the second
//   keeps its invoice, maps net_total_minor/tax_minor/image_hash/image_data to the new columns, and
//   survives migration despite transactions already having the 0001 columns and a stale journal row.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient, type Client } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { ensureLegacyMigrationBaseline } from "@/lib/migrations";

const MIGRATIONS_FOLDER = resolve("drizzle");

async function applyInitialSchema(client: Client): Promise<void> {
  const initial = await readFile(resolve(MIGRATIONS_FOLDER, "0000_nostalgic_punisher.sql"), "utf8");
  await client.executeMultiple(initial);
}

async function migrateLegacyDatabase(client: Client) {
  await ensureLegacyMigrationBaseline(client, MIGRATIONS_FOLDER);
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

describe("legacy database boot migration", () => {
  it("baselines an existing schema without a journal, then applies later migrations", async () => {
    const client = createClient({ url: ":memory:" });
    try {
      await applyInitialSchema(client);
      await client.execute(
        `INSERT INTO invoices (id, vendor, date, total_minor, currency_code, project, status, source_image, line_items, raw_llm_response)
         VALUES ('legacy-invoice', 'Legacy Vendor', 20260115, 5000, 'HUF', 'P', 'confirmed', 'sha256:old', '[]', '{}')`,
      );

      const db = await migrateLegacyDatabase(client);
      const [invoice] = await db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.id, "legacy-invoice"));
      expect(invoice).toMatchObject({
        vendor: "Legacy Vendor",
        total_minor: 5000,
        net_minor: 5000,
        vat_minor: 0,
        gross_minor: 5000,
        content_hash: "old",
        source_image: null,
      });
    } finally {
      client.close();
    }
  });

  it("normalizes a partially upgraded database with a stale journal timestamp", async () => {
    const client = createClient({ url: ":memory:" });
    try {
      await applyInitialSchema(client);
      await client.execute("ALTER TABLE transactions ADD net_minor integer");
      await client.execute("ALTER TABLE transactions ADD gross_minor integer");
      await client.execute("ALTER TABLE transactions ADD source text DEFAULT 'manual' NOT NULL");
      await client.execute("ALTER TABLE invoices ADD image_hash text");
      await client.execute("ALTER TABLE invoices ADD image_data text");
      await client.execute("ALTER TABLE invoices ADD net_total_minor integer");
      await client.execute("ALTER TABLE invoices ADD tax_minor integer");
      await client.execute(
        "CREATE TABLE __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)",
      );
      await client.execute(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('unrelated-revision', 1785523001480)",
      );
      await client.execute(
        `INSERT INTO invoices (id, vendor, date, total_minor, currency_code, project, status, source_image, line_items, raw_llm_response, image_hash, image_data, net_total_minor, tax_minor)
         VALUES ('partial-invoice', 'Partial Vendor', 20260115, 5000, 'HUF', 'P', 'confirmed', NULL, '[]', '{}', 'sha256:partial', 'aW1hZ2U=', 4000, 1000)`,
      );

      const db = await migrateLegacyDatabase(client);
      const [invoice] = await db
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.id, "partial-invoice"));
      expect(invoice).toMatchObject({
        total_minor: 5000,
        net_minor: 4000,
        vat_minor: 1000,
        gross_minor: 5000,
        content_hash: "partial",
        source_image: "aW1hZ2U=",
      });
    } finally {
      client.close();
    }
  });
});

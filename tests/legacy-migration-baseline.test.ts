// spec: a database created by the pre-migration app has the three tables but no Drizzle journal, so boot
//   migration must baseline the initial schema instead of re-running its CREATE TABLE statements.
// expected (hand-derived): after applying 0000 manually and inserting one 5000 invoice, boot migration
//   completes, keeps that invoice, and adds the 0001 columns (net_minor = 5000, source_image null).
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { ensureLegacyMigrationBaseline } from "@/lib/migrations";

const MIGRATIONS_FOLDER = resolve("drizzle");

describe("legacy database boot migration", () => {
  it("baselines an existing schema without a journal, then applies later migrations", async () => {
    const client = createClient({ url: ":memory:" });
    try {
      const initial = await readFile(resolve(MIGRATIONS_FOLDER, "0000_nostalgic_punisher.sql"), "utf8");
      await client.executeMultiple(initial);
      await client.execute(
        `INSERT INTO invoices (id, vendor, date, total_minor, currency_code, project, status, source_image, line_items, raw_llm_response)
         VALUES ('legacy-invoice', 'Legacy Vendor', 20260115, 5000, 'HUF', 'P', 'confirmed', 'sha256:old', '[]', '{}')`,
      );

      await ensureLegacyMigrationBaseline(client, MIGRATIONS_FOLDER);
      const db = drizzle(client, { schema });
      await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

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
});

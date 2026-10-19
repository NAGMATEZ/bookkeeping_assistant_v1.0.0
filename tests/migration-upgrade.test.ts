// spec: new columns arrive only through migrations, and an existing database with data must upgrade in place
//   without losing rows. Existing source_image hashes move to content_hash; existing rows become "manual" and
//   their gross/net are backfilled from total_minor.
// expected (hand-derived): after migrating a DB that already ran 0000 and holds one 5000 invoice + linked
//   -5000 transaction + one setting, applying 0001 keeps all three rows; invoice.content_hash = "abc",
//   source_image = NULL, net_minor = gross_minor = 5000, vat_minor = 0; transaction.source = "manual" and its
//   net/gross remain NULL; the setting is unchanged.
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { createClient } from "@libsql/client";
import { eq } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";

let tempFolder = "";
let client: ReturnType<typeof createClient>;
let db: LibSQLDatabase<typeof schema>;

async function buildOldMigrationsFolder(): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), "bookkeeping-old-migrations-"));
  await mkdir(join(folder, "meta"), { recursive: true });
  await copyFile(resolve("drizzle/0000_nostalgic_punisher.sql"), join(folder, "0000_nostalgic_punisher.sql"));
  const journal = JSON.parse(await readFile(resolve("drizzle/meta/_journal.json"), "utf8")) as {
    entries: unknown[];
  };
  await writeFile(
    join(folder, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "sqlite", entries: [journal.entries[0]] }),
  );
  return folder;
}

beforeAll(async () => {
  tempFolder = await buildOldMigrationsFolder();
  client = createClient({ url: ":memory:" });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: tempFolder });

  await client.execute(
    `INSERT INTO invoices (id, vendor, date, total_minor, currency_code, project, status, source_image, line_items, raw_llm_response)
     VALUES ('old-invoice', 'Old Vendor', 20260115, 5000, 'HUF', 'P', 'confirmed', 'sha256:abc', '[{"description":"Widget","amount_minor":5000}]', '{}')`,
  );
  await client.execute(
    `INSERT INTO transactions (id, date, amount_minor, currency_code, category, project, description, source_invoice_id)
     VALUES ('old-tx', 20260115, -5000, 'HUF', 'Office', 'P', 'Old Vendor', 'old-invoice')`,
  );
  await client.execute("INSERT INTO settings (key, value) VALUES ('DEFAULT_CURRENCY', 'HUF')");

  await migrate(db, { migrationsFolder: resolve("drizzle") });
});

afterAll(async () => {
  client.close();
  if (tempFolder) {
    await rm(tempFolder, { recursive: true, force: true });
  }
});

describe("migration upgrade of an existing database", () => {
  it("preserves data and backfills the new invoice/transaction columns", async () => {
    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, "old-invoice"));
    expect(invoice).toMatchObject({
      vendor: "Old Vendor",
      total_minor: 5000,
      net_minor: 5000,
      vat_minor: 0,
      gross_minor: 5000,
      content_hash: "abc",
      source_image: null,
    });

    const [transaction] = await db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.id, "old-tx"));
    expect(transaction).toMatchObject({
      amount_minor: -5000,
      source: "manual",
      net_minor: null,
      gross_minor: null,
      source_invoice_id: "old-invoice",
    });

    const settingsRows = await db.select().from(schema.settings);
    expect(settingsRows).toEqual([{ key: "DEFAULT_CURRENCY", value: "HUF" }]);

    const [newInvoice] = await db
      .insert(schema.invoices)
      .values({
        vendor: "New Vendor",
        date: 20260201,
        total_minor: 127000,
        net_minor: 100000,
        vat_minor: 27000,
        gross_minor: 127000,
        currency_code: "HUF",
        project: "P",
        status: "needs_review",
        content_hash: "newhash",
        line_items: "[]",
        raw_llm_response: "{}",
      })
      .returning();
    expect(newInvoice.net_minor).toBe(100000);
  });
});

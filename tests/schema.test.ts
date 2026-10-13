// spec: exactly 3 tables for this build (invoices, transactions, settings), schema changes only via Drizzle migrations
// expected: a fresh in-memory DB + generated migration → app tables = [invoices, settings, transactions]; migration must apply cleanly
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it } from "vitest";

const clients: ReturnType<typeof createClient>[] = [];

afterEach(() => {
  while (clients.length > 0) {
    clients.pop()?.close();
  }
});

describe("schema migration", () => {
  it("applies the generated migration to a fresh DB and creates exactly the 3 spec tables", async () => {
    const client = createClient({ url: ":memory:" });
    clients.push(client);
    const db = drizzle(client);

    await migrate(db, { migrationsFolder: "./drizzle" });

    const result = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations' ORDER BY name",
    );

    expect(result.rows.map((row) => row.name)).toEqual(["invoices", "settings", "transactions"]);
  });
});
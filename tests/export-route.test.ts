// spec: export controls must hit a real download — CSV UTF-8 semicolon-delimited, XLSX native-cell spreadsheet.
// expected: GET /api/export?format=csv → 200 text/csv whose body contains the header line and the inserted
//   HUF transaction; GET ?format=xlsx → 200 spreadsheet content that reads back with a numeric amount cell;
//   an unknown format → 400.
import { migrate } from "drizzle-orm/libsql/migrator";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";

vi.hoisted(() => {
  process.env.TURSO_DATABASE_URL = ":memory:";
  process.env.TURSO_AUTH_TOKEN = "test-token";
});

import { GET } from "@/app/api/export/route";
import { transactions } from "@/db/schema";
import { db } from "@/lib/db";

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.insert(transactions).values({
    date: 20260115,
    amount_minor: -1234,
    currency_code: "HUF",
    category: "ExportTest",
    project: "ExportRoute",
    description: "Export me",
  });
});

describe("GET /api/export", () => {
  it("downloads the CSV with header and row", async () => {
    const response = await GET(new Request("http://localhost/api/export?format=csv"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    const text = await response.text();
    expect(text.split("\n")[0]).toBe("date;description;amount;currency;category;project");
    expect(text).toContain("2026-01-15;Export me;-12.34;HUF;ExportTest;ExportRoute");
  });

  it("downloads a readable XLSX with a numeric amount cell", async () => {
    const response = await GET(new Request("http://localhost/api/export?format=xlsx"));

    expect(response.status).toBe(200);
    const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const exportRow = rows.find((row) => row[5] === "ExportRoute");

    expect(exportRow?.[2]).toBe(-12.34);
    expect(exportRow?.[3]).toBe("HUF");
  });

  it("rejects an unsupported format", async () => {
    const response = await GET(new Request("http://localhost/api/export?format=pdf"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, message: 'Unsupported export format "pdf"' });
  });
});
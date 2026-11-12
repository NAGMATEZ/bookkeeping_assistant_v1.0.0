import { z } from "zod";

import { todayDateInt } from "@/lib/dates";
import { failureResponse } from "@/lib/diagnostics";
import { mapImportRows } from "@/lib/import-map";
import { checkImportFile, parseImportFile } from "@/lib/import-parse";
import { persistImport } from "@/lib/import-persist";
import { checkStartup } from "@/lib/startup-gate";

/**
 * POST /api/import
 * multipart/form-data: `file` (.csv/.xlsx/.xls), `mapping` (JSON column indices), `overrides` (JSON
 * {rowIndex: isIncome} captured on the mapping screen — applied to every row, not just the previewed 5).
 * Maps rows with the direction precedence (sign < direction column < override) and persists them all in
 * DEFAULT_CURRENCY; unparseable rows and dates after today are reported in `skipped`, never thrown, and
 * rows identical to an already-imported transaction are counted in `skippedDuplicates` instead of being
 * inserted again.
 * Response: { ok: true, inserted, skippedDuplicates, skipped } | { ok: false, message } (400/500/503).
 */
const mappingSchema = z
  .object({
    date: z.number().int().min(0),
    amount: z.number().int().min(0),
    description: z.number().int().min(0).optional(),
    category: z.number().int().min(0).optional(),
    project: z.number().int().min(0).optional(),
    direction: z.number().int().min(0).optional(),
  })
  .strict();

const overridesSchema = z.record(z.string(), z.boolean());

export async function POST(request: Request): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return Response.json({ ok: false, message: startup.reason }, { status: 503 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, message: "No file was uploaded." }, { status: 400 });
    }
    const fileCheck = checkImportFile(file);
    if (!fileCheck.ok) {
      return Response.json({ ok: false, message: fileCheck.message }, { status: 400 });
    }

    let mappingJson: unknown;
    try {
      mappingJson = JSON.parse(String(form?.get("mapping")));
    } catch {
      return Response.json({ ok: false, message: "`mapping` must be a JSON object" }, { status: 400 });
    }
    const mapping = mappingSchema.safeParse(mappingJson);
    if (!mapping.success) {
      return Response.json({ ok: false, message: "Invalid column mapping" }, { status: 400 });
    }

    const overridesRaw = form?.get("overrides");
    let overrides: Record<number, boolean> = {};
    if (overridesRaw !== null && overridesRaw !== undefined && String(overridesRaw) !== "") {
      let overridesJson: unknown;
      try {
        overridesJson = JSON.parse(String(overridesRaw));
      } catch {
        return Response.json({ ok: false, message: "`overrides` must be a JSON object" }, { status: 400 });
      }
      const parsedOverrides = overridesSchema.safeParse(overridesJson);
      if (!parsedOverrides.success) {
        return Response.json({ ok: false, message: "Invalid row overrides" }, { status: 400 });
      }
      overrides = Object.fromEntries(
        Object.entries(parsedOverrides.data).map(([key, value]) => [Number(key), value]),
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseImportFile(file.name, bytes);
    const { records, skipped } = mapImportRows(parsed.rows, mapping.data, overrides);

    const today = todayDateInt();
    const importable = records.filter((record) => record.dateInt <= today);
    const futureSkipped = records
      .filter((record) => record.dateInt > today)
      .map((record) => ({
        rowIndex: record.rowIndex,
        reason: `Date "${record.date}" is after today`,
      }));
    const allSkipped = [...skipped, ...futureSkipped].sort((a, b) => a.rowIndex - b.rowIndex);

    const source = /\.xlsx?$/i.test(file.name) ? "xlsx" : "csv";
    const persisted = await persistImport(importable, source, { skipDuplicates: true });
    if (!persisted.ok) {
      return Response.json({ ok: false, message: persisted.message }, { status: persisted.status });
    }

    return Response.json({
      ok: true,
      inserted: persisted.inserted,
      skippedDuplicates: persisted.skippedDuplicates,
      skipped: allSkipped,
    });
  } catch (error) {
    const failure = failureResponse("import", error, "Importing transactions failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}
// spec: precedence lowest→highest: sign-based inference, then a mapped direction column, then an explicit
//   per-row override; overrides captured during a 5-row preview must still apply to rows 6+ at import.
// expected (hand-derived): "-50.00" with no direction/override → amountMinor -5000 (expense);
//   direction "income" on "-50.00" → +5000; direction "expense" + override true → +5000;
//   8 rows "-10.00" with overrides {3:true, 7:true} → exactly rows 3 and 7 positive (row 7 beyond the preview),
//   all other rows -1000; invalid date row is skipped and reported, not mapped.
import { describe, expect, it } from "vitest";

import { mapImportRows, resolveRowIsIncome, type ColumnMapping } from "@/lib/import-map";

const MAPPING: ColumnMapping = { date: 0, amount: 1, description: 2, direction: 3, category: 4, project: 5 };

function row(date: string, amount: string, direction = "", description = "x"): string[] {
  return [date, amount, description, direction, "Cat", "Proj"];
}

describe("resolveRowIsIncome", () => {
  it("infers direction from the sign when nothing else is mapped", () => {
    expect(resolveRowIsIncome(-5000, "")).toBe(false);
    expect(resolveRowIsIncome(5000, "")).toBe(true);
  });

  it("lets a mapped direction column override the sign", () => {
    expect(resolveRowIsIncome(-5000, "income")).toBe(true);
    expect(resolveRowIsIncome(5000, "expense")).toBe(false);
  });

  it("lets an explicit override beat both", () => {
    expect(resolveRowIsIncome(-5000, "expense", true)).toBe(true);
    expect(resolveRowIsIncome(5000, "income", false)).toBe(false);
  });
});

describe("mapImportRows", () => {
  it("maps a pre-signed negative amount to an expense", () => {
    const result = mapImportRows([row("2026-01-15", "-50.00")], MAPPING);

    expect(result.skipped).toEqual([]);
    expect(result.records[0].amountMinor).toBe(-5000);
    expect(result.records[0].dateInt).toBe(20260115);
  });

  it("applies overrides only to their own row indices, including rows past the preview", () => {
    const rows = Array.from({ length: 8 }, (_, index) =>
      row(`2026-01-${String(index + 1).padStart(2, "0")}`, "-10.00"),
    );

    const result = mapImportRows(rows, MAPPING, { 3: true, 7: true });

    expect(result.records.map((record) => record.amountMinor)).toEqual([
      -1000, -1000, -1000, 1000, -1000, -1000, -1000, 1000,
    ]);
  });

  it("skips rows with an unparseable date and reports them", () => {
    const result = mapImportRows(
      [row("2026-01-15", "-10.00"), row("2024-02-30", "-10.00"), row("not-a-date", "-10.00")],
      MAPPING,
    );

    expect(result.records).toHaveLength(1);
    expect(result.skipped).toEqual([
      { rowIndex: 1, reason: 'Invalid or missing date "2024-02-30"' },
      { rowIndex: 2, reason: 'Invalid or missing date "not-a-date"' },
    ]);
  });
});
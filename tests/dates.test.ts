// spec: Data Sanity — reject dates outside 1900–2100 / invalid month-day (no silent Date rollover); dates are
//       stored as integer YYYYMMDD (SUBMISSION_NOTES #5).
// expected (hand-derived): "2024-02-30" → invalid (Feb 30 does not exist); "1899-12-31" → out of range;
//   "2101-01-01" → out of range; "2024-02-29" → valid (leap year); "2026-01-15" → toDateInt 20260115;
//   monthKeyOf(20260115) → "2026-01"; fromDateInt(20260115) → "2026-01-15".
import { describe, expect, it } from "vitest";

import {
  fromDateInt,
  isAllowedCalendarDate,
  monthKeyOf,
  parseCalendarDate,
  toDateInt,
} from "@/lib/dates";

describe("isAllowedCalendarDate / parseCalendarDate", () => {
  it("rejects impossible month-days and out-of-range years", () => {
    expect(isAllowedCalendarDate("2024-02-30")).toBe(false);
    expect(isAllowedCalendarDate("1899-12-31")).toBe(false);
    expect(isAllowedCalendarDate("2101-01-01")).toBe(false);
    expect(isAllowedCalendarDate("2026-13-01")).toBe(false);
    expect(isAllowedCalendarDate("2026-00-10")).toBe(false);
    expect(isAllowedCalendarDate("15/01/2026")).toBe(false);
    expect(parseCalendarDate("2024-02-30")).toBeNull();
  });

  it("accepts valid dates including leap days", () => {
    expect(isAllowedCalendarDate("2024-02-29")).toBe(true);
    expect(isAllowedCalendarDate("1900-01-01")).toBe(true);
    expect(isAllowedCalendarDate("2100-12-31")).toBe(true);
    expect(parseCalendarDate("2026-01-15")).toEqual({ year: 2026, month: 1, day: 15 });
  });
});

describe("integer conversions", () => {
  it("converts between YYYY-MM-DD strings and YYYYMMDD integers", () => {
    expect(toDateInt("2026-01-15")).toBe(20260115);
    expect(fromDateInt(20260115)).toBe("2026-01-15");
    expect(toDateInt("2024-02-29")).toBe(20240229);
  });

  it("throws a specific error for invalid input", () => {
    expect(() => toDateInt("2024-02-30")).toThrow('Invalid date (expected YYYY-MM-DD within 1900–2100): "2024-02-30"');
  });

  it("derives the month key used for dashboard buckets", () => {
    expect(monthKeyOf(20260115)).toBe("2026-01");
    expect(monthKeyOf(20241231)).toBe("2024-12");
  });
});
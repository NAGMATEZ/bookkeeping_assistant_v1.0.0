// spec: Data Sanity — reject dates outside 1900–2100 / invalid month-day (no silent Date rollover); dates are
//       stored as integer YYYYMMDD (SUBMISSION_NOTES #5).
// expected (hand-derived): "2024-02-30" → invalid (Feb 30 does not exist); "1899-12-31" → out of range;
//   "2101-01-01" → out of range; "2024-02-29" → valid (leap year); "2026-01-15" → toDateInt 20260115;
//   monthKeyOf(20260115) → "2026-01"; fromDateInt(20260115) → "2026-01-15".
// Gregorian leap rule: 2000-02-29 valid (divisible by 400), 1900-02-29 / 2100-02-29 invalid
//   (centuries not divisible by 400), 2024-02-29 valid, 2023-02-29 invalid.
// Today in Europe/Budapest: 2026-11-12T23:30Z is already 2026-11-13 local, so todayDateInt → 20261113;
//   isFutureDateInt is true only when dateInt > todayDateInt (today itself is allowed).
import { describe, expect, it } from "vitest";

import {
  daysInMonth,
  fromDateInt,
  isAllowedCalendarDate,
  isFutureDateInt,
  isLeapYear,
  monthKeyOf,
  parseCalendarDate,
  toDateInt,
  todayDateInt,
  todayIsoDate,
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

  it("applies the Gregorian century rule to February 29", () => {
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2023)).toBe(false);
    expect(isAllowedCalendarDate("2000-02-29")).toBe(true);
    expect(isAllowedCalendarDate("2024-02-29")).toBe(true);
    expect(isAllowedCalendarDate("1900-02-29")).toBe(false);
    expect(isAllowedCalendarDate("2100-02-29")).toBe(false);
    expect(isAllowedCalendarDate("2023-02-29")).toBe(false);
  });

  it("reports the number of days in each month, including leap February", () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 13)).toBe(0);
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

  it("resolves today in the app timezone so after-midnight local dates are not future", () => {
    expect(todayIsoDate(new Date("2026-11-12T12:00:00Z"))).toBe("2026-11-12");
    expect(todayDateInt(new Date("2026-11-12T12:00:00Z"))).toBe(20261112);
    expect(todayIsoDate(new Date("2026-11-12T22:59:00Z"))).toBe("2026-11-12");
    expect(todayIsoDate(new Date("2026-11-12T23:30:00Z"))).toBe("2026-11-13");
    expect(todayDateInt(new Date("2026-11-12T23:30:00Z"))).toBe(20261113);
  });

  it("flags only dates strictly after today as future", () => {
    const now = new Date("2026-11-12T12:00:00Z");
    expect(isFutureDateInt(20261113, now)).toBe(true);
    expect(isFutureDateInt(20261112, now)).toBe(false);
    expect(isFutureDateInt(20261111, now)).toBe(false);
  });
});
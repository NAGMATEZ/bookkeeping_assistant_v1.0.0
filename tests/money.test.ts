// spec: multi-step sums keep full precision, round once at final persistence — never round-then-sum (Money invariant).
// expected (hand-derived): 5.6 + 4.9 = 10.5 pre-round → one round = 11 (Math.round tie rule, SUBMISSION_NOTES #1);
//   discriminating case: 0.4 + 0.4 → round-once = round(0.8) = 1, while round-then-sum = 0 + 0 = 0, so 1 proves no per-item rounding.
// expected parse (major→minor, ×100): "1 000,00" → 100000; "-12.34" → -1234; "1,234.56" → 123456.
import { describe, expect, it } from "vitest";

import {
  parseDecimalToMinorUnits,
  roundOnceToMinorUnits,
  sumAmounts,
  sumAndRoundOnce,
} from "@/lib/money";

describe("sumAmounts / roundOnceToMinorUnits", () => {
  it("keeps full precision until the final single rounding", () => {
    expect(sumAmounts([5.6, 4.9])).toBe(10.5);
    expect(roundOnceToMinorUnits(10.5)).toBe(11);
    expect(sumAndRoundOnce([5.6, 4.9])).toBe(11);
  });

  it("does not round each line item before summing", () => {
    const roundThenSum = [0.4, 0.4].reduce((total, value) => total + Math.round(value), 0);

    expect(sumAndRoundOnce([0.4, 0.4])).toBe(1);
    expect(roundThenSum).toBe(0);
    expect(sumAndRoundOnce([0.4, 0.4])).not.toBe(roundThenSum);
  });
});

describe("parseDecimalToMinorUnits", () => {
  it("converts decimal major units to integer minor units", () => {
    expect(parseDecimalToMinorUnits("1 000,00")).toBe(100000);
    expect(parseDecimalToMinorUnits("-12.34")).toBe(-1234);
    expect(parseDecimalToMinorUnits("1,234.56")).toBe(123456);
    expect(parseDecimalToMinorUnits("50")).toBe(5000);
  });

  it("rejects malformed or over-precise input", () => {
    expect(() => parseDecimalToMinorUnits("abc")).toThrow('Invalid amount: "abc"');
    expect(() => parseDecimalToMinorUnits("1.2345")).toThrow('Amount has more than 2 decimal places: "1.2345"');
  });
});
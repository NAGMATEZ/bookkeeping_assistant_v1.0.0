const DECIMAL_INPUT = /^[+-]?[\d.,]+$/;

function isGroupingSeparator(unsigned: string, index: number): boolean {
  const char = unsigned[index];
  if (unsigned.split(char).length - 1 > 1) {
    return true;
  }
  const digitsAfter = unsigned.length - index - 1;
  const digitsBefore = unsigned.slice(0, index).replace(/\D/g, "");
  return digitsAfter === 3 && digitsBefore.length >= 1 && digitsBefore.length <= 3 && digitsBefore !== "0";
}

export function sumAmounts(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}

export function roundOnceToMinorUnits(value: number): number {
  return Math.round(value);
}

export function sumAndRoundOnce(values: readonly number[]): number {
  return roundOnceToMinorUnits(sumAmounts(values));
}

export function minorUnitsToDecimal(minorUnits: number): string {
  const sign = minorUnits < 0 ? "-" : "";
  const absolute = Math.abs(minorUnits);
  const whole = Math.trunc(absolute / 100);
  const fraction = absolute % 100;
  return `${sign}${whole}.${String(fraction).padStart(2, "0")}`;
}

export function parseDecimalToMinorUnits(input: string): number {
  const cleaned = input.trim().replace(/[\s\u00a0]/g, "");

  if (cleaned === "" || !DECIMAL_INPUT.test(cleaned)) {
    throw new Error(`Invalid amount: "${input}"`);
  }

  const sign = cleaned.startsWith("-") ? -1 : 1;
  const unsigned = cleaned.replace(/^[+-]/, "");

  const dotIndex = unsigned.lastIndexOf(".");
  const commaIndex = unsigned.lastIndexOf(",");
  let decimalChar: "." | "," | null = null;

  if (dotIndex !== -1 && commaIndex !== -1) {
    decimalChar = dotIndex > commaIndex ? "." : ",";
  } else if (dotIndex !== -1) {
    decimalChar = isGroupingSeparator(unsigned, dotIndex) ? null : ".";
  } else if (commaIndex !== -1) {
    decimalChar = isGroupingSeparator(unsigned, commaIndex) ? null : ",";
  }

  const groupChar = decimalChar === "." ? "," : decimalChar === "," ? "." : null;
  const withoutGrouping = groupChar ? unsigned.split(groupChar).join("") : unsigned;
  const [wholePart, fractionPart = ""] = decimalChar
    ? withoutGrouping.split(decimalChar)
    : [withoutGrouping, ""];

  if (fractionPart.length > 2) {
    throw new Error(`Amount has more than 2 decimal places: "${input}"`);
  }
  const whole = wholePart === "" ? "0" : wholePart;
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fractionPart)) {
    throw new Error(`Invalid amount: "${input}"`);
  }

  const minorUnits = Number(whole) * 100 + Number((fractionPart + "00").slice(0, 2));
  if (!Number.isSafeInteger(minorUnits)) {
    throw new Error(`Amount is too large: "${input}"`);
  }

  return sign * minorUnits;
}
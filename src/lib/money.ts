const DECIMAL_INPUT = /^[+-]?[\d.,]+$/;

// Spaces used as thousands separators by Excel/bank exports: regular, NBSP, narrow NBSP, thin space.
const SPACE_SEPARATORS = /[\s\u00a0\u202f\u2009]/g;

// Recognized currency tokens may lead or trail the number ("50 000 Ft", "HUF 50000").
// Tokens must not be glued to other letters, so "12a.34" is still rejected.
const CURRENCY_TOKEN = /(^|[^A-Za-z])(HUF|FT|USD|EUR|GBP|CHF|\$|€|£)(?![A-Za-z])/gi;

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
  let text = input.trim().replace(CURRENCY_TOKEN, "$1 ");
  let parenthesesNegative = false;

  if (text.startsWith("(") && text.endsWith(")")) {
    parenthesesNegative = true;
    text = text.slice(1, -1).trim();
  }

  const cleaned = text.replace(SPACE_SEPARATORS, "");

  if (cleaned === "" || !DECIMAL_INPUT.test(cleaned)) {
    throw new Error(`Invalid amount: "${input}"`);
  }

  const explicitSign = cleaned.startsWith("-") ? -1 : 1;
  const sign = parenthesesNegative ? -1 : explicitSign;
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

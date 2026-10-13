const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MIN_DATE_INT = 19000101;
const MAX_DATE_INT = 21001231;

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

export function parseCalendarDate(value: string): { year: number; month: number; day: number } | null {
  const match = DATE_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1) {
    return null;
  }

  const daysInMonth = month === 2 && isLeapYear(year) ? 29 : DAYS_IN_MONTH[month - 1];
  if (day > daysInMonth) {
    return null;
  }

  return { year, month, day };
}

export function isAllowedCalendarDate(value: string): boolean {
  const parsed = parseCalendarDate(value);
  if (!parsed) {
    return false;
  }
  const dateInt = parsed.year * 10000 + parsed.month * 100 + parsed.day;
  return dateInt >= MIN_DATE_INT && dateInt <= MAX_DATE_INT;
}

export function toDateInt(value: string): number {
  const parsed = parseCalendarDate(value);
  if (!parsed || !isAllowedCalendarDate(value)) {
    throw new Error(`Invalid date (expected YYYY-MM-DD within 1900–2100): "${value}"`);
  }
  return parsed.year * 10000 + parsed.month * 100 + parsed.day;
}

export function fromDateInt(value: number): string {
  const year = Math.trunc(value / 10000);
  const month = Math.trunc((value % 10000) / 100);
  const day = value % 100;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthKeyOf(dateInt: number): string {
  return `${Math.trunc(dateInt / 10000)}-${String(Math.trunc((dateInt % 10000) / 100)).padStart(2, "0")}`;
}
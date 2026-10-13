import { z } from "zod";

import { isAllowedCalendarDate, toDateInt } from "@/lib/dates";
import { roundOnceToMinorUnits, sumAmounts } from "@/lib/money";

export const MAX_AMOUNT_MINOR = 1_000_000_000;

const KNOWN_CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

export const invoiceLlmOutputSchema = z.object({
  vendor: z.string().min(1),
  date: z.string(),
  total_minor: z.number(),
  currency_code: z.string(),
  line_items: z.array(
    z.object({
      description: z.string(),
      amount_minor: z.number(),
    }),
  ),
  suggested_category: z.string().optional().default(""),
  project: z.string().optional().default(""),
});

export type ParsedInvoice = {
  vendor: string;
  dateInt: number;
  totalMinor: number;
  currencyCode: string;
  lineItems: { description: string; amountMinor: number }[];
  suggestedCategory: string;
  project: string;
  totalMatchesLineItems: boolean;
};

function extractJsonPayload(raw: string): string {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain a JSON object");
  }
  return raw.slice(start, end + 1);
}

function assertWithinCap(label: string, valueMinor: number): void {
  if (Math.abs(valueMinor) > MAX_AMOUNT_MINOR) {
    throw new Error(
      `${label} exceeds the ${MAX_AMOUNT_MINOR} minor-unit cap (got ${valueMinor})`,
    );
  }
}

export function isKnownCurrencyCode(code: string): boolean {
  return KNOWN_CURRENCIES.has(code.trim().toUpperCase());
}

export function parseInvoiceLlmOutput(raw: string, defaultCurrency: string): ParsedInvoice {
  const payload = extractJsonPayload(raw);

  let json: unknown;
  try {
    json = JSON.parse(payload);
  } catch {
    throw new Error("LLM response was not valid JSON");
  }

  const parsed = invoiceLlmOutputSchema.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "output"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invoice data from the LLM failed validation — ${detail}`);
  }

  const output = parsed.data;

  if (!isAllowedCalendarDate(output.date)) {
    throw new Error(`Invoice date is invalid or out of range (1900–2100): "${output.date}"`);
  }

  const currencyCodeRaw = output.currency_code.trim().toUpperCase();
  const currencyCode = isKnownCurrencyCode(currencyCodeRaw) ? currencyCodeRaw : defaultCurrency;

  const lineItems = output.line_items.map((item) => {
    const amountMinor = roundOnceToMinorUnits(item.amount_minor);
    assertWithinCap(`Line item "${item.description}"`, amountMinor);
    return { description: item.description, amountMinor };
  });

  const totalMinor = roundOnceToMinorUnits(output.total_minor);
  assertWithinCap("Invoice total", totalMinor);

  const lineItemSum = roundOnceToMinorUnits(sumAmounts(lineItems.map((item) => item.amountMinor)));

  return {
    vendor: output.vendor.trim(),
    dateInt: toDateInt(output.date),
    totalMinor,
    currencyCode,
    lineItems,
    suggestedCategory: output.suggested_category.trim(),
    project: output.project.trim(),
    totalMatchesLineItems: lineItemSum === totalMinor,
  };
}
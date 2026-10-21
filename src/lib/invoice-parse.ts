import { z } from "zod";

import { isAllowedCalendarDate, toDateInt } from "@/lib/dates";
import { roundOnceToMinorUnits, sumAmounts } from "@/lib/money";

// Raised from 1,000,000,000: at 100 minor units per major unit that was only 10 million Ft,
// which real HUF invoices routinely exceed. The new ceiling is 100,000,000,000 minor units.
export const MAX_AMOUNT_MINOR = 100_000_000_000;

const KNOWN_CURRENCIES = new Set(Intl.supportedValuesOf("currency"));

const llmLineItemSchema = z
  .object({
    description: z.string(),
    net_minor: z.number().optional(),
    vat_minor: z.number().optional(),
    gross_minor: z.number().optional(),
    // Legacy alias: older prompts asked for a single gross amount per line.
    amount_minor: z.number().optional(),
    // Accepted as a fallback for providers that return major units despite the "_minor" contract.
    net: z.number().optional(),
    vat: z.number().optional(),
    gross: z.number().optional(),
  })
  .refine(
    (item) =>
      item.net_minor !== undefined ||
      item.vat_minor !== undefined ||
      item.gross_minor !== undefined ||
      item.amount_minor !== undefined ||
      item.net !== undefined ||
      item.vat !== undefined ||
      item.gross !== undefined,
    { message: "Line item must include net, VAT or gross amount" },
  );

const invoiceLlmOutputSchema = z.object({
  vendor: z.string().min(1),
  date: z.string(),
  total_minor: z.number(),
  net_minor: z.number().optional(),
  vat_minor: z.number().optional(),
  gross_minor: z.number().optional(),
  // Accepted as a fallback for providers that return major units despite the "_minor" contract.
  net: z.number().optional(),
  vat: z.number().optional(),
  gross: z.number().optional(),
  currency_code: z.string(),
  line_items: z.array(llmLineItemSchema),
  suggested_category: z.string().optional().default(""),
  project: z.string().optional().default(""),
});

export type InvoiceLineItem = {
  description: string;
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
};

export type ParsedInvoice = {
  vendor: string;
  dateInt: number;
  totalMinor: number;
  netMinor: number;
  vatMinor: number;
  grossMinor: number;
  currencyCode: string;
  lineItems: InvoiceLineItem[];
  suggestedCategory: string;
  project: string;
  totalMatchesLineItems: boolean;
  totalsConsistent: boolean;
};

function readStoredInteger(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)
    ? value
    : null;
}

/**
 * Reads the `line_items` JSON column defensively. The column is written by our own parser, but
 * legacy rows and manual fixes can contain malformed entries; drop those instead of crashing the
 * invoice review page. Legacy rows only stored `amount_minor` (gross), so they become net=gross
 * with zero VAT; new rows carry net/VAT/gross explicitly.
 */
export function parseStoredLineItems(lineItemsJson: string): InvoiceLineItem[] {
  try {
    const parsed: unknown = JSON.parse(lineItemsJson);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((item) => {
      if (typeof item !== "object" || item === null) {
        return [];
      }
      const record = item as Record<string, unknown>;
      const description = record.description;
      if (typeof description !== "string") {
        return [];
      }

      // Accept both the persisted snake_case shape and camelCase rows written before serialization
      // was normalized, so existing invoices become readable without a data migration.
      const netRaw =
        readStoredInteger(record, "net_minor") ?? readStoredInteger(record, "netMinor");
      const vatRaw =
        readStoredInteger(record, "vat_minor") ?? readStoredInteger(record, "vatMinor");
      const grossRaw =
        readStoredInteger(record, "gross_minor") ??
        readStoredInteger(record, "grossMinor") ??
        readStoredInteger(record, "amount_minor") ??
        readStoredInteger(record, "amountMinor");

      let grossMinor: number;
      if (grossRaw === null) {
        if (netRaw === null || vatRaw === null) {
          return [];
        }
        grossMinor = netRaw + vatRaw;
      } else {
        grossMinor = grossRaw;
      }

      const netMinor = netRaw ?? (vatRaw === null ? grossMinor : grossMinor - vatRaw);
      const vatMinor = vatRaw ?? grossMinor - netMinor;
      return [{ description, netMinor, vatMinor, grossMinor }];
    });
  } catch {
    return [];
  }
}

export function extractJsonPayload(raw: string): string {
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

/**
 * HUF/JPY and other zero-decimal currencies are printed in whole major units. Models asked for
 * minor units still return the printed forint amount, because no cents exist on the document.
 * The app stores every currency as hundredths (see money.ts), so scale those extractions by 100
 * once, at the parse boundary.
 */
export function currencyMajorUnitScale(currencyCode: string): number {
  const fractionDigits = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
  }).resolvedOptions().maximumFractionDigits;
  return fractionDigits === 0 ? 100 : 1;
}

type RawAmount = { value: number; major: boolean };

function pickAmount(minor: number | undefined, major: number | undefined): RawAmount | null {
  if (minor !== undefined) {
    return { value: minor, major: false };
  }
  if (major !== undefined) {
    return { value: major, major: true };
  }
  return null;
}

export function lineItemsMatchTotal(lineItemsJson: string, totalMinor: number): boolean {
  try {
    const parsed: unknown = JSON.parse(lineItemsJson);
    if (!Array.isArray(parsed)) {
      return false;
    }
    const items = parseStoredLineItems(lineItemsJson);
    if (items.length !== parsed.length) {
      return false;
    }
    return (
      roundOnceToMinorUnits(sumAmounts(items.map((item) => item.grossMinor))) === totalMinor
    );
  } catch {
    return false;
  }
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
  const zeroDecimalCorrection = currencyMajorUnitScale(currencyCode);

  const toMinor = (amount: RawAmount): number =>
    Math.round(amount.value * (amount.major ? 100 : 1) * zeroDecimalCorrection);

  const lineItems = output.line_items.map((item) => {
    const label = `Line item "${item.description}"`;
    const netInput = pickAmount(item.net_minor, item.net);
    const vatInput = pickAmount(item.vat_minor, item.vat);
    const grossInput =
      pickAmount(item.gross_minor, item.gross) ?? pickAmount(item.amount_minor, undefined);

    const netScaled = netInput ? toMinor(netInput) : undefined;
    const vatScaled = vatInput ? toMinor(vatInput) : undefined;
    const grossScaled = grossInput ? toMinor(grossInput) : undefined;

    let grossMinor: number;
    if (grossScaled !== undefined) {
      grossMinor = grossScaled;
    } else if (netScaled !== undefined && vatScaled !== undefined) {
      grossMinor = netScaled + vatScaled;
    } else if (netScaled !== undefined) {
      grossMinor = netScaled;
    } else if (vatScaled !== undefined) {
      grossMinor = vatScaled;
    } else {
      throw new Error(`${label} is missing its amount`);
    }

    const netMinor = netScaled ?? (vatScaled === undefined ? grossMinor : grossMinor - vatScaled);
    const vatMinor = vatScaled ?? grossMinor - netMinor;

    const legacyOnly =
      item.gross_minor === undefined &&
      item.gross === undefined &&
      item.amount_minor !== undefined &&
      item.net_minor === undefined &&
      item.net === undefined &&
      item.vat_minor === undefined &&
      item.vat === undefined;
    if (legacyOnly) {
      assertWithinCap(label, grossMinor);
    } else {
      assertWithinCap(`${label} net`, netMinor);
      assertWithinCap(`${label} VAT`, vatMinor);
      assertWithinCap(`${label} gross`, grossMinor);
    }

    return { description: item.description, netMinor, vatMinor, grossMinor };
  });

  const totalMinor = Math.round(output.total_minor * zeroDecimalCorrection);
  assertWithinCap("Invoice total", totalMinor);

  const netInput = pickAmount(output.net_minor, output.net);
  const vatInput = pickAmount(output.vat_minor, output.vat);
  const grossInput = pickAmount(output.gross_minor, output.gross);

  const netMinorFromInput = netInput ? toMinor(netInput) : undefined;
  const vatMinorFromInput = vatInput ? toMinor(vatInput) : undefined;
  const grossMinorFromInput = grossInput ? toMinor(grossInput) : undefined;

  let grossMinor =
    grossMinorFromInput ??
    (netMinorFromInput !== undefined && vatMinorFromInput !== undefined
      ? netMinorFromInput + vatMinorFromInput
      : totalMinor);
  let netMinor =
    netMinorFromInput ??
    (grossMinorFromInput !== undefined && vatMinorFromInput !== undefined
      ? grossMinorFromInput - vatMinorFromInput
      : grossMinor);
  const vatMinor =
    vatMinorFromInput ??
    (grossMinorFromInput !== undefined && netMinorFromInput !== undefined
      ? grossMinorFromInput - netMinorFromInput
      : grossMinor - netMinor);

  // If only legacy total_minor is present, gross is the total and net falls back to gross.
  if (output.net_minor === undefined && output.net === undefined && output.gross_minor === undefined && output.gross === undefined) {
    grossMinor = totalMinor;
    netMinor = totalMinor;
  }

  assertWithinCap("Invoice net", netMinor);
  assertWithinCap("Invoice VAT", vatMinor);
  assertWithinCap("Invoice gross", grossMinor);

  const lineItemSum = roundOnceToMinorUnits(sumAmounts(lineItems.map((item) => item.grossMinor)));

  return {
    vendor: output.vendor.trim(),
    dateInt: toDateInt(output.date),
    totalMinor: grossMinor,
    netMinor,
    vatMinor,
    grossMinor,
    currencyCode,
    lineItems,
    suggestedCategory: output.suggested_category.trim(),
    project: output.project.trim(),
    totalMatchesLineItems: lineItemSum === grossMinor,
    totalsConsistent: netMinor + vatMinor === grossMinor,
  };
}

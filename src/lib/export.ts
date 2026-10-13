import * as XLSX from "xlsx";

import { fromDateInt } from "@/lib/dates";
import { minorUnitsToDecimal } from "@/lib/money";
import type { TransactionRow } from "@/lib/transactions";

export const EXPORT_HEADERS = ["date", "description", "amount", "currency", "category", "project"];

function csvEscape(value: string): string {
  if (/[;"\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function transactionsToCsv(rows: TransactionRow[]): string {
  const lines = [EXPORT_HEADERS.join(";")];
  for (const row of rows) {
    lines.push(
      [
        fromDateInt(row.date),
        row.description,
        minorUnitsToDecimal(row.amount_minor),
        row.currency_code,
        row.category,
        row.project,
      ]
        .map(csvEscape)
        .join(";"),
    );
  }
  return `${lines.join("\n")}\n`;
}

function dateToUtcDate(dateInt: number): Date {
  const year = Math.trunc(dateInt / 10000);
  const month = Math.trunc((dateInt % 10000) / 100);
  const day = dateInt % 100;
  return new Date(Date.UTC(year, month - 1, day));
}

export function transactionsToXlsx(rows: TransactionRow[]): Uint8Array {
  const data: (string | number | Date)[][] = [[...EXPORT_HEADERS]];
  for (const row of rows) {
    data.push([
      dateToUtcDate(row.date),
      row.description,
      row.amount_minor / 100,
      row.currency_code,
      row.category,
      row.project,
    ]);
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(data), "Transactions");
  return new Uint8Array(XLSX.write(workbook, { type: "array", bookType: "xlsx", cellDates: true }) as ArrayBuffer);
}
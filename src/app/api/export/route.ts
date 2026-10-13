import { failureResponse } from "@/lib/diagnostics";
import { transactionsToCsv, transactionsToXlsx } from "@/lib/export";
import { checkStartup } from "@/lib/startup-gate";
import { listTransactions } from "@/lib/transactions";

/**
 * GET /api/export?format=csv|xlsx
 * Exports all transactions: CSV is UTF-8 semicolon-delimited
 * `date;description;amount;currency;category;project`; XLSX uses native date/numeric cells.
 * Response: the file download | { ok: false, message } (400/500/503).
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return Response.json({ ok: false, message: startup.reason }, { status: 503 });
    }

    const format = new URL(request.url).searchParams.get("format") ?? "csv";
    const rows = await listTransactions();

    if (format === "csv") {
      return new Response(transactionsToCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="transactions.csv"',
        },
      });
    }

    if (format === "xlsx") {
      return new Response(transactionsToXlsx(rows), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="transactions.xlsx"',
        },
      });
    }

    return Response.json({ ok: false, message: `Unsupported export format "${format}"` }, { status: 400 });
  } catch (error) {
    const failure = failureResponse("export", error, "Exporting transactions failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}
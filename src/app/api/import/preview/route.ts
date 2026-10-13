import { failureResponse } from "@/lib/diagnostics";
import { parseImportFile } from "@/lib/import-parse";
import { checkStartup } from "@/lib/startup-gate";

/**
 * POST /api/import/preview
 * multipart/form-data with a `file` field (.csv/.xlsx/.xls).
 * Parses the file and returns column headers plus the first 5 data rows for the mapping screen.
 * Response: { ok: true, headers, rows, totalRows } | { ok: false, message } (400/500/503).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const startup = await checkStartup();
    if (!startup.ok) {
      return Response.json({ ok: false, message: startup.reason }, { status: 503 });
    }

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, message: "No file was uploaded." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const parsed = parseImportFile(file.name, bytes);

    return Response.json({
      ok: true,
      headers: parsed.headers,
      rows: parsed.rows.slice(0, 5),
      totalRows: parsed.rows.length,
    });
  } catch (error) {
    const failure = failureResponse("import preview", error, "Reading the import file failed");
    return Response.json({ ok: false, message: failure.message }, { status: failure.status });
  }
}
import { sql } from "drizzle-orm";

import { missingDatabaseEnvVars } from "@/lib/db-config";
import { failureResponse } from "@/lib/diagnostics";

export type StartupStatus = { ok: true } | { ok: false; reason: string };

export async function checkStartup(): Promise<StartupStatus> {
  const missing = missingDatabaseEnvVars();
  if (missing.length > 0) {
    const label = missing.length > 1 ? "variables" : "variable";
    return { ok: false, reason: `Missing required environment ${label}: ${missing.join(", ")}` };
  }

  try {
    const { db } = await import("@/lib/db");
    await db.run(sql`SELECT 1`);
    return { ok: true };
  } catch (error) {
    const failure = failureResponse("startup gate", error, "Database connection check failed");
    return { ok: false, reason: failure.message };
  }
}
import { sql } from "drizzle-orm";

import { failureResponse } from "@/lib/diagnostics";

export type StartupStatus = { ok: true } | { ok: false; reason: string };

const REQUIRED_ENV_VARS = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"] as const;

export async function checkStartup(): Promise<StartupStatus> {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
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
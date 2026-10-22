export type FailureResponse = { message: string; status: number };

const SECRET_ENV_KEYS = [
  "PRIMARY_API_KEY",
  "SECONDARY_API_KEY",
  "APP_ENCRYPTION_KEY",
  "DATABASE_URL",
] as const;

function redactSecrets(text: string): string {
  let redacted = text;
  for (const key of SECRET_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      redacted = redacted.split(value).join("[REDACTED]");
    }
  }
  return redacted.replace(/(bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[REDACTED]");
}

function stripPaths(text: string): string {
  return text
    .replace(/[A-Za-z]:\\[^\s'"]*/g, "[path]")
    .replace(/\\\\[^\s'"]+/g, "[path]")
    .replace(/(^|[\s("'=,])\/(?!\/)[\w.@+-]+(?:\/[\w.@+-]+)+/g, "$1[path]");
}

function specificMessage(error: unknown, fallbackMessage: string): string {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const detail = stripPaths(redactSecrets(raw)).split("\n")[0].trim();
  return detail === "" ? fallbackMessage : detail;
}

export function logFailure(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[${context}]`, {
      name: error.name,
      message: redactSecrets(error.message),
      stack: redactSecrets(error.stack ?? `${error.name}: ${error.message}`),
    });
    return;
  }
  console.error(`[${context}]`, { message: redactSecrets(String(error)) });
}

export function failureResponse(
  context: string,
  error: unknown,
  fallbackMessage: string,
  status = 500,
): FailureResponse {
  logFailure(context, error);
  return { message: specificMessage(error, fallbackMessage), status };
}
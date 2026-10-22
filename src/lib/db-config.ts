export type DatabaseConfig = { url: string; authToken: string };

export type EnvSource = Record<string, string | undefined>;

const DATABASE_URL_KEY = "TURSO_DATABASE_URL";
const AUTH_TOKEN_KEY = "TURSO_AUTH_TOKEN";
const REQUIRED_KEYS = [DATABASE_URL_KEY, AUTH_TOKEN_KEY] as const;

function read(env: EnvSource, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function missingDatabaseEnvVars(env: EnvSource = process.env): string[] {
  return REQUIRED_KEYS.filter((key) => !read(env, key));
}

export function resolveDatabaseConfig(env: EnvSource = process.env): DatabaseConfig {
  const url = read(env, DATABASE_URL_KEY);
  const authToken = read(env, AUTH_TOKEN_KEY);

  if (!url || !authToken) {
    const missing = missingDatabaseEnvVars(env);
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }

  return { url, authToken };
}

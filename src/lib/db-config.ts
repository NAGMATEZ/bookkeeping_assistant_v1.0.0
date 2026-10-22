export type DatabaseConfig = { url: string };

export type EnvSource = Record<string, string | undefined>;

const DATABASE_URL_KEY = "DATABASE_URL";

function read(env: EnvSource, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

export function missingDatabaseEnvVars(env: EnvSource = process.env): string[] {
  return read(env, DATABASE_URL_KEY) ? [] : [DATABASE_URL_KEY];
}

export function resolveDatabaseConfig(env: EnvSource = process.env): DatabaseConfig {
  const url = read(env, DATABASE_URL_KEY);
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set: provide a libSQL/Turso URL with the auth token embedded as ?authToken=...",
    );
  }
  return { url };
}

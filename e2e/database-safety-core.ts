type DatabaseSafetyEnv = {
  DATABASE_URL?: string;
  E2E_DATABASE_URL?: string;
  E2E_ALLOW_DATABASE_WRITES?: string;
};

function databaseIdentity(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const url = new URL(raw);
    if (!url.protocol.startsWith("postgres")) return null;
    // Ignore credentials and query params: rotating a password or changing SSL
    // options must not make the same database look isolated.
    return `${url.hostname.toLowerCase()}:${url.port}${url.pathname}`;
  } catch {
    return null;
  }
}

export function allowsDatabaseWrites(env: DatabaseSafetyEnv): boolean {
  const configured = databaseIdentity(env.DATABASE_URL);
  const isolated = databaseIdentity(env.E2E_DATABASE_URL);
  return env.E2E_ALLOW_DATABASE_WRITES === "1" && Boolean(configured && isolated && configured !== isolated);
}

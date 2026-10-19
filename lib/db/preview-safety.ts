type Env = Record<string, string | undefined>;

export const PREVIEW_DATABASE_NAME = "quilgym_preview";

export function databaseNameFromUrl(url: string) {
  try {
    const name = decodeURIComponent(new URL(url).pathname.slice(1));
    if (!name) throw new Error("missing database name");
    return name;
  } catch {
    throw new Error("DATABASE_URL no es una URL válida.");
  }
}

/** Evita que cualquier deployment Preview use la base principal por un secreto mal asignado. */
export function assertPreviewDatabase(url: string, env: Env) {
  const databaseName = databaseNameFromUrl(url);
  if (env.VERCEL_ENV === "preview" && databaseName !== PREVIEW_DATABASE_NAME) {
    throw new Error("DATABASE_URL de Preview debe apuntar a quilgym_preview.");
  }

  // `next dev` admite escrituras (cuentas, carritos, pedidos y panel). Nunca debe
  // iniciarse contra producción por tener una .env.local antigua o mal copiada.
  if (env.NODE_ENV === "development" && env.VERCEL_ENV !== "preview" && databaseName !== PREVIEW_DATABASE_NAME) {
    throw new Error("El desarrollo local debe usar la base quilgym_preview; se bloqueó el acceso a la base de producción.");
  }
}

/**
 * Los scripts con capacidad de escritura usan Preview sin fricción. Cualquier otra
 * base requiere una confirmación efímera cuyo valor coincida con el nombre de la base.
 * Ejemplo deliberado: CONFIRM_DATABASE_WRITE=neondb npm run db:migrate
 */
export function assertDatabaseWriteAllowed(url: string, env: Env) {
  const databaseName = databaseNameFromUrl(url);
  if (databaseName === PREVIEW_DATABASE_NAME) return databaseName;
  if (env.CONFIRM_DATABASE_WRITE?.trim() === databaseName) return databaseName;
  throw new Error(
    `Escritura bloqueada en ${databaseName}. Para autorizarla deliberadamente, ejecutá el comando con CONFIRM_DATABASE_WRITE=${databaseName}.`,
  );
}

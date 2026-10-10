type Env = Record<string, string | undefined>;

/** Evita que los pedidos de mp-sandbox usen la base principal por un secreto mal asignado. */
export function assertPreviewDatabase(url: string, env: Env) {
  if (env.VERCEL_ENV !== "preview" || env.VERCEL_GIT_COMMIT_REF !== "mp-sandbox") return;

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    throw new Error("DATABASE_URL de mp-sandbox no es una URL válida.");
  }

  if (databaseName !== "quilgym_preview") {
    throw new Error("DATABASE_URL de mp-sandbox debe apuntar a quilgym_preview.");
  }
}

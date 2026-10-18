type Env = Record<string, string | undefined>;

/** Evita que cualquier deployment Preview use la base principal por un secreto mal asignado. */
export function assertPreviewDatabase(url: string, env: Env) {
  if (env.VERCEL_ENV !== "preview") return;

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(new URL(url).pathname.slice(1));
  } catch {
    throw new Error("DATABASE_URL de Preview no es una URL válida.");
  }

  if (databaseName !== "quilgym_preview") {
    throw new Error("DATABASE_URL de Preview debe apuntar a quilgym_preview.");
  }
}

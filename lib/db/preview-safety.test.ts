import { describe, expect, it } from "vitest";
import { assertDatabaseWriteAllowed, assertPreviewDatabase, databaseNameFromUrl } from "./preview-safety";

const env = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "mp-sandbox" };

describe("aislamiento de la base de Preview", () => {
  it("acepta quilgym_preview", () => {
    expect(() => assertPreviewDatabase("postgresql://user:secret@host/quilgym_preview", env)).not.toThrow();
  });

  it("rechaza la base principal y URLs inválidas sin revelar credenciales", () => {
    expect(() => assertPreviewDatabase("postgresql://user:secret@host/neondb", env)).toThrow("debe apuntar a quilgym_preview");
    expect(() => assertPreviewDatabase("no-es-una-url", env)).toThrow("no es una URL válida");
  });

  it("no impone el nombre a Production y sí a cualquier rama de Preview", () => {
    expect(() => assertPreviewDatabase("postgresql://user:secret@host/neondb", { VERCEL_ENV: "production" })).not.toThrow();
    expect(() => assertPreviewDatabase("postgresql://user:secret@host/neondb", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "otra-rama" })).toThrow("debe apuntar a quilgym_preview");
    expect(() => assertPreviewDatabase("postgresql://user:secret@host/quilgym_preview", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "otra-rama" })).not.toThrow();
  });
});

describe("protección local y de scripts", () => {
  const production = "postgresql://user:secret@example.neon.tech/neondb";
  const preview = "postgresql://user:secret@example.neon.tech/quilgym_preview";

  it("extrae el nombre sin exponer credenciales", () => {
    expect(databaseNameFromUrl(preview)).toBe("quilgym_preview");
  });

  it("bloquea next dev contra producción", () => {
    expect(() => assertPreviewDatabase(production, { NODE_ENV: "development" })).toThrow(/desarrollo local/i);
  });

  it("permite next dev contra Preview", () => {
    expect(() => assertPreviewDatabase(preview, { NODE_ENV: "development" })).not.toThrow();
  });

  it("permite scripts sobre Preview sin confirmación", () => {
    expect(assertDatabaseWriteAllowed(preview, {})).toBe("quilgym_preview");
  });

  it("bloquea scripts sobre producción sin confirmación exacta", () => {
    expect(() => assertDatabaseWriteAllowed(production, {})).toThrow(/CONFIRM_DATABASE_WRITE=neondb/);
    expect(() => assertDatabaseWriteAllowed(production, { CONFIRM_DATABASE_WRITE: "otra" })).toThrow();
  });

  it("permite scripts sobre producción con confirmación exacta", () => {
    expect(assertDatabaseWriteAllowed(production, { CONFIRM_DATABASE_WRITE: "neondb" })).toBe("neondb");
  });
});

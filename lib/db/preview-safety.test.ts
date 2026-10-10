import { describe, expect, it } from "vitest";
import { assertPreviewDatabase } from "./preview-safety";

const env = { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "mp-sandbox" };

describe("aislamiento de la base de mp-sandbox", () => {
  it("acepta quilgym_preview", () => {
    expect(() => assertPreviewDatabase("postgresql://user:secret@host/quilgym_preview", env)).not.toThrow();
  });

  it("rechaza la base principal y URLs inválidas sin revelar credenciales", () => {
    expect(() => assertPreviewDatabase("postgresql://user:secret@host/neondb", env)).toThrow("debe apuntar a quilgym_preview");
    expect(() => assertPreviewDatabase("no-es-una-url", env)).toThrow("no es una URL válida");
  });

  it("no impone el nombre de esta base a Production ni a otras ramas", () => {
    expect(() => assertPreviewDatabase("postgresql://user:secret@host/neondb", { VERCEL_ENV: "production" })).not.toThrow();
    expect(() => assertPreviewDatabase("postgresql://user:secret@host/otra_preview", { VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "otra-rama" })).not.toThrow();
  });
});

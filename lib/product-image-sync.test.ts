import { describe, expect, it } from "vitest";
import { describeImageSync, planImageSync, type ManifestImage, type StoredImage } from "./product-image-sync";

const img = (path: string, kind: "product" | "nutrition" = "product"): ManifestImage => ({ path, kind, width: 1200, height: 1200 });
const stored = (url: string, position: number, kind: "product" | "nutrition" = "product"): StoredImage => ({ url, kind, width: 1200, height: 1200, position });

describe("plan de db:sync-images", () => {
  it("reemplaza galerías distintas, quita imágenes de combos y no toca lo que no está en el manifiesto", () => {
    const database = new Map<string, StoredImage[]>([
      ["creatina", [stored("/a/01.webp", 0), stored("/a/02.webp", 1, "nutrition")]],
      ["proteina", [stored("/p/01.webp", 0)]],
      ["combo-arnold", [stored("/c/01.webp", 0)]],
      ["combo-vacio", []],
      ["huerfano", [stored("/h/01.webp", 0)]],
    ]);
    const manifest = { creatina: [img("/a/01.webp"), img("/a/02.webp", "nutrition")], proteina: [img("/p/01.webp"), img("/p/02.webp"), img("/p/03.webp", "nutrition")], nuevo: [img("/n/01.webp")] };
    const plan = planImageSync(database, manifest);
    expect(plan.changes.map((change) => [change.slug, change.reason])).toEqual([["combo-arnold", "combo"], ["proteina", "replace"]]);
    expect(plan.unchanged).toBe(2);
    expect(plan.notInManifest).toEqual(["huerfano"]);
    expect(plan.notInDatabase).toEqual(["nuevo"]);
    const text = describeImageSync(plan);
    expect(text).toContain("+ /p/03.webp (rótulo 1200×1200)");
    expect(text).toContain("combo: se quitan sus imágenes");
  });

  it("detecta cambios de orden o de dimensiones aunque la URL sea la misma", () => {
    const database = new Map([["x", [stored("/x/02.webp", 0), stored("/x/01.webp", 1)]], ["y", [{ ...stored("/y/01.webp", 0), width: 600 }]]]);
    const plan = planImageSync(database, { x: [img("/x/01.webp"), img("/x/02.webp")], y: [img("/y/01.webp")] });
    expect(plan.changes.map((change) => change.slug)).toEqual(["x", "y"]);
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: {} }));

import { ADMIN_PAGE_SIZE, queryAdminCatalog, validateProductInput, type AdminProductInput } from "./admin-catalog";

const now = new Date("2026-10-09T12:00:00Z");
const row = (id: number, overrides: Partial<{
  name: string; brand: string | null; brandId: number | null; categoryId: number; category: string;
  slug: string; sku: string | null; status: "active" | "draft" | "archived";
  priceArs: number | null; stock: number | null; updatedAt: Date;
}> = {}) => ({
  name: `Producto ${String(id).padStart(2, "0")}`, brand: "STAR", brandId: 1, categoryId: 1,
  category: "Creatinas", slug: `producto-${id}`, sku: `SKU-${id}`, status: "active" as const,
  priceArs: 1000 + id, stock: id, updatedAt: now, ...overrides,
});

describe("admin de catálogo (sin base de datos)", () => {
  it("filtra por marca, categoría y términos; ordena y pagina sin duplicados", () => {
    const rows = Array.from({ length: ADMIN_PAGE_SIZE + 2 }, (_, index) => row(index + 1));
    rows.push(row(99, { name: "Proteína ENA", brand: "ENA", brandId: 2, categoryId: 2, category: "Proteínas", slug: "proteina-ena", sku: "ENA-99" }));
    const first = queryAdminCatalog(rows, { orden: "precio-desc", pagina: "1" });
    expect(first.total).toBe(ADMIN_PAGE_SIZE + 3);
    expect(first.pages).toBe(2);
    expect(first.items).toHaveLength(ADMIN_PAGE_SIZE);
    expect(first.items[0].slug).toBe("proteina-ena");
    const second = queryAdminCatalog(rows, { orden: "precio-desc", pagina: "2" });
    expect(second.items).toHaveLength(3);
    expect(new Set([...first.items, ...second.items].map((item) => item.slug)).size).toBe(rows.length);
    const filtered = queryAdminCatalog(rows, { marca: "2", categoria: "2", q: "proteina ena" });
    expect(filtered.items.map((item) => item.slug)).toEqual(["proteina-ena"]);
  });

  it("rechaza variantes ajenas o repetidas dentro del formulario", () => {
    const input: AdminProductInput = {
      name: "Producto test", brandId: 1, categoryId: 1, description: "", status: "active", isFeatured: false,
      variants: [
        { id: 1, sku: "DUP-1", label: "300 g", priceArs: 1000, compareAtPriceArs: null, stock: 2 },
        { id: 2, sku: "dup-1", label: "500 g", priceArs: 2000, compareAtPriceArs: null, stock: 3 },
      ],
      defaultIndex: 0, removedVariantIds: [1],
      images: [{ url: "/assets/products/test/01.webp", kind: "product", width: 1200, height: 1200 }],
    };
    const errors = validateProductInput(input);
    expect(errors["variants.0.sku"]).toContain("quitarse y editarse");
    expect(errors["variants.1.sku"]).toContain("Repite el SKU");
  });
});

import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./db/schema";

const mocks = vi.hoisted(() => ({ transaction: vi.fn(), db: {} as Record<string, unknown>, admin: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./db/transaction", () => ({ withOrderTransaction: mocks.transaction }));
vi.mock("./admin-auth", () => ({ getAdminUser: mocks.admin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), updateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));
vi.mock("@vercel/blob", () => ({ del: vi.fn() }));
import { getAdminProduct, validateProductInput, validateShippingInput, type AdminProductInput, type AdminShippingInput } from "./admin-catalog";
import { saveAdminProduct } from "./admin-actions";

const pg = new PGlite();
const database = drizzle(pg, { schema });
beforeAll(async () => {
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  mocks.transaction.mockImplementation((fn) => database.transaction(fn));
  Object.assign(mocks.db, { select: database.select.bind(database), selectDistinct: database.selectDistinct.bind(database), execute: database.execute.bind(database) });
}, 30000);
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  mocks.admin.mockResolvedValue({ id: "admin", email: "admin@example.com" });
  await database.execute(sql`truncate brands, categories, products, product_variants restart identity cascade`);
});

const empty: AdminShippingInput = { weightGrams: null, lengthCm: null, widthCm: null, heightCm: null };
const input = (categoryId: number, shipping?: AdminShippingInput, extra: Partial<AdminProductInput> = {}): AdminProductInput => ({
  name: "Creatina de prueba", brandId: null, categoryId, description: "", status: "draft", isFeatured: false, defaultIndex: 0, removedVariantIds: [], images: [],
  variants: [{ sku: "SHIP-1", label: "300 g", priceArs: 1000, compareAtPriceArs: null, stock: null, ...(shipping ? { shipping } : {}) }], ...extra,
});

describe("validación de peso y medidas", () => {
  const key = (field: string) => `variants.0.${field}`;
  it("acepta vacío, ausente y enteros dentro de los límites", () => {
    expect(validateShippingInput(undefined, key)).toEqual({});
    expect(validateShippingInput(empty, key)).toEqual({});
    expect(validateShippingInput({ weightGrams: 100_000, lengthCm: 200, widthCm: 1, heightCm: 15 }, key)).toEqual({});
  });
  it("rechaza ceros, negativos, decimales, textos y valores fuera de rango, indicando el campo", () => {
    const errors = validateShippingInput({ weightGrams: 0, lengthCm: 200.5, widthCm: 201, heightCm: -3 } as AdminShippingInput, key);
    expect(Object.keys(errors).sort()).toEqual(["variants.0.heightCm", "variants.0.lengthCm", "variants.0.weightGrams", "variants.0.widthCm"]);
    expect(validateShippingInput({ ...empty, weightGrams: 100_001 }, key)).toHaveProperty("variants.0.weightGrams");
    expect(validateShippingInput({ ...empty, heightCm: "12" as unknown as number }, key)).toHaveProperty("variants.0.heightCm");
    expect(validateShippingInput("x", key)).not.toEqual({});
  });
  it("se integra a la validación del producto", () => {
    const errors = validateProductInput(input(1, { ...empty, weightGrams: -1 }));
    expect(errors["variants.0.weightGrams"]).toBeTruthy();
    expect(validateProductInput(input(1, { ...empty, weightGrams: 500 }))).toEqual({});
  });
});

describe("guardado en variant_shipping (PGlite con la migración 0010)", () => {
  async function category() { const [row] = await database.insert(schema.categories).values({ slug: "creatinas", name: "Creatinas" }).returning(); return row.id; }
  const shippingRows = () => database.select().from(schema.variantShipping);

  it("crea, actualiza y borra la fila; ausente no toca lo guardado", async () => {
    const categoryId = await category();
    const created = await saveAdminProduct(input(categoryId, { weightGrams: 450, lengthCm: 15, widthCm: 12, heightCm: 12 }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    let rows = await shippingRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ weightGrams: 450, lengthCm: 15, widthCm: 12, heightCm: 12 });

    const entry = await getAdminProduct(created.id);
    expect(entry?.shippingAvailable).toBe(true);
    expect(entry?.variants[0].shipping).toEqual({ weightGrams: 450, lengthCm: 15, widthCm: 12, heightCm: 12 });
    const variantId = entry!.variants[0].id;
    const edit = (shipping?: AdminShippingInput) => input(categoryId, undefined, { id: created.id, variants: [{ id: variantId, sku: "SHIP-1", label: "300 g", priceArs: 1000, compareAtPriceArs: null, stock: null, ...(shipping ? { shipping } : {}) }] });

    expect((await saveAdminProduct(edit({ weightGrams: 600, lengthCm: null, widthCm: null, heightCm: null }))).ok).toBe(true);
    rows = await shippingRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ weightGrams: 600, lengthCm: null });

    expect((await saveAdminProduct(edit())).ok).toBe(true);
    expect(await shippingRows()).toHaveLength(1);

    expect((await saveAdminProduct(edit(empty))).ok).toBe(true);
    expect(await shippingRows()).toHaveLength(0);
    expect((await getAdminProduct(created.id))?.variants[0].shipping).toBeNull();
  });

  it("un valor inválido no guarda nada y devuelve el campo", async () => {
    const categoryId = await category();
    const result = await saveAdminProduct(input(categoryId, { ...empty, weightGrams: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fields).toHaveProperty("variants.0.weightGrams");
    expect(await database.select().from(schema.products)).toHaveLength(0);
  });

  it("sin la tabla (migración 0010 sin aplicar) guarda el producto y la sección queda deshabilitada", async () => {
    const categoryId = await category();
    await database.execute(sql`drop table variant_shipping`);
    const result = await saveAdminProduct(input(categoryId, { weightGrams: 500, lengthCm: null, widthCm: null, heightCm: null }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = await getAdminProduct(result.id);
    expect(entry?.shippingAvailable).toBe(false);
    expect(entry?.variants[0].shipping).toBeNull();
    expect((await database.select().from(schema.productVariants).where(eq(schema.productVariants.productId, result.id)))).toHaveLength(1);
  });
});

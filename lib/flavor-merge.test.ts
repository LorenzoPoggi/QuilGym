/** Unión de sabores contra Postgres en memoria (PGlite): las variantes se mueven, no se recrean. */
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "./db/schema";
import { applyFlavorGroup, flavorRedirects, validateFlavorData, type FlavorData, type FlavorGroup } from "./flavor-merge";

const pg = new PGlite();
const db = drizzle(pg, { schema });

const group: FlavorGroup = {
  slug: "creatina-doypack", mergeFrom: ["creatina-uva"], option: "Sabor",
  variants: [
    { key: "sin-sabor", label: "Sin sabor", fromSlug: "creatina-doypack", sold: true },
    { key: "uva", label: "Uva", fromSlug: "creatina-uva", sold: true },
    { key: "limon", label: "Limón", sold: false },
  ],
};

beforeAll(async () => {
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) await pg.exec(readFileSync(`drizzle/${file}`, "utf8"));
  const [category] = await db.insert(schema.categories).values({ slug: "creatinas", name: "Creatinas", position: 1 }).returning();
  const make = async (slug: string, sku: string) => {
    const [product] = await db.insert(schema.products).values({ slug, name: slug, categoryId: category.id, status: "active", isFeatured: true }).returning();
    const [variant] = await db.insert(schema.productVariants).values({ productId: product.id, sku, priceArs: 30990, stock: null, isDefault: true }).returning();
    return { product, variant };
  };
  const a = await make("creatina-doypack", "QG-0001");
  const b = await make("creatina-uva", "QG-0002");
  await db.insert(schema.users).values({ id: "u1", name: "Cliente", email: "c@example.com", emailVerified: false });
  await db.insert(schema.favorites).values([{ userId: "u1", productId: a.product.id }, { userId: "u1", productId: b.product.id }]);
  const [cart] = await db.insert(schema.carts).values({}).returning();
  await db.insert(schema.cartItems).values({ cartId: cart.id, variantId: b.variant.id, quantity: 2, seenPriceArs: 30990 });
}, 30000);
afterAll(async () => { await pg.close(); });

describe("unión de sabores", () => {
  it("mueve la variante del producto viejo (conserva su id y su carrito), crea los sabores nuevos con stock 0 y archiva el viejo", async () => {
    const [oldVariant] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.sku, "QG-0002"));
    const result = await applyFlavorGroup(db, group);
    expect(result).toMatchObject({ moved: ["uva"], created: ["limon"], relabeled: ["sin-sabor"], archived: ["creatina-uva"] });

    const [target] = await db.select().from(schema.products).where(eq(schema.products.slug, "creatina-doypack"));
    const variants = await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, target.id)).orderBy(schema.productVariants.position);
    expect(variants.map((v) => [v.label, v.stock, v.isDefault])).toEqual([["Sin sabor", null, true], ["Uva", null, false], ["Limón", 0, false]]);
    expect(variants[1].id).toBe(oldVariant.id);
    expect(variants[2].priceArs).toBe(30990);
    expect(variants[2].sku).toBe("QG-0001-LIMON");

    const [old] = await db.select().from(schema.products).where(eq(schema.products.slug, "creatina-uva"));
    expect(old.status).toBe("archived");
    const cartItems = await db.select().from(schema.cartItems);
    expect(cartItems.map((item) => item.variantId)).toEqual([oldVariant.id]);
    expect(await db.select().from(schema.favorites).where(eq(schema.favorites.productId, target.id))).toHaveLength(1);
    expect(await db.select().from(schema.favorites).where(eq(schema.favorites.productId, old.id))).toHaveLength(0);
  });

  it("es idempotente: una segunda corrida no duplica nada", async () => {
    const again = await applyFlavorGroup(db, group);
    expect(again).toMatchObject({ moved: [], created: [], relabeled: [] });
    const [target] = await db.select().from(schema.products).where(eq(schema.products.slug, "creatina-doypack"));
    expect(await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, target.id))).toHaveLength(3);
  });

  it("falla si falta el producto destino", async () => {
    await expect(applyFlavorGroup(db, { ...group, slug: "no-existe" })).rejects.toThrow("Producto destino inexistente");
  });
});

describe("validación y redirecciones", () => {
  const data: FlavorData = { groups: [group] };
  it("valida claves y orígenes, y genera redirecciones solo de productos unidos", () => {
    expect(validateFlavorData(data)).toEqual([]);
    expect(flavorRedirects(data)).toEqual([{ from: "creatina-uva", to: "creatina-doypack?sabor=uva" }]);
    expect(validateFlavorData({ groups: [{ ...group, variants: [{ key: "x", label: "Uva", sold: true }, group.variants[0]] }] }).join(" ")).toContain("no coincide");
    expect(validateFlavorData({ groups: [{ ...group, variants: [group.variants[0]] }] }).join(" ")).toContain("al menos 2");
  });
});

describe("data/product-variants.json", () => {
  it("es válido y solo menciona productos del catálogo", async () => {
    const [{ default: variantData }, { default: catalog }] = await Promise.all([import("../data/product-variants.json"), import("../data/tiendanube-catalog.json")]);
    const data = variantData as unknown as FlavorData;
    expect(validateFlavorData(data)).toEqual([]);
    const slugs = new Set(catalog.products.map((product) => product.siteSlug));
    for (const item of data.groups) for (const slug of [item.slug, ...(item.mergeFrom ?? [])]) expect(slugs.has(slug), slug).toBe(true);
  });
});

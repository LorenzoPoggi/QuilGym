/**
 * Unión de productos duplicados por sabor en una sola ficha con variantes (`npm run db:merge-flavors`).
 * Sin `server-only` para usarlo desde el script y los tests. Recibe una base o transacción de Drizzle.
 *
 * Las filas de `product_variants` existentes se MUEVEN al producto destino (no se recrean): así
 * conservan carritos, pedidos, costos y envíos. Los sabores nuevos se crean con stock 0 si el negocio
 * nunca los vendió (el dueño los habilita desde el panel) y sin control de inventario si ya se vendían.
 */
import { eq, inArray, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { favorites, productVariants, products } from "./db/schema";
import type * as schema from "./db/schema";
import { flavorKey } from "./flavors";

export type FlavorVariantSpec = {
  /** Clave estable (`frutos-rojos`); se usa en `?sabor=` y en el manifiesto de fotos (`slug#clave`). */
  key: string;
  label: string;
  /** Slug del producto existente cuya variante por defecto pasa a ser este sabor. */
  fromSlug?: string;
  /** true = el negocio ya lo vendía (sin control de stock); false = stock 0 hasta que lo habiliten. */
  sold: boolean;
  sourcePage?: string;
};

export type FlavorGroup = {
  /** Producto destino: la ficha que se conserva. */
  slug: string;
  /** Productos que se archivan (sus variantes pasan al destino). */
  mergeFrom?: string[];
  option: "Sabor";
  variants: FlavorVariantSpec[];
  sourcePage?: string;
  note?: string;
  /** Nombre nuevo de la ficha (p. ej. «Barritas Mervick 65 g» sin el sabor). */
  name?: string;
};

export type FlavorData = { groups: FlavorGroup[] };

export type FlavorMergeResult = { slug: string; moved: string[]; created: string[]; relabeled: string[]; archived: string[]; skipped: string[] };

type Db<Q extends PgQueryResultHKT> = PgDatabase<Q, typeof schema>;

export function validateFlavorData(data: FlavorData) {
  const problems: string[] = [];
  const targets = new Set<string>();
  const merged = new Set<string>();
  for (const group of data.groups) {
    if (targets.has(group.slug)) problems.push(`${group.slug}: grupo repetido`);
    targets.add(group.slug);
    const keys = new Set<string>();
    for (const variant of group.variants) {
      if (variant.key !== flavorKey(variant.label)) problems.push(`${group.slug}: la clave «${variant.key}» no coincide con «${variant.label}» (${flavorKey(variant.label)})`);
      if (keys.has(variant.key)) problems.push(`${group.slug}: sabor repetido «${variant.key}»`);
      keys.add(variant.key);
      if (variant.fromSlug && variant.fromSlug !== group.slug && !(group.mergeFrom ?? []).includes(variant.fromSlug)) problems.push(`${group.slug}: fromSlug ${variant.fromSlug} no está en mergeFrom`);
    }
    for (const slug of group.mergeFrom ?? []) {
      if (merged.has(slug)) problems.push(`${slug}: está en más de un grupo`);
      merged.add(slug);
      if (!group.variants.some((variant) => variant.fromSlug === slug)) problems.push(`${group.slug}: ${slug} está en mergeFrom pero ningún sabor sale de él`);
    }
    if (group.variants.length < 2) problems.push(`${group.slug}: un grupo necesita al menos 2 sabores`);
    if (group.variants.filter((variant) => variant.fromSlug === group.slug).length !== 1) problems.push(`${group.slug}: exactamente un sabor debe salir del propio producto (fromSlug = slug)`);
  }
  for (const slug of merged) if (targets.has(slug)) problems.push(`${slug}: es destino y origen a la vez`);
  return problems;
}

/** Slug viejo → destino con `?sabor=`. Sirve para las redirecciones permanentes. */
export function flavorRedirects(data: FlavorData) {
  const redirects: { from: string; to: string }[] = [];
  for (const group of data.groups) {
    for (const variant of group.variants) {
      if (variant.fromSlug && variant.fromSlug !== group.slug) redirects.push({ from: variant.fromSlug, to: `${group.slug}?sabor=${variant.key}` });
    }
  }
  return redirects;
}

export async function applyFlavorGroup<Q extends PgQueryResultHKT>(db: Db<Q>, group: FlavorGroup): Promise<FlavorMergeResult> {
  const result: FlavorMergeResult = { slug: group.slug, moved: [], created: [], relabeled: [], archived: [], skipped: [] };
  const slugs = [group.slug, ...(group.mergeFrom ?? [])];
  const found = await db.select({ id: products.id, slug: products.slug, status: products.status }).from(products).where(inArray(products.slug, slugs));
  const bySlug = new Map(found.map((row) => [row.slug, row]));
  const target = bySlug.get(group.slug);
  if (!target) throw new Error(`Producto destino inexistente: ${group.slug}`);
  for (const slug of group.mergeFrom ?? []) if (!bySlug.has(slug)) throw new Error(`Producto a unir inexistente: ${slug}`);

  const variantsOf = async (productId: number) => db.select().from(productVariants).where(eq(productVariants.productId, productId)).orderBy(productVariants.position, productVariants.id);
  const targetVariants = await variantsOf(target.id);
  const targetDefault = targetVariants.find((variant) => variant.isDefault) ?? targetVariants[0];
  if (!targetDefault) throw new Error(`${group.slug} no tiene variantes`);
  const labelKeys = new Map(targetVariants.filter((variant) => variant.label).map((variant) => [flavorKey(variant.label!), variant]));

  for (const [position, spec] of group.variants.entries()) {
    const existing = labelKeys.get(spec.key);
    if (existing) {
      if (existing.position !== position) await db.update(productVariants).set({ position }).where(eq(productVariants.id, existing.id));
      result.skipped.push(spec.key);
      continue;
    }
    if (spec.fromSlug === group.slug) {
      await db.update(productVariants).set({ label: spec.label, position }).where(eq(productVariants.id, targetDefault.id));
      labelKeys.set(spec.key, { ...targetDefault, label: spec.label });
      result.relabeled.push(spec.key);
      continue;
    }
    if (spec.fromSlug) {
      const origin = bySlug.get(spec.fromSlug)!;
      const originVariants = await variantsOf(origin.id);
      const source = originVariants.find((variant) => variant.isDefault) ?? originVariants[0];
      if (!source) throw new Error(`${spec.fromSlug} no tiene variantes para mover`);
      await db.update(productVariants).set({ productId: target.id, isDefault: false, label: spec.label, position }).where(eq(productVariants.id, source.id));
      result.moved.push(spec.key);
      continue;
    }
    const sku = `QG-${String(target.id).padStart(4, "0")}-${spec.key.toUpperCase().replace(/[^A-Z0-9]+/g, "")}`.slice(0, 40);
    await db.insert(productVariants).values({
      productId: target.id, sku, label: spec.label, priceArs: targetDefault.priceArs, compareAtPriceArs: targetDefault.compareAtPriceArs,
      stock: spec.sold ? null : 0, isDefault: false, position,
    }).onConflictDoNothing({ target: productVariants.sku });
    result.created.push(spec.key);
  }

  if (group.name) await db.update(products).set({ name: group.name }).where(eq(products.id, target.id));

  for (const slug of group.mergeFrom ?? []) {
    const origin = bySlug.get(slug)!;
    // Favoritos: pasan al destino (los repetidos se ignoran) y los viejos se borran.
    await db.execute(sql`insert into favorites (user_id, product_id) select user_id, ${target.id} from favorites where product_id = ${origin.id} on conflict do nothing`);
    await db.delete(favorites).where(eq(favorites.productId, origin.id));
    if (origin.status !== "archived") await db.update(products).set({ status: "archived", isFeatured: false }).where(eq(products.id, origin.id));
    result.archived.push(slug);
  }
  return result;
}

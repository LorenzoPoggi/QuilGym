import type { ProductSummary } from "./catalog-types";
import { normalizeText } from "./slugify";

/** Reglas puras del comparador: selección en la URL (`/comparar?p=a,b,c`), enlaces y datos derivados del nombre. */
export const MAX_COMPARE = 3;
export const PICKER_ANCHOR = "elegir-productos";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** `null` = sin parámetro (se muestra el ejemplo); `[]` = selección vacía. Descarta slugs malformados y repetidos. */
export function parseCompareParam(raw: string | string[] | undefined): string[] | null {
  const value = first(raw);
  if (value === undefined) return null;
  const slugs = value.toLowerCase().split(",").map((slug) => slug.trim()).filter((slug) => slug.length <= 120 && SLUG.test(slug));
  return [...new Set(slugs)].slice(0, MAX_COMPARE * 4);
}

/** Resuelve los slugs contra el catálogo activo en el orden pedido; ignora los inexistentes y corta en el máximo. */
export function selectCompared<T extends { slug: string }>(slugs: string[], catalog: T[]): T[] {
  const bySlug = new Map(catalog.map((product) => [product.slug, product]));
  return slugs.flatMap((slug) => bySlug.get(slug) ?? []).slice(0, MAX_COMPARE);
}

export type CompareLink = { slugs: string[]; categoria?: string; q?: string; cambiar?: string; todos?: boolean; hash?: string };

export function compareHref({ slugs, categoria, q, cambiar, todos, hash }: CompareLink) {
  const query = [`p=${slugs.join(",")}`];
  if (cambiar) query.push(`cambiar=${cambiar}`);
  if (categoria) query.push(`categoria=${encodeURIComponent(categoria)}`);
  if (q) query.push(`q=${encodeURIComponent(q)}`);
  if (todos) query.push("ver=todos");
  return `/comparar?${query.join("&")}${hash ? `#${hash}` : ""}`;
}

export const withAdded = (slugs: string[], slug: string) => slugs.includes(slug) || slugs.length >= MAX_COMPARE ? slugs : [...slugs, slug];
export const withRemoved = (slugs: string[], slug: string) => slugs.filter((item) => item !== slug);
export const withReplaced = (slugs: string[], previous: string, next: string) => slugs.includes(next) ? slugs : slugs.map((item) => item === previous ? next : item);

/** Productos para agregar: sin los ya elegidos, filtrados por categoría y texto, en el orden recibido (relevancia). */
export function pickerCandidates(catalog: ProductSummary[], selected: string[], categoria?: string, q?: string) {
  const tokens = q ? normalizeText(q).split(/\s+/).filter(Boolean) : [];
  return catalog.filter((product) => !selected.includes(product.slug) && (!categoria || product.category.slug === categoria) &&
    tokens.every((token) => normalizeText(`${product.name} ${product.brand?.name ?? ""} ${product.category.name}`).includes(token)));
}

// Combos, snacks y accesorios: el peso o la capacidad del nombre no describe el contenido que se paga (unidades, cajas o envases).
const WITHOUT_NET_WEIGHT = new Set(["combos", "snacks", "accesorios"]);
const GRAMS_PER_LB = 453.59237;

/** Peso neto que figura en el nombre del producto («300 g», «1,5 kg», «2 lb»). No se estima nada que el nombre no diga. */
export function netWeight(name: string, categorySlug: string): { grams: number; label: string } | null {
  if (WITHOUT_NET_WEIGHT.has(categorySlug)) return null;
  const match = normalizeText(name).match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*(kg|gr|g|lbs|lb)(?=\s|$)/);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = match[2];
  const shown = match[1].replace(".", ",");
  if (unit === "kg") return { grams: amount * 1000, label: `${shown} kg` };
  if (unit === "lb" || unit === "lbs") return { grams: amount * GRAMS_PER_LB, label: `${shown} lb (${Math.round(amount * GRAMS_PER_LB)} g)` };
  return { grams: amount, label: `${shown} g` };
}

export const pricePer100g = (priceArs: number, grams: number) => Math.round((priceArs * 100) / grams);

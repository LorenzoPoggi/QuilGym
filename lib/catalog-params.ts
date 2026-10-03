import { priceRanges, type CatalogQuery, type CatalogSort } from "./catalog-types";

export type RawSearchParams = Record<string, string | string[] | undefined>;

const sorts: CatalogSort[] = ["relevancia", "menor-precio", "mayor-precio", "nombre"];
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;

export function parseCatalogParams(params: RawSearchParams): CatalogQuery {
  const sort = first(params.orden) as CatalogSort | undefined;
  const price = first(params.precio);
  const page = Number.parseInt(first(params.pagina) ?? "1", 10);
  return {
    category: first(params.categoria),
    brands: (first(params.marca) ?? "").split(",").filter(Boolean),
    price: priceRanges.some((range) => range.slug === price) ? price : undefined,
    inStockOnly: first(params.stock) === "1",
    q: first(params.q)?.slice(0, 80),
    sort: sort && sorts.includes(sort) ? sort : "relevancia",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Arma la URL del catálogo; cualquier cambio de filtro vuelve a la página 1. */
export function catalogHref(query: CatalogQuery, changes: Partial<CatalogQuery> = {}) {
  const next = { ...query, page: 1, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("categoria", next.category);
  if (next.brands.length) params.set("marca", next.brands.join(","));
  if (next.price) params.set("precio", next.price);
  if (next.inStockOnly) params.set("stock", "1");
  if (next.sort !== "relevancia") params.set("orden", next.sort);
  if (next.page > 1) params.set("pagina", String(next.page));
  const search = params.toString();
  return search ? `/productos?${search}` : "/productos";
}

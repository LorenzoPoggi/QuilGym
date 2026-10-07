/** Contratos serializables del catálogo, seguros para Client Components. */

export type CategoryRef = { slug: string; name: string };
export type BrandRef = { slug: string; name: string };

export type ProductSummary = {
  id: number;
  /** Variante por defecto: la que agregan las tarjetas al carrito. */
  variantId: number;
  slug: string;
  name: string;
  brand: BrandRef | null;
  category: CategoryRef;
  priceArs: number;
  compareAtPriceArs: number | null;
  inStock: boolean;
  imageUrl: string | null;
  /** Hasta 4 fotos de producto (sin rótulos) para el carrusel de la tarjeta; la primera es `imageUrl`. */
  photoUrls: string[];
};

export type ProductImage = { url: string; kind: "product" | "nutrition"; width: number; height: number };

export type ProductDetail = ProductSummary & {
  description: string | null;
  images: ProductImage[];
  variants: { id: number; sku: string; label: string | null; priceArs: number; inStock: boolean; maxQuantity: number }[];
};

export type CatalogSort = "relevancia" | "menor-precio" | "mayor-precio" | "nombre";

export type PriceRange = { slug: string; label: string; min?: number; max?: number };

export const priceRanges: PriceRange[] = [
  { slug: "hasta-20000", label: "Hasta $20.000", max: 20000 },
  { slug: "20000-50000", label: "$20.000 – $50.000", min: 20000, max: 50000 },
  { slug: "50000-100000", label: "$50.000 – $100.000", min: 50000, max: 100000 },
  { slug: "mas-de-100000", label: "Más de $100.000", min: 100000 },
];

export type CatalogQuery = {
  category?: string;
  brands: string[];
  price?: string;
  inStockOnly: boolean;
  q?: string;
  sort: CatalogSort;
  page: number;
};

export type Facet = { slug: string; name: string; count: number };

export type CatalogResult = {
  products: ProductSummary[];
  total: number;
  page: number;
  pageCount: number;
  categories: Facet[];
  brands: Facet[];
};

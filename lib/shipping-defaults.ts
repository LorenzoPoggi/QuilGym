/**
 * Peso y medidas por defecto para cotizar con el transportista cuando la variante no tiene datos propios
 * en `variant_shipping` (migración 0010). Son estimaciones conservadoras del envase más común de cada
 * categoría, con el embalaje incluido: conviene cargar los valores reales desde el panel cuando existan.
 */
export type Parcel = { weightGrams: number; lengthCm: number; widthCm: number; heightCm: number };

const byCategory: Record<string, Parcel> = {
  proteinas: { weightGrams: 1_200, lengthCm: 25, widthCm: 15, heightCm: 15 },
  creatinas: { weightGrams: 450, lengthCm: 15, widthCm: 12, heightCm: 12 },
  "ganadores-de-peso": { weightGrams: 3_300, lengthCm: 30, widthCm: 22, heightCm: 22 },
  "vitaminas-y-minerales": { weightGrams: 250, lengthCm: 12, widthCm: 8, heightCm: 8 },
  combos: { weightGrams: 2_000, lengthCm: 30, widthCm: 25, heightCm: 20 },
  snacks: { weightGrams: 400, lengthCm: 20, widthCm: 15, heightCm: 8 },
  accesorios: { weightGrams: 350, lengthCm: 25, widthCm: 12, heightCm: 12 },
  colageno: { weightGrams: 450, lengthCm: 15, widthCm: 12, heightCm: 12 },
  "pre-entrenos": { weightGrams: 450, lengthCm: 15, widthCm: 12, heightCm: 12 },
  aminoacidos: { weightGrams: 400, lengthCm: 15, widthCm: 12, heightCm: 12 },
};

export const FALLBACK_PARCEL: Parcel = { weightGrams: 1_000, lengthCm: 25, widthCm: 20, heightCm: 15 };

export function defaultParcelFor(categorySlug: string | null | undefined): Parcel {
  return (categorySlug && byCategory[categorySlug]) || FALLBACK_PARCEL;
}

/**
 * Un solo bulto para todo el pedido: suma pesos y apila los volúmenes en una caja de base máxima.
 * Aproximación simple (los transportistas cobran por el mayor entre peso real y volumétrico).
 */
export function combineParcels(items: { parcel: Parcel; quantity: number }[]): Parcel {
  const units = items.flatMap(({ parcel, quantity }) => Array.from({ length: Math.max(0, Math.min(quantity, 50)) }, () => parcel));
  if (!units.length) return FALLBACK_PARCEL;
  const lengthCm = Math.max(...units.map((unit) => unit.lengthCm));
  const widthCm = Math.max(...units.map((unit) => unit.widthCm));
  const volume = units.reduce((sum, unit) => sum + unit.lengthCm * unit.widthCm * unit.heightCm, 0);
  return {
    weightGrams: units.reduce((sum, unit) => sum + unit.weightGrams, 0),
    lengthCm, widthCm, heightCm: Math.max(...units.map((unit) => unit.heightCm), Math.ceil(volume / (lengthCm * widthCm))),
  };
}

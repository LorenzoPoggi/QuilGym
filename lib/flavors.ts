import { slugify } from "./slugify";

/** Clave estable de un sabor para la URL (`?sabor=frutos-rojos`). */
export const flavorKey = (label: string) => slugify(label);

/** Variante cuyo sabor coincide con la clave de la URL, o `undefined`. */
export function findFlavor<T extends { label: string | null }>(variants: T[], key: string | null | undefined) {
  if (!key) return undefined;
  return variants.find((variant) => variant.label && flavorKey(variant.label) === key);
}

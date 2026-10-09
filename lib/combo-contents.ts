import imageManifest from "../data/product-images.json";

/**
 * Qué trae cada combo, según la sección «## Qué incluye» de data/product-content.json,
 * con los `siteSlug` de data/tiendanube-catalog.json de cada producto incluido.
 *
 * Lo usan la vitrina de la home y la ficha de cada combo: arman la imagen del combo con las
 * fotos limpias de cada producto (components/combo-showcase.tsx). El envase de cada slot sigue la foto del combo de la tienda anterior
 * (por ejemplo, la creatina STAR va en pote, no en doypack). Los sabores se eligen al
 * comprar, así que las etiquetas no nombran ninguno.
 */
export type ComboItem = { slug: string; label: string; quantity?: number };

export const comboContents: Record<string, ComboItem[]> = {
  "combo-classic": [
    { slug: "proteina-star-2lb", label: "Proteína STAR 2 lb" },
    { slug: "creatina-star-300gr-clasica", label: "Creatina STAR 300 g" },
  ],
  "combo-arnold": [
    { slug: "pre-entreno-star-nutricion", label: "Pre-entreno PUMP V8 285 g" },
    { slug: "creatina-star-300gr-clasica", label: "Creatina STAR 300 g" },
  ],
  "combo-body-advance": [
    { slug: "proteina-body-advance-1kg", label: "Proteína Body Advance 910 g" },
    { slug: "creatina-body-advance-300-gr", label: "Creatina Body Advance 300 g" },
  ],
  "combo-gold-nutrition": [
    { slug: "proteina-gold-nutrition-2lb", label: "Proteína GOLD 2 lb" },
    { slug: "creatina-gold-300-gr", label: "Creatina GOLD 300 g" },
  ],
  "combo-dino": [
    { slug: "proteina-star-2lb", label: "Proteína STAR 2 lb", quantity: 2 },
  ],
  "combo-one-fit": [
    { slug: "proteina-one-fit-2lb", label: "Proteína One Fit 2 lb" },
    { slug: "creatina-one-fit-200-gr", label: "Creatina One Fit 200 g" },
  ],
  "combo-laid": [
    { slug: "citrato-de-magnesio-body-500g", label: "Citrato de magnesio Body Advance 500 g" },
    { slug: "omega-3-star-nutrition", label: "Omega 3 STAR" },
  ],
  "combo-mentzer": [
    { slug: "creatina-star-300gr-clasica", label: "Creatina STAR 300 g" },
    { slug: "pancakes-proteicos-granger-vainilla", label: "Pancakes proteicos Granger 450 g" },
  ],
  "combo-popeye": [
    { slug: "proteina-star-2lb", label: "Proteína STAR 2 lb" },
    { slug: "mutant-mass-1-5-kg", label: "Mutant Mass 1,5 kg" },
  ],
};

type ManifestImage = { path: string; kind: string };
const manifest = imageManifest as Record<string, ManifestImage[] | undefined>;

export type ComboPart = { slug: string; label: string; quantity: number; photoUrl: string };

/**
 * Productos del combo con su foto principal, o `null` si el combo no está mapeado o falta
 * alguna foto: en ese caso la tarjeta y la ficha usan la foto propia del combo.
 * Se resuelve contra el manifiesto de imágenes (no contra el disco) para que funcione igual
 * en el build y en las revalidaciones de Vercel.
 */
export function comboParts(comboSlug: string): ComboPart[] | null {
  const items = comboContents[comboSlug];
  if (!items?.length) return null;
  const parts: ComboPart[] = [];
  for (const item of items) {
    const photo = manifest[item.slug]?.find((image) => image.kind === "product");
    if (!photo) return null;
    parts.push({ slug: item.slug, label: item.label, quantity: item.quantity ?? 1, photoUrl: photo.path });
  }
  return parts;
}

/** Cantidad total de unidades del combo (el Combo Dino trae dos proteínas). */
export function comboUnits(parts: ComboPart[]): number {
  return parts.reduce((total, part) => total + part.quantity, 0);
}

/** «Proteína STAR 2 lb + Creatina STAR 300 g» o «2 × Proteína STAR 2 lb». */
export function comboIncludesLine(comboSlug: string): string | null {
  const items = comboContents[comboSlug];
  if (!items?.length) return null;
  return items.map((item) => (item.quantity && item.quantity > 1 ? `${item.quantity} × ${item.label}` : item.label)).join(" + ");
}

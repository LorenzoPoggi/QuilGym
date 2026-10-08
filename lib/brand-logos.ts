/** Logos de marca disponibles en public/assets/brands. Una marca sin logo no aparece en la cinta de la home. */
export type BrandLogo = { src: string; width: number; height: number; tone: "dark" | "light" | "color" };

export const brandLogos: Record<string, BrandLogo> = {
  "star-nutrition": { src: "/assets/brands/star-nutrition-v2.webp", width: 640, height: 216, tone: "dark" },
  "ena-sport": { src: "/assets/brands/ena-sport-v2.webp", width: 640, height: 255, tone: "dark" },
  "body-advance": { src: "/assets/brands/body-advance-v2.webp", width: 289, height: 52, tone: "dark" },
  "one-fit": { src: "/assets/brands/one-fit-v2.webp", width: 428, height: 135, tone: "color" },
  "gold-nutrition": { src: "/assets/brands/gold-nutrition-horizontal-v2.webp", width: 487, height: 128, tone: "color" },
  xtrenght: { src: "/assets/brands/xtrenght-v2.webp", width: 486, height: 111, tone: "light" },
};

/** Devuelve solo las marcas con logo, conservando el orden recibido. */
export function withLogos<T extends { slug: string }>(brands: T[]): (T & { logo: BrandLogo })[] {
  return brands.flatMap((brand) => brandLogos[brand.slug] ? [{ ...brand, logo: brandLogos[brand.slug] }] : []);
}

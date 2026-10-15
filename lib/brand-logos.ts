/** Logos de marca disponibles en public/assets/brands. Una marca sin logo no aparece en la cinta de la home. */
export type BrandLogo = { src: string; width: number; height: number; tone: "dark" | "light" | "color" };

export const brandLogos: Record<string, BrandLogo> = {
  "star-nutrition": { src: "/assets/brands/star-nutrition-v2.webp", width: 640, height: 216, tone: "dark" },
  "ena-sport": { src: "/assets/brands/ena-sport-v2.webp", width: 640, height: 255, tone: "dark" },
  // Body Advance, One Fit y Gold: logos oficiales (bodyadvancenutrition.com, tiendaxnutrition.com —tienda del
  // fabricante de One Fit— y goldnutrition.com.ar) pasados a blanco con los detalles internos calados, para que
  // se lean al 50 % sobre el video del hero (el filtro blanco de la cinta convertía los sellos en manchas).
  "body-advance": { src: "/assets/brands/body-advance-white.webp", width: 338, height: 58, tone: "light" },
  "one-fit": { src: "/assets/brands/one-fit-white.webp", width: 199, height: 79, tone: "light" },
  "gold-nutrition": { src: "/assets/brands/gold-nutrition-white.webp", width: 205, height: 67, tone: "light" },
  xtrenght: { src: "/assets/brands/xtrenght-v2.webp", width: 486, height: 111, tone: "light" },
};

/** Devuelve solo las marcas con logo, conservando el orden recibido. */
export function withLogos<T extends { slug: string }>(brands: T[]): (T & { logo: BrandLogo })[] {
  return brands.flatMap((brand) => brandLogos[brand.slug] ? [{ ...brand, logo: brandLogos[brand.slug] }] : []);
}

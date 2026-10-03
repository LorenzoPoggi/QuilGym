export type StoreProduct = {
  slug: string;
  brand: string;
  name: string;
  category: "Creatina" | "Proteína" | "Pre-entreno" | "Accesorio";
  objective: "Masa muscular" | "Rendimiento" | "Recuperación" | "Energía";
  detail: string;
  price: string;
  priceValue: number;
  oldPrice?: string;
  badge: string;
  stock: string;
  cropX: number;
  rating: string;
  reviews: number;
};

export const storeProducts: StoreProduct[] = [
  { slug: "creatina-star-300-g", brand: "STAR NUTRITION", name: "Creatina STAR 300 g", category: "Creatina", objective: "Rendimiento", detail: "Sin sabor · 60 porciones", price: "$31.680", priceValue: 31680, oldPrice: "$35.200", badge: "-10%", stock: "En stock", cropX: 361, rating: "4,8", reviews: 126 },
  { slug: "creatina-gold-250-g", brand: "GOLD NUTRITION", name: "Creatina GOLD 250 g", category: "Creatina", objective: "Rendimiento", detail: "Sin sabor · 60 porciones", price: "$29.890", priceValue: 29890, badge: "NUEVO", stock: "Últimas unidades", cropX: 621, rating: "4,7", reviews: 126 },
  { slug: "creatina-micronizada-ena-300-g", brand: "ENA SPORT", name: "Creatina Micronizada 300 g", category: "Creatina", objective: "Recuperación", detail: "Neutro · 60 porciones", price: "$36.400", priceValue: 36400, oldPrice: "$40.450", badge: "OFERTA", stock: "En stock", cropX: 881, rating: "4,9", reviews: 204 },
  { slug: "creatine-powder-200-g", brand: "UNIVERSAL", name: "Creatine Powder 200 g", category: "Creatina", objective: "Rendimiento", detail: "Sin sabor · 40 porciones", price: "$42.900", priceValue: 42900, badge: "MÁS VENDIDO", stock: "Sin stock", cropX: 1143, rating: "4,8", reviews: 91 },
  { slug: "whey-protein-star-2-lb", brand: "STAR NUTRITION", name: "Proteína STAR 2 lb", category: "Proteína", objective: "Masa muscular", detail: "Chocolate · 24 g de proteína", price: "$39.920", priceValue: 39920, oldPrice: "$43.900", badge: "-10%", stock: "En stock", cropX: 361, rating: "4,8", reviews: 148 },
  { slug: "whey-protein-ena-2-lb", brand: "ENA SPORT", name: "Proteína Whey 2 lb", category: "Proteína", objective: "Masa muscular", detail: "Vainilla · 25 g de proteína", price: "$58.400", priceValue: 58400, oldPrice: "$64.450", badge: "OFERTA", stock: "En stock", cropX: 881, rating: "4,9", reviews: 162 },
  { slug: "pre-entreno-gold-300-g", brand: "GOLD NUTRITION", name: "Pre-entreno 300 g", category: "Pre-entreno", objective: "Energía", detail: "Frutos rojos · 30 servicios", price: "$37.800", priceValue: 37800, badge: "NUEVO", stock: "Últimas unidades", cropX: 621, rating: "4,7", reviews: 88 },
  { slug: "shaker-pro-700-ml", brand: "UNIVERSAL", name: "Shaker Pro 700 ml", category: "Accesorio", objective: "Recuperación", detail: "Negro · libre de BPA", price: "$14.900", priceValue: 14900, badge: "MÁS VENDIDO", stock: "En stock", cropX: 1143, rating: "4,8", reviews: 72 },
];

export const featuredProducts = storeProducts.slice(0, 4);

export function getProduct(slug: string) {
  return storeProducts.find((product) => product.slug === slug);
}

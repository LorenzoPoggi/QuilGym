import { describe, expect, it } from "vitest";
import type { ProductSummary } from "./catalog-types";
import { compareHref, netWeight, parseCompareParam, pickerCandidates, pricePer100g, selectCompared, withAdded, withRemoved, withReplaced } from "./compare";

function product(slug: string, overrides: Partial<ProductSummary> = {}): ProductSummary {
  return { id: slug.length, variantId: slug.length, slug, name: slug, brand: { slug: "star", name: "Star Nutrition" }, category: { slug: "creatinas", name: "Creatinas" },
    priceArs: 10000, compareAtPriceArs: null, inStock: true, imageUrl: null, photoUrls: [], ...overrides };
}

describe("parseCompareParam", () => {
  it("distingue la ausencia del parámetro de una selección vacía", () => {
    expect(parseCompareParam(undefined)).toBeNull();
    expect(parseCompareParam("")).toEqual([]);
  });

  it("descarta slugs malformados y repetidos, y toma el primer valor si viene repetido", () => {
    expect(parseCompareParam("creatina-gold, CREATINA-GOLD,../etc,<script>,a--b,proteina-star-2lb")).toEqual(["creatina-gold", "proteina-star-2lb"]);
    expect(parseCompareParam(["a,b", "c"])).toEqual(["a", "b"]);
  });
});

describe("selectCompared", () => {
  const catalog = ["a", "b", "c", "d"].map((slug) => product(slug));

  it("respeta el orden pedido, ignora slugs fuera del catálogo activo y corta en 3", () => {
    expect(selectCompared(["x", "c", "a", "d", "b"], catalog).map((item) => item.slug)).toEqual(["c", "a", "d"]);
    expect(selectCompared([], catalog)).toEqual([]);
  });
});

describe("enlaces", () => {
  it("arma la URL con la selección, el reemplazo y los filtros del selector", () => {
    expect(compareHref({ slugs: ["a", "b"] })).toBe("/comparar?p=a,b");
    expect(compareHref({ slugs: [] })).toBe("/comparar?p=");
    expect(compareHref({ slugs: ["a"], categoria: "todas", todos: true })).toBe("/comparar?p=a&categoria=todas&ver=todos");
    expect(compareHref({ slugs: ["a"], cambiar: "a", categoria: "creatinas", q: "star 300 & más", hash: "elegir-productos" }))
      .toBe("/comparar?p=a&cambiar=a&categoria=creatinas&q=star%20300%20%26%20m%C3%A1s#elegir-productos");
  });

  it("agrega sin duplicar ni pasar de 3, quita y reemplaza en el mismo lugar", () => {
    expect(withAdded(["a"], "b")).toEqual(["a", "b"]);
    expect(withAdded(["a", "b"], "a")).toEqual(["a", "b"]);
    expect(withAdded(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(withRemoved(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(withReplaced(["a", "b", "c"], "b", "d")).toEqual(["a", "d", "c"]);
    expect(withReplaced(["a", "b"], "b", "a")).toEqual(["a", "b"]);
  });
});

describe("pickerCandidates", () => {
  const catalog = [
    product("creatina-star", { name: "Creatina STAR 300 g" }),
    product("creatina-gold", { name: "Creatina GOLD 300 g", brand: { slug: "gold", name: "Gold Nutrition" } }),
    product("proteina-star", { name: "Proteína STAR 2 lb", category: { slug: "proteinas", name: "Proteínas" } }),
  ];

  it("excluye los elegidos y filtra por categoría y texto sin acentos", () => {
    expect(pickerCandidates(catalog, ["creatina-star"]).map((item) => item.slug)).toEqual(["creatina-gold", "proteina-star"]);
    expect(pickerCandidates(catalog, [], "creatinas", "gold nutr").map((item) => item.slug)).toEqual(["creatina-gold"]);
    expect(pickerCandidates(catalog, [], undefined, "proteina").map((item) => item.slug)).toEqual(["proteina-star"]);
  });
});

describe("netWeight", () => {
  it("lee gramos, kilos con coma y libras del nombre", () => {
    expect(netWeight("Creatina STAR 300 g Clásica", "creatinas")).toEqual({ grams: 300, label: "300 g" });
    expect(netWeight("Creatina GOLD 300 gr", "creatinas")).toEqual({ grams: 300, label: "300 g" });
    expect(netWeight("Mutant Mass 1,5 kg", "ganadores-de-peso")).toEqual({ grams: 1500, label: "1,5 kg" });
    expect(netWeight("Proteína STAR 2 lb", "proteinas")).toEqual({ grams: 2 * 453.59237, label: "2 lb (907 g)" });
  });

  it("no inventa peso cuando el nombre no lo dice o no describe el contenido pagado", () => {
    expect(netWeight("Omega 3 Star Nutrition", "vitaminas-y-minerales")).toBeNull();
    expect(netWeight("Barritas Mervick 65 g Banana", "snacks")).toBeNull();
    expect(netWeight("Shaker STAR 500 ml", "accesorios")).toBeNull();
    expect(netWeight("Combo Classic 300 g", "combos")).toBeNull();
    expect(netWeight("Omega 3 Landerfit", "vitaminas-y-minerales")).toBeNull();
    expect(netWeight("Creatina 300g", "creatinas")?.grams).toBe(300);
  });

  it("calcula el precio cada 100 g redondeado al peso", () => {
    expect(pricePer100g(30000, 300)).toBe(10000);
    expect(pricePer100g(45000, 907.18474)).toBe(4960);
  });
});

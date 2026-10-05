import { describe, expect, it } from "vitest";
import { advisorSteps, parseAdvisorProfile, recommendProducts, type AdvisorProfile } from "./advisor";
import type { ProductSummary } from "./catalog-types";
const profile: AdvisorProfile = { age:"adult",safety:"clear",experience:"regular",duration:"years",goal:"muscle",training:"strength",frequency:"medium",nutrition:"difficult",restriction:"none",budget:"45000" };
function product(id: number, category: string, priceArs=20000, inStock=true): ProductSummary {
  return { id, variantId:id, slug:`p${id}`, name:category === "creatinas" ? `Creatina ${id}` : `Producto ${id}`,category:{slug:category,name:category},brand:null,priceArs,compareAtPriceArs:null,inStock,imageUrl:null };
}
const catalog=[product(1,"proteinas"),product(2,"creatinas"),product(3,"accesorios"),product(4,"creatinas",50000),product(5,"proteinas",10000,false)];
describe("asesor con razones y límites",()=>{
  it("valida todo el perfil y rechaza parámetros arbitrarios",()=>{expect(parseAdvisorProfile(profile)).toEqual(profile);expect(parseAdvisorProfile({...profile,budget:"1"})).toBeNull();expect(parseAdvisorProfile({})).toBeNull();expect(advisorSteps).toHaveLength(10)});
  it("combina proteína por practicidad y creatina para fuerza dentro del presupuesto y stock",()=>{const r=recommendProducts(profile,catalog);expect(r.picks.map(p=>p.product.id)).toEqual([1,2]);expect(r.picks.every(p=>p.reason.length>80 && p.check.length>20)).toBe(true)});
  it("no prescribe suplementos a menores ni situaciones que requieren consulta",()=>{for(const p of [{...profile,age:"minor"},{...profile,safety:"consult"}]){const r=recommendProducts(p,catalog);expect(r.requiresConsultation).toBe(true);expect(r.picks).toEqual([])}});
  it("no declara aptos productos cuando no se conocen certificaciones/alérgenos",()=>{for(const restriction of ["vegan","gluten","allergy"])expect(recommendProducts({...profile,restriction},catalog).picks).toEqual([])});
  it("prioriza hábitos para quien nunca entrenó",()=>{const r=recommendProducts({...profile,experience:"never"},catalog);expect(r.picks.map(p=>p.product.category.slug)).toEqual(["accesorios"]);expect(r.explanation).toContain("hábitos")});
  it("considera el tiempo entrenando cuando empieza o retoma",()=>{expect(recommendProducts({...profile,experience:"starting",duration:"new"},catalog).picks.map(p=>p.product.category.slug)).toEqual(["accesorios"])});
  it("no ofrece creatina a resistencia ni proteína cuando ya incluye fuentes",()=>{expect(recommendProducts({...profile,training:"endurance",nutrition:"enough"},catalog).picks).toEqual([])});
  it("no sustituye alimentos ni promueve quemadores o estimulantes",()=>{expect(recommendProducts({...profile,goal:"weight",nutrition:"enough"},catalog).picks).toEqual([]);expect(recommendProducts({...profile,goal:"energy",nutrition:"enough"},catalog).explanation).toContain("No sugerimos estimulantes")});
  it("no obliga a gastar más cuando no hay opciones",()=>{expect(recommendProducts(profile,[]).explanation).toContain("no significa que necesites gastar más")});
});

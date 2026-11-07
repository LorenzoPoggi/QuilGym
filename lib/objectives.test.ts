import { describe, expect, it } from "vitest";
import { getObjective, objectiveHref, objectives } from "./objectives";

const CATEGORIES = ["proteinas", "creatinas", "ganadores-de-peso", "pre-entrenos", "aminoacidos", "colageno", "vitaminas-y-minerales"];

describe("objetivos", () => {
  it("tienen slugs únicos y al menos un grupo con categorías reales", () => {
    expect(new Set(objectives.map((item) => item.slug)).size).toBe(objectives.length);
    for (const objective of objectives) {
      expect(objective.groups.length).toBeGreaterThan(0);
      for (const group of objective.groups) expect(CATEGORIES).toContain(group.category);
    }
  });

  it("las fuentes son https y cada objetivo explica en qué se basa", () => {
    for (const objective of objectives) {
      expect(objective.evidence.length).toBeGreaterThan(0);
      for (const source of objective.sources) expect(source.url.startsWith("https://")).toBe(true);
    }
  });

  it("no promete resultados", () => {
    const text = JSON.stringify(objectives).toLowerCase();
    expect(text).not.toMatch(/garantiz|asegura(do|s)? resultados|quema grasa por sí solo\b(?!:)/);
  });

  it("resuelve slugs y arma el enlace", () => {
    expect(getObjective("masa-muscular")?.groups[0].category).toBe("proteinas");
    expect(getObjective("inexistente")).toBeUndefined();
    expect(objectiveHref("energia")).toBe("/objetivos/energia");
  });
});

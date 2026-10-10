import { describe, expect, it } from "vitest";
import { describeDescriptionSync, planDescriptionSync } from "./product-description-sync";

describe("plan de db:sync-descriptions", () => {
  it("informa solo las líneas que cambian y no toca productos sin texto", () => {
    const database = new Map<string, string | null>([
      ["barra", "Barra vegana, con 15 g de proteína.\n\n## Características\n- 15 g de proteína por barra.\n- Sin TACC."],
      ["igual", "Texto"],
      ["vacio", null],
      ["sin-json", "algo"],
    ]);
    const plan = planDescriptionSync(database, { barra: "Barra vegana, con proteína.\n\n## Características\n- Sin TACC.", igual: "Texto", vacio: "Nuevo", nuevo: "x" });
    expect(plan.changes).toEqual([
      { slug: "barra", removed: ["Barra vegana, con 15 g de proteína.", "- 15 g de proteína por barra."], added: ["Barra vegana, con proteína."] },
      { slug: "vacio", removed: [], added: ["Nuevo"] },
    ]);
    expect(plan.unchanged).toBe(1);
    expect(plan.notInContent).toEqual(["sin-json"]);
    expect(plan.notInDatabase).toEqual(["nuevo"]);
    expect(describeDescriptionSync(plan)).toContain("    − - 15 g de proteína por barra.");
  });
});

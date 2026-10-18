import { describe, expect, it } from "vitest";
import { fillDailyTraffic, groupDevices, groupSources, resolveTrafficRange } from "./admin-traffic-core";

describe("período del tablero de tráfico", () => {
  const now = new Date("2026-10-18T15:00:00.000Z"); // 12:00 en Argentina

  it("usa 30 días por defecto y termina hoy", () => {
    const range = resolveTrafficRange({}, now);
    expect(range.preset).toBe("30d");
    expect(range.to).toBe("2026-10-18");
    expect(range.from).toBe("2026-09-19");
    expect(range.days).toHaveLength(30);
    expect(range.days.at(-1)).toBe("2026-10-18");
  });

  it("acepta 7 y 90 días e ignora valores raros", () => {
    expect(resolveTrafficRange({ p: "7d" }, now).days).toHaveLength(7);
    expect(resolveTrafficRange({ p: "90d" }, now).days).toHaveLength(90);
    expect(resolveTrafficRange({ p: "1000d" }, now).preset).toBe("30d");
  });

  it("el período anterior tiene la misma duración y termina donde empieza el actual", () => {
    const range = resolveTrafficRange({ p: "7d" }, now);
    expect(range.prevEnd.getTime()).toBe(range.start.getTime());
    expect(range.start.getTime() - range.prevStart.getTime()).toBe(7 * 86_400_000);
    expect(range.end.getTime() - range.start.getTime()).toBe(7 * 86_400_000);
  });

  it("toma el día en horario argentino aunque en UTC ya sea el siguiente", () => {
    const lateNight = new Date("2026-10-19T01:30:00.000Z"); // 22:30 del 18 en Argentina
    expect(resolveTrafficRange({ p: "7d" }, lateNight).to).toBe("2026-10-18");
  });
});

describe("serie diaria", () => {
  it("completa con ceros los días sin visitas", () => {
    const points = fillDailyTraffic([{ day: "2026-10-17", visitors: 4, sessions: 5, pageViews: 12 }], ["2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(points.map((p) => p.pageViews)).toEqual([0, 12, 0]);
    expect(points[1]).toMatchObject({ visitors: 4, sessions: 5, label: "17/10" });
  });
});

describe("orígenes y dispositivos", () => {
  it("junta orígenes con el mismo nombre y calcula conversión", () => {
    const rows = groupSources([
      { utmSource: null, referrerHost: "google.com", sessions: 6, purchases: 1 },
      { utmSource: null, referrerHost: "google.com.ar", sessions: 4, purchases: 1 },
      { utmSource: null, referrerHost: null, sessions: 10, purchases: 0 },
      { utmSource: "newsletter", referrerHost: null, sessions: 5, purchases: 1 },
    ]);
    expect(rows.map((r) => r.label)).toEqual(["Directo", "Google", "Newsletter"]);
    const google = rows.find((r) => r.label === "Google")!;
    expect(google).toMatchObject({ sessions: 10, purchases: 2, conversion: 0.2 });
    expect(rows.reduce((sum, r) => sum + r.share, 0)).toBeCloseTo(1);
  });

  it("agrupa la cola larga en «Otros»", () => {
    const raw = Array.from({ length: 12 }, (_, i) => ({ utmSource: null, referrerHost: `sitio${i}.com`, sessions: 12 - i, purchases: 0 }));
    const rows = groupSources(raw, 3);
    expect(rows).toHaveLength(4);
    expect(rows[3].label).toBe("Otros");
    expect(rows[3].sessions).toBe(raw.slice(3).reduce((sum, r) => sum + r.sessions, 0));
  });

  it("no divide por cero sin sesiones", () => {
    expect(groupSources([])).toEqual([]);
    expect(groupDevices([])).toEqual([]);
  });

  it("nombra y ordena los dispositivos", () => {
    const rows = groupDevices([{ device: "desktop", sessions: 3 }, { device: "mobile", sessions: 7 }]);
    expect(rows.map((r) => r.label)).toEqual(["Celular", "Computadora"]);
    expect(rows[0].share).toBeCloseTo(0.7);
  });
});

/**
 * Cálculos puros del tablero de tráfico (sin base de datos, con tests): períodos de 7, 30 y 90 días en horario de
 * Argentina, serie diaria completa y agrupación de orígenes. Los totales y el embudo salen de `analytics-core.ts`.
 */
import { argentinaDate, argentinaDayStart } from "./admin-metrics-core";
import { sourceLabel } from "./analytics-core";

export type TrafficPreset = "7d" | "30d" | "90d";
export const trafficPresets: TrafficPreset[] = ["7d", "30d", "90d"];
export const trafficPresetLabels: Record<TrafficPreset, string> = { "7d": "Últimos 7 días", "30d": "Últimos 30 días", "90d": "Últimos 90 días" };
const presetDays: Record<TrafficPreset, number> = { "7d": 7, "30d": 30, "90d": 90 };

export type TrafficRange = { preset: TrafficPreset; start: Date; end: Date; prevStart: Date; prevEnd: Date; from: string; to: string; label: string; days: string[] };

const DAY = 86_400_000;
const shortDay = (day: string) => { const [, m, d] = day.split("-"); return `${Number(d)}/${Number(m)}`; };
const addDays = (day: string, amount: number) => argentinaDate(new Date(argentinaDayStart(day).getTime() + amount * DAY));

/** El período termina hoy (inclusive); el anterior tiene los mismos días y termina donde empieza este. */
export function resolveTrafficRange(params: { p?: string }, now = new Date()): TrafficRange {
  const preset: TrafficPreset = trafficPresets.includes(params.p as TrafficPreset) ? params.p as TrafficPreset : "30d";
  const length = presetDays[preset];
  const to = argentinaDate(now), from = addDays(to, -(length - 1));
  const start = argentinaDayStart(from), end = argentinaDayStart(addDays(to, 1));
  return {
    preset, start, end, prevStart: argentinaDayStart(addDays(from, -length)), prevEnd: start, from, to,
    label: `${shortDay(from)} al ${shortDay(to)}`, days: Array.from({ length }, (_, index) => addDays(from, index)),
  };
}

export type DailyTrafficRow = { day: string; visitors: number; sessions: number; pageViews: number };
export type DailyTrafficPoint = DailyTrafficRow & { label: string };

/** Una fila por día del período, con ceros donde no hubo visitas, para que el gráfico no salte días. */
export function fillDailyTraffic(rows: DailyTrafficRow[], days: string[]): DailyTrafficPoint[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return days.map((day) => {
    const row = byDay.get(day);
    return { day, label: shortDay(day), visitors: row?.visitors ?? 0, sessions: row?.sessions ?? 0, pageViews: row?.pageViews ?? 0 };
  });
}

export type RawSourceRow = { utmSource: string | null; referrerHost: string | null; sessions: number; purchases: number };
export type SourceRow = { label: string; sessions: number; purchases: number; share: number; conversion: number | null };

/** Junta los orígenes que tienen el mismo nombre legible (p. ej. google.com y google.com.ar) y deja los `limit` más grandes. */
export function groupSources(rows: RawSourceRow[], limit = 8): SourceRow[] {
  const map = new Map<string, { label: string; sessions: number; purchases: number }>();
  for (const row of rows) {
    const label = sourceLabel({ utmSource: row.utmSource, referrerHost: row.referrerHost });
    const entry = map.get(label) ?? { label, sessions: 0, purchases: 0 };
    entry.sessions += row.sessions; entry.purchases += row.purchases;
    map.set(label, entry);
  }
  const total = [...map.values()].reduce((sum, row) => sum + row.sessions, 0);
  const sorted = [...map.values()].sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label, "es"));
  const head = sorted.slice(0, limit), rest = sorted.slice(limit);
  if (rest.length) head.push({ label: "Otros", sessions: rest.reduce((sum, row) => sum + row.sessions, 0), purchases: rest.reduce((sum, row) => sum + row.purchases, 0) });
  return head.map((row) => ({ ...row, share: total > 0 ? row.sessions / total : 0, conversion: row.sessions > 0 ? Math.min(1, row.purchases / row.sessions) : null }));
}

export const deviceLabels: Record<string, string> = { mobile: "Celular", tablet: "Tablet", desktop: "Computadora" };
export type DeviceRow = { key: string; label: string; sessions: number; share: number };
export function groupDevices(rows: { device: string; sessions: number }[]): DeviceRow[] {
  const total = rows.reduce((sum, row) => sum + row.sessions, 0);
  return rows.map((row) => ({ key: row.device, label: deviceLabels[row.device] ?? row.device, sessions: row.sessions, share: total > 0 ? row.sessions / total : 0 }))
    .sort((a, b) => b.sessions - a.sessions);
}

import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { tableExists } from "./db/table-exists";
import { productInterest, type ProductInterestRow, type TrafficTotals } from "./analytics-core";
import {
  fillDailyTraffic, groupDevices, groupSources, type DailyTrafficPoint, type DeviceRow, type RawSourceRow, type SourceRow, type TrafficRange,
} from "./admin-traffic-core";

export type TrafficData = {
  /** false = falta aplicar la migración 0011: no hay analítica guardada. */
  ready: boolean;
  current: TrafficTotals;
  previous: TrafficTotals;
  daily: DailyTrafficPoint[];
  sources: SourceRow[];
  devices: DeviceRow[];
  products: ProductInterestRow[];
};

const emptyTotals = (): TrafficTotals => ({
  visitors: 0, newVisitors: 0, sessions: 0, pageViews: 0, productSessions: 0, cartSessions: 0, checkoutSessions: 0,
  purchaseSessions: 0, buyers: 0, orders: 0, revenue: 0,
});

async function rows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query) as unknown as { rows?: T[] } | T[];
  return Array.isArray(result) ? result : result.rows ?? [];
}

// Fechas como texto ISO con cast: evita depender de cómo el driver serializa objetos Date.
const at = (date: Date) => sql`${date.toISOString()}::timestamptz`;
const eventWindow = (start: Date, end: Date) => sql`occurred_at >= ${at(start)} and occurred_at < ${at(end)}`;
const paidOrderWindow = (start: Date, end: Date) => sql`o.status = 'approved' and o.is_demo = false and o.created_at >= ${at(start)} and o.created_at < ${at(end)}`;

async function totalsFor(start: Date, end: Date): Promise<TrafficTotals> {
  const [events, fresh, purchases] = await Promise.all([
    rows<{ visitors: number; sessions: number; page_views: number; product_sessions: number; cart_sessions: number; checkout_sessions: number }>(sql`
      select count(distinct visitor_id)::int as visitors,
             count(distinct session_id)::int as sessions,
             (count(*) filter (where type in ('page_view', 'product_view')))::int as page_views,
             (count(distinct session_id) filter (where type = 'product_view'))::int as product_sessions,
             (count(distinct session_id) filter (where type = 'add_to_cart'))::int as cart_sessions,
             (count(distinct session_id) filter (where type = 'checkout_start'))::int as checkout_sessions
      from analytics_events where ${eventWindow(start, end)}`),
    // Visitante nuevo = su primer evento registrado cae dentro del período.
    rows<{ new_visitors: number }>(sql`
      select count(*)::int as new_visitors from (
        select visitor_id from analytics_events group by visitor_id
        having min(occurred_at) >= ${at(start)} and min(occurred_at) < ${at(end)}
      ) first_seen`),
    rows<{ purchase_sessions: number; buyers: number; orders: number; revenue: number }>(sql`
      select count(distinct v.session_id)::int as purchase_sessions,
             count(distinct v.visitor_id)::int as buyers,
             count(*)::int as orders,
             coalesce(sum(o.total_ars), 0)::int as revenue
      from analytics_order_visitors v join orders o on o.id = v.order_id
      where ${paidOrderWindow(start, end)}`),
  ]);
  const e = events[0], p = purchases[0];
  return {
    visitors: e?.visitors ?? 0, newVisitors: fresh[0]?.new_visitors ?? 0, sessions: e?.sessions ?? 0, pageViews: e?.page_views ?? 0,
    productSessions: e?.product_sessions ?? 0, cartSessions: e?.cart_sessions ?? 0, checkoutSessions: e?.checkout_sessions ?? 0,
    purchaseSessions: p?.purchase_sessions ?? 0, buyers: p?.buyers ?? 0, orders: p?.orders ?? 0, revenue: p?.revenue ?? 0,
  };
}

/** Tráfico y conversión del período y del anterior. Solo lecturas; sin las tablas de la migración 0011 responde vacío. */
export async function getTrafficData(range: TrafficRange): Promise<TrafficData> {
  const ready = await tableExists(db, "analytics_events") && await tableExists(db, "analytics_order_visitors");
  if (!ready) {
    return { ready: false, current: emptyTotals(), previous: emptyTotals(), daily: fillDailyTraffic([], range.days), sources: [], devices: [], products: [] };
  }

  const [current, previous, dailyRows, sourceRows, deviceRows, viewRows, saleRows] = await Promise.all([
    totalsFor(range.start, range.end),
    totalsFor(range.prevStart, range.prevEnd),
    rows<{ day: string; visitors: number; sessions: number; page_views: number }>(sql`
      select to_char(occurred_at at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') as day,
             count(distinct visitor_id)::int as visitors,
             count(distinct session_id)::int as sessions,
             (count(*) filter (where type in ('page_view', 'product_view')))::int as page_views
      from analytics_events where ${eventWindow(range.start, range.end)}
      group by 1`),
    // El origen de cada sesión es el de su primer evento.
    rows<{ utm_source: string | null; referrer_host: string | null; sessions: number; purchases: number }>(sql`
      with first_events as (
        select distinct on (session_id) session_id, utm_source, referrer_host
        from analytics_events where ${eventWindow(range.start, range.end)}
        order by session_id, occurred_at
      ), buying as (
        select distinct v.session_id from analytics_order_visitors v join orders o on o.id = v.order_id
        where ${paidOrderWindow(range.start, range.end)}
      )
      select f.utm_source, f.referrer_host, count(*)::int as sessions, count(b.session_id)::int as purchases
      from first_events f left join buying b on b.session_id = f.session_id
      group by 1, 2`),
    rows<{ device: string; sessions: number }>(sql`
      select device, count(distinct session_id)::int as sessions
      from analytics_events where ${eventWindow(range.start, range.end)} group by device`),
    rows<{ slug: string; name: string; views: number }>(sql`
      select e.product_slug as slug, coalesce(p.name, e.product_slug) as name, count(*)::int as views
      from analytics_events e left join products p on p.slug = e.product_slug
      where e.type = 'product_view' and e.product_slug is not null
        and e.occurred_at >= ${at(range.start)} and e.occurred_at < ${at(range.end)}
      group by 1, 2 order by views desc limit 40`),
    rows<{ slug: string; units: number }>(sql`
      select oi.slug, sum(oi.quantity)::int as units
      from order_items oi join orders o on o.id = oi.order_id
      where ${paidOrderWindow(range.start, range.end)}
      group by oi.slug`),
  ]);

  const sources: RawSourceRow[] = sourceRows.map((row) => ({ utmSource: row.utm_source, referrerHost: row.referrer_host, sessions: row.sessions, purchases: row.purchases }));
  return {
    ready: true, current, previous,
    daily: fillDailyTraffic(dailyRows.map((row) => ({ day: row.day, visitors: row.visitors, sessions: row.sessions, pageViews: row.page_views })), range.days),
    sources: groupSources(sources),
    devices: groupDevices(deviceRows),
    products: productInterest(viewRows, saleRows, 10),
  };
}

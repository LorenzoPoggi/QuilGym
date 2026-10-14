/**
 * Cuotas con tarjeta: reglas puras (sin red ni `server-only`) para usarlas en componentes de servidor y de
 * cliente y probarlas con fetch simulado. Los datos salen de la API de Mercado Pago
 * (`/v1/payment_methods/installments` y `/v1/payment_methods`); acá no se inventa ninguna tasa.
 *
 * La tasa de cada plan es un porcentaje fijo sobre el precio (el CFT y la TEA solo dependen de la cantidad de
 * cuotas), por eso alcanza con consultar la API una vez por tarjeta y calcular cada precio localmente.
 */

export type InstallmentRow = { n: number; ratePct: number; cft: number | null; tea: number | null };
export type InstallmentPlan = { id: string; name: string; rows: InstallmentRow[] };
export type AcceptedCard = { id: string; name: string; type: "credit" | "debit"; thumbnail: string };
export type InstallmentsData = { plans: InstallmentPlan[]; cards: AcceptedCard[] };

export type InstallmentQuote = { n: number; amount: number; total: number; interestFree: boolean; cft: number | null; tea: number | null };
export type InstallmentOffer = { headline: InstallmentQuote; interestFreeHeadline: InstallmentQuote | null; byCard: { id: string; name: string; quotes: InstallmentQuote[] }[] };

/** Tarjetas de crédito con cuotas que se consultan; el resto de las marcas se muestra solo como aceptada. */
export const INSTALLMENT_METHODS = [
  { id: "visa", name: "Visa" }, { id: "master", name: "Mastercard" }, { id: "amex", name: "American Express" },
  { id: "naranja", name: "Naranja X" }, { id: "cabal", name: "Cabal" },
] as const;

const CARD_NAMES: Record<string, string> = {
  visa: "Visa", debvisa: "Visa débito", master: "Mastercard", debmaster: "Mastercard débito", maestro: "Maestro",
  amex: "American Express", naranja: "Naranja X", cabal: "Cabal", debcabal: "Cabal débito", diners: "Diners Club", argencard: "Argencard",
};

const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** «CFT_249,00%|TEA_184,00%» → { cft: 249, tea: 184 }. */
export function parseCostLabel(labels: unknown) {
  const text = Array.isArray(labels) ? labels.filter((item) => typeof item === "string").join("|") : "";
  const pick = (key: string) => {
    const match = new RegExp(`${key}_(\\d+(?:[.,]\\d+)?)%`).exec(text);
    const value = match ? Number(match[1].replace(",", ".")) : NaN;
    return Number.isFinite(value) ? value : null;
  };
  return { cft: pick("CFT"), tea: pick("TEA") };
}

/**
 * La API devuelve un plan por banco emisor. Los planes se agrupan por su forma y se elige el más frecuente entre
 * los que ofrecen cuotas; el comprador ve el plan exacto de su banco en el formulario de pago.
 */
export function representativePlan(raw: unknown, id: string, name: string): InstallmentPlan | null {
  if (!Array.isArray(raw)) return null;
  const groups = new Map<string, { count: number; rows: InstallmentRow[] }>();
  for (const entry of raw) {
    const costs = record(entry).payer_costs;
    if (!Array.isArray(costs)) continue;
    const rows: InstallmentRow[] = [];
    for (const cost of costs) {
      const item = record(cost);
      const n = item.installments, rate = item.installment_rate;
      if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 48 || typeof rate !== "number" || !Number.isFinite(rate) || rate < 0) continue;
      rows.push({ n, ratePct: rate, ...parseCostLabel(item.labels) });
    }
    if (rows.length < 2) continue;
    rows.sort((a, b) => a.n - b.n);
    const key = rows.map((row) => `${row.n}:${row.ratePct}:${row.cft}`).join("|");
    const group = groups.get(key);
    if (group) group.count += 1; else groups.set(key, { count: 1, rows });
  }
  const best = [...groups.values()].sort((a, b) => b.count - a.count || b.rows.length - a.rows.length)[0];
  return best ? { id, name, rows: best.rows } : null;
}

/** Marcas aceptadas: solo activas y de crédito o débito; una por logo y tipo (el consumidor las filtra por tipo). */
export function acceptedCards(raw: unknown): AcceptedCard[] {
  if (!Array.isArray(raw)) return [];
  const entries = raw.map(record).sort((a, b) => Number(b.payment_type_id === "credit_card") - Number(a.payment_type_id === "credit_card"));
  const seen = new Set<string>();
  const cards: AcceptedCard[] = [];
  for (const item of entries) {
    const type = item.payment_type_id === "credit_card" ? "credit" : item.payment_type_id === "debit_card" ? "debit" : null;
    const thumb = item.secure_thumbnail;
    if (item.status !== "active" || !type || typeof item.id !== "string" || typeof thumb !== "string" || seen.has(`${type}|${thumb}`)) continue;
    try {
      const url = new URL(thumb);
      if (url.protocol !== "https:" || !/(^|\.)(mlstatic\.com|mercadopago\.com|mercadolibre\.com)$/.test(url.hostname)) continue;
    } catch { continue; }
    seen.add(`${type}|${thumb}`);
    cards.push({ id: item.id, name: CARD_NAMES[item.id] ?? (typeof item.name === "string" ? item.name : item.id), type, thumbnail: thumb });
  }
  return cards;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function quoteRow(price: number, row: InstallmentRow, interestFree = false): InstallmentQuote {
  const free = interestFree || row.ratePct === 0;
  const total = free ? price : round2(price * (1 + row.ratePct / 100));
  return { n: row.n, amount: round2(total / row.n), total, interestFree: free && row.n > 1, cft: free ? 0 : row.cft, tea: free ? 0 : row.tea };
}

/**
 * Oferta de cuotas para un precio. `maxInstallments` es el tope del negocio (`commerce.maxCardInstallments`);
 * `interestFree` el máximo de cuotas sin interés confirmado por el negocio (1 = no hay).
 */
export function buildOffer(price: number, data: InstallmentsData | null, options: { maxInstallments?: number | null; interestFree?: number } = {}): InstallmentOffer | null {
  if (!data || !Number.isFinite(price) || price <= 0) return null;
  const cap = options.maxInstallments && options.maxInstallments >= 1 ? options.maxInstallments : 48;
  const free = options.interestFree ?? 1;
  const byCard = data.plans.map((plan) => ({
    id: plan.id, name: plan.name,
    // Cuotas de menos de $1 no tienen sentido comercial.
    quotes: plan.rows.filter((row) => row.n <= cap).map((row) => quoteRow(price, row, row.n <= free)).filter((quote) => quote.amount >= 1),
  })).filter((card) => card.quotes.some((quote) => quote.n > 1));
  if (byCard.length === 0) return null;
  const multi = byCard.flatMap((card) => card.quotes.filter((quote) => quote.n > 1));
  const headline = [...multi].sort((a, b) => b.n - a.n || (a.cft ?? 0) - (b.cft ?? 0))[0];
  const interestFreeHeadline = multi.filter((quote) => quote.interestFree).sort((a, b) => b.n - a.n)[0] ?? null;
  return { headline, interestFreeHeadline, byCard };
}

export const formatPct = (value: number | null) => value === null ? "—" : `${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}%`;

/** Arma los datos finales con la respuesta de `/installments` de cada tarjeta y la de `/payment_methods`. */
export function buildInstallmentsData(installments: Record<string, unknown>, methods: unknown): InstallmentsData {
  const plans = INSTALLMENT_METHODS.map((method) => representativePlan(installments[method.id], method.id, method.name)).filter((plan): plan is InstallmentPlan => plan !== null);
  return { plans, cards: acceptedCards(methods) };
}

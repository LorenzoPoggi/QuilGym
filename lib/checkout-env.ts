import type { CheckoutConfig, ShippingRate } from "./checkout-types";

/**
 * Lectura pura de las variables de entorno del checkout. No importa `server-only`
 * para que `npm run checkout:check` pueda diagnosticar la configuración fuera de Next.
 */
type Env = Record<string, string | undefined>;

export type CheckoutEnvReport = {
  config: CheckoutConfig;
  /** Configuración presente pero inválida: el medio queda deshabilitado. */
  issues: string[];
  /** Configuración ausente o incompleta que conviene revisar. */
  warnings: string[];
  pendingOrderTtlHours: number;
  orderAccessEnabled: boolean;
  emailsEnabled: boolean;
  cronEnabled: boolean;
};

export const DEFAULT_PENDING_ORDER_TTL_HOURS = 72;
export const MIN_ORDER_ACCESS_SECRET_LENGTH = 32;

function value(env: Env, key: string) {
  return env[key]?.trim() || undefined;
}

export function readSiteUrl(env: Env) {
  const raw = value(env, "NEXT_PUBLIC_SITE_URL");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.origin : null;
  } catch { return null; }
}

export function readBankDetails(env: Env) {
  const account = value(env, "TRANSFER_ACCOUNT");
  const holder = value(env, "TRANSFER_HOLDER");
  const taxId = value(env, "TRANSFER_TAX_ID");
  return account && holder && taxId ? { account, holder, taxId } : null;
}

export function readPendingOrderTtlHours(env: Env) {
  const raw = value(env, "PENDING_ORDER_TTL_HOURS");
  if (!raw) return { hours: DEFAULT_PENDING_ORDER_TTL_HOURS, valid: true };
  const hours = Number(raw);
  return Number.isInteger(hours) && hours >= 1 && hours <= 720
    ? { hours, valid: true }
    : { hours: DEFAULT_PENDING_ORDER_TTL_HOURS, valid: false };
}

export function readOrderAccessSecret(env: Env) {
  const secret = value(env, "ORDER_ACCESS_SECRET");
  return secret && secret.length >= MIN_ORDER_ACCESS_SECRET_LENGTH ? secret : null;
}

/** Valida cada tarifa por separado: una entrada inválida no inventa precios ni tumba las demás. */
function readShippingRates(env: Env, issues: string[]) {
  const raw = value(env, "SHIPPING_RATES_JSON");
  if (!raw) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch {
    issues.push("SHIPPING_RATES_JSON no es un JSON válido.");
    return [];
  }
  if (!Array.isArray(parsed)) {
    issues.push("SHIPPING_RATES_JSON debe ser una lista de tarifas.");
    return [];
  }
  const rates: ShippingRate[] = [];
  const ids = new Set<string>();
  parsed.forEach((entry: unknown, index) => {
    const r = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const problems: string[] = [];
    if (typeof r.id !== "string" || !r.id.trim()) problems.push("id");
    if (typeof r.label !== "string" || !r.label.trim()) problems.push("label");
    if (typeof r.estimate !== "string" || !r.estimate.trim()) problems.push("estimate");
    if (!Array.isArray(r.postalCodes) || !r.postalCodes.length || !r.postalCodes.every((code) => typeof code === "string" && code.trim())) problems.push("postalCodes");
    if (!Number.isSafeInteger(r.priceArs) || (r.priceArs as number) < 0) problems.push("priceArs (entero en pesos, ≥ 0)");
    if (problems.length) {
      issues.push(`SHIPPING_RATES_JSON[${index}]: falta o es inválido ${problems.join(", ")}.`);
      return;
    }
    if (ids.has(r.id as string)) issues.push(`SHIPPING_RATES_JSON[${index}]: el id "${r.id}" está repetido.`);
    ids.add(r.id as string);
    rates.push({ id: r.id as string, label: r.label as string, estimate: r.estimate as string,
      postalCodes: (r.postalCodes as string[]).map((code) => code.trim().toUpperCase()), priceArs: r.priceArs as number });
  });
  return rates;
}

export function parseCheckoutEnv(env: Env): CheckoutEnvReport {
  const issues: string[] = [];
  const warnings: string[] = [];
  const ttl = readPendingOrderTtlHours(env);
  if (!ttl.valid) issues.push(`PENDING_ORDER_TTL_HOURS debe ser un entero entre 1 y 720. Se usa ${DEFAULT_PENDING_ORDER_TTL_HOURS}.`);

  const accessSecret = value(env, "ORDER_ACCESS_SECRET");
  if (!accessSecret) warnings.push("Falta ORDER_ACCESS_SECRET: el pedido solo se puede ver desde el navegador que lo creó y el email no incluye el link.");
  else if (accessSecret.length < MIN_ORDER_ACCESS_SECRET_LENGTH) issues.push(`ORDER_ACCESS_SECRET debe tener al menos ${MIN_ORDER_ACCESS_SECRET_LENGTH} caracteres.`);

  const emailsEnabled = Boolean(value(env, "RESEND_API_KEY") && value(env, "EMAIL_FROM"));
  if (!emailsEnabled) warnings.push("Faltan RESEND_API_KEY y/o EMAIL_FROM: los emails quedan guardados en la outbox sin enviarse.");
  const cronEnabled = Boolean(value(env, "CRON_SECRET"));
  if (!cronEnabled) warnings.push("Falta CRON_SECRET: los crons de reintento de emails y vencimiento de pedidos responden 401.");

  const report = { issues, warnings, pendingOrderTtlHours: ttl.hours, orderAccessEnabled: Boolean(readOrderAccessSecret(env)), emailsEnabled, cronEnabled };

  // Nunca se puede habilitar el simulador en producción, incluso con la variable en true.
  if (env.NODE_ENV === "development" && env.CHECKOUT_DEMO_MODE !== "false") {
    return { ...report, config: {
      demo: true,
      pickup: { address: "Local de prueba · Quilmes (dirección a configurar)", hours: "Horario de prueba · a coordinar" },
      shippingRates: [{ id: "demo", label: "Envío simulado", postalCodes: ["*"], priceArs: 4200, estimate: "Plazo de prueba: 3 a 5 días hábiles" }],
      payments: { mercadopago: true, transfer: true, cash: true },
    } };
  }

  const shippingRates = readShippingRates(env, issues);
  if (!value(env, "SHIPPING_RATES_JSON")) warnings.push("Falta SHIPPING_RATES_JSON: el envío a domicilio no está disponible.");

  const address = value(env, "PICKUP_ADDRESS");
  const hours = value(env, "PICKUP_HOURS");
  const pickup = address && hours ? { address, hours } : null;
  if (!pickup) warnings.push(address || hours ? "PICKUP_ADDRESS y PICKUP_HOURS van juntos: falta uno de los dos." : "Faltan PICKUP_ADDRESS y PICKUP_HOURS: el retiro en el local no está disponible.");

  const rawSite = value(env, "NEXT_PUBLIC_SITE_URL");
  const site = readSiteUrl(env);
  if (rawSite && !site) issues.push("NEXT_PUBLIC_SITE_URL debe ser una URL https válida (por ejemplo https://quilgym.com.ar).");

  const mpKeys = ["MP_ACCESS_TOKEN", "NEXT_PUBLIC_MP_PUBLIC_KEY", "MP_WEBHOOK_SECRET"] as const;
  const mpPresent = mpKeys.filter((key) => value(env, key));
  if (mpPresent.length && mpPresent.length < mpKeys.length) issues.push(`Mercado Pago incompleto: falta ${mpKeys.filter((key) => !value(env, key)).join(", ")}.`);
  if (!mpPresent.length) warnings.push("Mercado Pago no configurado (MP_ACCESS_TOKEN, NEXT_PUBLIC_MP_PUBLIC_KEY, MP_WEBHOOK_SECRET).");
  const accessToken = value(env, "MP_ACCESS_TOKEN");
  const publicKey = value(env, "NEXT_PUBLIC_MP_PUBLIC_KEY");
  if (accessToken && publicKey && accessToken.startsWith("TEST-") !== publicKey.startsWith("TEST-")) {
    issues.push("Las credenciales de Mercado Pago mezclan sandbox (TEST-) y producción (APP_USR-).");
  }
  if (mpPresent.length === mpKeys.length && !site) issues.push("Mercado Pago necesita NEXT_PUBLIC_SITE_URL con https para el webhook y la vuelta del pago.");

  const bank = readBankDetails(env);
  const bankPresent = ["TRANSFER_ACCOUNT", "TRANSFER_HOLDER", "TRANSFER_TAX_ID"].filter((key) => value(env, key));
  if (bankPresent.length && !bank) issues.push("Transferencia incompleta: TRANSFER_ACCOUNT, TRANSFER_HOLDER y TRANSFER_TAX_ID van juntos.");
  if (!bankPresent.length) warnings.push("Transferencia no configurada (TRANSFER_ACCOUNT, TRANSFER_HOLDER, TRANSFER_TAX_ID).");

  const cashFlag = value(env, "CASH_PICKUP_ENABLED");
  if (cashFlag && cashFlag !== "true" && cashFlag !== "false") issues.push('CASH_PICKUP_ENABLED solo acepta "true" o "false".');
  if (cashFlag === "true" && !pickup) issues.push("CASH_PICKUP_ENABLED=true requiere PICKUP_ADDRESS y PICKUP_HOURS.");

  return { ...report, config: {
    demo: false, pickup, shippingRates,
    payments: {
      mercadopago: Boolean(accessToken && publicKey && value(env, "MP_WEBHOOK_SECRET") && site
        && accessToken.startsWith("TEST-") === publicKey.startsWith("TEST-")),
      transfer: Boolean(bank),
      cash: Boolean(pickup && cashFlag === "true"),
    },
  } };
}

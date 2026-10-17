import type { CheckoutConfig, ShippingRate } from "./checkout-types";
import { readEmailConfig } from "./email-config";
import { readInvoicingConfig } from "./invoicing-config";
import { STORE_COORDINATES } from "./store-location";
import type { CorreoArgentinoConfig } from "./carriers/correo-argentino";

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

export const DEFAULT_LOCAL_DELIVERY_RADIUS_KM = 5;

/** STORE_LAT/STORE_LNG con default en el local de Quilmes. Inválidas → issue y se usa el default. */
export function readStoreCoordinates(env: Env, issues: string[] = []) {
  const rawLat = value(env, "STORE_LAT");
  const rawLng = value(env, "STORE_LNG");
  if (!rawLat && !rawLng) return { lat: STORE_COORDINATES.lat, lng: STORE_COORDINATES.lng };
  const lat = Number(rawLat); const lng = Number(rawLng);
  if (!rawLat || !rawLng || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -56 || lat > -21 || lng < -74 || lng > -53) {
    issues.push("STORE_LAT y STORE_LNG van juntas y deben ser coordenadas de Argentina en grados decimales (p. ej. -34.72, -58.26). Se usa la ubicación del local por defecto.");
    return { lat: STORE_COORDINATES.lat, lng: STORE_COORDINATES.lng };
  }
  return { lat, lng };
}

/** Entrega propia: apagada salvo LOCAL_DELIVERY_ENABLED=true. Efectivo al entregar solo con LOCAL_DELIVERY_CASH=true. */
export function readLocalDelivery(env: Env, issues: string[] = []) {
  const flag = value(env, "LOCAL_DELIVERY_ENABLED");
  if (flag && flag !== "true" && flag !== "false") issues.push('LOCAL_DELIVERY_ENABLED solo acepta "true" o "false".');
  const cashFlag = value(env, "LOCAL_DELIVERY_CASH");
  if (cashFlag && cashFlag !== "true" && cashFlag !== "false") issues.push('LOCAL_DELIVERY_CASH solo acepta "true" o "false".');
  const rawRadius = value(env, "LOCAL_DELIVERY_RADIUS_KM");
  const radius = rawRadius ? Number(rawRadius.replace(",", ".")) : DEFAULT_LOCAL_DELIVERY_RADIUS_KM;
  const validRadius = Number.isFinite(radius) && radius > 0 && radius <= 30;
  if (rawRadius && !validRadius) issues.push("LOCAL_DELIVERY_RADIUS_KM debe ser un número de kilómetros entre 0 y 30. La entrega propia queda apagada.");
  if (flag !== "true" || !validRadius) return null;
  return { radiusKm: radius, cash: cashFlag === "true" };
}

export type CarrierEnvConfig =
  | { code: "correo_argentino"; label: string; correoArgentino: CorreoArgentinoConfig }
  | { code: "mock"; label: string };

/**
 * SHIPPING_CARRIER: vacío = sin transportista (tarifa fija). `correo_argentino` exige CORREO_AR_USER,
 * CORREO_AR_PASSWORD, CORREO_AR_CUSTOMER_ID y CORREO_AR_ORIGIN_POSTAL_CODE; si falta alguna, queda apagado.
 * `mock` (simulado) solo fuera de producción.
 */
export function readCarrierConfig(env: Env, issues: string[] = [], warnings: string[] = []): { carrier: CarrierEnvConfig | null } {
  const code = value(env, "SHIPPING_CARRIER");
  if (!code) return { carrier: null };
  if (code === "mock") {
    if (env.NODE_ENV === "production" || value(env, "VERCEL_ENV") === "production") {
      issues.push("SHIPPING_CARRIER=mock no se permite en producción.");
      return { carrier: null };
    }
    return { carrier: { code: "mock", label: "Transportista simulado" } };
  }
  if (code !== "correo_argentino") {
    issues.push('SHIPPING_CARRIER solo acepta "correo_argentino" (o vacío para usar SHIPPING_RATES_JSON).');
    return { carrier: null };
  }
  const keys = ["CORREO_AR_USER", "CORREO_AR_PASSWORD", "CORREO_AR_CUSTOMER_ID", "CORREO_AR_ORIGIN_POSTAL_CODE"] as const;
  const missing = keys.filter((key) => !value(env, key));
  const rawEnv = value(env, "CORREO_AR_ENV") ?? "test";
  if (rawEnv !== "test" && rawEnv !== "prod") issues.push('CORREO_AR_ENV solo acepta "test" o "prod".');
  const origin = value(env, "CORREO_AR_ORIGIN_POSTAL_CODE");
  if (origin && !/^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/i.test(origin)) issues.push("CORREO_AR_ORIGIN_POSTAL_CODE debe ser un código postal argentino (1878 o B1878ABC).");
  if (missing.length) {
    issues.push(`Correo Argentino incompleto: falta ${missing.join(", ")}. Se usa la tarifa fija de SHIPPING_RATES_JSON.`);
    return { carrier: null };
  }
  if ((rawEnv !== "test" && rawEnv !== "prod") || (origin && !/^(\d{4}|[A-Z]\d{4}[A-Z]{3})$/i.test(origin))) return { carrier: null };
  if (rawEnv === "test") warnings.push("CORREO_AR_ENV=test: las cotizaciones y altas van al ambiente de prueba de Correo Argentino.");
  return { carrier: { code: "correo_argentino", label: "Correo Argentino", correoArgentino: {
    user: value(env, "CORREO_AR_USER")!, password: value(env, "CORREO_AR_PASSWORD")!, customerId: value(env, "CORREO_AR_CUSTOMER_ID")!,
    originPostalCode: origin!.toUpperCase(), env: rawEnv,
    sender: { name: "QuilGym", address: value(env, "PICKUP_ADDRESS") },
  } } };
}

export const DEFAULT_PENDING_ORDER_TTL_HOURS = 72;
export const MIN_ORDER_ACCESS_SECRET_LENGTH = 32;

function value(env: Env, key: string) {
  return env[key]?.trim() || undefined;
}

export function readSiteUrl(env: Env) {
  // A branch alias can still point at an older deployment with different secrets
  // or a different database. Return to the exact Preview that created the order.
  // Use Vercel's server-side metadata, never a client-supplied Host header.
  if (value(env, "VERCEL_ENV") === "preview") {
    const host = value(env, "VERCEL_URL");
    if (!host || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i.test(host)) return null;
    return `https://${host.toLowerCase()}`;
  }
  const raw = value(env, "NEXT_PUBLIC_SITE_URL");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.origin : null;
  } catch { return null; }
}

/** Un Preview protegido necesita el bypass de Vercel para recibir POST de Mercado Pago. */
export function readPaymentNotificationUrl(env: Env) {
  const site = readSiteUrl(env);
  if (!site) return null;
  const url = new URL("/api/payments/mercadopago/webhook", site);
  if (value(env, "VERCEL_ENV") === "preview") {
    const bypass = value(env, "VERCEL_AUTOMATION_BYPASS_SECRET");
    if (!bypass) return null;
    url.searchParams.set("x-vercel-protection-bypass", bypass);
  }
  return url.href;
}

/**
 * 3-D Secure para tarjetas: con "optional" Mercado Pago decide si pide el desafío del banco
 * (respuesta `pending_challenge`, que el sitio muestra con el Status Screen Brick). Vacío = no se solicita.
 */
export function readCardThreeDsMode(env: Env) {
  return value(env, "MP_CARD_3DS") === "optional" ? "optional" as const : null;
}

/** El prefijo APP_USR también puede corresponder a credenciales de prueba. */
export function readMercadoPagoTestMode(env: Env) {
  const explicit = value(env, "MP_TEST_MODE");
  return explicit === "true" || (!explicit && value(env, "MP_ACCESS_TOKEN")?.startsWith("TEST-") === true);
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
  // Reuse the webhook secret as a secure fallback so Mercado Pago's return link
  // remains usable in a separate browser when an explicit order secret is absent.
  const secret = value(env, "ORDER_ACCESS_SECRET") ?? value(env, "MP_WEBHOOK_SECRET");
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

  const explicitAccessSecret = value(env, "ORDER_ACCESS_SECRET");
  const accessSecret = explicitAccessSecret ?? value(env, "MP_WEBHOOK_SECRET");
  if (!accessSecret) warnings.push("Falta ORDER_ACCESS_SECRET (o MP_WEBHOOK_SECRET): el pedido solo se puede ver desde el navegador que lo creó y el email no incluye el link.");
  else if (accessSecret.length < MIN_ORDER_ACCESS_SECRET_LENGTH) issues.push(`${explicitAccessSecret ? "ORDER_ACCESS_SECRET" : "ORDER_ACCESS_SECRET o MP_WEBHOOK_SECRET"} debe tener al menos ${MIN_ORDER_ACCESS_SECRET_LENGTH} caracteres.`);

  const email = readEmailConfig(env);
  const emailsEnabled = email.enabled;
  issues.push(...email.issues);
  warnings.push(...email.warnings);
  const invoicing = readInvoicingConfig(env);
  issues.push(...invoicing.issues);
  warnings.push(...invoicing.warnings);
  const threeDs = value(env, "MP_CARD_3DS");
  if (threeDs && threeDs !== "optional") issues.push('MP_CARD_3DS solo acepta "optional" (vacío = sin 3-D Secure).');
  const cronEnabled = Boolean(value(env, "CRON_SECRET"));
  if (!cronEnabled) warnings.push("Falta CRON_SECRET: los crons de reintento de emails y vencimiento de pedidos responden 401.");

  const report = { issues, warnings, pendingOrderTtlHours: ttl.hours, orderAccessEnabled: Boolean(readOrderAccessSecret(env)), emailsEnabled, cronEnabled };

  // Nunca se puede habilitar el simulador en producción, incluso con la variable en true.
  if (env.NODE_ENV === "development" && env.CHECKOUT_DEMO_MODE !== "false") {
    return { ...report, config: {
      demo: true,
      pickup: { address: "QuilGym · Quilmes", hours: "Horario de 7 AM a 5 PM" },
      shippingRates: [{ id: "demo", label: "Envío simulado", postalCodes: ["*"], priceArs: 4200, estimate: "Plazo de prueba: 3 a 5 días hábiles" }],
      payments: { mercadopago: true, transfer: true, cash: true },
      // En la simulación la entrega propia está habilitada (efectivo solo con retiro, igual que por defecto).
      localDelivery: { radiusKm: readLocalDelivery({ ...env, LOCAL_DELIVERY_ENABLED: "true" })?.radiusKm ?? DEFAULT_LOCAL_DELIVERY_RADIUS_KM, cash: false },
      store: readStoreCoordinates(env),
      carrier: publicCarrier(readCarrierConfig(env).carrier),
    } };
  }

  const shippingRates = readShippingRates(env, issues);

  const address = value(env, "PICKUP_ADDRESS");
  const hours = value(env, "PICKUP_HOURS");
  const pickup = address && hours ? { address, hours } : null;
  if (!pickup) warnings.push(address || hours ? "PICKUP_ADDRESS y PICKUP_HOURS van juntos: falta uno de los dos." : "Faltan PICKUP_ADDRESS y PICKUP_HOURS: el retiro en el local no está disponible.");

  const rawSite = value(env, "NEXT_PUBLIC_SITE_URL");
  const site = readSiteUrl(env);
  if (value(env, "VERCEL_ENV") === "preview" && !site) issues.push("Preview necesita VERCEL_URL válido: habilitá las variables de sistema en Vercel para no enviar pedidos a otro despliegue.");
  else if (rawSite && !site) issues.push("NEXT_PUBLIC_SITE_URL debe ser una URL https válida (por ejemplo https://quilgym.com.ar).");

  const mpKeys = ["MP_ACCESS_TOKEN", "NEXT_PUBLIC_MP_PUBLIC_KEY", "MP_WEBHOOK_SECRET"] as const;
  const mpPresent = mpKeys.filter((key) => value(env, key));
  if (mpPresent.length && mpPresent.length < mpKeys.length) issues.push(`Mercado Pago incompleto: falta ${mpKeys.filter((key) => !value(env, key)).join(", ")}.`);
  if (!mpPresent.length) warnings.push("Mercado Pago no configurado (MP_ACCESS_TOKEN, NEXT_PUBLIC_MP_PUBLIC_KEY, MP_WEBHOOK_SECRET).");
  const accessToken = value(env, "MP_ACCESS_TOKEN");
  const publicKey = value(env, "NEXT_PUBLIC_MP_PUBLIC_KEY");
  const mpTestMode = value(env, "MP_TEST_MODE");
  if (mpTestMode && mpTestMode !== "true" && mpTestMode !== "false") issues.push('MP_TEST_MODE solo acepta "true" o "false".');
  if (mpTestMode === "true" && value(env, "VERCEL_ENV") === "production") issues.push("MP_TEST_MODE=true no se permite en Production.");
  if (accessToken && publicKey && accessToken.startsWith("TEST-") !== publicKey.startsWith("TEST-")) {
    issues.push("Las credenciales de Mercado Pago mezclan sandbox (TEST-) y producción (APP_USR-).");
  }
  if (mpPresent.length === mpKeys.length && !site) issues.push("Mercado Pago necesita una URL https para el webhook y la vuelta del pago (VERCEL_URL en Preview; NEXT_PUBLIC_SITE_URL fuera de Preview).");
  const notificationUrl = readPaymentNotificationUrl(env);
  if (mpPresent.length === mpKeys.length && site && !notificationUrl) issues.push("Preview necesita VERCEL_AUTOMATION_BYPASS_SECRET para que Mercado Pago pueda notificar un pago sin iniciar sesión en Vercel.");

  const store = readStoreCoordinates(env, issues);
  const localDelivery = readLocalDelivery(env, issues);
  if (!localDelivery && !value(env, "LOCAL_DELIVERY_ENABLED")) warnings.push(`Entrega propia apagada (LOCAL_DELIVERY_ENABLED=true para ofrecerla hasta ${DEFAULT_LOCAL_DELIVERY_RADIUS_KM} km del local; requiere la migración 0010).`);
  const carrier = readCarrierConfig(env, issues, warnings).carrier;
  if (!value(env, "SHIPPING_RATES_JSON")) warnings.push(carrier
    ? "Falta SHIPPING_RATES_JSON: si el transportista no responde, el envío a domicilio no se puede cotizar."
    : "Falta SHIPPING_RATES_JSON: el envío a domicilio no está disponible.");

  const bank = readBankDetails(env);
  const bankPresent = ["TRANSFER_ACCOUNT", "TRANSFER_HOLDER", "TRANSFER_TAX_ID"].filter((key) => value(env, key));
  if (bankPresent.length && !bank) issues.push("Transferencia incompleta: TRANSFER_ACCOUNT, TRANSFER_HOLDER y TRANSFER_TAX_ID van juntos.");
  if (!bankPresent.length) warnings.push("Transferencia no configurada (TRANSFER_ACCOUNT, TRANSFER_HOLDER, TRANSFER_TAX_ID).");

  const cashFlag = value(env, "CASH_PICKUP_ENABLED");
  if (cashFlag && cashFlag !== "true" && cashFlag !== "false") issues.push('CASH_PICKUP_ENABLED solo acepta "true" o "false".');
  if (cashFlag === "true" && !pickup) issues.push("CASH_PICKUP_ENABLED=true requiere PICKUP_ADDRESS y PICKUP_HOURS.");

  return { ...report, config: {
    demo: false, pickup, shippingRates, taxIdThresholdArs: invoicing.identificationThresholdArs,
    localDelivery, store, carrier: publicCarrier(carrier),
    payments: {
      mercadopago: Boolean(accessToken && publicKey && value(env, "MP_WEBHOOK_SECRET") && notificationUrl
        && accessToken.startsWith("TEST-") === publicKey.startsWith("TEST-")
        && (!mpTestMode || mpTestMode === "true" || mpTestMode === "false")
        && !(mpTestMode === "true" && value(env, "VERCEL_ENV") === "production")),
      transfer: Boolean(bank),
      // Cash is available by default whenever pickup is configured; set the flag
      // to false to explicitly disable it for a deployment.
      cash: Boolean(pickup && cashFlag !== "false"),
    },
  } };
}

/** Datos del transportista que pueden viajar al navegador: nunca credenciales. */
function publicCarrier(carrier: CarrierEnvConfig | null) {
  return carrier ? { code: carrier.code, label: carrier.label } : null;
}

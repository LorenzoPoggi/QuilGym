import "server-only";
import { unstable_cache } from "next/cache";
import { buildInstallmentsData, INSTALLMENT_METHODS, type InstallmentsData } from "./installments-core";

const API = "https://api.mercadopago.com";
/** Monto de referencia: la tasa es un porcentaje fijo, el precio real se aplica en `buildOffer`. */
const REFERENCE_AMOUNT = 100_000;
const TIMEOUT_MS = 4_000;
const REVALIDATE_SECONDS = 6 * 60 * 60;

async function getJson(url: string, fetcher: typeof fetch) {
  const response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Mercado Pago respondió ${response.status}`);
  return response.json() as Promise<unknown>;
}

/** Consulta la API pública con la public key. Lanza ante cualquier falla para que no se cachee un resultado vacío. */
export async function fetchInstallmentsData(publicKey: string, fetcher: typeof fetch = fetch): Promise<InstallmentsData> {
  const key = encodeURIComponent(publicKey);
  const [methods, ...results] = await Promise.all([
    getJson(`${API}/v1/payment_methods?public_key=${key}`, fetcher),
    ...INSTALLMENT_METHODS.map((method) => getJson(`${API}/v1/payment_methods/installments?public_key=${key}&amount=${REFERENCE_AMOUNT}&payment_method_id=${method.id}&locale=es-AR`, fetcher)),
  ]);
  const data = buildInstallmentsData(Object.fromEntries(INSTALLMENT_METHODS.map((method, index) => [method.id, results[index]])), methods);
  if (data.plans.length === 0 && data.cards.length === 0) throw new Error("Mercado Pago no devolvió datos de cuotas");
  return data;
}

const cached = unstable_cache(async () => {
  const publicKey = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY?.trim();
  if (!publicKey) throw new Error("Sin public key");
  return fetchInstallmentsData(publicKey);
}, ["mp:installments:v1"], { revalidate: REVALIDATE_SECONDS, tags: ["installments"] });

/** Cuotas y marcas aceptadas, o null si Mercado Pago no responde (la UI simplemente no las muestra). */
export async function getInstallmentsData(): Promise<InstallmentsData | null> {
  try { return await cached(); } catch { return null; }
}

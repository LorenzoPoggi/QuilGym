/* Orígenes de Better Auth: lógica pura (sin server-only) para poder probarla. */
type Env = Record<string, string | undefined>;
const value = (env: Env, key: string) => env[key]?.trim() || undefined;
const vercelHostPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i;
const DEV_FALLBACK = "http://localhost:3000";

/** Hostname de Vercel validado (VERCEL_URL / VERCEL_BRANCH_URL los fija la plataforma, nunca el cliente). */
export function vercelHost(raw: string | undefined) {
  return raw && vercelHostPattern.test(raw) ? raw.toLowerCase() : null;
}
function httpOrigin(raw: string | undefined, httpsOnly: boolean) {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && (httpsOnly || url.protocol !== "http:")) return null;
    return url.origin;
  } catch { return null; }
}
const isDev = (env: Env) => value(env, "NODE_ENV") === "development";
const isPreview = (env: Env) => value(env, "VERCEL_ENV") === "preview";

/** baseURL: Preview usa su propio deployment; desarrollo, BETTER_AUTH_URL o localhost; el resto exige https. */
export function authBaseUrl(env: Env) {
  if (isPreview(env)) { const host = vercelHost(value(env, "VERCEL_URL")); return host ? `https://${host}` : null; }
  if (isDev(env)) return httpOrigin(value(env, "BETTER_AUTH_URL"), false) ?? DEV_FALLBACK;
  return httpOrigin(value(env, "BETTER_AUTH_URL"), true);
}
/** Better Auth resuelve el host real de cada request, limitado a los dos hosts de este Preview. */
export function authBaseUrlOption(env: Env) {
  const deployment = vercelHost(value(env, "VERCEL_URL"));
  const branch = vercelHost(value(env, "VERCEL_BRANCH_URL"));
  if (isPreview(env) && deployment) {
    return { allowedHosts: [...new Set([deployment, branch].filter((host): host is string => Boolean(host)))], protocol: "https" as const };
  }
  return authBaseUrl(env) ?? DEV_FALLBACK;
}
export function previewBranchOrigin(env: Env) {
  if (!isPreview(env)) return null;
  const branch = vercelHost(value(env, "VERCEL_BRANCH_URL"));
  return branch ? `https://${branch}` : null;
}
export function authSecretValid(env: Env) { return (value(env, "BETTER_AUTH_SECRET")?.length ?? 0) >= 32; }
/** Desarrollo funciona con el secreto local; Preview y producción fallan cerrados sin secreto ≥ 32 y URL https. */
export function authEnabled(env: Env) {
  if (isDev(env) && !isPreview(env)) return true;
  return authSecretValid(env) && Boolean(authBaseUrl(env)?.startsWith("https://"));
}
/** Google en Preview usa el alias estable de rama como callback registrado. */
export function googleEnabled(env: Env) {
  if (!value(env, "GOOGLE_CLIENT_ID") || !value(env, "GOOGLE_CLIENT_SECRET") || !authSecretValid(env) || !authEnabled(env)) return false;
  return !isPreview(env) || Boolean(previewBranchOrigin(env) && httpOrigin(value(env, "BETTER_AUTH_URL"), true) === previewBranchOrigin(env));
}
/** El botón de Google solo sirve si la página se abrió en el mismo host que el callback (las cookies de estado son por host). */
export function googleUsableOnHost(env: Env, host: string | null | undefined) {
  const base = previewBranchOrigin(env) ?? authBaseUrl(env);
  if (!base || !host) return false;
  return new URL(base).host === host.toLowerCase();
}
/** Orígenes fijos extra: el alias de rama en Preview. */
export function staticTrustedOrigins(env: Env) {
  if (!isPreview(env)) return [];
  const branch = vercelHost(value(env, "VERCEL_BRANCH_URL"));
  return branch ? [`https://${branch}`] : [];
}
const privateIpv4 = (host: string) => {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return false;
  const [a, b] = parts.map(Number);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
};
export function devPort(env: Env) {
  const port = value(env, "PORT");
  if (port && /^\d{2,5}$/.test(port)) return port;
  const base = authBaseUrl(env);
  return (base && new URL(base).port) || "3000";
}
/** En desarrollo acepta http de localhost/127.0.0.1/IP privada en el puerto del dev server (probar desde el celular por la red local). */
export function isTrustedDevOrigin(env: Env, origin: string | null | undefined) {
  if (!isDev(env) || isPreview(env) || !origin) return false;
  let url: URL;
  try { url = new URL(origin); } catch { return false; }
  if (url.protocol !== "http:" || url.username || url.password || url.port !== devPort(env)) return false;
  const host = url.hostname.toLowerCase();
  return host === "localhost" || host === "[::1]" || privateIpv4(host);
}
/** Origen dinámico por request: solo el de desarrollo validado; nunca ecoa un valor arbitrario. */
export function requestTrustedOrigins(env: Env, request?: Request) {
  if (!request) return [];
  const origin = request.headers.get("origin");
  let candidate = origin && origin !== "null" ? origin : null;
  if (!candidate) { try { candidate = new URL(request.headers.get("referer") ?? "").origin; } catch { candidate = null; } }
  return candidate && isTrustedDevOrigin(env, candidate) ? [new URL(candidate).origin] : [];
}

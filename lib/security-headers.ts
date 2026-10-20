const productionPolicy = [
  "default-src 'self'",
  // Next currently emits inline bootstrap/RSC scripts. Replacing this with nonces
  // would disable static rendering/ISR across the app; see docs/csp-qa.md.
  "script-src 'self' 'unsafe-inline' https://sdk.mercadopago.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://lh3.googleusercontent.com https://lh5.googleusercontent.com https://*.ggpht.com https://http2.mlstatic.com https://tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://api.mercadopago.com https://*.mercadopago.com https://*.mercadolibre.com https://places.googleapis.com",
  "frame-src https://maps.google.com https://www.google.com https://*.mercadopago.com https://*.mercadolibre.com",
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "form-action 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export function contentSecurityPolicy(isDevelopment: boolean): string {
  if (!isDevelopment) return productionPolicy;

  // Next/React dev tooling evaluates source maps. Do not emit this in Production.
  return productionPolicy.replace(
    "script-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  ).replace("; upgrade-insecure-requests", "");
}

export const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy(process.env.NODE_ENV !== "production") },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
] as const;

import type { NextConfig } from "next";

const securityHeaders = [
  { key: "Content-Security-Policy", value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
] as const;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Solo `next dev`: permite probar desde el celular por la IP de la red local (si no, Next bloquea sus scripts
  // de desarrollo, la página no se hidrata y no funcionan el header, la cuenta ni el carrito).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  async headers() {
    return [{ source: "/(.*)", headers: [...securityHeaders] }];
  },
};

export default nextConfig;

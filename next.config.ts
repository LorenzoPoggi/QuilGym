import type { NextConfig } from "next";
import variantData from "./data/product-variants.json";
import { flavorRedirects, type FlavorData } from "./lib/flavor-merge";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Solo `next dev`: permite probar desde el celular por la IP de la red local (si no, Next bloquea sus scripts
  // de desarrollo, la página no se hidrata y no funcionan el header, la cuenta ni el carrito).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
  // Los productos que se unieron en una ficha con sabores conservan sus links viejos (SEO, favoritos, enlaces compartidos).
  async redirects() {
    return flavorRedirects(variantData as unknown as FlavorData).map(({ from, to }) => ({ source: `/productos/${from}`, destination: `/productos/${to}`, permanent: true }));
  },
  async headers() {
    return [{ source: "/(.*)", headers: [...securityHeaders] }];
  },
};

export default nextConfig;

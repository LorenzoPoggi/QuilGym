import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Solo `next dev`: permite probar desde el celular por la IP de la red local (si no, Next bloquea sus scripts
  // de desarrollo, la página no se hidrata y no funcionan el header, la cuenta ni el carrito).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  images: { remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com" }] },
};

export default nextConfig;

/**
 * Genera la imagen del hero de la home (public/assets/hero/hero-productos.webp):
 * escena de estudio con pedestales y productos reales del catálogo, a partir de
 * los PNG transparentes oficiales de Star Nutrition descargados en .cache/hero/.
 *
 *   node scripts/build-hero.mjs
 */
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const W = 2200, H = 1600;
const cache = (file) => path.join(root, ".cache/hero", file);

// Escena: fondo, piso y pedestales (vector, se renderiza a la resolución final).
const scene = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1eee8"/><stop offset="1" stop-color="#e5e1d9"/></linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dcd5c8"/><stop offset="1" stop-color="#cfc6b6"/></linearGradient>
    <radialGradient id="glow" cx=".55" cy=".35" r=".6"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
    <linearGradient id="front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f6266"/><stop offset="1" stop-color="#244c50"/></linearGradient>
    <linearGradient id="front2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#29565a"/><stop offset="1" stop-color="#1f4245"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#wall)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect y="1210" width="${W}" height="${H - 1210}" fill="url(#floor)"/>
  <rect y="1205" width="${W}" height="10" fill="#d6cfc2" opacity=".6"/>
  <!-- sombra de los pedestales sobre el piso -->
  <ellipse cx="1180" cy="1395" rx="900" ry="60" fill="#5d564b" opacity=".28" filter="url(#soft)"/>
  <!-- pedestal principal -->
  <path d="M420 1010 L1520 1010 L1600 960 L500 960 Z" fill="#4a8287"/>
  <rect x="420" y="1010" width="1100" height="365" fill="url(#front)"/>
  <path d="M1520 1010 L1600 960 L1600 1325 L1520 1375 Z" fill="#1d3f42"/>
  <!-- pedestal bajo derecho -->
  <path d="M1460 1150 L2000 1150 L2060 1112 L1520 1112 Z" fill="#3e7377"/>
  <rect x="1460" y="1150" width="540" height="250" fill="url(#front2)"/>
  <path d="M2000 1150 L2060 1112 L2060 1362 L2000 1400 Z" fill="#183639"/>
  <!-- brillo en aristas -->
  <rect x="420" y="1010" width="1100" height="3" fill="#ffffff" opacity=".25"/>
  <rect x="1460" y="1150" width="540" height="3" fill="#ffffff" opacity=".22"/>
</svg>`;

/** Producto recortado, escalado a una altura, con su base apoyada en (cx, baseY). */
async function product(file, height, cx, baseY) {
  const { data, info } = await sharp(cache(file)).trim().resize({ height }).toBuffer({ resolveWithObject: true });
  const shadowW = Math.round(info.width * 0.95), shadowH = Math.round(info.width * 0.12);
  const shadow = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${shadowW + 120}" height="${shadowH + 120}"><ellipse cx="${(shadowW + 120) / 2}" cy="${(shadowH + 120) / 2}" rx="${shadowW / 2}" ry="${shadowH / 2}" fill="#10201f" opacity=".45"/></svg>`)).blur(18).png().toBuffer();
  return [
    { input: shadow, left: Math.round(cx - (shadowW + 120) / 2), top: Math.round(baseY - (shadowH + 120) / 2 + 4) },
    { input: data, left: Math.round(cx - info.width / 2), top: Math.round(baseY - info.height) },
  ];
}

const layers = [
  ...(await product("mutant-mass-5kg.png", 640, 800, 992)),
  ...(await product("platinum-whey-protein-chocolate-x-2-lbs.png", 660, 1230, 992)),
  ...(await product("creatina-monohidrato-eeuu-x-300-grs.png", 375, 1740, 1134)),
  ...(await product("pump-v8-285-gr.png", 360, 360, 1405)),
];

const out = path.join(root, "public/assets/hero");
await mkdir(out, { recursive: true });
await sharp(Buffer.from(scene)).composite(layers).webp({ quality: 90 }).toFile(path.join(out, "hero-productos.webp"));
console.log("ok", path.join(out, "hero-productos.webp"));

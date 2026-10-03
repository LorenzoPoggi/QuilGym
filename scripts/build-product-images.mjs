/**
 * Arma las imágenes finales de cada producto según data/product-gallery-curation.json:
 * toma fotos de la caché de Tiendanube (tN) y de los sitios oficiales (oN),
 * normaliza encuadre y formato, y escribe public/assets/products/<slug>/NN.webp
 * más data/product-images.json (lo lee el seed).
 *
 *   node scripts/fetch-product-images.mjs   # una vez, llena .cache/tiendanube
 *   node scripts/build-product-images.mjs
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const curation = JSON.parse(await readFile(path.join(root, "data/product-gallery-curation.json"), "utf8"));
const headers = { "user-agent": "Mozilla/5.0 (QuilGym catalog migration)" };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

const officialImages = new Map();
async function officialImageUrls(source) {
  if (!officialImages.has(source)) {
    const [domain, , handle] = source.split("/");
    const response = await fetch(`https://${domain}/products/${handle}.json`, { headers });
    if (!response.ok) throw new Error(`${response.status} ${source}`);
    const { product } = await response.json();
    officialImages.set(source, product.images.map((image) => image.src.split("?")[0]));
  }
  return officialImages.get(source);
}

async function loadRef(slug, ref) {
  const index = Number(ref.slice(1));
  if (ref.startsWith("t")) return readFile(path.join(root, ".cache/tiendanube", slug, `${index + 1}.webp`));

  const urls = await officialImageUrls(curation.officialSource[slug]);
  const url = urls[index];
  const cache = path.join(root, ".cache/official", slug, `${index}${path.extname(url)}`);
  if (!existsSync(cache)) {
    await mkdir(path.dirname(cache), { recursive: true });
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    await writeFile(cache, Buffer.from(await response.arrayBuffer()));
  }
  return readFile(cache);
}

/** ¿El fondo es blanco/transparente? Se miran las cuatro esquinas. */
async function hasPlainBackground(buffer) {
  const { data, info } = await sharp(buffer).flatten({ background: WHITE }).resize(64, 64, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3);
  return [[0, 0], [63, 0], [0, 63], [63, 63]].every(([x, y]) => at(x, y).every((value) => value > 240));
}

async function trimmed(buffer) {
  const flat = await sharp(buffer).flatten({ background: WHITE }).toBuffer();
  return sharp(flat).trim({ background: "#ffffff", threshold: 12 }).toBuffer({ resolveWithObject: true });
}

/** Producto sobre blanco: recorte al ras y lienzo cuadrado con margen uniforme. Fotos ambientadas: solo redimensionar. */
async function renderProduct(buffer) {
  if (!(await hasPlainBackground(buffer))) {
    return sharp(buffer).flatten({ background: WHITE }).resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  }
  const { data, info } = await trimmed(buffer);
  const side = Math.round(Math.max(info.width, info.height) * 1.12);
  const left = Math.round((side - info.width) / 2), top = Math.round((side - info.height) / 2);
  const square = await sharp(data).extend({ left, right: side - info.width - left, top, bottom: side - info.height - top, background: WHITE }).toBuffer();
  return sharp(square).resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
}

/** Rótulo nutricional: se prioriza la legibilidad del texto. */
async function renderNutrition(buffer) {
  const { data, info } = await trimmed(buffer);
  const pad = Math.round(Math.max(info.width, info.height) * 0.04);
  return sharp(data).extend({ top: pad, bottom: pad, left: pad, right: pad, background: WHITE }).resize(2000, 2000, { fit: "inside", withoutEnlargement: true }).webp({ quality: 92 }).toBuffer({ resolveWithObject: true });
}

/** Entre alternativas "a|b" gana la de más píxeles útiles. */
async function pick(slug, slot) {
  let best = null;
  for (const ref of slot.split("|")) {
    const buffer = await loadRef(slug, ref);
    const { info } = await trimmed(buffer);
    const area = info.width * info.height;
    if (!best || area > best.area) best = { ref, buffer, area };
  }
  return best;
}

const manifest = {};
for (const [slug, { product, nutrition }] of Object.entries(curation.products)) {
  const dir = path.join(root, "public/assets/products", slug);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  manifest[slug] = [];

  const slots = [...product.map((slot) => ({ slot, kind: "product" })), ...nutrition.map((slot) => ({ slot, kind: "nutrition" }))];
  for (const [position, { slot, kind }] of slots.entries()) {
    const chosen = await pick(slug, slot);
    const { data, info } = kind === "product" ? await renderProduct(chosen.buffer) : await renderNutrition(chosen.buffer);
    const file = `${String(position + 1).padStart(2, "0")}.webp`;
    await writeFile(path.join(dir, file), data);
    manifest[slug].push({ path: `/assets/products/${slug}/${file}`, kind, width: info.width, height: info.height, source: chosen.ref });
  }
  console.log(`${slug}: ${manifest[slug].map((image) => `${image.kind[0]}:${image.source}:${image.width}`).join(" ")}`);
}

await writeFile(path.join(root, "data/product-images.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Listo: ${Object.values(manifest).flat().length} imágenes.`);

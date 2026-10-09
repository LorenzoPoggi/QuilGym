/**
 * Utilidades compartidas del pipeline de fotos (v2): fuentes oficiales por marca en
 * data/product-photo-sources/<marca>.json, caché en .cache/official-photos y render con sharp.
 * Ver el `_doc` de data/product-photo-sources/README.json para el formato.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const root = path.resolve(import.meta.dirname, "../..");
export const headers = { "user-agent": "Mozilla/5.0 (QuilGym catalog photos)", accept: "image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8" };
export const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
export const MAX_SIDE = 1600;
export const GOOD_PRODUCT_SIDE = 1200;
const MIN_PRODUCT_SIDE = 500, MIN_NUTRITION_SIDE = 600;
const cacheDir = path.join(root, ".cache/official-photos");
const sourcesDir = path.join(root, "data/product-photo-sources");

export const isCombo = (slug) => slug.startsWith("combo-");
export const isShaker = (slug) => slug.startsWith("shaker-");
export const hostOf = (value) => { try { return new URL(value).hostname.replace(/^www\./, ""); } catch { return null; } };

/** Lee todos los JSON de marca y valida su forma. Devuelve { entries: Map<slug, entry>, errors }. */
export async function loadPhotoSources(catalogSlugs) {
  const entries = new Map(), errors = [];
  if (!existsSync(sourcesDir)) return { entries, errors };
  for (const file of (await readdir(sourcesDir)).filter((name) => name.endsWith(".json") && name !== "README.json").sort()) {
    const where = `data/product-photo-sources/${file}`;
    let data;
    try { data = JSON.parse(await readFile(path.join(sourcesDir, file), "utf8")); } catch (error) { errors.push(`${where}: JSON inválido (${error.message})`); continue; }
    const sites = (data.officialSites ?? []).map(hostOf);
    if (!data.brand || !sites.length || sites.includes(null)) errors.push(`${where}: faltan "brand" u "officialSites" con URLs https válidas`);
    for (const [slug, entry] of Object.entries(data.products ?? {})) {
      const at = `${where} › ${slug}`;
      if (catalogSlugs && !catalogSlugs.has(slug)) errors.push(`${at}: no es un siteSlug de data/tiendanube-catalog.json`);
      if (isCombo(slug)) errors.push(`${at}: los combos no llevan fotos propias (usan ComboVisual)`);
      if (entries.has(slug)) errors.push(`${at}: el producto ya aparece en ${entries.get(slug).file}`);
      for (const [index, source] of (entry.sources ?? []).entries()) {
        const label = `${at} › sources[${index}]`;
        if (!/^https:\/\//.test(source.url ?? "")) errors.push(`${label}: "url" debe ser https`);
        if (!["product", "nutrition"].includes(source.kind)) errors.push(`${label}: "kind" debe ser "product" o "nutrition"`);
        const page = hostOf(source.sourcePage ?? "");
        if (!page || !sites.some((site) => page === site || page.endsWith(`.${site}`))) errors.push(`${label}: "sourcePage" debe ser una página de ${sites.join(" / ")} (officialSites)`);
        if (source.crop && !["left", "top", "width", "height"].every((key) => Number.isInteger(source.crop[key]) && source.crop[key] >= 0)) errors.push(`${label}: "crop" necesita left/top/width/height enteros en píxeles del original`);
      }
      if (entry.dropBaseline !== undefined && entry.dropBaseline !== true && !Array.isArray(entry.dropBaseline)) errors.push(`${at}: "dropBaseline" es true o una lista de refs ("t0", "o2"…)`);
      entries.set(slug, { ...entry, sources: entry.sources ?? [], file: where, brand: data.brand });
    }
  }
  return { entries, errors };
}

/** Descarga (si falta) y devuelve el original cacheado de una URL oficial. */
export async function cachedSource(slug, url, { offline = false } = {}) {
  const dir = path.join(cacheDir, slug);
  const base = createHash("sha1").update(url).digest("hex").slice(0, 16);
  const existing = existsSync(dir) ? (await readdir(dir)).find((name) => name.startsWith(`${base}.`)) : null;
  if (existing) return { file: path.join(dir, existing), buffer: await readFile(path.join(dir, existing)), downloaded: false };
  if (offline) throw new Error(`sin caché: ${url} (correr npm run images:official:fetch)`);
  const response = await fetch(url, { headers, redirect: "follow" });
  if (!response.ok) throw new Error(`HTTP ${response.status} al bajar ${url}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) throw new Error(`no es una imagen (${type || "sin content-type"}): ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const { format } = await sharp(buffer).metadata().catch(() => ({}));
  if (!["jpeg", "png", "webp", "avif", "gif", "tiff"].includes(format)) throw new Error(`formato no soportado (${format ?? "ilegible"}): ${url}`);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${base}.${format === "jpeg" ? "jpg" : format}`);
  await writeFile(file, buffer);
  return { file, buffer, downloaded: true };
}

export async function applyCrop(buffer, crop) {
  return crop ? sharp(buffer).extract(crop).toBuffer() : buffer;
}

/** ¿El fondo es blanco/transparente? Se miran las cuatro esquinas. */
export async function hasPlainBackground(buffer) {
  const { data, info } = await sharp(buffer).flatten({ background: WHITE }).resize(64, 64, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3);
  return [[0, 0], [63, 0], [0, 63], [63, 63]].every(([x, y]) => at(x, y).every((value) => value > 240));
}

export async function trimmed(buffer) {
  const flat = await sharp(buffer).flatten({ background: WHITE }).toBuffer();
  return sharp(flat).trim({ background: "#ffffff", threshold: 12 }).toBuffer({ resolveWithObject: true });
}

/** Producto sobre blanco: recorte al ras y lienzo cuadrado con margen uniforme. Fotos ambientadas: solo redimensionar. */
export async function renderProduct(buffer) {
  if (!(await hasPlainBackground(buffer))) {
    return sharp(buffer).flatten({ background: WHITE }).resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 86 }).toBuffer({ resolveWithObject: true });
  }
  const { data, info } = await trimmed(buffer);
  const side = Math.round(Math.max(info.width, info.height) * 1.12);
  const left = Math.round((side - info.width) / 2), top = Math.round((side - info.height) / 2);
  const square = await sharp(data).extend({ left, right: side - info.width - left, top, bottom: side - info.height - top, background: WHITE }).toBuffer();
  return sharp(square).resize(1400, 1400, { fit: "inside", withoutEnlargement: true }).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });
}

/** Rótulo nutricional: se prioriza la legibilidad del texto. */
export async function renderNutrition(buffer) {
  const { data, info } = await trimmed(buffer);
  const pad = Math.round(Math.max(info.width, info.height) * 0.04);
  return sharp(data).extend({ top: pad, bottom: pad, left: pad, right: pad, background: WHITE }).resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true }).webp({ quality: 92 }).toBuffer({ resolveWithObject: true });
}

/** Valida un original oficial: devuelve { width, height, trimmedWidth, trimmedHeight, problems, warnings }. */
export async function inspectSource(buffer, source) {
  const meta = await sharp(buffer).metadata();
  const cropped = await applyCrop(buffer, source.crop);
  const { info } = await trimmed(cropped);
  const side = Math.max(info.width, info.height);
  const problems = [], warnings = [];
  const minimum = source.kind === "nutrition" ? MIN_NUTRITION_SIDE : MIN_PRODUCT_SIDE;
  if (side < minimum && !source.allowSmaller) problems.push(`útil ${info.width}×${info.height} px, menos de ${minimum} px (usar "allowSmaller": true solo si no existe nada mejor)`);
  else if (source.kind === "product" && side < GOOD_PRODUCT_SIDE / 1.12) warnings.push(`útil ${info.width}×${info.height} px: la foto final queda bajo ${GOOD_PRODUCT_SIDE} px`);
  return { width: meta.width, height: meta.height, trimmedWidth: info.width, trimmedHeight: info.height, problems, warnings };
}

/** dHash 64 bits sobre la imagen recortada, para detectar la misma foto en otra resolución. */
export async function photoHash(buffer) {
  const { data } = await sharp(buffer).flatten({ background: WHITE }).grayscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = 0n;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits = (bits << 1n) | (data[y * 9 + x] > data[y * 9 + x + 1] ? 1n : 0n);
  return bits;
}

export function hammingDistance(a, b) {
  let value = a ^ b, count = 0;
  while (value) { count += Number(value & 1n); value >>= 1n; }
  return count;
}

/**
 * Arma las imágenes finales de cada producto (pipeline v2):
 *   1. Base: data/product-gallery-curation.json (tN = foto N de la caché de Tiendanube,
 *      oN = foto N del Shopify oficial de officialSource; "a|b" elige la de más píxeles útiles).
 *   2. Encima, las fuentes oficiales de data/product-photo-sources/<marca>.json (bajadas con
 *      npm run images:official:fetch): van primero, en el orden del JSON, y desplazan a las de
 *      la base hasta el máximo (2 fotos de producto y 1 rótulo, o más si el JSON trae más).
 *      Si una foto de la base es la misma imagen (dHash) en mayor resolución, se conserva la de la base.
 *      Si una oficial es más chica que una foto de la base que desplaza, el producto falla
 *      salvo "allowSmaller": true en esa fuente (no se reemplaza una foto buena por una peor).
 * Escribe public/assets/products/<slug>/NN.webp (solo los archivos que cambian) y
 * data/product-images.json (lo leen el seed, db:sync-images y lib/combo-contents.ts).
 * Los combos no llevan fotos propias (usan ComboVisual): se omiten y sus carpetas se listan para borrar
 * después de correr db:sync-images en cada base.
 *
 *   npm run images:official:build -- --dry-run          (no escribe: muestra qué archivos cambiarían)
 *   npm run images:official:build -- --only=slug1,slug2 (el resto del manifiesto queda igual)
 *   npm run images:official:build -- --prune            (borra NN.webp sobrantes; solo después del sync)
 */
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyCrop, cachedSource, hammingDistance, headers, inspectSource, isCombo, loadPhotoSources, photoHash, renderNutrition, renderProduct, root, trimmed } from "./lib/product-photos.mjs";

const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=")[1];
const dryRun = process.argv.includes("--dry-run");
const prune = process.argv.includes("--prune");
const only = arg("only")?.split(",");

const curation = JSON.parse(await readFile(path.join(root, "data/product-gallery-curation.json"), "utf8"));
const catalog = JSON.parse(await readFile(path.join(root, "data/tiendanube-catalog.json"), "utf8"));
const manifestPath = path.join(root, "data/product-images.json");
const previous = JSON.parse(await readFile(manifestPath, "utf8"));
const { entries: overlays, errors } = await loadPhotoSources(new Set(catalog.products.map((product) => product.siteSlug)));
for (const error of errors) console.error(`✗ ${error}`);
if (errors.length) { console.error("Corregí los JSON de data/product-photo-sources antes de construir."); process.exit(1); }

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

/** Referencia de la curaduría base. La caché manda: así el build no depende de que la tienda oficial reordene su galería. */
async function loadRef(slug, ref) {
  const index = Number(ref.slice(1));
  if (ref.startsWith("t")) return readFile(path.join(root, ".cache/tiendanube", slug, `${index + 1}.webp`));
  const dir = path.join(root, ".cache/official", slug);
  const cached = existsSync(dir) ? (await readdir(dir)).find((name) => name.startsWith(`${index}.`)) : null;
  if (cached) return readFile(path.join(dir, cached));
  const url = (await officialImageUrls(curation.officialSource[slug]))[index];
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${index}${path.extname(url)}`), buffer);
  return buffer;
}

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

const side = (image) => Math.max(image.info.width, image.info.height);
const render = (kind, buffer) => kind === "product" ? renderProduct(buffer) : renderNutrition(buffer);
async function candidate(kind, buffer, extra) {
  const { data, info } = await render(kind, buffer);
  return { kind, data, info, hash: await photoHash(data), ...extra };
}

/** Mezcla oficiales y base de un tipo. Devuelve { images, notes, error }. */
function merge(kind, official, base, entry) {
  const notes = [];
  if (!official.length) return { images: base, notes };
  const rest = [];
  for (const image of base) {
    const twin = official.find((item) => !item.replacedBy && hammingDistance(item.hash, image.hash) <= 8);
    if (!twin) { rest.push(image); continue; }
    if (side(image) > side(twin)) { twin.replacedBy = image; notes.push(`${image.ref} es la misma foto que ${twin.source} en más resolución: se conserva la de la base`); }
  }
  const limit = Math.max(official.length, kind === "product" ? entry.maxProduct ?? 2 : entry.maxNutrition ?? 1);
  const combined = [...official.map((item) => item.replacedBy ?? item), ...rest];
  const images = combined.slice(0, limit);
  for (const removed of combined.slice(limit)) {
    const worse = official.filter((item) => !item.replacedBy && !item.allowSmaller && side(item) < side(removed));
    if (worse.length) return { error: `${worse.map((item) => item.source).join(", ")} (${worse.map(side).join("/")} px) es más chica que ${removed.ref} (${side(removed)} px), que quedaría afuera. Usá "allowSmaller": true, "maxProduct"/"maxNutrition" o "dropBaseline".` };
    notes.push(`sale ${removed.ref} (${side(removed)} px)`);
  }
  return { images, notes };
}

const manifest = {};
const changes = [], stale = [], failures = [];
const comboDirs = [];

for (const [slug, selection] of Object.entries(curation.products)) {
  if (isCombo(slug)) continue;
  if (only && !only.includes(slug)) { if (previous[slug]) manifest[slug] = previous[slug]; continue; }

  const base = [];
  for (const kind of ["product", "nutrition"]) {
    for (const slot of selection[kind]) {
      const chosen = await pick(slug, slot);
      base.push(await candidate(kind, chosen.buffer, { ref: chosen.ref, source: chosen.ref }));
    }
  }

  let images = base;
  const entry = overlays.get(slug);
  if (entry) {
    const drop = entry.dropBaseline === true ? null : new Set(entry.dropBaseline ?? []);
    const kept = base.filter((image) => drop && !drop.has(image.ref));
    const official = [];
    let error = null;
    for (const source of entry.sources) {
      try {
        const { buffer } = await cachedSource(slug, source.url);
        const report = await inspectSource(buffer, source);
        if (report.problems.length) { error = `${source.url}: ${report.problems.join("; ")}`; break; }
        official.push(await candidate(source.kind, await applyCrop(buffer, source.crop), { ref: source.url, source: source.url, sourcePage: source.sourcePage, allowSmaller: source.allowSmaller }));
      } catch (caught) { error = caught.message; break; }
    }
    const merged = error ? null : ["product", "nutrition"].map((kind) => merge(kind, official.filter((item) => item.kind === kind), kept.filter((item) => item.kind === kind), entry));
    error ??= merged.find((result) => result.error)?.error;
    if (error) failures.push(`${slug}: ${error} → se mantiene la galería base`);
    else {
      images = merged.flatMap((result) => result.images);
      for (const note of merged.flatMap((result) => result.notes)) console.log(`  ${slug}: ${note}`);
    }
  }

  const dir = path.join(root, "public/assets/products", slug);
  manifest[slug] = [];
  for (const [position, image] of images.entries()) {
    const file = `${String(position + 1).padStart(2, "0")}.webp`;
    const target = path.join(dir, file);
    const current = existsSync(target) ? await readFile(target) : null;
    if (!current || !current.equals(image.data)) {
      changes.push(`${slug}/${file}${current ? "" : " (nueva)"}`);
      if (!dryRun) { await mkdir(dir, { recursive: true }); await writeFile(target, image.data); }
    }
    manifest[slug].push({ path: `/assets/products/${slug}/${file}`, kind: image.kind, width: image.info.width, height: image.info.height, source: image.source, ...(image.sourcePage ? { sourcePage: image.sourcePage } : {}) });
  }
  const extra = existsSync(dir) ? (await readdir(dir)).filter((name) => /^\d+\.webp$/.test(name) && Number.parseInt(name) > images.length) : [];
  for (const name of extra) {
    stale.push(`public/assets/products/${slug}/${name}`);
    if (prune && !dryRun) await rm(path.join(dir, name));
  }
  console.log(`${slug}: ${manifest[slug].map((image) => `${image.kind[0]}:${image.source.startsWith("http") ? "oficial" : image.source}:${image.width}`).join(" ")}`);
}

for (const name of await readdir(path.join(root, "public/assets/products"))) if (isCombo(name)) comboDirs.push(`public/assets/products/${name}/`);

if (!dryRun) await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${dryRun ? "[dry run] " : ""}${Object.values(manifest).flat().length} imágenes en ${Object.keys(manifest).length} productos; ${changes.length} archivo(s) ${dryRun ? "cambiarían" : "escritos"}.`);
if (changes.length) console.log(`  ${changes.join("\n  ")}`);
if (stale.length) console.log(`\nSobrantes${prune && !dryRun ? " (borrados)" : " (borrar con --prune después de correr db:sync-images en cada base)"}:\n  ${stale.join("\n  ")}`);
if (comboDirs.length) console.log(`\nCarpetas de combos fuera del pipeline (borrar después de db:sync-images en cada base):\n  ${comboDirs.join("\n  ")}`);
if (failures.length) { console.error(`\n✗ ${failures.join("\n✗ ")}`); process.exitCode = 1; }

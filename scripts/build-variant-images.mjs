/**
 * Fotos por sabor (variante): frente, dorso y rótulo nutricional de cada sabor, desde fuentes oficiales.
 * Fuentes: data/variant-photo-sources.json. Resultado: public/assets/products/<slug>/<sabor>/NN.webp
 * y data/variant-images.json (lo lee `npm run db:sync-images` para llenar `variant_images`).
 *
 *   npm run images:variants                      dry-run: valida el JSON y muestra qué falta (sin red, sin escribir)
 *   npm run images:variants -- --fetch           baja los originales a .cache/official-photos (usa la red, con pausa
 *                                                entre pedidos para no saturar los sitios) y muestra tamaños; no escribe public/
 *   npm run images:variants -- --apply           arma las webp desde la caché y escribe public/ + el manifiesto
 *   npm run images:variants -- --from-products   para los sabores que eran productos propios (fromSlug en product-variants.json):
 *                                                reutiliza la galería que ya tenían (data/product-images.json). No toca public/ ni la red
 *   Filtros: --only=slug1,slug2  --variant=chocolate
 *
 * No inventa ni retipea rótulos: si una marca no publica dorso o rótulo, el sabor queda con las fotos que haya
 * y se informa en "faltantes" para sacar las fotos en el local. Nunca amplía una foto por encima de su tamaño real.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyCrop, cachedSource, hammingDistance, hostOf, inspectSource, photoHash, renderNutrition, renderProduct, root } from "./lib/product-photos.mjs";

const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=")[1];
const has = (flag) => process.argv.includes(`--${flag}`);
const apply = has("apply") && !has("dry-run");
const fetchMode = has("fetch");
const only = arg("only")?.split(",");
const onlyVariant = arg("variant")?.split(",");
const MAX_SOURCES = 8;
const PRODUCT_OPTIONS = { size: 2400, maxSide: 2400, quality: 90 };
const NUTRITION_OPTIONS = { maxSide: 2400, quality: 92 };
const GOOD_SIDE = 1200;
const PAUSE_MS = 1200;

const sourcesPath = path.join(root, "data/variant-photo-sources.json");
const manifestPath = path.join(root, "data/variant-images.json");
const read = async (file) => JSON.parse(await readFile(path.join(root, file), "utf8"));
const catalog = await read("data/tiendanube-catalog.json");
const flavors = await read("data/product-variants.json");
const config = existsSync(sourcesPath) ? JSON.parse(await readFile(sourcesPath, "utf8")) : { products: {} };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Valida data/variant-photo-sources.json contra el catálogo y los sabores declarados. */
function validate() {
  const errors = [];
  const slugs = new Set(catalog.products.map((product) => product.siteSlug));
  const groups = new Map(flavors.groups.map((group) => [group.slug, new Set(group.variants.map((variant) => variant.key))]));
  for (const [slug, entry] of Object.entries(config.products ?? {})) {
    const sites = (entry.officialSites ?? []).map(hostOf);
    if (!slugs.has(slug)) errors.push(`${slug}: no es un siteSlug del catálogo`);
    if (!groups.has(slug)) errors.push(`${slug}: no tiene grupo de sabores en data/product-variants.json`);
    if (!sites.length || sites.includes(null)) errors.push(`${slug}: faltan "officialSites" con URLs https válidas`);
    for (const [key, variant] of Object.entries(entry.variants ?? {})) {
      const at = `${slug} › ${key}`;
      if (groups.has(slug) && !groups.get(slug).has(key)) errors.push(`${at}: el sabor no existe en data/product-variants.json`);
      if (!variant.sources?.length || variant.sources.length > MAX_SOURCES) errors.push(`${at}: necesita entre 1 y ${MAX_SOURCES} fuentes`);
      const seen = new Set();
      for (const [index, source] of (variant.sources ?? []).entries()) {
        const where = `${at} › sources[${index}]`;
        if (!/^https:\/\//.test(source.url ?? "")) errors.push(`${where}: "url" debe ser https`);
        if (seen.has(source.url)) errors.push(`${where}: URL repetida`);
        seen.add(source.url);
        if (!["product", "nutrition"].includes(source.kind)) errors.push(`${where}: "kind" debe ser "product" o "nutrition"`);
        const page = hostOf(source.sourcePage ?? "");
        if (!page || !sites.some((site) => page === site || page.endsWith(`.${site}`))) errors.push(`${where}: "sourcePage" debe ser una página de ${sites.join(" / ")}`);
        if (source.crop && !["left", "top", "width", "height"].every((k) => Number.isInteger(source.crop[k]) && source.crop[k] >= 0)) errors.push(`${where}: "crop" necesita left/top/width/height enteros`);
      }
    }
  }
  return errors;
}

if (has("from-products")) {
  // Los sabores que eran productos propios conservan su galería actual: no hace falta bajar ni renderizar nada.
  const productImages = await read("data/product-images.json");
  const manifest = existsSync(manifestPath) ? await read("data/variant-images.json") : {};
  let reused = 0;
  for (const group of flavors.groups) {
    if (only && !only.includes(group.slug)) continue;
    for (const variant of group.variants) {
      if (!variant.fromSlug || variant.fromSlug === group.slug || !productImages[variant.fromSlug]?.length) continue;
      manifest[`${group.slug}#${variant.key}`] = productImages[variant.fromSlug];
      reused++;
    }
  }
  await writeFile(manifestPath, `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2)}
`);
  console.log(`${reused} sabor(es) con la galería de su producto anterior en data/variant-images.json.`);
  process.exit(0);
}

const errors = validate();
for (const error of errors) console.error(`✗ ${error}`);
if (errors.length) process.exit(1);
if (apply && (!only?.length)) { console.error("--apply requiere --only=slug1,slug2 (revisá las fuentes y las vistas previas antes)."); process.exit(1); }

const selected = [];
for (const [slug, entry] of Object.entries(config.products ?? {})) {
  if (only && !only.includes(slug)) continue;
  for (const [key, variant] of Object.entries(entry.variants ?? {})) if (!onlyVariant || onlyVariant.includes(key)) selected.push({ slug, key, ...variant });
}
const previous = existsSync(manifestPath) ? await read("data/variant-images.json") : {};
const cacheKey = (slug, key) => `${slug}__${key}`;

if (!apply) {
  let sources = 0, missing = 0;
  const flavorsMissing = [];
  for (const item of selected) {
    for (const source of item.sources) {
      sources++;
      if (fetchMode) {
        try {
          const { buffer, downloaded } = await cachedSource(cacheKey(item.slug, item.key), source.url);
          const report = await inspectSource(buffer, source);
          const flag = report.problems.length ? "✗" : report.warnings.length ? "!" : "✓";
          console.log(`${flag} ${item.slug}#${item.key} ${source.kind.padEnd(9)} ${report.trimmedWidth}×${report.trimmedHeight} útil${downloaded ? " (descargada)" : ""} ${source.url.split("/").pop()}`);
          for (const problem of report.problems) console.log(`    ✗ ${problem}`);
          if (downloaded) await sleep(PAUSE_MS);
        } catch (error) { missing++; console.log(`✗ ${item.slug}#${item.key} ${source.url}: ${error.message}`); await sleep(PAUSE_MS); }
      } else {
        console.log(`[dry-run] ${item.slug}#${item.key} ${source.kind}: ${source.url}`);
      }
    }
    const kinds = new Set(item.sources.map((source) => source.kind));
    const count = item.sources.filter((source) => source.kind === "product").length;
    if (count < 2 || !kinds.has("nutrition")) flavorsMissing.push(`${item.slug}#${item.key}: ${count} foto(s) de producto${kinds.has("nutrition") ? "" : ", sin rótulo"}`);
  }
  console.log(`\n${selected.length} sabor(es), ${sources} fuente(s)${fetchMode ? `, ${missing} con error` : ""}. ${fetchMode ? "Originales en .cache/official-photos." : "Sin red ni escrituras: usá --fetch para bajar."}`);
  if (flavorsMissing.length) console.log(`\nFaltantes (frente + dorso + rótulo; fotografiar en el local si la marca no los publica):\n  ${flavorsMissing.join("\n  ")}`);
  if (missing) process.exitCode = 1;
} else {
  const manifest = { ...previous };
  const failures = [];
  const writes = [];
  for (const item of selected) {
    const rendered = [];
    for (const source of item.sources) {
      try {
        const { buffer } = await cachedSource(cacheKey(item.slug, item.key), source.url, { offline: true });
        const report = await inspectSource(buffer, source);
        if (report.problems.length) throw new Error(report.problems.join("; "));
        const cropped = await applyCrop(buffer, source.crop);
        const { data, info } = source.kind === "nutrition" ? await renderNutrition(cropped, NUTRITION_OPTIONS) : await renderProduct(cropped, PRODUCT_OPTIONS);
        const hash = await photoHash(data);
        const twin = rendered.find((other) => other.kind === source.kind && hammingDistance(other.hash, hash) <= 4);
        if (twin) { console.log(`  ${item.slug}#${item.key}: ${source.url.split("/").pop()} repite ${twin.url.split("/").pop()}; se omite`); continue; }
        rendered.push({ kind: source.kind, data, info, hash, url: source.url, sourcePage: source.sourcePage });
      } catch (error) { failures.push(`${item.slug}#${item.key}: ${error.message}`); }
    }
    if (!rendered.length) continue;
    // Orden de la galería: fotos de producto (frente, dorso…) y al final los rótulos.
    const ordered = [...rendered.filter((image) => image.kind === "product"), ...rendered.filter((image) => image.kind === "nutrition")];
    manifest[`${item.slug}#${item.key}`] = ordered.map((image, index) => {
      const file = `${String(index + 1).padStart(2, "0")}.webp`;
      writes.push({ target: path.join(root, "public/assets/products", item.slug, item.key, file), data: image.data });
      if (Math.max(image.info.width, image.info.height) < GOOD_SIDE && image.kind === "product") console.log(`  ! ${item.slug}#${item.key}/${file} ${image.info.width}×${image.info.height}: bajo ${GOOD_SIDE} px`);
      return { path: `/assets/products/${item.slug}/${item.key}/${file}`, kind: image.kind, width: image.info.width, height: image.info.height, source: image.url, sourcePage: image.sourcePage };
    });
  }
  if (failures.length) { console.error(`\n✗ ${failures.join("\n✗ ")}\nNo se escribió nada. Corregí las fuentes o corré --fetch.`); process.exit(1); }
  for (const { target, data } of writes) { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, data); }
  await writeFile(manifestPath, `${JSON.stringify(Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
  console.log(`\n${writes.length} archivo(s) escritos; manifiesto con ${Object.keys(manifest).length} galería(s) por sabor.`);
}

/**
 * Baja y valida las fotos oficiales declaradas en data/product-photo-sources/<marca>.json.
 * Guarda los originales en .cache/official-photos/<slug>/ (gitignored) y una vista previa del
 * resultado final en .cache/official-photos/_preview/<slug>-NN-<kind>.webp para revisarla.
 * No toca public/ ni data/product-images.json (eso lo hace images:official:build).
 *
 *   npm run images:official:fetch
 *   npm run images:official:fetch -- --brand=body-advance
 *   npm run images:official:fetch -- --only=preentreno-beast-blood,creatina-body-advance-300-gr
 *   npm run images:official:fetch -- --refresh   (vuelve a bajar aunque esté en caché)
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyCrop, cachedSource, inspectSource, loadPhotoSources, renderNutrition, renderProduct, root } from "./lib/product-photos.mjs";

const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.split("=")[1];
const only = arg("only")?.split(",");
const brand = arg("brand");
const refresh = process.argv.includes("--refresh");

const catalog = JSON.parse(await readFile(path.join(root, "data/tiendanube-catalog.json"), "utf8"));
const { entries, errors } = await loadPhotoSources(new Set(catalog.products.map((product) => product.siteSlug)));
for (const error of errors) console.error(`✗ ${error}`);

const previewDir = path.join(root, ".cache/official-photos/_preview");
await mkdir(previewDir, { recursive: true });
let failures = errors.length, total = 0;

for (const [slug, entry] of entries) {
  if (only && !only.includes(slug)) continue;
  if (brand && path.basename(entry.file, ".json") !== brand) continue;
  if (refresh) await rm(path.join(root, ".cache/official-photos", slug), { recursive: true, force: true });
  console.log(`\n${slug}  (${entry.file})`);
  for (const [index, source] of entry.sources.entries()) {
    total++;
    const label = `  ${String(index + 1).padStart(2, "0")} ${source.kind.padEnd(9)}`;
    try {
      const { buffer, downloaded } = await cachedSource(slug, source.url);
      const report = await inspectSource(buffer, source);
      const render = source.kind === "nutrition" ? renderNutrition : renderProduct;
      const { data, info } = await render(await applyCrop(buffer, source.crop));
      const preview = path.join(previewDir, `${slug}-${String(index + 1).padStart(2, "0")}-${source.kind}.webp`);
      await writeFile(preview, data);
      const status = report.problems.length ? "✗" : report.warnings.length ? "!" : "✓";
      console.log(`${label} ${status} original ${report.width}×${report.height}, útil ${report.trimmedWidth}×${report.trimmedHeight}, final ${info.width}×${info.height}${downloaded ? " (descargada)" : ""}`);
      console.log(`     ${source.url}`);
      for (const problem of report.problems) console.log(`     ✗ ${problem}`);
      for (const warning of report.warnings) console.log(`     ! ${warning}`);
      console.log(`     vista previa: ${path.relative(root, preview)}`);
      if (report.problems.length) failures++;
    } catch (error) {
      failures++;
      console.log(`${label} ✗ ${error.message}`);
    }
  }
}

console.log(`\n${total} fuente(s) revisada(s), ${failures} con error.${failures ? " Corregí el JSON antes de correr images:official:build." : " Revisá las vistas previas y después corré npm run images:official:build."}`);
if (failures) process.exitCode = 1;

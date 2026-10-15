/**
 * Auditoría local y de solo lectura de la galería curada.
 * No consulta la red, Neon ni escribe archivos.
 *
 *   npm run images:check
 *   npm run images:check -- --strict
 *   npm run images:check -- --verbose
 */
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const strict = process.argv.includes("--strict");
const verbose = process.argv.includes("--verbose");
const curation = JSON.parse(await readFile(path.join(root, "data/product-gallery-curation.json"), "utf8"));
const manifest = JSON.parse(await readFile(path.join(root, "data/product-images.json"), "utf8"));
const issues = [];
const rows = [];

const isCombo = (slug) => slug.startsWith("combo-");
const isShaker = (slug) => slug.startsWith("shaker-");
const sourceExists = (slug, slots) => slots.every((slot) => slot.split("|").every((ref) => {
  if (/^t\d+$/.test(ref)) return true;
  return /^o\d+$/.test(ref) && typeof curation.officialSource?.[slug] === "string";
}));

for (const [slug, selection] of Object.entries(curation.products)) {
  if (!sourceExists(slug, [...selection.product, ...selection.nutrition])) {
    issues.push(`${slug}: referencia oficial inválida o sin officialSource`);
  }
  if (isCombo(slug)) continue;

  const images = manifest[slug] ?? [];
  const productImages = images.filter((image) => image.kind === "product");
  const nutritionImages = images.filter((image) => image.kind === "nutrition");
  const row = { slug, product: productImages.length, nutrition: nutritionImages.length, lowResolution: 0, missingFiles: 0 };

  if (productImages.length < 2) issues.push(`${slug}: faltan fotos de producto (${productImages.length}/2)`);
  if (!isShaker(slug) && nutritionImages.length < 1) issues.push(`${slug}: falta foto nutricional (0/1)`);

  for (const image of images) {
    // Las URLs del manifiesto son relativas a la raíz pública de Next (`public/`),
    // no a la raíz del repositorio. Resolverlas contra root directamente produce
    // falsos positivos de archivos ausentes.
    const relativePath = image.path?.replace(/^\//, "");
    const fullPath = relativePath && path.resolve(root, "public", relativePath);
    if (!fullPath || !fullPath.startsWith(`${path.join(root, "public")}${path.sep}`)) {
      issues.push(`${slug}: ruta fuera de public/ o inválida`);
      row.missingFiles++;
      continue;
    }
    try {
      await access(fullPath);
      const metadata = await sharp(fullPath).metadata();
      if (!metadata.width || !metadata.height) {
        issues.push(`${slug}: imagen sin dimensiones legibles (${image.path})`);
        row.missingFiles++;
      } else {
        if (metadata.width !== image.width || metadata.height !== image.height) {
          issues.push(`${slug}: dimensiones del manifiesto no coinciden (${image.path})`);
        }
        if (image.kind === "product" && Math.max(metadata.width, metadata.height) < 1200) {
          row.lowResolution++;
          issues.push(`${slug}: resolución menor a 1200 px (${image.path}, ${metadata.width}x${metadata.height})`);
        }
      }
    } catch {
      row.missingFiles++;
      issues.push(`${slug}: no se puede leer el archivo (${image.path ?? "ruta ausente"})`);
    }
  }
  rows.push(row);
}

for (const slug of Object.keys(manifest)) {
  if (!curation.products[slug]) issues.push(`${slug}: aparece en el manifiesto pero no en la curaduría`);
}

const missingProduct = rows.filter((row) => row.product < 2).length;
const missingNutrition = rows.filter((row) => !isShaker(row.slug) && row.nutrition < 1).length;
const lowResolution = rows.reduce((sum, row) => sum + row.lowResolution, 0);
const missingFiles = rows.reduce((sum, row) => sum + row.missingFiles, 0);
const slugsFor = (predicate) => rows.filter(predicate).map((row) => row.slug);

console.log(`Galería: ${rows.length} productos, ${missingProduct} necesitan otra foto, ${missingNutrition} necesitan rótulo, ${lowResolution} fotos de producto bajo 1200 px, ${missingFiles} archivos ausentes/ilegibles.`);
if (missingProduct) console.log(`Falta una segunda foto: ${slugsFor((row) => row.product < 2).join(", ")}`);
if (missingNutrition) console.log(`Falta rótulo nutricional: ${slugsFor((row) => !isShaker(row.slug) && row.nutrition < 1).join(", ")}`);
if (lowResolution) console.log(`Fotos de producto bajo 1200 px: ${slugsFor((row) => row.lowResolution > 0).join(", ")}`);
if (missingFiles) console.log(`Archivos ausentes/ilegibles en: ${slugsFor((row) => row.missingFiles > 0).join(", ")}`);
if (verbose) for (const issue of issues) console.log(`- ${issue}`);
if (strict && issues.length) process.exitCode = 1;

/**
 * Plan puro de `npm run db:sync-images`: compara las imágenes guardadas en la base con
 * data/product-images.json (lo genera images:official:build) sin tocar nada. Sin `server-only`
 * para usarlo desde el script y los tests.
 */
export type ManifestImage = { path: string; kind: "product" | "nutrition"; width: number; height: number };
export type StoredImage = { url: string; kind: "product" | "nutrition"; width: number; height: number; position: number };
export type ImageSyncChange = { slug: string; reason: "replace" | "combo"; before: StoredImage[]; after: ManifestImage[] };
export type ImageSyncPlan = { changes: ImageSyncChange[]; unchanged: number; notInManifest: string[]; notInDatabase: string[] };

export const isComboSlug = (slug: string) => slug.startsWith("combo-");

const same = (stored: StoredImage[], manifest: ManifestImage[]) =>
  stored.length === manifest.length && stored.every((image, index) => image.url === manifest[index].path && image.kind === manifest[index].kind
    && image.width === manifest[index].width && image.height === manifest[index].height && image.position === index);

/**
 * - Producto con entrada en el manifiesto y galería distinta → se reemplaza completa (en orden).
 * - Combo → se quitan sus imágenes: las vistas usan ComboVisual con las fotos de los productos incluidos.
 * - Producto sin entrada en el manifiesto → no se toca (se informa).
 */
export function planImageSync(database: Map<string, StoredImage[]>, manifest: Record<string, ManifestImage[]>): ImageSyncPlan {
  const changes: ImageSyncChange[] = [];
  const notInManifest: string[] = [];
  let unchanged = 0;
  for (const [slug, stored] of [...database.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sorted = [...stored].sort((a, b) => a.position - b.position);
    if (isComboSlug(slug)) {
      if (sorted.length) changes.push({ slug, reason: "combo", before: sorted, after: [] }); else unchanged += 1;
      continue;
    }
    const target = manifest[slug];
    if (!target) { notInManifest.push(slug); continue; }
    if (same(sorted, target)) unchanged += 1;
    else changes.push({ slug, reason: "replace", before: sorted, after: target });
  }
  const notInDatabase = Object.keys(manifest).filter((slug) => !database.has(slug)).sort();
  return { changes, unchanged, notInManifest, notInDatabase };
}

/** Texto del diff para la consola (dry-run y apply). */
export function describeImageSync(plan: ImageSyncPlan) {
  const lines: string[] = [];
  const label = (image: { kind: string; width: number; height: number }) => `${image.kind === "nutrition" ? "rótulo" : "foto"} ${image.width}×${image.height}`;
  for (const change of plan.changes) {
    lines.push(`${change.reason === "combo" ? "−" : "~"} ${change.slug}${change.reason === "combo" ? " (combo: se quitan sus imágenes; usa ComboVisual)" : ""}`);
    for (const image of change.before) lines.push(`    − ${image.url} (${label(image)})`);
    for (const image of change.after) lines.push(`    + ${image.path} (${label(image)})`);
  }
  lines.push("", `${plan.changes.length} producto(s) con cambios, ${plan.unchanged} sin cambios.`);
  if (plan.notInManifest.length) lines.push(`Sin entrada en data/product-images.json (no se tocan): ${plan.notInManifest.join(", ")}`);
  if (plan.notInDatabase.length) lines.push(`En el manifiesto pero no en la base (no se crean acá): ${plan.notInDatabase.join(", ")}`);
  return lines.join("\n");
}

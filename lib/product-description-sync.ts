/**
 * Plan puro de `npm run db:sync-descriptions`: compara `products.description` con data/product-content.json.
 * Sin `server-only` para usarlo desde el script y los tests.
 */
export type DescriptionChange = { slug: string; removed: string[]; added: string[] };
export type DescriptionSyncPlan = { changes: DescriptionChange[]; unchanged: number; notInContent: string[]; notInDatabase: string[] };

/** Diff por líneas (sin orden): alcanza para revisar qué frases salen o entran en cada descripción. */
function lineDiff(before: string, after: string) {
  const a = before.split("\n").filter((line) => line.trim());
  const b = after.split("\n").filter((line) => line.trim());
  return { removed: a.filter((line) => !b.includes(line)), added: b.filter((line) => !a.includes(line)) };
}

export function planDescriptionSync(database: Map<string, string | null>, content: Record<string, string>): DescriptionSyncPlan {
  const changes: DescriptionChange[] = [];
  const notInContent: string[] = [];
  let unchanged = 0;
  for (const [slug, current] of [...database.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const target = content[slug];
    if (target === undefined) { notInContent.push(slug); continue; }
    if ((current ?? "") === target) { unchanged += 1; continue; }
    changes.push({ slug, ...lineDiff(current ?? "", target) });
  }
  const notInDatabase = Object.keys(content).filter((slug) => !database.has(slug)).sort();
  return { changes, unchanged, notInContent, notInDatabase };
}

export function describeDescriptionSync(plan: DescriptionSyncPlan) {
  const lines: string[] = [];
  for (const change of plan.changes) {
    lines.push(`~ ${change.slug}`);
    for (const line of change.removed) lines.push(`    − ${line}`);
    for (const line of change.added) lines.push(`    + ${line}`);
  }
  lines.push("", `${plan.changes.length} descripción(es) con cambios, ${plan.unchanged} sin cambios.`);
  if (plan.notInContent.length) lines.push(`Sin texto en data/product-content.json (no se tocan): ${plan.notInContent.join(", ")}`);
  if (plan.notInDatabase.length) lines.push(`En el JSON pero no en la base (no se crean acá): ${plan.notInDatabase.join(", ")}`);
  return lines.join("\n");
}

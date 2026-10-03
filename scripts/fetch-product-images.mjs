/**
 * Descarga la galería de cada producto desde la tienda anterior (Tiendanube)
 * a .cache/tiendanube/<slug>/<n>.webp (caché local, no versionada).
 * Después correr scripts/build-product-images.mjs. Saltea lo ya descargado.
 *
 *   node scripts/fetch-product-images.mjs
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const catalog = JSON.parse(await readFile(path.join(root, "data/tiendanube-catalog.json"), "utf8"));
const headers = { "user-agent": "Mozilla/5.0 (QuilGym catalog migration)" };

const slugify = (value) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&#?\w+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function galleryUrls(pageUrl) {
  const response = await fetch(pageUrl, { headers });
  if (!response.ok) throw new Error(`${response.status} ${pageUrl}`);
  const html = await response.text();
  const urls = [...html.matchAll(/data-zoom-url="([^"]+)"/g)].map((match) => `https:${match[1].replace(/^https?:/, "")}`);
  return [...new Set(urls)];
}

let total = 0;
for (const product of catalog.products) {
  const slug = slugify(product.name);
  const dir = path.join(root, ".cache/tiendanube", slug);
  await mkdir(dir, { recursive: true });

  const urls = await galleryUrls(product.sourceUrl);
  for (const [index, url] of urls.entries()) {
    const file = path.join(dir, `${index + 1}.webp`);
    if (existsSync(file)) continue;
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${response.status} ${url}`);
    await writeFile(file, Buffer.from(await response.arrayBuffer()));
  }
  total += urls.length;
  console.log(`${slug}: ${urls.length}`);
}

console.log(`Listo: ${total} imágenes en .cache/tiendanube.`);

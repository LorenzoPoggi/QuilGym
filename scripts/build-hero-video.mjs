/**
 * Genera el video del hero de la home en public/assets/hero/:
 * hero-1280.{mp4,webm} (16:9), hero-720x1280.{mp4,webm} (9:16) y sus posters webp. Sin audio.
 *
 * Es un montaje de 9 cortes (13,33 s, 24 fps) armado con clips de:
 * - Mixkit, Stock Video Free License (https://mixkit.co/license/#videoFree): uso comercial sin atribución.
 * - Coverr, Coverr License (https://coverr.co/license): uso comercial sin atribución.
 * La receta (fuente, página, URL de descarga, licencia, tramo, velocidad, zoom, recortes y grade)
 * está en scripts/hero-montage.json. Los clips se guardan en .cache/hero-montaje/clips/ (gitignored)
 * y se bajan solos si faltan.
 *
 *   npm run video:hero
 */
import { execFileSync } from "node:child_process";
import { createWriteStream, existsSync, readFileSync } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const recipe = JSON.parse(readFileSync(path.join(import.meta.dirname, "hero-montage.json"), "utf8"));
const clipsDir = path.join(root, ".cache/hero-montaje/clips");
const work = path.join(root, ".cache/hero-montaje/work");
const out = path.join(root, "public/assets/hero");
const { fps } = recipe;

const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const kb = async (file) => `${Math.round((await stat(file)).size / 1024)} KB`;
const pad = (i) => String(i + 1).padStart(2, "0");

/** Baja el clip de su URL directa si no está en caché; si no puede, corta con instrucciones. */
async function ensureClip(file) {
  const clip = recipe.clips[file];
  const target = path.join(clipsDir, file);
  if (existsSync(target)) return target;
  console.log(`Bajando ${file} de ${clip.download}…`);
  const partial = `${target}.part`;
  try {
    const response = await fetch(clip.download, { headers: { "user-agent": "Mozilla/5.0", referer: new URL(clip.page).origin + "/" } });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    const { size } = await stat(partial);
    if (clip.bytes && size !== clip.bytes) throw new Error(`pesa ${size} bytes y se esperaban ${clip.bytes}`);
    await rename(partial, target);
    return target;
  } catch (error) {
    await rm(partial, { force: true });
    throw new Error(
      `No se pudo bajar ${file} (${error.message}).\n`
      + `Bajalo a mano desde ${clip.page} (${clip.license}) en 1080p y guardalo como ${path.relative(root, target)}:\n`
      + `  curl -L -o "${path.relative(root, target)}" "${clip.download}"`,
    );
  }
}

/** Cadena por plano: grade previo, velocidad, 24 fps, zoom, recorte 16:9 o 9:16, grade común y del clip. */
function segmentFilter(cut, vertical) {
  const zoom = cut.zoom ?? 1;
  const w = Math.round((1920 * zoom) / 2) * 2, h = Math.round((1080 * zoom) / 2) * 2;
  const chain = [];
  if (cut.pre) chain.push(cut.pre);
  chain.push(`setpts=(PTS-STARTPTS)/${cut.speed}`, `fps=${fps}`);
  if (zoom !== 1) chain.push(`scale=${w}:${h}:flags=lanczos`);
  if (vertical) {
    const vw = 608; // 608x1080 ≈ 9:16, después se escala a 720x1280.
    const x = Math.max(0, Math.min(w - vw, Math.round(cut.vx - vw / 2)));
    chain.push(`crop=${vw}:1080:${x}:${cut.oy ?? 0}`, "scale=720:1280:flags=lanczos,setsar=1");
  } else {
    chain.push(`crop=1920:1080:${cut.ox ?? 0}:${cut.oy ?? 0}`);
  }
  chain.push(recipe.grade);
  if (cut.grade) chain.push(cut.grade);
  chain.push("format=yuv420p");
  return chain.join(",");
}

await mkdir(clipsDir, { recursive: true });
await mkdir(work, { recursive: true });
await mkdir(out, { recursive: true });
for (const file of new Set(recipe.cuts.map((cut) => cut.clip))) await ensureClip(file);

const frames = recipe.cuts.reduce((sum, cut) => sum + Math.round(cut.out * fps), 0);
const fadeStart = (frames / fps - recipe.fadeOut).toFixed(3);

for (const output of recipe.outputs) {
  const suffix = output.vertical ? "-v" : "";

  // 1) Cada plano a un intermedio casi sin pérdida (CRF 10) con la cantidad exacta de cuadros.
  const list = [];
  for (const [i, cut] of recipe.cuts.entries()) {
    const segment = path.join(work, `seg${pad(i)}${suffix}.mp4`);
    run([
      "-ss", String(cut.start), "-t", (cut.out * cut.speed + 0.2).toFixed(3), "-i", path.join(clipsDir, cut.clip),
      "-an", "-vf", segmentFilter(cut, output.vertical), "-frames:v", String(Math.round(cut.out * fps)),
      "-c:v", "libx264", "-preset", "medium", "-crf", "10", "-r", String(fps), segment,
    ]);
    list.push(`file '${path.basename(segment)}'`);
  }
  const listFile = path.join(work, `list${suffix}.txt`);
  await writeFile(listFile, list.join("\n"));

  // 2) Viñeta, grano y fundido a negro al final: el loop vuelve en corte seco al boxeador.
  const post = [
    `vignette=angle=${recipe.vignette}`, `noise=alls=${recipe.grain}:allf=t`,
    `fade=t=out:st=${fadeStart}:d=${recipe.fadeOut}`, "format=yuv420p",
    ...(output.scale ? [`scale=${output.scale}:flags=lanczos`] : []),
  ].join(",");
  const input = ["-f", "concat", "-safe", "0", "-i", listFile, "-an", "-vf", post];
  const mp4 = path.join(out, `${output.name}.mp4`), webm = path.join(out, `${output.name}.webm`);
  run([...input, "-c:v", "libx264", "-preset", "slow", "-crf", String(output.mp4Crf), "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4]);
  run([...input, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(output.webmCrf), "-pix_fmt", "yuv420p", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-fflags", "+bitexact", webm]);

  // 3) Poster = cuadro nítido del primer corte (el boxeador, inicio del loop), así no salta al arrancar el video.
  const png = path.join(work, `${output.name}-poster.png`), poster = path.join(out, `${output.name}-poster.webp`);
  run(["-i", mp4, "-vf", `select=eq(n\\,${output.posterFrame})`, "-frames:v", "1", png]);
  await sharp(png).webp({ quality: 80 }).toFile(poster);

  for (const file of [mp4, webm]) if ((await stat(file)).size > output.maxBytes) console.warn(`⚠ ${path.basename(file)} supera ${output.maxBytes / 1e6} MB`);
  if ((await stat(poster)).size > 120_000) console.warn(`⚠ ${path.basename(poster)} supera 120 KB`);
  console.log(output.name, "mp4", await kb(mp4), "· webm", await kb(webm), "· poster", await kb(poster), `· ${frames} cuadros (${(frames / fps).toFixed(2)} s)`);
}

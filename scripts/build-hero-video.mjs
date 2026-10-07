/**
 * Genera el video del hero de la home en public/assets/hero/:
 * hero-1280.{mp4,webm} (16:9), hero-720x1280.{mp4,webm} (9:16) y sus posters webp.
 *
 * Fuente: Pexels, video 7690496 «A man lifting weights in the gym» (cottonbro studio).
 * https://www.pexels.com/video/a-man-lifting-weights-in-the-gym-7690496/
 * Licencia Pexels (https://www.pexels.com/license/): uso comercial gratuito, sin atribución obligatoria.
 * La versión vertical sale de recortar el mismo clip: el 36072020 propuesto para mobile
 * muestra un banner con logo de gimnasio y equipos con marca, así que se descartó.
 * Los tramos usados (0–10 s y 44,4–54,4 s) se revisaron cuadro a cuadro: sin logos ni marcas.
 *
 *   curl -L -o .cache/hero/pexels-7690496.mp4 https://www.pexels.com/download/video/7690496/
 *   npm run video:hero
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, ".cache/hero/pexels-7690496.mp4");
const out = path.join(root, "public/assets/hero");
const LENGTH = 9, FADE = 1;

if (!existsSync(source)) throw new Error(`Falta ${path.relative(root, source)}: bajalo con el curl del encabezado.`);

// Grade oscuro y desaturado: el texto blanco del hero va encima.
const grade = "eq=contrast=1.04:saturation=0.6,curves=all='0/0 0.5/0.44 1/0.9'";
const variants = [
  // Desktop: curl sentado con el sujeto a la derecha; la izquierda queda libre para el texto.
  { name: "hero-1280", start: 44.4, frame: "crop=3840:2160:256:0,scale=1280:720:flags=lanczos", mp4Crf: 23, webmCrf: 32, maxBytes: 3_000_000 },
  // Mobile: la mano que levanta la mancuerna, centrada en el recorte 9:16.
  { name: "hero-720x1280", start: 0, frame: "crop=1215:2160:1300:0,scale=720:1280:flags=lanczos", mp4Crf: 24, webmCrf: 34, maxBytes: 1_500_000 },
];

// Loop limpio: el último segundo funde con el primero, así el cuadro final coincide con el inicial.
const loop = (frame) => `[0:v]${frame},${grade},fps=25,split[a][b];`
  + `[a]trim=start=${FADE}:end=${LENGTH + FADE},setpts=PTS-STARTPTS[main];`
  + `[b]trim=start=0:end=${FADE},setpts=PTS-STARTPTS[head];`
  + `[main][head]xfade=transition=fade:duration=${FADE}:offset=${LENGTH - FADE},format=yuv420p[v]`;

const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const kb = async (file) => `${Math.round((await stat(file)).size / 1024)} KB`;

await mkdir(out, { recursive: true });
for (const { name, start, frame, mp4Crf, webmCrf, maxBytes } of variants) {
  const input = ["-ss", String(start), "-t", String(LENGTH + FADE), "-i", source];
  const mp4 = path.join(out, `${name}.mp4`), webm = path.join(out, `${name}.webm`);
  run([...input, "-filter_complex", loop(frame), "-map", "[v]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", String(mp4Crf), "-profile:v", "high", "-movflags", "+faststart", mp4]);
  run([...input, "-filter_complex", loop(frame), "-map", "[v]", "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", String(webmCrf), "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", webm]);

  // Poster = primer cuadro del video, para que el fade no salte.
  const png = path.join(out, `${name}-poster.png`), poster = path.join(out, `${name}-poster.webp`);
  run(["-i", mp4, "-frames:v", "1", png]);
  await sharp(png).webp({ quality: 72 }).toFile(poster);
  await rm(png);

  for (const file of [mp4, webm]) if ((await stat(file)).size > maxBytes) console.warn(`⚠ ${path.basename(file)} supera ${maxBytes / 1e6} MB`);
  console.log(name, "mp4", await kb(mp4), "· webm", await kb(webm), "· poster", await kb(poster));
}

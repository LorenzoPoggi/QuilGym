"use client";

import { getImageProps } from "next/image";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const MOBILE = "(max-width: 768px)";
const common = { alt: "", sizes: "100vw", fetchPriority: "high" as const, loading: "eager" as const };
// Dos posters (16:9 y 9:16) con <picture>: preload en ambos bajaría los dos, así que va fetchPriority="high".
const { props: { srcSet: desktopSet } } = getImageProps({ ...common, src: "/assets/hero/hero-1280-poster.webp", width: 1280, height: 720 });
const { props: { srcSet: mobileSet, ...poster } } = getImageProps({ ...common, src: "/assets/hero/hero-720x1280-poster.webp", width: 720, height: 1280 });

type State = "off" | "playing" | "paused";

/** Fondo del hero: poster (LCP) y video en loop que solo se pide si el usuario no pidió menos movimiento ni ahorro de datos. */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const userPaused = useRef(false);
  const [state, setState] = useState<State>("off");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const video = ref.current;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (!video || matchMedia("(prefers-reduced-motion: reduce)").matches || connection?.saveData) return;

    const base = `/assets/hero/${matchMedia(MOBILE).matches ? "hero-720x1280" : "hero-1280"}`;
    for (const [ext, type] of [["webm", "video/webm"], ["mp4", "video/mp4"]]) {
      const source = document.createElement("source");
      source.src = `${base}.${ext}`;
      source.type = type;
      video.append(source);
    }
    video.muted = true;
    video.load();

    const play = () => { video.play().catch(() => setState("paused")); };
    const onPlaying = () => { setShown(true); setState("playing"); };
    const onPause = () => setState("paused");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);

    // Fuera de pantalla no gasta batería; al volver retoma salvo que el usuario lo haya pausado.
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause();
      else if (!userPaused.current) play();
    });
    observer.observe(video);

    return () => {
      observer.disconnect();
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.pause();
      video.replaceChildren();
    };
  }, []);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    userPaused.current = !video.paused;
    if (video.paused) video.play().catch(() => undefined);
    else video.pause();
  };

  return (
    <div className="hero-media" data-shown={shown || undefined}>
      <picture>
        <source media={MOBILE} srcSet={mobileSet}/>
        <source srcSet={desktopSet}/>
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt="" viene de getImageProps: es decorativo */}
        <img {...poster} className="hero-poster"/>
      </picture>
      <video ref={ref} className="hero-video" muted playsInline loop preload="none" aria-hidden="true" tabIndex={-1} disablePictureInPicture disableRemotePlayback/>
      {state === "off" ? null : <button type="button" className="hero-video-toggle" onClick={toggle} aria-label={state === "playing" ? "Pausar video de fondo" : "Reproducir video de fondo"}>{state === "playing" ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}</button>}
    </div>
  );
}

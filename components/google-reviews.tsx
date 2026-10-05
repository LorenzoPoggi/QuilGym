"use client";
import Image from "next/image";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { quilgymMapsUrl, unavailableReviews, type ReviewsData } from "@/lib/review-types";
export function GoogleReviews() {
  const [data, setData] = useState<ReviewsData>(unavailableReviews);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/reviews", { cache: "no-store", signal: controller.signal }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setData).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  const advance = useCallback((direction: number) => {
    const node = track.current;
    if (!node) return;
    const card = node.querySelector("article");
    const step = (card?.getBoundingClientRect().width || node.clientWidth) + 16;
    const last = node.scrollWidth - node.clientWidth;
    node.scrollTo({ left: direction > 0 && node.scrollLeft >= last - 8 ? 0 : Math.max(0, node.scrollLeft + step * direction), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, []);
  useEffect(() => {
    if (paused || hovering || data.reviews.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => { if (!document.hidden) advance(1); }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, hovering, data.reviews.length, advance]);
  return <section id="resenas" className="section-pad section-soft"><div className="container"><div className="section-heading"><div><p className="eyebrow">EXPERIENCIAS REALES</p><h2>Opiniones en Google</h2><p>Lo que cuentan quienes visitaron QuilGym. Consultá las opiniones completas en Google Maps.</p></div></div><div className="google-reviews-layout"><div className="reviews-panel" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} onFocusCapture={() => setHovering(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHovering(false); }}>
    <div className="reviews-panel-head"><div>{data.rating !== null ? <><strong>{data.rating.toLocaleString("es-AR", { minimumFractionDigits: 1 })}<span className="review-stars" aria-hidden="true"> ★</span></strong><small>{data.count !== null ? `${data.count} opiniones en Google` : "Valoración en Google"}</small></> : null}</div><a href={quilgymMapsUrl} target="_blank" rel="noopener noreferrer" className="google-attribution"><Image src="https://www.gstatic.com/images/branding/productlogos/maps_2025/v1/192px.svg" alt="Google Maps" width={30} height={30} unoptimized/>Ver todas las reseñas<ArrowRight aria-hidden="true" size={16}/></a></div>
    {data.reviews.length ? <><div className="reviews-track" ref={track} role="region" aria-roledescription="carrusel" aria-label="Opiniones de Google Maps" tabIndex={0}>{data.reviews.map((review) => <article className="review-card" key={review.id}><span className="eyebrow">GOOGLE MAPS</span><span className="review-stars" aria-label={`${review.rating} de 5 estrellas`}>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span><blockquote>{review.text || "El usuario dejó una puntuación sin comentario."}</blockquote>{review.original ? <details><summary>Ver texto original</summary><p>{review.original}</p></details> : null}<footer>{review.authorUrl ? <a href={review.authorUrl} target="_blank" rel="noopener noreferrer">{review.author}</a> : <strong>{review.author}</strong>}<small>{review.date}</small><a href={review.url} target="_blank" rel="noopener noreferrer">Leer en Google</a></footer></article>)}</div><div className="reviews-controls"><button type="button" onClick={() => setPaused(!paused)}>{paused ? "Reanudar carrusel" : "Pausar carrusel"}</button><button type="button" aria-label="Reseña anterior" onClick={() => advance(-1)}><ArrowLeft aria-hidden="true"/></button><button type="button" aria-label="Siguiente reseña" onClick={() => advance(1)}><ArrowRight aria-hidden="true"/></button></div><small>Google muestra una selección de opiniones. El enlace permite consultar todas.</small></> : <div className="reviews-unavailable" role="status"><h3>{loading ? "Buscando opiniones…" : "Conocé las experiencias de nuestros clientes"}</h3><p>Podés leer las reseñas originales, sus autores y sus puntuaciones directamente en la ficha de QuilGym.</p><a className="button button--outline" href={quilgymMapsUrl} target="_blank" rel="noopener noreferrer">Leer reseñas en Google<ArrowRight aria-hidden="true"/></a></div>}
    </div><div className="location-card"><iframe title="Ubicación de QuilGym en Google Maps" src="https://maps.google.com/maps?q=QuilGym%20Suplementos%20Deportivos%20Quilmes&ll=-34.7212393,-58.2603596&z=16&output=embed" loading="lazy" tabIndex={-1} referrerPolicy="no-referrer-when-downgrade"/><a className="location-link" aria-label="Abrir ubicación de QuilGym en Google Maps" href={quilgymMapsUrl} target="_blank" rel="noopener noreferrer"/><div className="location-caption"><h3>QuilGym en Quilmes</h3><p>Consultá la dirección, las indicaciones y los horarios actualizados en Google Maps.</p><span><MapPin aria-hidden="true" size={18}/>Abrir ubicación<ArrowRight aria-hidden="true" size={16}/></span></div></div></div></div></section>;
}

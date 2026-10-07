"use client";
import Image from "next/image";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { reducedMotion } from "@/lib/motion";
import { quilgymMapsUrl, unavailableReviews, type GoogleReview, type ReviewsData } from "@/lib/review-types";

const mapEmbedUrl = "https://maps.google.com/maps?q=QuilGym%20Suplementos%20Deportivos%20Quilmes&ll=-34.7212393,-58.2603596&z=16&output=embed";

/** Atribución de texto que permiten las políticas de Places cuando no se usa el logo oficial. */
function GoogleMapsAttribution() {
  return <span className="google-maps-attribution" translate="no">Google Maps</span>;
}

function ReviewCard({ review }: { review: GoogleReview }) {
  const initial = review.author.trim().charAt(0).toUpperCase() || "?";
  return <article className="review-card">
    <header className="review-author">
      {review.photo ? <Image src={review.photo} alt="" width={36} height={36} unoptimized referrerPolicy="no-referrer"/> : <span className="review-avatar" aria-hidden="true">{initial}</span>}
      <div>{review.authorUrl ? <a href={review.authorUrl} target="_blank" rel="noopener noreferrer">{review.author}</a> : <strong>{review.author}</strong>}{review.date ? <small>{review.date}</small> : null}</div>
    </header>
    <span className="review-stars" role="img" aria-label={`${review.rating} de 5 estrellas`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
    <blockquote>{review.text || "El usuario dejó una puntuación sin comentario."}</blockquote>
    {review.original ? <><span className="review-translated">Traducida por Google</span><details><summary>Ver texto original</summary><p>{review.original}</p></details></> : null}
    <footer><a href={review.url} target="_blank" rel="noopener noreferrer">Leer en Google</a></footer>
  </article>;
}

/**
 * Opiniones de Google Places. El pedido a /api/reviews sale recién cuando la sección se acerca a la pantalla
 * (cada consulta tiene costo) y no se cachea: los términos de Places lo prohíben.
 * Sin reseñas (sin configurar, error o mientras carga) se muestra «Visitanos en Quilmes», sin prometer opiniones.
 */
export function GoogleReviews() {
  const [data, setData] = useState<ReviewsData>(unavailableReviews);
  const [paused, setPaused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const controller = new AbortController();
    const load = () => { void fetch("/api/reviews", { cache: "no-store", signal: controller.signal }).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then((value: ReviewsData) => { if (Array.isArray(value?.reviews)) setData(value); }).catch(() => {}); };
    if (typeof IntersectionObserver === "undefined") { load(); return () => controller.abort(); }
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      load();
    }, { rootMargin: "200px 0px" });
    observer.observe(node);
    return () => { observer.disconnect(); controller.abort(); };
  }, []);
  const advance = useCallback((direction: number) => {
    const node = track.current;
    if (!node) return;
    const card = node.querySelector("article");
    const step = (card?.getBoundingClientRect().width || node.clientWidth) + 16;
    const last = node.scrollWidth - node.clientWidth;
    node.scrollTo({ left: direction > 0 && node.scrollLeft >= last - 8 ? 0 : Math.max(0, node.scrollLeft + step * direction), behavior: reducedMotion() ? "instant" : "smooth" });
  }, []);
  useEffect(() => {
    if (paused || hovering || data.reviews.length < 2 || reducedMotion()) return;
    const timer = window.setInterval(() => { if (!document.hidden) advance(1); }, 6500);
    return () => window.clearInterval(timer);
  }, [paused, hovering, data.reviews.length, advance]);

  if (!data.reviews.length) return <section id="resenas" ref={section} className="section-pad section-soft" aria-labelledby="resenas-title"><div className="container"><div className="visit-quilmes">
    <div className="visit-quilmes-copy"><MapPin aria-hidden="true" size={26}/><h2 id="resenas-title">Visitanos en Quilmes</h2><p>Tenemos local en Quilmes. En Google Maps encontrás cómo llegar y las opiniones de quienes nos visitaron.</p><a className="button button--dark" href={quilgymMapsUrl} target="_blank" rel="noopener noreferrer">Ver reseñas y cómo llegar<ArrowRight aria-hidden="true" size={16}/></a></div>
    <div className="visit-quilmes-map"><iframe title="Ubicación de QuilGym en Google Maps" src={mapEmbedUrl} loading="lazy" tabIndex={-1} referrerPolicy="no-referrer-when-downgrade"/><a className="location-link" href={quilgymMapsUrl} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true"/></div>
  </div></div></section>;

  return <section id="resenas" ref={section} className="section-pad section-soft" aria-labelledby="resenas-title"><div className="container"><div className="section-heading"><div><p className="eyebrow">EXPERIENCIAS REALES</p><h2 id="resenas-title">Opiniones en Google</h2><p>Lo que cuentan quienes visitaron QuilGym. Consultá las opiniones completas en Google Maps.</p></div></div><div className="google-reviews-layout"><div className="reviews-panel" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)} onFocusCapture={() => setHovering(true)} onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHovering(false); }}>
    <div className="reviews-panel-head"><div>{data.rating !== null ? <><strong>{data.rating.toLocaleString("es-AR", { minimumFractionDigits: 1 })}<span className="review-stars" aria-hidden="true"> ★</span></strong><small>{data.count !== null ? `${data.count} opiniones en Google` : "Valoración en Google"}</small></> : null}</div><div className="reviews-source"><GoogleMapsAttribution/><a href={quilgymMapsUrl} target="_blank" rel="noopener noreferrer" className="google-attribution">Ver todas las reseñas<ArrowRight aria-hidden="true" size={16}/></a></div></div>
    <div className="reviews-track" ref={track} role="region" aria-roledescription="carrusel" aria-label="Opiniones de Google Maps" tabIndex={0}>{data.reviews.map((review) => <ReviewCard review={review} key={review.id}/>)}</div>
    <div className="reviews-controls"><button type="button" onClick={() => setPaused(!paused)}>{paused ? "Reanudar carrusel" : "Pausar carrusel"}</button><button type="button" aria-label="Reseña anterior" onClick={() => advance(-1)}><ArrowLeft aria-hidden="true"/></button><button type="button" aria-label="Siguiente reseña" onClick={() => advance(1)}><ArrowRight aria-hidden="true"/></button></div>
    <small className="reviews-note">Hasta 5 opiniones, ordenadas por relevancia según Google.</small>
    </div><div className="location-card"><iframe title="Ubicación de QuilGym en Google Maps" src={mapEmbedUrl} loading="lazy" tabIndex={-1} referrerPolicy="no-referrer-when-downgrade"/><a className="location-link" aria-label="Abrir ubicación de QuilGym en Google Maps" href={quilgymMapsUrl} target="_blank" rel="noopener noreferrer"/><div className="location-caption"><h3>QuilGym en Quilmes</h3><p>Consultá la dirección y las indicaciones para llegar en Google Maps.</p><span><MapPin aria-hidden="true" size={18}/>Abrir ubicación<ArrowRight aria-hidden="true" size={16}/></span></div></div></div></div></section>;
}

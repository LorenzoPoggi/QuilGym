"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ZoomIn } from "lucide-react";
import type { ProductDetail } from "@/lib/catalog-types";
import { ProductImage } from "./product-image";
import { reducedMotion } from "@/lib/motion";
import { ProductLightbox, useSnapTrack } from "./product-lightbox";

type GalleryProduct = Pick<ProductDetail, "name" | "brand" | "category" | "imageUrl" | "images">;

export function ProductGallery({ product }: { product: GalleryProduct }) {
  const total = product.images.length;
  const trackRef = useRef<HTMLDivElement>(null);
  const { index: active, onScroll, scrollToIndex, release } = useSnapTrack(trackRef, total);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Mantiene visible la miniatura activa dentro de su tira (vertical en desktop, horizontal en mobile).
  useEffect(() => {
    const list = thumbsRef.current;
    const thumb = list?.children[active] as HTMLElement | undefined;
    if (!list || !thumb) return;
    const behavior = reducedMotion() ? "auto" : "smooth";
    if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: thumb.offsetLeft - (list.clientWidth - thumb.offsetWidth) / 2, behavior });
    else if (list.scrollHeight > list.clientHeight) list.scrollTo({ top: thumb.offsetTop - (list.clientHeight - thumb.offsetHeight) / 2, behavior });
  }, [active]);

  if (total === 0) {
    return <div className="product-gallery product-gallery--single"><ProductImage product={product} className="product-main-image" sizes="(max-width: 1100px) 100vw, 50vw" priority/></div>;
  }

  const label = (index: number) => product.images[index].kind === "nutrition" ? `Información nutricional de ${product.name}` : `${product.name}, foto ${index + 1}`;

  function open(index: number, trigger: HTMLElement) {
    triggerRef.current = trigger;
    setLightbox(index);
  }

  function close(index: number) {
    setLightbox(null);
    scrollToIndex(index, false);
    triggerRef.current?.focus({ preventScroll: true });
  }

  return (
    <div className={`product-gallery ${total === 1 ? "product-gallery--single" : ""}`}>
      {total > 1 ? (
        <div className="gallery-thumbs" ref={thumbsRef} role="group" aria-label="Elegir foto">
          {product.images.map((item, index) => (
            <button type="button" aria-current={index === active ? "true" : undefined} aria-label={label(index)} className={`${index === active ? "is-active" : ""} ${item.kind === "nutrition" ? "is-nutrition" : ""}`} onClick={() => scrollToIndex(index)} key={item.url}>
              <Image src={item.url} alt="" width={160} height={160} sizes="80px" loading="eager"/>
              {item.kind === "nutrition" ? <span>INFO</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div className="gallery-stage">
        <div
          className="gallery-track"
          ref={trackRef}
          onScroll={onScroll}
          onPointerDown={release}
          onWheel={release}
          tabIndex={0}
          role="region"
          aria-label={`Fotos de ${product.name}`}
          onClick={(event) => {
            const slide = (event.target as HTMLElement).closest<HTMLElement>("[data-slide]");
            if (slide) open(Number(slide.dataset.slide), event.currentTarget);
          }}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); open(active, event.currentTarget); } }}
        >
          {product.images.map((image, index) => (
            <div className={`product-thumb product-main-image gallery-slide ${image.kind === "nutrition" ? "is-nutrition" : ""}`} data-slide={index} key={image.url}>
              <Image src={image.url} alt={label(index)} fill sizes="(max-width: 1100px) 100vw, 50vw" preload={index === 0}/>
            </div>
          ))}
        </div>
        {total > 1 ? (
          <>
            <span className="gallery-counter" aria-hidden="true">{active + 1} / {total}</span>
            <div className="gallery-dots" aria-hidden="true">{product.images.map((image, index) => <i className={index === active ? "is-active" : undefined} key={image.url}/>)}</div>
          </>
        ) : null}
        <button type="button" className="gallery-zoom" aria-haspopup="dialog" aria-label={`Ampliar: ${label(active)}`} onClick={(event) => open(active, event.currentTarget)}><ZoomIn aria-hidden="true"/> Ampliar</button>
      </div>
      <ProductLightbox images={product.images.map((image, index) => ({ ...image, alt: label(index) }))} index={lightbox} title={product.name} onClose={close}/>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { ZoomIn } from "lucide-react";
import type { ProductDetail } from "@/lib/catalog-types";
import { ProductImage } from "./product-image";

export function ProductGallery({ product }: { product: Pick<ProductDetail, "name" | "brand" | "category" | "imageUrl" | "images"> }) {
  const [active, setActive] = useState(0);
  const image = product.images[active];

  if (product.images.length === 0) {
    return <div className="product-gallery product-gallery--single"><ProductImage product={product} className="product-main-image" sizes="(max-width: 1100px) 100vw, 50vw" priority/></div>;
  }

  const label = (index: number) => product.images[index].kind === "nutrition" ? `Información nutricional de ${product.name}` : `${product.name}, foto ${index + 1}`;

  return (
    <div className={`product-gallery ${product.images.length === 1 ? "product-gallery--single" : ""}`}>
      {product.images.length > 1 ? (
        <div className="gallery-thumbs" role="tablist" aria-label="Fotos del producto">
          {product.images.map((item, index) => (
            <button type="button" role="tab" aria-selected={index === active} aria-label={label(index)} className={`${index === active ? "is-active" : ""} ${item.kind === "nutrition" ? "is-nutrition" : ""}`} onClick={() => setActive(index)} key={item.url}>
              <Image src={item.url} alt="" width={160} height={160} sizes="80px"/>
              {item.kind === "nutrition" ? <span>INFO</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div className={`product-thumb product-main-image ${image.kind === "nutrition" ? "is-nutrition" : ""}`} role="tabpanel">
        <Image src={image.url} alt={label(active)} fill sizes="(max-width: 1100px) 100vw, 50vw" priority={active === 0}/>
        <a className="gallery-zoom" href={image.url} target="_blank" rel="noopener" aria-label={`Ampliar: ${label(active)} (se abre en otra pestaña)`}><ZoomIn aria-hidden="true"/> Ampliar</a>
      </div>
    </div>
  );
}

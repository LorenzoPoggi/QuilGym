import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ProductSummary } from "@/lib/catalog-types";
import { formatArs, paymentHighlights } from "@/lib/commerce";
import { AddToCartButton } from "./cart-buttons";
import { ProductImage } from "./product-image";
import { ProductCardMedia } from "./product-card-media";
import { FavoriteButton } from "./account-controls";

/**
 * Tarjeta de producto compartida (home, catálogo, búsqueda, ficha, favoritos, comparador y asesor).
 * El pie sigue el de las tarjetas de combos: precio a la izquierda y stock a la derecha, y debajo
 * «Agregar» en negro con la flecha a la ficha. El pie queda abajo para alinear las tarjetas de una fila.
 */
export function ProductCard({ product, compact = false, priority = false, className = "" }: { product: ProductSummary; compact?: boolean; priority?: boolean; className?: string }) {
  const href = `/productos/${product.slug}`;
  const highlights = paymentHighlights();
  // `?? []`: las respuestas del asesor pueden traer productos sin el campo (cachés o mocks viejos).
  const photos = product.photoUrls ?? [];

  return (
    <article className={`product-card ${compact ? "product-card--compact" : ""} ${className}`}>
      <div className="product-image">
        <FavoriteButton productId={product.id} name={product.name}/>
        {photos.length > 1
          ? <ProductCardMedia href={href} name={product.name} photos={photos} preload={priority}/>
          : <Link className="card-media-single" href={href} aria-label={`Ver ${product.name}`}><ProductImage product={product} priority={priority} decorative/></Link>}
      </div>
      <p className="eyebrow product-brand">{product.brand?.name ?? product.category.name}</p>
      <h3><Link href={href}>{product.name}</Link></h3>
      <div className="product-card__footer">
        <div className="product-card__meta">
          <p className="price">{formatArs(product.priceArs)} {product.compareAtPriceArs ? <del>{formatArs(product.compareAtPriceArs)}</del> : null}</p>
          <p className={`stock ${product.inStock ? "" : "stock--out"}`}><span/> {product.inStock ? "En stock" : "Sin stock"}</p>
        </div>
        {highlights ? <p className="installments">{highlights}</p> : null}
        <div className="product-card__actions">
          <AddToCartButton variantId={product.variantId} name={product.name} inStock={product.inStock} className="button button--dark product-card__add"/>
          <Link className="button button--outline product-card__link" href={href} aria-label={`Ver ${product.name}`}><ArrowUpRight aria-hidden="true"/></Link>
        </div>
      </div>
    </article>
  );
}

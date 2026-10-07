import Link from "next/link";
import type { ProductSummary } from "@/lib/catalog-types";
import { formatArs, paymentHighlights } from "@/lib/commerce";
import { AddToCartButton } from "./cart-buttons";
import { ProductImage } from "./product-image";
import { ProductCardMedia } from "./product-card-media";
import { FavoriteButton } from "./account-controls";

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
      <p className="product-detail">{product.category.name}</p>
      <p className="price">{formatArs(product.priceArs)} {product.compareAtPriceArs ? <del>{formatArs(product.compareAtPriceArs)}</del> : null}</p>
      {highlights ? <p className="installments">{highlights}</p> : null}
      <p className={`stock ${product.inStock ? "" : "stock--out"}`}><span/> {product.inStock ? "En stock" : "Sin stock"}</p>
      <AddToCartButton variantId={product.variantId} name={product.name} inStock={product.inStock}/>
    </article>
  );
}

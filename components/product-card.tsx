import catalogReference from "@/design-reference/02-catalogo.png";
import type { StoreProduct } from "@/lib/store-data";
import Link from "next/link";
import { BagIcon } from "./icons";
import { ReferenceCrop } from "./reference-crop";

export type Product = Partial<Pick<StoreProduct, "slug" | "rating" | "reviews">> & {
  brand: string;
  name: string;
  detail: string;
  price: string;
  oldPrice?: string;
  badge: string;
  stock: string;
  cropX: number;
};

export function ProductCard({ product, compact = false, priority = false }: { product: Product; compact?: boolean; priority?: boolean }) {
  return (
    <article className={`product-card ${compact ? "product-card--compact" : ""}`}>
      <div className="product-image">
        {product.slug ? <Link href={`/productos/${product.slug}`} aria-label={`Ver ${product.name}`}><ReferenceCrop source={catalogReference} crop={{ x: product.cropX, y: 493, width: 214, height: 159 }} alt={product.name} priority={priority} /></Link> : <ReferenceCrop source={catalogReference} crop={{ x: product.cropX, y: 493, width: 214, height: 159 }} alt={product.name} priority={priority} />}
      </div>
      <p className="eyebrow product-brand">{product.brand}</p>
      <h3>{product.slug ? <Link href={`/productos/${product.slug}`}>{product.name}</Link> : product.name}</h3>
      <div className="rating" aria-label={`${product.rating ?? "4,8"} de 5 estrellas`}>★★★★★ <strong>{product.rating ?? "4,8"}</strong> <span>({product.reviews ?? 126})</span></div>
      <p className="product-detail">{product.detail}</p>
      <p className="price">{product.price} {product.oldPrice ? <del>{product.oldPrice}</del> : null}</p>
      <p className="installments">3 cuotas sin interés · 10% OFF transferencia</p>
      <p className="stock"><span/> {product.stock}</p>
      <button type="button" className="button button--outline button--full"><BagIcon/> Agregar</button>
    </article>
  );
}

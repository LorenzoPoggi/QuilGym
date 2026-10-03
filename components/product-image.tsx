import Image from "next/image";
import type { ProductSummary } from "@/lib/catalog-types";

type ProductImageProps = {
  product: Pick<ProductSummary, "name" | "brand" | "category" | "imageUrl">;
  className?: string;
  priority?: boolean;
  sizes?: string;
  decorative?: boolean;
};

/** Foto del producto o, mientras no haya assets reales, un placeholder neutro con marca y categoría. */
export function ProductImage({ product, className = "", priority = false, sizes = "(max-width: 520px) 100vw, (max-width: 1100px) 50vw, 25vw", decorative = false }: ProductImageProps) {
  if (product.imageUrl) {
    return (
      <div className={`product-thumb ${className}`}>
        <Image src={product.imageUrl} alt={decorative ? "" : product.name} fill sizes={sizes} priority={priority} />
      </div>
    );
  }

  const label = product.brand?.name ?? "QuilGym";
  const initials = label.split(/\s+/).map((word) => word[0]).join("").slice(0, 3);

  return (
    <div className={`product-thumb product-thumb--placeholder ${className}`} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : product.name} aria-hidden={decorative || undefined}>
      <strong>{label}</strong>
      <em>{initials}</em>
      <span>{product.category.name}</span>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getProductsByCategory } from "@/lib/catalog";
import type { ProductSummary } from "@/lib/catalog-types";
import { comboIncludesLine, comboParts, comboUnits, type ComboPart } from "@/lib/combo-contents";
import { formatArs } from "@/lib/commerce";
import { FavoriteButton } from "./account-controls";
import { AddToCartButton } from "./cart-buttons";
import { ProductImage } from "./product-image";
import { ComboVisual } from "./combo-visual";
export { ComboVisual } from "./combo-visual";

/**
 * Sección «Combos por objetivo» de la home. Cada tarjeta arma la imagen del combo con las
 * fotos limpias de los productos que incluye (lib/combo-contents.ts), en lugar de la foto
 * con texto de la tienda anterior. Precio y stock son los del combo en la base.
 */
export async function ComboShowcase({ limit = 4 }: { limit?: number }) {
  const combos = await getProductsByCategory("combos", limit);
  if (combos.length === 0) return null;

  return (
    <section id="combos" className="section-pad container combo-showcase">
      <div className="section-heading">
        <div>
          <p className="eyebrow">COMBOS QUILGYM</p>
          <h2>Combos por objetivo</h2>
          <p>Productos que se complementan, en una sola compra. En cada ficha ves el detalle de lo que incluye.</p>
        </div>
        <Link href="/productos?categoria=combos">Explorar combos <ArrowRight aria-hidden="true"/></Link>
      </div>
      <ul className="combo-track" role="list">
        {combos.map((combo) => <li key={combo.slug}><ComboCard combo={combo}/></li>)}
      </ul>
      <Link className="combo-showcase__more" href="/productos?categoria=combos">Explorar combos <ArrowRight aria-hidden="true"/></Link>
    </section>
  );
}

/**
 * Composición del combo: las fotos de los productos que incluye, una delante de la otra.
 * La usan las tarjetas, la home y la ficha del combo. Es decorativa:
 * el nombre y el detalle de lo que incluye van siempre en texto al lado.
 *
 * Las fotos tienen fondo blanco y se funden con el panel con `mix-blend-mode: multiply`
 * aplicado al contenedor de cada foto (no a la `<img>`): así el fundido sigue funcionando
 * cuando el contenedor se mueve con `transform` en el hover.
 */
function ComboCard({ combo }: { combo: ProductSummary }) {
  const href = `/productos/${combo.slug}`;
  const parts = comboParts(combo.slug);
  const includes = comboIncludesLine(combo.slug);
  const units = parts ? comboUnits(parts) : 0;

  return (
    <article className="combo-card">
      <div className="combo-card__stage">
        <FavoriteButton productId={combo.id} name={combo.name}/>
        {units > 1 ? <span className="combo-card__count">{units} productos</span> : null}
        <Link className="combo-card__visual" href={href} aria-label={`Ver ${combo.name}`}>
          {parts ? (
            <ComboVisual parts={parts} sizes="(max-width: 768px) 46vw, 190px"/>
          ) : (
            <span className="combo-card__fallback"><ProductImage product={combo} decorative sizes="(max-width: 768px) 80vw, 300px"/></span>
          )}
        </Link>
      </div>
      <div className="combo-card__body">
        <p className="eyebrow combo-card__brand">{combo.brand?.name ?? "Combo"}</p>
        <h3><Link href={href}>{combo.name}</Link></h3>
        {includes ? <p className="combo-card__includes"><span>Incluye</span>{includes}</p> : null}
        <div className="combo-card__meta">
          <p className="price">{formatArs(combo.priceArs)}</p>
          <p className={`stock ${combo.inStock ? "" : "stock--out"}`}><span/> {combo.inStock ? "En stock" : "Sin stock"}</p>
        </div>
        <div className="combo-card__actions">
          <AddToCartButton variantId={combo.variantId} name={combo.name} inStock={combo.inStock} className="button button--dark combo-card__add"/>
          <Link className="button button--outline combo-card__link" href={href} aria-label={`Ver detalle de ${combo.name}`}><ArrowUpRight aria-hidden="true"/></Link>
        </div>
      </div>
    </article>
  );
}

/**
 * Galería de la ficha de un combo mapeado: la misma composición de la home en grande y, debajo,
 * la lista de lo que incluye con un link a cada producto que siga activo en el catálogo.
 * Reemplaza a la foto del combo de la tienda anterior (fondo gris con el nombre impreso).
 */
export function ComboGallery({ name, parts, activeSlugs }: { name: string; parts: ComboPart[]; activeSlugs: ReadonlySet<string> }) {
  const units = comboUnits(parts);
  return (
    <div className="combo-gallery">
      <div className="combo-gallery__stage" role="img" aria-label={`${name}: ${parts.map((part) => part.label).join(" y ")}`}>
        {units > 1 ? <span className="combo-gallery__count" aria-hidden="true">{units} productos</span> : null}
        <ComboVisual parts={parts} sizes="(max-width: 1100px) 62vw, 360px" preload/>
      </div>
      <div className="combo-gallery__includes">
        <p className="eyebrow">Qué incluye</p>
        <ul role="list">
          {parts.map((part) => {
            const content = (
              <>
                <span className="combo-gallery__thumb"><Image src={part.photoUrl} alt="" fill sizes="64px"/></span>
                <span className="combo-gallery__label">
                  <strong>{part.quantity > 1 ? `${part.quantity} × ${part.label}` : part.label}</strong>
                  {activeSlugs.has(part.slug) ? <small>Ver producto</small> : null}
                </span>
              </>
            );
            return (
              <li key={part.slug}>
                {activeSlugs.has(part.slug) ? (
                  <Link className="combo-gallery__part" href={`/productos/${part.slug}`}>{content}<ArrowUpRight aria-hidden="true"/></Link>
                ) : (
                  <div className="combo-gallery__part">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

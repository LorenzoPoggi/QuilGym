"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { ProductDetail, ProductImage, ProductVariantDetail } from "@/lib/catalog-types";
import { commerce, formatArs, transferPrice } from "@/lib/commerce";
import { findFlavor, flavorKey } from "@/lib/flavors";
import { InstallmentsBlock } from "./product-installments";

type VariantContext = {
  variants: ProductVariantDetail[];
  variant: ProductVariantDetail;
  select: (id: number) => void;
};

function subscribeToUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

const Context = createContext<VariantContext | null>(null);

/** Variante elegida en la ficha; `null` fuera del proveedor (el consumidor usa la variante por defecto). */
export const useProductVariant = () => useContext(Context);

/**
 * Comparte la variante (sabor) elegida entre la galería, el precio y el bloque de compra.
 * El sabor viaja en `?sabor=` (compartible); la ficha sigue siendo estática: la URL se lee al montar.
 */
export function ProductVariantProvider({ product, children }: { product: Pick<ProductDetail, "variantId" | "variants">; children: ReactNode }) {
  // Sabor de la URL (compartible): useSyncExternalStore evita un setState en un efecto y la hidratación usa la variante inicial.
  const urlKey = useSyncExternalStore(subscribeToUrl, () => new URLSearchParams(window.location.search).get("sabor"), () => null);
  const [chosenId, setChosenId] = useState<number | null>(null);
  const variantId = chosenId ?? findFlavor(product.variants, urlKey)?.id ?? product.variantId;

  const select = useCallback((id: number) => {
    setChosenId(id);
    const chosen = product.variants.find((item) => item.id === id);
    try {
      const url = new URL(window.location.href);
      if (chosen?.label && product.variants.length > 1) url.searchParams.set("sabor", flavorKey(chosen.label));
      else url.searchParams.delete("sabor");
      window.history.replaceState(window.history.state, "", url);
    } catch { /* la URL es solo una comodidad */ }
  }, [product.variants]);

  const variant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  const value = useMemo(() => ({ variants: product.variants, variant, select }), [product.variants, variant, select]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

/** Fotos que se muestran: las propias del sabor elegido o, si no tiene, la galería común del producto. */
export function variantImages(common: ProductImage[], variant: ProductVariantDetail | null | undefined) {
  return variant && variant.images.length > 0 ? variant.images : common;
}

/** Precio, cuotas, transferencia y estado de stock del sabor elegido. */
export function VariantPriceBlock({ fallback }: { fallback: Pick<ProductDetail, "priceArs" | "compareAtPriceArs" | "inStock"> }) {
  const selected = useProductVariant()?.variant;
  const priceArs = selected?.priceArs ?? fallback.priceArs;
  const compareAtPriceArs = selected ? selected.compareAtPriceArs : fallback.compareAtPriceArs;
  const inStock = selected ? selected.inStock : fallback.inStock;
  return (
    <>
      <p className="buybox-price">{formatArs(priceArs)} {compareAtPriceArs ? <del>{formatArs(compareAtPriceArs)}</del> : null}</p>
      <InstallmentsBlock price={priceArs}/>
      {commerce.transferDiscountPercent > 0 ? <p className="transfer-price">{formatArs(transferPrice(priceArs))} con transferencia bancaria</p> : null}
      <p className={`stock ${inStock ? "" : "stock--out"}`}><span/> {inStock ? "En stock" : "Sin stock por el momento"}</p>
    </>
  );
}

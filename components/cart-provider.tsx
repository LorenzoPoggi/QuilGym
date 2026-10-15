"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { acknowledgeCartChanges, addToCart, applyCoupon, removeCoupon, removeFromCart, updateCartQuantity } from "@/lib/cart-actions";
import { emptyCart, type Cart, type CartActionResult } from "@/lib/cart-types";

type Feedback = { tone: "success" | "error"; text: string } | null;
type AddOptions = { openDrawer?: boolean; animateFrom?: HTMLElement | null };

async function flyProductToCart(source: HTMLElement | null) {
  if (!source || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const image = source.closest(".combo-card, .product-card, .product-gallery")?.querySelector("img")
    ?? document.querySelector<HTMLElement>(".product-gallery img");
  const target = document.querySelector<HTMLElement>(".site-header .cart-pill, .cart-pill");
  if (!(image instanceof HTMLImageElement) || !target || typeof image.animate !== "function") return false;

  const from = image.getBoundingClientRect();
  const to = target.getBoundingClientRect();
  if (!from.width || !from.height || !to.width || !to.height) return false;

  const flight = document.createElement("img");
  flight.src = image.currentSrc || image.src;
  flight.alt = "";
  flight.setAttribute("aria-hidden", "true");
  Object.assign(flight.style, {
    position: "fixed", zIndex: "10000", left: `${from.left}px`, top: `${from.top}px`,
    width: `${Math.min(from.width, 84)}px`, height: `${Math.min(from.height, 84)}px`,
    objectFit: "contain", borderRadius: "12px", background: "#fff", padding: "4px",
    boxShadow: "0 8px 24px rgba(0,0,0,.22)", pointerEvents: "none",
  });
  document.body.append(flight);
  const dx = to.left + to.width / 2 - (from.left + Math.min(from.width, 84) / 2);
  const dy = to.top + to.height / 2 - (from.top + Math.min(from.height, 84) / 2);
  try {
    await flight.animate(
      [{ transform: "translate(0, 0) scale(1)", opacity: 1 }, { transform: `translate(${dx}px, ${dy}px) scale(.18)`, opacity: .25 }],
      { duration: 520, easing: "cubic-bezier(.2,.75,.25,1)", fill: "forwards" },
    ).finished;
  } catch { /* Si el usuario navega o cancela la animación, abrimos igual el carrito. */ }
  finally { flight.remove(); }
  return true;
}

type CartContextValue = {
  cart: Cart;
  loaded: boolean;
  pending: boolean;
  feedback: Feedback;
  isOpen: boolean;
  countBouncing: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Agrega y abre el drawer, salvo `openDrawer: false` (p. ej. "Comprar ahora"). */
  add: (variantId: number, quantity?: number, options?: AddOptions) => Promise<CartActionResult>;
  setQuantity: (variantId: number, quantity: number) => Promise<CartActionResult>;
  remove: (variantId: number) => Promise<CartActionResult>;
  applyCoupon: (code: string) => Promise<CartActionResult>;
  removeCoupon: () => Promise<CartActionResult>;
  acknowledgeChanges: () => Promise<CartActionResult>;
  refreshCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [loaded, setLoaded] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [countBouncing, setCountBouncing] = useState(false);

  // Los setState van en callbacks de la promesa: el efecto de montaje solo dispara la carga.
  const refresh = useCallback((): Promise<void> => fetch("/api/cart", { cache: "no-store" })
    .then(async (response) => { if (response.ok) setCart(await response.json()); })
    .catch(() => setFeedback({ tone: "error", text: "No pudimos actualizar el carrito. Intentá nuevamente." }))
    .finally(() => setLoaded(true)), []);

  useEffect(() => {
    void refresh();
    // Otra pestaña pudo cambiar el carrito: lo releemos al volver.
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  const run = useCallback(async (action: () => Promise<CartActionResult>) => {
    setPendingCount((count) => count + 1);
    try {
      const result = await action();
      setCart(result.cart);
      setLoaded(true);
      setFeedback(result.ok ? (result.message ? { tone: "success", text: result.message } : null) : { tone: "error", text: result.error });
      return result;
    } catch {
      const result: CartActionResult = { ok: false, error: "No pudimos conectar con el servidor. Probá de nuevo.", cart };
      setFeedback({ tone: "error", text: result.error });
      return result;
    } finally {
      setPendingCount((count) => count - 1);
    }
  }, [cart]);

  const value = useMemo<CartContextValue>(() => ({
    cart,
    loaded,
    pending: pendingCount > 0,
    feedback,
    isOpen,
    countBouncing,
    openCart: () => setIsOpen(true),
    closeCart: () => { setIsOpen(false); setFeedback(null); },
    add: async (variantId, quantity = 1, options) => {
      const result = await run(() => addToCart(variantId, quantity));
      if (options?.openDrawer !== false || !result.ok) {
        if (result.ok && options?.animateFrom) {
          if (await flyProductToCart(options.animateFrom)) {
            setCountBouncing(true);
            window.setTimeout(() => setCountBouncing(false), 650);
          }
        }
        setIsOpen(true);
      }
      return result;
    },
    setQuantity: (variantId, quantity) => run(() => updateCartQuantity(variantId, quantity)),
    remove: (variantId) => run(() => removeFromCart(variantId)),
    applyCoupon: (code) => run(() => applyCoupon(code)),
    removeCoupon: () => run(() => removeCoupon()),
    acknowledgeChanges: () => run(() => acknowledgeCartChanges()),
    refreshCart: refresh,
  }), [cart, loaded, pendingCount, feedback, isOpen, countBouncing, run, refresh]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider.");
  return context;
}

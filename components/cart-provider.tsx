"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { acknowledgeCartChanges, addToCart, applyCoupon, removeCoupon, removeFromCart, updateCartQuantity } from "@/lib/cart-actions";
import { emptyCart, type Cart, type CartActionResult } from "@/lib/cart-types";

type Feedback = { tone: "success" | "error"; text: string } | null;

type CartContextValue = {
  cart: Cart;
  loaded: boolean;
  pending: boolean;
  feedback: Feedback;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  /** Agrega y abre el drawer, salvo `openDrawer: false` (p. ej. "Comprar ahora"). */
  add: (variantId: number, quantity?: number, options?: { openDrawer?: boolean }) => Promise<CartActionResult>;
  setQuantity: (variantId: number, quantity: number) => Promise<CartActionResult>;
  remove: (variantId: number) => Promise<CartActionResult>;
  applyCoupon: (code: string) => Promise<CartActionResult>;
  removeCoupon: () => Promise<CartActionResult>;
  acknowledgeChanges: () => Promise<CartActionResult>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [loaded, setLoaded] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isOpen, setIsOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      if (response.ok) setCart(await response.json());
    } finally {
      setLoaded(true);
    }
  }, []);

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
    openCart: () => setIsOpen(true),
    closeCart: () => { setIsOpen(false); setFeedback(null); },
    add: async (variantId, quantity = 1, options) => {
      const result = await run(() => addToCart(variantId, quantity));
      if (options?.openDrawer !== false || !result.ok) setIsOpen(true);
      return result;
    },
    setQuantity: (variantId, quantity) => run(() => updateCartQuantity(variantId, quantity)),
    remove: (variantId) => run(() => removeFromCart(variantId)),
    applyCoupon: (code) => run(() => applyCoupon(code)),
    removeCoupon: () => run(() => removeCoupon()),
    acknowledgeChanges: () => run(() => acknowledgeCartChanges()),
  }), [cart, loaded, pendingCount, feedback, isOpen, run]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider.");
  return context;
}

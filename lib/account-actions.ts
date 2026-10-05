"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { currentUser } from "./auth";
import { db } from "./db";
import { favorites, products, users } from "./db/schema";

export async function setFavorite(productId: number, saved: boolean) {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Ingresá para guardar tus favoritos." };
  if (!Number.isSafeInteger(productId) || productId <= 0 || typeof saved !== "boolean") return { ok: false, error: "Producto inválido." };
  try {
    if (saved) {
      const [product] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), eq(products.status, "active"))).limit(1);
      if (!product) return { ok: false, error: "Ese producto ya no está disponible." };
      await db.insert(favorites).values({ userId: user.id, productId }).onConflictDoNothing();
    } else await db.delete(favorites).where(and(eq(favorites.userId, user.id), eq(favorites.productId, productId)));
    revalidatePath("/cuenta");
    return { ok: true };
  } catch { return { ok: false, error: "No pudimos guardar el cambio. Intentá nuevamente." }; }
}
export async function setMarketingConsent(enabled: boolean) {
  const user = await currentUser();
  if (!user || typeof enabled !== "boolean") return { ok: false };
  await db.update(users).set({ marketingConsent: enabled }).where(eq(users.id, user.id));
  revalidatePath("/cuenta");
  return { ok: true };
}

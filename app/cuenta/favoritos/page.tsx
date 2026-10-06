import { eq } from "drizzle-orm";
import { AccountShell } from "@/components/account-shell";
import { AccountFavorites } from "@/components/account-favorites";
import { requireAccountUser } from "@/lib/account-page";
import { getAllProducts } from "@/lib/catalog";
import { db } from "@/lib/db";
import { favorites } from "@/lib/db/schema";

export const metadata = { title: "Favoritos | QuilGym", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireAccountUser();
  const [saved, catalog] = await Promise.all([
    db.select({ productId: favorites.productId }).from(favorites).where(eq(favorites.userId, user.id)),
    getAllProducts(),
  ]);
  const ids = new Set(saved.map((item) => item.productId));
  const picks = catalog.filter((product) => ids.has(product.id));
  return <AccountShell user={user} active="/cuenta/favoritos"><h2 className="account-page-title">Favoritos <span>({picks.length})</span></h2><p className="account-page-intro">Tus productos guardados, con precios y stock actualizados. Filtralos por tipo de suplemento.</p><AccountFavorites products={picks}/></AccountShell>;
}

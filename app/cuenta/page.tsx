import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Star, Package, UserRound } from "lucide-react";
import { Header } from "@/components/header";
import { ProductCard } from "@/components/product-card";
import { MarketingPreference, SignOutButton } from "@/components/account-controls";
import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { favorites, orders, users } from "@/lib/db/schema";
import { getAllProducts } from "@/lib/catalog";
import { formatArs } from "@/lib/commerce";
import { orderStatusLabels } from "@/lib/checkout-types";
export const metadata = { title: "Mi cuenta | QuilGym", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const user = await currentUser();
  if (!user) redirect("/cuenta/ingresar");
  const [saved, catalog, purchases, preferences] = await Promise.all([
    db.select().from(favorites).where(eq(favorites.userId, user.id)), getAllProducts(),
    db.select().from(orders).where(eq(orders.userId, user.id)).orderBy(desc(orders.createdAt)).limit(30),
    db.select({ marketing: users.marketingConsent }).from(users).where(eq(users.id, user.id)).limit(1),
  ]);
  const picks = catalog.filter((p) => saved.some((item) => item.productId === p.id));
  return <><Header/><main className="container account-dashboard"><header className="account-heading"><div><p className="eyebrow">MI CUENTA</p><h1>Hola, {user.name.split(" ")[0]}</h1><p>{user.email}</p></div><SignOutButton/></header><nav className="account-tabs" aria-label="Secciones de tu cuenta"><a href="#favoritos"><Star/>Favoritos</a><a href="#pedidos"><Package/>Mis pedidos</a><a href="#preferencias"><UserRound/>Preferencias</a></nav>
    <section id="favoritos"><h2>Tus favoritos <span>({picks.length})</span></h2><p>Guardá lo que te interesa y volvé cuando quieras. Los precios y el stock se actualizan.</p>{picks.length ? <div className="product-grid">{picks.map((p) => <ProductCard key={p.id} product={p}/>)}</div> : <div className="account-empty"><Star aria-hidden="true"/><h3>Tu próxima elección empieza acá</h3><p>Tocá la estrella de un producto para guardarlo.</p><Link className="button button--dark" href="/productos">Explorar productos</Link></div>}</section>
    <section id="pedidos"><h2>Mis pedidos</h2><p>Los pedidos realizados mientras estés conectado aparecen acá. Las compras actuales son de prueba.</p>{purchases.length ? <div className="account-orders">{purchases.map((order) => <Link href={`/checkout/confirmacion/${order.id}`} key={order.id}><span><strong>Pedido {order.id.slice(0,8).toUpperCase()}</strong><small>{order.createdAt.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}{order.isDemo ? " · De prueba" : ""}</small></span><span>{orderStatusLabels[order.status]}</span><strong>{formatArs(order.totalArs)}</strong></Link>)}</div> : <p className="account-empty">Todavía no tenés pedidos asociados a tu cuenta.</p>}</section>
    <section id="preferencias"><h2>Novedades a tu medida</h2><MarketingPreference initial={preferences[0]?.marketing ?? false}/></section>
  </main></>;
}

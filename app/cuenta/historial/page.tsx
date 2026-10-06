import { AccountShell } from "@/components/account-shell";
import { AccountHistory } from "@/components/account-history";
import { requireAccountUser } from "@/lib/account-page";
import { listSearchHistory } from "@/lib/search-history";

export const metadata = { title: "Historial de búsquedas | QuilGym", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireAccountUser();
  const items = await listSearchHistory(user.id);
  return <AccountShell user={user} active="/cuenta/historial"><h2 className="account-page-title">Historial</h2><p className="account-page-intro">Tus búsquedas se guardan en tu cuenta y solo vos podés verlas.</p><AccountHistory initial={items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() }))}/></AccountShell>;
}

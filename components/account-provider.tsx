"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { setFavorite } from "@/lib/account-actions";

const AccountContext = createContext<{
  user: { id: string; name: string; email: string } | null; loading: boolean;
  ids: number[]; toggle: (id: number) => Promise<void>; error: string;
} | null>(null);
const noFavorites: number[] = [];
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const [saved, setSaved] = useState<{ owner: string; ids: number[] }>({ owner: "", ids: [] });
  const [error, setError] = useState("");
  const router = useRouter();
  const user = data?.user ?? null;
  const userId = user?.id;
  const ids = saved.owner === userId ? saved.ids : noFavorites;
  useEffect(() => {
    const controller = new AbortController();
    if (userId) void fetch("/api/account/favorites", { cache: "no-store", signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((result) => setSaved({ owner: userId, ids: result.ids })).catch(() => { if (!controller.signal.aborted) { setError("No pudimos cargar tus favoritos."); setSaved({ owner: userId, ids: [] }); } });
    return () => controller.abort();
  }, [userId]);
  const toggle = useCallback(async (id: number) => {
    if (!user) { router.push("/cuenta/ingresar?next=" + encodeURIComponent(window.location.pathname + window.location.search)); return; }
    const save = !ids.includes(id);
    setError("");
    try {
      const result = await setFavorite(id, save);
      if (!result.ok) { setError(result.error || "No pudimos actualizar tus favoritos."); return; }
      setSaved((value) => ({ owner: user.id, ids: save ? [...new Set([...(value.owner === user.id ? value.ids : []), id])] : value.ids.filter((item) => item !== id) }));
      router.refresh();
    } catch { setError("No pudimos actualizar tus favoritos. Intentá nuevamente."); }
  }, [user, ids, router]);
  return <AccountContext.Provider value={{ user, loading: isPending || Boolean(userId && saved.owner !== userId), ids: user ? ids : noFavorites, toggle, error }}>{children}</AccountContext.Provider>;
}
export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("AccountProvider no disponible");
  return context;
}

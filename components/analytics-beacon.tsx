"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAccount } from "./account-provider";

/**
 * Avisa al servidor de cada página vista (analítica propia, sin terceros). No corre en el panel ni para el
 * administrador, así sus visitas no inflan las métricas. El origen (referrer y utm) se manda solo en la primera vista.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname() ?? "/";
  const { isAdmin, roleLoading, authLoading } = useAccount();
  const lastSent = useRef<string | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (authLoading || roleLoading || isAdmin || pathname.startsWith("/admin")) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;
    const params = new URLSearchParams(window.location.search);
    const body: Record<string, string> = { path: pathname };
    if (first.current) {
      first.current = false;
      if (document.referrer) body.referrer = document.referrer;
      const utm = { utmSource: params.get("utm_source"), utmMedium: params.get("utm_medium"), utmCampaign: params.get("utm_campaign") };
      for (const [key, value] of Object.entries(utm)) if (value) body[key] = value;
    }
    fetch("/api/analytics", { method: "POST", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .catch(() => { /* La analítica es accesoria. */ });
  }, [pathname, isAdmin, roleLoading, authLoading]);

  return null;
}

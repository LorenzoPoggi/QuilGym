import { isAuthorizedCron } from "@/lib/cron-auth";
import { expireAbandonedCarts } from "@/lib/abandoned-cart-expiry";
import { purgeOldAnalytics } from "@/lib/analytics";

export const runtime = "nodejs";

async function handler(request: Request) {
  if (!isAuthorizedCron(request)) return new Response(null, { status: 401 });
  try {
    const result = await expireAbandonedCarts();
    // Analítica: se borran los eventos de más de 400 días. Si falla, no afecta la limpieza de carritos.
    const analyticsPurged = await purgeOldAnalytics().catch(() => 0);
    return Response.json({ ...result, analyticsPurged });
  } catch {
    return Response.json({ error: "No se pudieron limpiar los carritos vencidos." }, { status: 503 });
  }
}

export { handler as GET, handler as POST };

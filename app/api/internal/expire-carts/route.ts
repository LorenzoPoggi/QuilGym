import { isAuthorizedCron } from "@/lib/cron-auth";
import { expireAbandonedCarts } from "@/lib/abandoned-cart-expiry";

export const runtime = "nodejs";

async function handler(request: Request) {
  if (!isAuthorizedCron(request)) return new Response(null, { status: 401 });
  try {
    const result = await expireAbandonedCarts();
    return Response.json(result);
  } catch {
    return Response.json({ error: "No se pudieron limpiar los carritos vencidos." }, { status: 503 });
  }
}

export { handler as GET, handler as POST };

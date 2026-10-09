import { getGoogleReviews } from "@/lib/google-reviews";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function GET() {
  try {
    // Presupuesto de emergencia compartido entre instancias: limita consultas al proveedor.
    if (!await consumeRateLimit("reviews:global:day", 300, 86_400_000)) {
      return Response.json({ error: "Las reseñas alcanzaron el límite diario. Volvé a consultar mañana." }, {
        status: 429,
        headers: { "Cache-Control": "no-store", "Retry-After": "86400" },
      });
    }
    return Response.json(await getGoogleReviews(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    // Fallar cerrado para no dejar sin protección el gasto externo si Postgres no responde.
    return Response.json({ error: "Las reseñas no están disponibles en este momento." }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "60" },
    });
  }
}

import { isAuthorizedCron } from "@/lib/cron-auth";
import { purgeStaleCourierPositions, syncOpenShipments } from "@/lib/tracking";

export const runtime = "nodejs";

/**
 * Cron diario (compatible con Vercel Hobby): sincroniza el seguimiento de los envíos abiertos con transportista y
 * borra las posiciones del repartidor de más de 4 horas. Sin la migración 0010 no hace nada. Requiere CRON_SECRET.
 */
async function handler(request: Request) {
  if (!isAuthorizedCron(request)) return new Response(null, { status: 401 });
  const [shipments, purgedPositions] = await Promise.all([syncOpenShipments(), purgeStaleCourierPositions()]);
  return Response.json({ ...shipments, purgedPositions });
}

export { handler as GET, handler as POST };

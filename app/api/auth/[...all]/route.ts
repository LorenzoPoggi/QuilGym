import { getAuth, authConfigured } from "@/lib/auth";
export const runtime = "nodejs";
async function handler(request: Request) {
  if (!authConfigured()) return Response.json({ message: "Las cuentas todavía no están configuradas." }, { status: 503 });
  return getAuth().handler(request);
}
export const GET = handler;
export const POST = handler;

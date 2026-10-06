import { currentUser } from "@/lib/auth";
import { cleanSearchQuery, forgetSearch, listSearchHistory, rememberSearch } from "@/lib/search-history";

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Ingresá para ver tu historial." }, { status: 401, headers: privateHeaders });
  const items = await listSearchHistory(user.id);
  return Response.json({ items }, { headers: privateHeaders });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Ingresá para guardar tu búsqueda." }, { status: 401, headers: privateHeaders });
  const body = await request.json().catch(() => null);
  if (!cleanSearchQuery(body?.query)) return Response.json({ error: "Búsqueda inválida." }, { status: 400, headers: privateHeaders });
  await rememberSearch(user.id, body.query);
  return Response.json({ items: await listSearchHistory(user.id) }, { headers: privateHeaders });
}

export async function DELETE(request: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Ingresá para borrar tu historial." }, { status: 401, headers: privateHeaders });
  const body = await request.json().catch(() => null);
  if (!Number.isSafeInteger(body?.id) || body.id < 1) return Response.json({ error: "Búsqueda inválida." }, { status: 400, headers: privateHeaders });
  await forgetSearch(user.id, body.id);
  return Response.json({ items: await listSearchHistory(user.id) }, { headers: privateHeaders });
}

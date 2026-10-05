import { NextRequest, NextResponse } from "next/server";
import { getAllProducts } from "@/lib/catalog";
import { advisorConfigured, generateAdvisorReply } from "@/lib/advisor-chat";
import { parseChatMessages } from "@/lib/advisor-chat-types";
import { advisorVisitor, allowAdvisorRequest } from "@/lib/advisor-rate-limit";
import { advisorServiceError } from "@/lib/advisor-config";

export const runtime = "nodejs";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
function error(message: string, status: number) { return NextResponse.json({ error: message }, { status, headers }); }

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return error("Solicitud no permitida.", 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return error("Formato de mensaje no válido.", 415);
  if (!advisorConfigured()) return error("El chat de IA todavía no está conectado. Falta configurar GOOGLE_GENERATIVE_AI_API_KEY en el servidor.", 503);
  // Lee con un límite efectivo incluso cuando no hay Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return error("Escribí un mensaje para empezar.", 400);
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 48000) { await reader.cancel(); return error("La conversación es demasiado larga. Reiniciala para continuar.", 413); }
      chunks.push(value);
    }
  } catch { return error("No pudimos leer el mensaje. Reintentá.", 400); }
  let messages;
  try { messages = parseChatMessages(JSON.parse(Buffer.concat(chunks).toString("utf8"))?.messages); }
  catch { return error("Formato de mensaje no válido.", 400); }
  if (!messages) return error("Revisá el mensaje o reiniciá la conversación si alcanzaste el límite.", 400);
  const visitor = advisorVisitor(request.cookies.get("qg_advisor")?.value);
  try {
    if (!await allowAdvisorRequest(visitor.id)) return error("Alcanzamos el límite de consultas. Probá más tarde.", 429);
    const catalog = await getAllProducts();
    const reply = await generateAdvisorReply(messages, catalog, request.signal);
    const response = NextResponse.json(reply, { headers });
    response.cookies.set("qg_advisor", visitor.cookie, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 86400, path: "/api/advisor" });
    return response;
  } catch (cause) {
    // No registrar mensajes, respuestas del proveedor ni claves en los logs.
    const failure = advisorServiceError(cause);
    return error(failure.message, failure.status);
  }
}

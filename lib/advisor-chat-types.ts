import type { ProductSummary } from "./catalog-types";

export const ADVISOR_GREETING = "¡Hola! Soy tu asesor fitness virtual. Contame, ¿cuál es tu principal objetivo hoy y qué te motivó a empezar?";
export const MAX_CHAT_MESSAGES = 21;
export const MAX_CHAT_TEXT = 1800;
export type AdvisorMessage = { role: "user" | "assistant"; content: string };
export type AdvisorReply = {
  reply: string;
  recommendations: { product: ProductSummary; reason: string; caution: string }[];
};
export type AdvisorModelReply = {
  reply: string;
  needsProfessional: boolean;
  recommendations: { productId: number; reason: string; caution: string }[];
};

/** Rechaza roles privilegiados, historial truncado y mensajes vacíos antes de pagar una generación. */
export function parseChatMessages(input: unknown): AdvisorMessage[] | null {
  if (!Array.isArray(input) || !input.length || input.length > MAX_CHAT_MESSAGES) return null;
  const result: AdvisorMessage[] = [];
  for (const [index, value] of input.entries()) {
    if (!value || typeof value !== "object") return null;
    const { role, content } = value;
    if (role !== (index % 2 === 0 ? "user" : "assistant") || typeof content !== "string") return null;
    const text = content.trim();
    if (!text || text.length > (role === "user" ? MAX_CHAT_TEXT : 5000)) return null;
    result.push({ role, content: text });
  }
  return result.at(-1)?.role === "user" ? result : null;
}

export function validModelReply(value: unknown): value is AdvisorModelReply {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<AdvisorModelReply>;
  return typeof v.reply === "string" && v.reply.trim().length > 0 && v.reply.length <= 5000 &&
    typeof v.needsProfessional === "boolean" && Array.isArray(v.recommendations) && v.recommendations.length <= 3 &&
    v.recommendations.every((r) => r && Number.isSafeInteger(r.productId) && r.productId > 0 &&
      typeof r.reason === "string" && r.reason.trim().length > 0 && r.reason.length <= 1200 &&
      typeof r.caution === "string" && r.caution.length <= 1000);
}

/** Las tarjetas nunca usan nombres, URLs, precios ni stock escritos por el modelo. */
export function resolveChatRecommendations(output: AdvisorModelReply, catalog: ProductSummary[]): AdvisorReply {
  const seen = new Set<number>();
  const recommendations: AdvisorReply["recommendations"] = [];
  if (!output.needsProfessional) {
    for (const item of output.recommendations) {
      const product = catalog.find((p) => p.id === item.productId && p.inStock);
      if (!product || seen.has(product.id)) continue;
      seen.add(product.id);
      recommendations.push({ product, reason: item.reason, caution: item.caution });
    }
  }
  return { reply: output.reply, recommendations };
}

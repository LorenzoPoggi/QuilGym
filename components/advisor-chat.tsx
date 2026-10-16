"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Bot, MessagesSquare, RefreshCw, Send, ShieldCheck, LoaderCircle } from "lucide-react";
import { ADVISOR_GREETING, MAX_CHAT_MESSAGES, MAX_CHAT_TEXT, type AdvisorMessage, type AdvisorReply } from "@/lib/advisor-chat-types";
import { ProductCard } from "./product-card";

type ChatEntry = AdvisorMessage & { id: string; recommendations?: AdvisorReply["recommendations"] };
type AdvisorStreamEvent =
  | { type: "reply"; reply: string }
  | ({ type: "done" } & AdvisorReply)
  | { type: "error"; error: string };
const greeting: ChatEntry = { id: "welcome", role: "assistant", content: ADVISOR_GREETING };

async function readAdvisorStream(response: Response, onEvent: (event: AdvisorStreamEvent) => void) {
  if (!response.body) throw new Error("El asesor no pudo iniciar la respuesta. Reintentá.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function readLine(line: string) {
    if (!line.trim()) return;
    let value: unknown;
    try { value = JSON.parse(line); }
    catch { throw new Error("El asesor devolvió una respuesta incompleta. Reintentá."); }
    if (!value || typeof value !== "object" || !("type" in value)) throw new Error("El asesor devolvió una respuesta inválida. Reintentá.");
    onEvent(value as AdvisorStreamEvent);
  }

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(readLine);
    if (done) break;
  }
  readLine(buffer);
}

export function AdvisorChat({ configured }: { configured: boolean }) {
  const [messages, setMessages] = useState<ChatEntry[]>([greeting]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const history = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const turnAnchor = useRef<string | null>(null);
  const last = messages.at(-1)!;
  const failed = !pending && last.role === "user";
  const exhausted = messages.length - 1 >= MAX_CHAT_MESSAGES && last.role === "assistant";

  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const region = history.current;
    const anchor = turnAnchor.current;
    if (!region || !anchor) return;
    const frame = requestAnimationFrame(() => {
      const entry = region.querySelector<HTMLElement>(`[data-message-id="${anchor}"]`);
      if (!entry) return;
      const top = entry.getBoundingClientRect().top - region.getBoundingClientRect().top + region.scrollTop - 12;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      region.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? "auto" : "smooth" });
      turnAnchor.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages]);

  async function ask(next: ChatEntry[]) {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true); setError("");
    const assistantId = crypto.randomUUID();
    let receivedReply = false;
    let completed = false;
    try {
      const response = await fetch("/api/advisor", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ messages: next.slice(1).map(({ role, content }) => ({ role, content })) }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: unknown } | null;
        throw new Error(typeof result?.error === "string" ? result.error : "No pudimos enviar tu mensaje.");
      }
      await readAdvisorStream(response, (streamEvent) => {
        if (request.current !== controller) return;
        if (streamEvent.type === "error") throw new Error(streamEvent.error || "No pudimos completar la respuesta.");
        if (streamEvent.type === "reply") {
          if (typeof streamEvent.reply !== "string" || !streamEvent.reply) return;
          receivedReply = true;
          setStreamingId(assistantId);
          setMessages((current) => {
            const existing = current.some((message) => message.id === assistantId);
            if (!existing) return [...next, { id: assistantId, role: "assistant", content: streamEvent.reply }];
            return current.map((message) => message.id === assistantId ? { ...message, content: streamEvent.reply } : message);
          });
          return;
        }
        if (typeof streamEvent.reply !== "string" || !Array.isArray(streamEvent.recommendations)) throw new Error("El asesor no devolvió una respuesta válida. Reintentá.");
        completed = true;
        setStreamingId(null);
        setMessages([...next, { id: assistantId, role: "assistant", content: streamEvent.reply, recommendations: streamEvent.recommendations }]);
      });
      if (!completed) throw new Error("El asesor no pudo completar la respuesta. Reintentá.");
    } catch (cause) {
      if (!controller.signal.aborted) {
        if (receivedReply) setMessages((current) => current.filter((message) => message.id !== assistantId));
        setError(cause instanceof Error ? cause.message : "No pudimos conectar. Reintentá.");
      }
    } finally {
      if (request.current === controller) { request.current = null; setPending(false); setStreamingId(null); textarea.current?.focus(); }
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || pending || failed || exhausted) return;
    const userId = crypto.randomUUID();
    const next: ChatEntry[] = [...messages, { id: userId, role: "user", content: text }];
    turnAnchor.current = userId;
    setMessages(next); setInput(""); void ask(next);
  }
  function reset() {
    request.current?.abort(); request.current = null;
    turnAnchor.current = null;
    setPending(false); setStreamingId(null); setError(""); setInput(""); setMessages([greeting]);
    history.current?.scrollTo({ top: 0, behavior: "auto" }); textarea.current?.focus();
  }

  return <div className="advisor-layout advisor-layout--conversation">
    <aside className="advisor-sidebar">
      <span className="advisor-sidebar-icon"><MessagesSquare aria-hidden="true"/></span>
      <p className="eyebrow">ASESOR QUILGYM</p>
      <h1>Tu objetivo. Tu rutina. Tu conversación.</h1>
      <p>Contame dónde estás y adónde querés llegar. Vamos a pensar juntos qué hábitos y opciones del catálogo pueden acompañarte, y por qué.</p>
      <small><ShieldCheck aria-hidden="true"/>Soy un asesor virtual con IA, no un profesional de salud. Las sugerencias son informativas y no reemplazan una evaluación personal.</small>
    </aside>
    {/* En mobile el panel lateral (con el h1) se oculta: este título solo existe para lectores de pantalla. */}
    <h1 className="advisor-mobile-title">Asesor QuilGym: tu objetivo, tu rutina, tu conversación</h1>
    <section className="advisor-chat advisor-chat--conversation" aria-label="Chat con el asesor QuilGym">
      <header><div><span><Bot aria-hidden="true"/></span><strong>Asesor QuilGym</strong><small>{pending ? (streamingId ? "Respondiendo…" : "Pensando en tu situación…") : "Conversemos sobre vos"}</small></div><button type="button" onClick={reset}><RefreshCw aria-hidden="true"/>Reiniciar</button></header>
      <div ref={history} className="advisor-conversation" role="log" aria-label="Conversación" aria-live="polite" aria-relevant="additions" aria-busy={pending} tabIndex={0}>
        {messages.map((message) => <div key={message.id} data-message-id={message.id} className={`advisor-entry advisor-entry--${message.role}${streamingId === message.id ? " advisor-entry--streaming" : ""}`}>
          <span className="advisor-speaker">{message.role === "assistant" ? <><Bot aria-hidden="true"/>Asesor QuilGym</> : "Vos"}</span>
          <p className="advisor-bubble">{message.content}</p>
          {message.recommendations?.length ? <div className="advisor-chat-products">{message.recommendations.map(({ product, reason, caution }) => <div key={product.id}><ProductCard product={product} compact/><div className="recommendation-reason"><h3>Por qué podría servirte</h3><p>{reason}</p>{caution ? <small><ShieldCheck aria-hidden="true"/>{caution}</small> : null}</div></div>)}</div> : null}
        </div>)}
        {messages.length === 1 && !pending ? <div className="advisor-starters" aria-label="Ideas para iniciar la conversación"><p>Podés empezar por acá:</p>{[
          "Quiero ganar masa muscular, ¿por dónde empiezo?",
          "¿Qué diferencia hay entre creatina y proteína?",
          "Quiero explorar opciones según mi rutina de entrenamiento.",
        ].map((prompt) => <button type="button" key={prompt} onClick={() => { setInput(prompt); textarea.current?.focus(); }}>{prompt}</button>)}</div> : null}
        {pending && !streamingId ? <p className="advisor-thinking" role="status"><LoaderCircle aria-hidden="true"/>Estoy leyendo lo que me contaste…</p> : null}
      </div>
      {error ? <div className="advisor-chat-error" role="alert"><p>{error}</p>{failed ? <button className="button button--outline" type="button" onClick={() => void ask(messages)}>Reintentar mensaje</button> : null}</div> : null}
      {!configured ? <p className="advisor-config-note" role="status">El chat está preparado, pero falta conectar Gemini. Configurá GOOGLE_GENERATIVE_AI_API_KEY en el servidor para conversar.</p> : null}
      {exhausted ? <p role="status">Llegamos al límite de esta conversación. Podés reiniciar para seguir con otra consulta.</p> : null}
      <form className="advisor-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="advisor-message">Tu mensaje al asesor</label>
        <textarea ref={textarea} id="advisor-message" rows={2} value={input} maxLength={MAX_CHAT_TEXT} placeholder="Contame tu objetivo, tu rutina o tus dudas…" disabled={pending || failed || exhausted} aria-describedby="advisor-privacy" onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/>
        <button type="submit" className="button button--dark" aria-label="Enviar mensaje" disabled={!input.trim() || pending || failed || exhausted}><Send aria-hidden="true"/><span>Enviar</span></button>
      </form>
      <div id="advisor-privacy" className="advisor-privacy"><p>IA informativa, no reemplaza a un profesional de salud. La procesa un proveedor externo: no compartas datos sensibles.</p><details><summary>Más info</summary><p>Soy un asesor virtual con IA, no un profesional de salud; mis sugerencias son informativas y no reemplazan una evaluación personal. Al enviar, la conversación se procesa con un proveedor externo de IA. QuilGym no guarda este chat en tu cuenta; se borra al salir o reiniciar. Enter envía · Shift + Enter agrega una línea.</p></details></div>
    </section>
  </div>;
}

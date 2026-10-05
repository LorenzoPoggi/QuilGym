"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Bot, MessagesSquare, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { advisorSteps } from "@/lib/advisor";
export function AdvisorWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string,string>>({});
  const current = advisorSteps[step];
  const selected = answers[current.key];
  function next() {
    if (!selected) return;
    if ((current.key === "age" && selected === "minor") || (current.key === "safety" && selected === "consult")) { router.push("/asesor/recomendaciones?orientacion=personal"); return; }
    if (step < advisorSteps.length - 1) { setStep(step + 1); return; }
    const params = new URLSearchParams(Object.entries(answers).filter(([key]) => !["age", "safety"].includes(key)));
    params.set("perfil", "adulto");
    router.push("/asesor/recomendaciones?" + params.toString());
  }
  return <div className="advisor-layout"><aside className="advisor-sidebar"><span className="advisor-sidebar-icon"><MessagesSquare aria-hidden="true"/></span><p className="eyebrow">ASESOR QUILGYM</p><h1>Entendamos tu rutina antes de elegir</h1><p>Una conversación sobre tu experiencia, objetivo y alimentación. Después vas a ver opciones del catálogo y el motivo de cada sugerencia.</p><div><strong>Paso {step+1} de {advisorSteps.length}</strong><span>{Math.round((step+1)/advisorSteps.length*100)}%</span></div><progress value={step+1} max={advisorSteps.length} aria-label={`Paso ${step+1} de ${advisorSteps.length}`}/><small><ShieldCheck aria-hidden="true"/>Guía informativa con criterios de entrenamiento y nutrición. No reemplaza a un entrenador o nutricionista.</small></aside>
  <section className="advisor-chat"><header><div><span><Bot aria-hidden="true"/></span><strong>Asesor QuilGym</strong><small><i aria-hidden="true"/>Vamos paso a paso</small></div><button type="button" onClick={() => { setStep(0); setAnswers({}); }}><RefreshCw aria-hidden="true"/>Reiniciar</button></header>
  <div className="advisor-transcript" aria-label="Respuestas anteriores">{advisorSteps.slice(0,step).filter((s) => answers[s.key]).map((s) => <div key={s.key}><small>{s.question}</small><div className="chat-answer">{s.options.find(([id]) => id === answers[s.key])?.[1]}</div></div>)}</div>
  <div className="chat-message" aria-live="polite"><span><Sparkles aria-hidden="true"/></span><div><p>{current.context}</p><h2>{current.question}</h2></div></div><div className="advisor-options">{current.options.map(([id,label]) => <button type="button" key={id} className={selected === id ? "is-active" : ""} aria-pressed={selected === id} onClick={() => setAnswers((a) => ({...a,[current.key]:id}))}><span><Check aria-hidden="true"/></span>{label}{selected === id ? <Check className="advisor-option-check" aria-hidden="true"/> : null}</button>)}</div><p className="advisor-step-label">{current.title} · Tus respuestas no se guardan en una cuenta.</p><footer><button className="button button--outline" disabled={!step} onClick={() => setStep(step-1)}><ArrowLeft aria-hidden="true"/>Anterior</button><button className="button button--dark" disabled={!selected} onClick={next}>{step === advisorSteps.length-1 ? "Ver mis opciones" : "Continuar"}<ArrowRight aria-hidden="true"/></button></footer></section></div>;
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, ArrowRight, BatteryCharging, Banknote, Bot, CalendarCheck, CalendarDays, CandyOff, Check, CircleCheck, Coins, Dumbbell, Flame, Gauge, Layers, Medal, MessagesSquare, RefreshCw, RotateCcw, ShieldCheck, Shuffle, Sparkles, Sprout, Timer, TrendingUp, Vegan, Wallet, Weight, WheatOff, Zap } from "lucide-react";

type Option = { label: string; icon: LucideIcon };

const steps: { key: string; question: string; options: Option[] }[] = [
  { key: "Objetivo", question: "¿Cuál es tu objetivo principal?", options: [{ label: "Mejorar mi rendimiento", icon: Gauge }, { label: "Ganar masa muscular", icon: Dumbbell }, { label: "Recuperarme mejor", icon: BatteryCharging }, { label: "Tener más energía", icon: Zap }] },
  { key: "Experiencia", question: "¿Cómo describirías tu experiencia entrenando?", options: [{ label: "Estoy empezando", icon: Sprout }, { label: "Tengo experiencia intermedia", icon: TrendingUp }, { label: "Entreno hace varios años", icon: Medal }, { label: "Estoy retomando", icon: RotateCcw }] },
  { key: "Frecuencia", question: "¿Con qué frecuencia entrenás habitualmente?", options: [{ label: "3 veces por semana", icon: CalendarDays }, { label: "4 veces por semana", icon: CalendarCheck }, { label: "5 o más veces", icon: Flame }, { label: "Estoy retomando", icon: RotateCcw }] },
  { key: "Tipo de entrenamiento", question: "¿Qué tipo de entrenamiento hacés más seguido?", options: [{ label: "Fuerza", icon: Weight }, { label: "Hipertrofia", icon: Dumbbell }, { label: "Resistencia", icon: Timer }, { label: "Entrenamiento mixto", icon: Shuffle }] },
  { key: "Preferencias", question: "¿Tenés alguna preferencia alimentaria?", options: [{ label: "Sin restricciones", icon: CircleCheck }, { label: "Sin TACC", icon: WheatOff }, { label: "Vegano", icon: Vegan }, { label: "Sin azúcar agregada", icon: CandyOff }] },
  { key: "Presupuesto", question: "¿Qué presupuesto querés considerar?", options: [{ label: "Hasta $30.000", icon: Wallet }, { label: "Hasta $45.000", icon: Coins }, { label: "Hasta $60.000", icon: Banknote }, { label: "Quiero ver todas", icon: Layers }] },
];

export function AdvisorWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const current = steps[step];
  const selected = answers[step];
  const percent = Math.round(((step + 1) / steps.length) * 100);

  function choose(answer: string) {
    setAnswers((items) => [...items.slice(0, step), answer, ...items.slice(step + 1)]);
  }

  function next() {
    if (!selected) return;
    if (step === steps.length - 1) router.push("/asesor/recomendaciones");
    else setStep((value) => value + 1);
  }

  return <div className="advisor-layout">
    <aside className="advisor-sidebar">
      <span className="advisor-sidebar-icon"><MessagesSquare aria-hidden="true"/></span>
      <p className="eyebrow">ASESOR QUILGYM</p>
      <h1>Una guía simple para elegir con más claridad</h1>
      <p>Te hacemos seis preguntas y sugerimos hasta tres opciones. Orientación informativa, sin promesas médicas.</p>
      <div><strong>Paso {step + 1} de {steps.length}</strong><span>{percent}%</span></div>
      <progress value={step + 1} max={steps.length} aria-label={`Paso ${step + 1} de ${steps.length}`}/>
      <small><ShieldCheck aria-hidden="true"/> No necesitás registrarte. Podés cambiar respuestas o reiniciar cuando quieras.</small>
    </aside>
    <section className="advisor-chat">
      <header><div><span><Bot aria-hidden="true"/></span><strong>Asesor QuilGym</strong><small><i aria-hidden="true"/> Disponible ahora</small></div><button type="button" onClick={() => { setStep(0); setAnswers([]); }}><RefreshCw aria-hidden="true"/> Reiniciar</button></header>
      <div className="chat-message"><span><Sparkles aria-hidden="true"/></span><p>¡Hola! Voy a ayudarte a ordenar opciones según tu entrenamiento y preferencias.<br/>{current.question}</p></div>
      {step > 0 ? <div className="chat-answer">{answers[step - 1]}</div> : null}
      <div className="advisor-options">{current.options.map(({ label, icon: Icon }) => <button type="button" className={selected === label ? "is-active" : ""} aria-pressed={selected === label} onClick={() => choose(label)} key={label}><span><Icon aria-hidden="true"/></span>{label}{selected === label ? <Check className="advisor-option-check" aria-hidden="true"/> : null}</button>)}</div>
      <div className="journey"><p className="eyebrow">TU RECORRIDO</p><div>{steps.map((item, index) => <span className={index === step ? "is-active" : index < step ? "is-done" : ""} key={item.key}>{item.key}{index < step ? <><Check aria-hidden="true"/><span className="sr-only"> (completado)</span></> : null}</span>)}</div></div>
      <footer><button type="button" className="button button--outline" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft aria-hidden="true"/> Anterior</button><button type="button" className="button button--outline" disabled={!selected} onClick={next}><ArrowRight aria-hidden="true"/> {step === steps.length - 1 ? "Ver recomendaciones" : "Continuar"}</button></footer>
    </section>
  </div>;
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowIcon, CheckIcon, SparkIcon } from "./icons";

const steps = [
  { key: "Objetivo", question: "¿Cuál es tu objetivo principal?", options: ["Mejorar mi rendimiento", "Ganar masa muscular", "Recuperarme mejor", "Tener más energía"] },
  { key: "Experiencia", question: "¿Cómo describirías tu experiencia entrenando?", options: ["Estoy empezando", "Tengo experiencia intermedia", "Entreno hace varios años", "Estoy retomando"] },
  { key: "Frecuencia", question: "¿Con qué frecuencia entrenás habitualmente?", options: ["3 veces por semana", "4 veces por semana", "5 o más veces", "Estoy retomando"] },
  { key: "Tipo de entrenamiento", question: "¿Qué tipo de entrenamiento hacés más seguido?", options: ["Fuerza", "Hipertrofia", "Resistencia", "Entrenamiento mixto"] },
  { key: "Preferencias", question: "¿Tenés alguna preferencia alimentaria?", options: ["Sin restricciones", "Sin TACC", "Vegano", "Sin azúcar agregada"] },
  { key: "Presupuesto", question: "¿Qué presupuesto querés considerar?", options: ["Hasta $30.000", "Hasta $45.000", "Hasta $60.000", "Quiero ver todas"] },
];

export function AdvisorWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const current = steps[step];
  const selected = answers[step];

  function choose(answer: string) {
    setAnswers((items) => [...items.slice(0, step), answer, ...items.slice(step + 1)]);
  }

  function next() {
    if (!selected) return;
    if (step === steps.length - 1) router.push("/asesor/recomendaciones");
    else setStep((value) => value + 1);
  }

  return <div className="advisor-layout"><aside className="advisor-sidebar"><span className="advisor-sidebar-icon">▢</span><p className="eyebrow">ASESOR QUILGYM</p><h1>Una guía simple para elegir con más claridad</h1><p>Te hacemos seis preguntas y sugerimos hasta tres opciones. Orientación informativa, sin promesas médicas.</p><div><strong>Paso {step + 1} de {steps.length}</strong><span>{Math.round(((step + 1) / steps.length) * 100)}%</span></div><progress value={step + 1} max={steps.length}/><small>♢ No necesitás registrarte. Podés cambiar respuestas o reiniciar cuando quieras.</small></aside><section className="advisor-chat"><header><div><span><SparkIcon/></span><strong>Asesor QuilGym</strong><small>● Disponible ahora</small></div><button type="button" onClick={() => { setStep(0); setAnswers([]); }}>↻ Reiniciar</button></header><div className="chat-message"><SparkIcon/><p>¡Hola! Voy a ayudarte a ordenar opciones según tu entrenamiento y preferencias.<br/>{current.question}</p></div>{step > 0 ? <div className="chat-answer">{answers[step - 1]}</div> : null}<div className="advisor-options">{current.options.map((option, index) => <button type="button" className={selected === option ? "is-active" : ""} onClick={() => choose(option)} key={option}><span>{["◫","▣","♨","↻"][index]}</span>{option}{selected === option ? <CheckIcon/> : null}</button>)}</div><div className="journey"><p className="eyebrow">TU RECORRIDO</p><div>{steps.map((item,index) => <span className={index === step ? "is-active" : index < step ? "is-done" : ""} key={item.key}>{item.key}{index < step ? " ✓" : ""}</span>)}</div></div><footer><button type="button" className="button button--outline" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>← Anterior</button><button type="button" className="button button--outline" disabled={!selected} onClick={next}>{step === steps.length - 1 ? "Ver recomendaciones" : "Continuar"}<ArrowIcon/></button></footer></section></div>;
}

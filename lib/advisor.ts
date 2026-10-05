import type { ProductSummary } from "./catalog-types";
export const advisorVersion = "2026-10-v1";
export const advisorSteps = [
  { key: "age", title: "Antes de empezar", question: "¿Tenés 18 años o más?", context: "La suplementación de menores requiere una evaluación individual.", options: [["adult", "Sí, tengo 18 años o más"], ["minor", "Soy menor de 18 años"]] },
  { key: "safety", title: "Tu cuidado", question: "¿Necesitás consultar antes de usar suplementos?", context: "Si tenés una condición de salud, tomás medicación, estás embarazada o en lactancia, conviene revisarlo con un profesional. No necesitás contarnos detalles.", options: [["clear", "No, ninguna de esas situaciones"], ["consult", "Sí, o no estoy seguro/a"]] },
  { key: "experience", title: "Tu historia", question: "¿Alguna vez entrenaste de forma regular?", context: "No existe un suplemento obligatorio para empezar. Queremos entender dónde estás hoy.", options: [["never", "Todavía no entrené"], ["starting", "Estoy empezando ahora"], ["regular", "Ya entreno de forma regular"], ["returning", "Entrené antes y estoy retomando"]] },
  { key: "duration", title: "Tu experiencia", question: "¿Hace cuánto entrenás en esta etapa?", context: "La continuidad ayuda a decidir si tiene sentido sumar algo o enfocarnos primero en la rutina.", options: [["new", "Menos de 3 meses o todavía no empecé"], ["months", "Entre 3 meses y 1 año"], ["years", "Más de 1 año"]] },
  { key: "goal", title: "Tu objetivo", question: "¿Qué querés conseguir y por qué buscás suplementos?", context: "Elegí tu prioridad. Los suplementos pueden complementar alimentación, entrenamiento y descanso; no los reemplazan.", options: [["muscle", "Ganar masa muscular"], ["strength", "Mejorar fuerza y rendimiento"], ["recovery", "Acompañar mi recuperación"], ["weight", "Bajar grasa corporal"], ["energy", "Sentirme con más energía"]] },
  { key: "training", title: "Tu rutina", question: "¿Qué tipo de entrenamiento hacés o vas a empezar?", context: "Una rutina de fuerza y una de resistencia no tienen las mismas demandas.", options: [["strength", "Gimnasio, fuerza o musculación"], ["endurance", "Running, ciclismo o resistencia"], ["mixed", "Deportes o entrenamiento mixto"], ["none", "Todavía no tengo una rutina"]] },
  { key: "frequency", title: "Tu constancia", question: "¿Cuántos días por semana entrenás?", context: "Entrenar más días no significa necesitar más suplementos.", options: [["low", "0 a 1 día"], ["medium", "2 a 3 días"], ["high", "4 o más días"]] },
  { key: "nutrition", title: "Tu alimentación", question: "¿Cómo te llevás con las fuentes de proteína en tus comidas?", context: "Pensá en huevos, carnes, lácteos, legumbres o alternativas vegetales. Esta pregunta no mide tus requerimientos nutricionales.", options: [["enough", "Suelo incluirlas en mis comidas"], ["difficult", "Me cuesta incluirlas por tiempo o practicidad"], ["unsure", "No sé si estoy cubriendo lo que necesito"]] },
  { key: "restriction", title: "Tus preferencias", question: "¿Hay algo que debamos revisar en el rótulo?", context: "No tenemos ingredientes y certificaciones estructurados para todo el catálogo. No vamos a asumir que un producto es apto.", options: [["none", "No tengo restricciones"], ["vegan", "Busco opciones veganas"], ["gluten", "Necesito productos sin TACC"], ["allergy", "Tengo alergias o intolerancias"]] },
  { key: "budget", title: "Tu presupuesto", question: "¿Hasta cuánto querés gastar en un producto?", context: "Filtramos por precio actual y disponibilidad, sin armarte una compra obligatoria.", options: [["30000", "Hasta $30.000"], ["45000", "Hasta $45.000"], ["60000", "Hasta $60.000"], ["all", "Prefiero ver todas las opciones"]] },
] as const;
export type AdvisorProfile = Record<(typeof advisorSteps)[number]["key"], string>;
export function parseAdvisorProfile(raw: Record<string, unknown>): AdvisorProfile | null {
  const result: Record<string,string> = {};
  for (const step of advisorSteps) {
    if (typeof raw[step.key] !== "string" || !step.options.some(([id]) => id === raw[step.key])) return null;
    result[step.key] = raw[step.key] as string;
  }
  return result as AdvisorProfile;
}
export type AdvisorResult = { title: string; explanation: string; habits: string[]; picks: { product: ProductSummary; reason: string; check: string }[]; requiresConsultation: boolean };
/** Reglas auditables. No dosifica ni infiere ingredientes por marca. */
export function recommendProducts(profile: AdvisorProfile, catalog: ProductSummary[]): AdvisorResult {
  const base = { habits: ["Sostené una rutina progresiva que puedas mantener.", "Priorizá comidas variadas y descanso suficiente.", "Un suplemento es opcional: identificá qué necesidad concreta cubre."], picks: [], requiresConsultation: false };
  if (profile.age !== "adult" || profile.safety !== "clear") return { ...base, requiresConsultation: true, title: "Primero, una orientación personal", explanation: "Revisá tu caso con un profesional de salud o nutrición deportiva antes de elegir suplementos. Con estas respuestas no corresponde una sugerencia automática." };
  if (profile.restriction !== "none") return { ...base, title: "Revisemos los ingredientes antes de elegir", explanation: "Tu preferencia o restricción importa. Como no podemos verificar ingredientes, alérgenos y certificaciones de todo el catálogo, no te mostramos opciones como aptas. Revisá el rótulo y consultá con un profesional y con el local." };
  const novice = profile.experience === "never" || profile.training === "none" || profile.frequency === "low"
    || (profile.duration === "new" && ["starting", "returning"].includes(profile.experience));
  const categories = new Map<string, { reason: string; check: string }>();
  if (!novice && profile.nutrition === "difficult") categories.set("proteinas", {
    reason: "Contaste que te cuesta incluir fuentes de proteína por practicidad. Una proteína en polvo puede ser una forma cómoda de complementar comidas cuando no cubrís lo necesario con alimentos. No es necesaria si ya cubrís tus necesidades.",
    check: "Revisá ingredientes y alérgenos. Esta conversación no calculó tu requerimiento de proteína.",
  });
  if (!novice && ["muscle", "strength"].includes(profile.goal) && ["strength", "mixed"].includes(profile.training)) categories.set("creatinas", {
    reason: "Tu objetivo y tu rutina incluyen esfuerzos de fuerza o alta intensidad. La creatina cuenta con evidencia en ese tipo de esfuerzos, aunque su efecto varía y no sustituye la progresión del entrenamiento. Es una opción para evaluar, no un requisito.",
    check: "Confirmá el tipo de creatina, ingredientes y advertencias en el rótulo. No asumimos la formulación por marca ni indicamos dosis personales.",
  });
  if (novice) categories.set("accesorios", { reason: "Como estás construyendo tu rutina, priorizamos una ayuda práctica para organizarla. Un accesorio no tiene efectos nutricionales; podés empezar sin suplementos.", check: "Comprobá que el accesorio te resulte útil. No hace falta comprar para empezar." });
  const cap = profile.budget === "all" ? Infinity : Number(profile.budget);
  const sorted = catalog.filter((p) => p.inStock && p.priceArs <= cap && categories.has(p.category.slug)
    && (p.category.slug !== "creatinas" || /creatina|creatine/i.test(p.name))).toSorted((a,b) => a.priceArs-b.priceArs || a.id-b.id);
  const picks: AdvisorResult["picks"] = [];
  for (const category of categories.keys()) {
    const product = sorted.find((p) => p.category.slug === category);
    if (product) picks.push({ product, ...categories.get(category)! });
  }
  for (const product of sorted) if (picks.length < 3 && !picks.some((p) => p.product.id === product.id)) picks.push({ product, ...categories.get(product.category.slug)! });
  let explanation = novice ? "Estás empezando o todavía no sostenés una rutina. Lo que más puede ayudarte ahora es construir hábitos; no necesitás un suplemento para dar el primer paso." : "Estas opciones responden a tu rutina y a las necesidades que contaste. Usamos disponibilidad y precio actual, sin afirmar que una marca sea mejor que otra.";
  if (profile.goal === "weight") explanation += " No recomendamos quemadores: ningún suplemento reemplaza una estrategia de alimentación y actividad adaptada a vos.";
  if (profile.goal === "energy") explanation += " No sugerimos estimulantes para resolver cansancio. Si persiste, revisá descanso, alimentación y consultá su causa.";
  if (profile.nutrition === "unsure") explanation += " Antes de comprar proteína, conviene revisar si tu alimentación ya cubre tus necesidades.";
  if (!picks.length) explanation += " No encontramos una opción pertinente dentro de tu presupuesto y con stock. Eso no significa que necesites gastar más.";
  return { ...base, title: novice ? "Primero tu rutina, después los extras" : "Opciones con una razón para vos", explanation, picks };
}

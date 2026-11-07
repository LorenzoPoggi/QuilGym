/**
 * Objetivos de entrenamiento y qué categorías del catálogo los respaldan, en orden de evidencia.
 * Uso INTERNO: la evidencia y las fuentes definen qué se muestra y en qué orden; la tienda no las muestra al cliente.
 * Reglas del negocio: orienta, no diagnostica ni promete resultados; solo se mencionan las categorías
 * cuyo respaldo se puede citar. Revisar los textos con un profesional antes del lanzamiento.
 */
export type ObjectiveSource = { label: string; url: string };
export type ObjectiveGroup = { category: string; title: string; why: string };
export type Objective = {
  slug: string;
  title: string;
  /** Texto corto de la tarjeta de la home. */
  teaser: string;
  /** Qué dice la evidencia, en puntos cortos y sin promesas. */
  evidence: string[];
  /** Aclaración honesta cuando la evidencia es limitada. */
  caution?: string;
  sources: ObjectiveSource[];
  groups: ObjectiveGroup[];
};

const PROTEIN: ObjectiveSource = { label: "ISSN: postura sobre proteína y ejercicio (2017)", url: "https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0177-8" };
const CREATINE: ObjectiveSource = { label: "ISSN: postura sobre creatina (2017)", url: "https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0173-z" };
const CAFFEINE: ObjectiveSource = { label: "ISSN: postura sobre cafeína y rendimiento (2021)", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7777221/" };

export const objectives: Objective[] = [
  {
    slug: "masa-muscular",
    title: "Masa muscular",
    teaser: "Proteínas, creatina y ganadores de peso",
    evidence: [
      "Para ganar masa muscular con entrenamiento de fuerza, la postura de la ISSN indica una ingesta de proteína de 1,4 a 2,0 g por kg de peso por día; el suplemento sirve para llegar a esa cantidad cuando la comida no alcanza.",
      "La creatina es uno de los suplementos más estudiados para aumentar fuerza y masa magra junto con el entrenamiento de resistencia.",
      "Si cuesta comer lo suficiente, un ganador de peso suma calorías; el aumento de masa también depende de comer más energía de la que gastás.",
    ],
    sources: [PROTEIN, CREATINE],
    groups: [
      { category: "proteinas", title: "1. Proteínas", why: "Es la base: ayudan a llegar a la proteína diaria que respalda el aumento de masa muscular." },
      { category: "creatinas", title: "2. Creatina", why: "Tiene respaldo para mejorar fuerza y masa magra cuando se combina con entrenamiento de fuerza." },
      { category: "ganadores-de-peso", title: "3. Ganadores de peso", why: "Una opción práctica para sumar calorías y proteína si te cuesta comer lo necesario." },
    ],
  },
  {
    slug: "rendimiento",
    title: "Rendimiento",
    teaser: "Creatina y soporte para entrenar",
    evidence: [
      "La creatina puede mejorar el rendimiento en esfuerzos intensos y repetidos de corta duración.",
      "La cafeína, en dosis de 3 a 6 mg por kg tomada cerca de una hora antes, mejora el rendimiento en muchos estudios; el efecto varía entre personas.",
    ],
    sources: [CREATINE, CAFFEINE],
    groups: [
      { category: "creatinas", title: "1. Creatina", why: "El respaldo más sólido para esfuerzos intensos y repetidos, como el trabajo con pesas." },
      { category: "pre-entrenos", title: "2. Pre-entrenos", why: "Muchos aportan cafeína, que mostró beneficios en el rendimiento; revisá el rótulo y tu tolerancia." },
    ],
  },
  {
    slug: "energia",
    title: "Energía",
    teaser: "Pre-entrenos para tu rutina",
    evidence: [
      "La cafeína es el ingrediente de pre-entrenos con mejor respaldo para el rendimiento durante el ejercicio; los beneficios más consistentes se vieron en resistencia aeróbica.",
      "Dosis muy altas (9 mg por kg o más) aumentan los efectos adversos sin sumar beneficio.",
    ],
    caution: "Un pre-entreno no reemplaza el descanso ni la comida. Si tenés dudas de salud, consultá a un profesional antes de usar estimulantes.",
    sources: [CAFFEINE],
    groups: [
      { category: "pre-entrenos", title: "Pre-entrenos", why: "Aportan cafeína y otros ingredientes para entrenar con más foco; compará el contenido de cada rótulo." },
    ],
  },
  {
    slug: "recuperacion",
    title: "Recuperación",
    teaser: "Proteínas y aminoácidos",
    evidence: [
      "Sumar proteína después de entrenar ayuda a reparar el tejido muscular; la postura de la ISSN la vincula con menos daño muscular y mejor recuperación.",
      "Lo más importante es completar la proteína total del día; los aminoácidos sueltos son una alternativa práctica, no un reemplazo de la comida.",
    ],
    sources: [PROTEIN],
    groups: [
      { category: "proteinas", title: "1. Proteínas", why: "Es la opción con más respaldo para acompañar la recuperación entre entrenamientos." },
      { category: "aminoacidos", title: "2. Aminoácidos", why: "Una alternativa cómoda si buscás algo liviano cerca del entrenamiento." },
    ],
  },
  {
    slug: "definicion",
    title: "Definición",
    teaser: "Proteína para acompañar tu plan",
    evidence: [
      "Mientras se come menos energía de la que se gasta, una ingesta de proteína más alta ayuda a conservar la masa magra en personas que entrenan fuerza.",
    ],
    caution: "Ningún suplemento quema grasa por sí solo: el resultado depende de tu alimentación, tu entrenamiento y tu descanso. Por eso no sugerimos productos “quemadores”.",
    sources: [PROTEIN],
    groups: [
      { category: "proteinas", title: "Proteínas", why: "Ayudan a llegar a la proteína diaria y a conservar masa magra mientras comés menos calorías." },
    ],
  },
  {
    slug: "bienestar",
    title: "Bienestar",
    teaser: "Vitaminas, minerales y colágeno",
    evidence: [
      "Las vitaminas y los minerales sirven para cubrir una necesidad concreta; si comés variado, rara vez hace falta suplementar.",
      "La evidencia del colágeno es heterogénea y depende del caso.",
    ],
    caution: "Acá la evidencia es más limitada: consultá a un profesional de la salud para saber si necesitás suplementar.",
    sources: [],
    groups: [
      { category: "vitaminas-y-minerales", title: "Vitaminas y minerales", why: "Complementan una alimentación variada cuando hay una necesidad puntual." },
      { category: "colageno", title: "Colágeno", why: "Es un complemento; el respaldo varía según la persona y el objetivo." },
    ],
  },
];

export const objectiveSlugs = objectives.map((objective) => objective.slug);
export const getObjective = (slug: string) => objectives.find((objective) => objective.slug === slug);
export const objectiveHref = (slug: string) => `/objetivos/${slug}`;

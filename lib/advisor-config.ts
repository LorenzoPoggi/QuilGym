import "server-only";

/** La variable anterior se acepta temporalmente: su valor se envía SOLO a Google. */
export function googleAdvisorKey() {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || process.env.AI_GATEWAY_API_KEY?.trim() || "";
}

export function googleAdvisorModel() {
  return (process.env.ADVISOR_MODEL?.trim() || "gemini-3.5-flash-lite").replace(/^google\//, "");
}

/** Solo categorías públicas; nunca copiar cuerpos/URLs del error que puedan contener secretos. */
export function advisorServiceError(cause: unknown) {
  const status = cause && typeof cause === "object" && "statusCode" in cause ? cause.statusCode : null;
  if (status === 401 || status === 403) return { status: 503, message: "Google no autorizó la consulta. Revisá la clave y sus restricciones para la API de Gemini en Google AI Studio." };
  if (status === 429) return { status: 429, message: "Google indicó que se alcanzó la cuota o el límite de consultas. Revisá los límites de tu proyecto en Google AI Studio y probá más tarde." };
  if (status === 404) return { status: 503, message: "El modelo configurado no está disponible en Google. Revisá ADVISOR_MODEL y los modelos habilitados para tu proyecto." };
  if (status === 400) return { status: 503, message: "Google rechazó la configuración de la consulta. Revisá que la clave corresponda a Gemini y que el modelo configurado sea compatible." };
  if (status === 503) return { status: 503, message: "Gemini no está disponible temporalmente. Esperá un momento y reintentá." };
  return { status: 502, message: "No pudimos consultar al asesor en este momento. Tu mensaje sigue acá; podés reintentarlo." };
}

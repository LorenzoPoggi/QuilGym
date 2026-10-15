/* Mensajes de error de cuentas: cada causa con su texto, sin ocultar un problema de origen o de servidor detrás de "credenciales". */
export type AuthMode = "login" | "register" | "recover" | "reset";
export const MIN_PASSWORD = 10;
export const MAX_PASSWORD = 128;
const ORIGIN_CODES = new Set(["INVALID_ORIGIN", "MISSING_OR_NULL_ORIGIN", "CROSS_SITE_NAVIGATION_LOGIN_BLOCKED", "INVALID_CALLBACK_URL", "INVALID_REDIRECT_URL", "INVALID_ERROR_CALLBACK_URL"]);

export function authErrorMessage(mode: AuthMode, code?: string | null, status?: number | null) {
  if (status === 429) return "Demasiados intentos. Esperá unos minutos y volvé a probar.";
  if (code && ORIGIN_CODES.has(code)) return "No pudimos validar este acceso desde esta dirección. Abrí el sitio desde su dirección habitual y volvé a intentar.";
  if (status === 503) return "Las cuentas todavía no están disponibles en este entorno.";
  if (status && status >= 500) return "El acceso no está disponible en este momento. Reintentá en unos minutos.";
  if (code === "PASSWORD_TOO_SHORT") return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  if (code === "PASSWORD_TOO_LONG") return `La contraseña puede tener hasta ${MAX_PASSWORD} caracteres.`;
  if (code === "INVALID_EMAIL") return "Revisá el email: parece incompleto.";
  if (mode === "login") {
    if (code === "INVALID_EMAIL_OR_PASSWORD" || status === 401) return "Email o contraseña incorrectos. Si todavía no tenés cuenta, registrate primero.";
    if (code === "EMAIL_NOT_VERIFIED") return "Confirmá tu email desde el enlace que te enviamos antes de ingresar.";
    return "No pudimos iniciar sesión. Revisá los datos y volvé a intentar.";
  }
  if (mode === "register") {
    if (code === "USER_ALREADY_EXISTS" || code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") return "Ese email ya tiene una cuenta. Probá ingresar.";
    return "No pudimos crear la cuenta. Revisá el nombre, email y contraseña.";
  }
  if (mode === "reset") {
    if (code === "INVALID_TOKEN" || code === "TOKEN_EXPIRED") return "El enlace venció o ya se usó. Pedí uno nuevo para restablecer la contraseña.";
    return "No pudimos cambiar la contraseña. Pedí un enlace nuevo y volvé a intentar.";
  }
  if (code === "RESET_PASSWORD_DISABLED") return "La recuperación por email todavía no está disponible.";
  return "No pudimos procesar el pedido. Volvé a intentar en unos minutos.";
}
export const NETWORK_ERROR = "No pudimos conectar. Revisá tu conexión e intentá nuevamente.";

/** Avisos que llegan por la URL al volver de Google, de la verificación o del restablecimiento. */
export function loginNotice(params: { error?: string | string[]; verificado?: string; restablecida?: string }) {
  const errors = Array.isArray(params.error) ? params.error : params.error ? [params.error] : [];
  if (errors.includes("account_not_linked")) return { tone: "error" as const, text: "Ese email ya tiene una cuenta sin vincular. Ingresá con tu contraseña y luego vinculá Google desde Configuración." };
  if (errors.some((error) => error === "INVALID_TOKEN" || error === "TOKEN_EXPIRED" || error === "USER_NOT_FOUND")) return { tone: "error" as const, text: "El enlace de confirmación venció o no es válido. Ingresá y pedí uno nuevo desde tu cuenta si hace falta." };
  if (errors.length) return { tone: "error" as const, text: "No se pudo completar el acceso con Google. Podés ingresar con tu email." };
  if (params.restablecida === "1") return { tone: "success" as const, text: "Listo: tu contraseña se cambió. Ingresá con la nueva." };
  if (params.verificado === "1") return { tone: "success" as const, text: "Tu email quedó confirmado." };
  return null;
}

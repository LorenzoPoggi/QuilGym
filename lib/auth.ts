import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { after } from "next/server";
import { db } from "./db";
import { users, authSessions, authAccounts, authVerifications, authRateLimits } from "./db/schema";
import { authBaseUrl, authEnabled, googleEnabled, googleUsableOnHost, requestTrustedOrigins } from "./auth-origins";
import { authEmailConfigured, sendAuthEmail } from "./auth-email";

export function authConfigured() { return authEnabled(process.env); }
export function googleConfigured() { return googleEnabled(process.env); }
/** Recuperar contraseña y verificar email solo existen con Resend configurado. */
export function authEmailAvailable() { return authConfigured() && authEmailConfigured(process.env); }
/** Google solo en el host registrado para el callback (deployment exacto en Preview). */
export async function googleAvailableHere() { return googleConfigured() && googleUsableOnHost(process.env, (await headers()).get("host")); }

/** Los envíos corren después de responder: así la respuesta no revela si el email existe. */
function background(promise: Promise<unknown>) {
  try { after(() => promise); } catch { void promise.catch(() => {}); }
}

function createAuth() {
  const email = authEmailConfigured(process.env);
  return betterAuth({
    appName: "QuilGym",
    baseURL: authBaseUrl(process.env) ?? "http://localhost:3000",
    trustedOrigins: async (request) => requestTrustedOrigins(process.env, request),
    secret: process.env.BETTER_AUTH_SECRET || "quilgym-development-only-auth-secret-never-use-in-production",
    database: drizzleAdapter(db, { provider: "pg", schema: {
      user: users, session: authSessions, account: authAccounts, verification: authVerifications, rateLimit: authRateLimits,
    } }),
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128, revokeSessionsOnPasswordReset: true, resetPasswordTokenExpiresIn: 60 * 60,
      ...(email ? { sendResetPassword: async ({ user, url, token }: { user: { email: string; name: string }; url: string; token: string }) => { await sendAuthEmail(process.env, "reset-password", user.email, user.name, url, token); } } : {}) },
    // Se envía la verificación al registrarse, pero no se exige para ingresar: las cuentas existentes siguen funcionando.
    ...(email ? { emailVerification: { sendOnSignUp: true, autoSignInAfterVerification: true, expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url, token }: { user: { email: string; name: string }; url: string; token: string }) => { await sendAuthEmail(process.env, "verify-email", user.email, user.name, url, token); } } } : {}),
    user: { deleteUser: { enabled: true } },
    socialProviders: googleConfigured() ? { google: {
      clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    } } : {},
    account: { accountLinking: { enabled: true }, encryptOAuthTokens: true },
    advanced: { cookiePrefix: "quilgym", backgroundTasks: { handler: background } },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 8 }, "/sign-up/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 15 * 60, max: 3 }, "/reset-password": { window: 60, max: 5 }, "/send-verification-email": { window: 15 * 60, max: 3 } } },
  });
}
let instance: ReturnType<typeof createAuth> | undefined;
/** Configuración diferida: el build funciona sin credenciales y producción falla cerrada. */
export function getAuth() {
  if (!authConfigured()) throw new Error("Configurá BETTER_AUTH_SECRET y BETTER_AUTH_URL para habilitar las cuentas.");
  if (!instance) instance = createAuth();
  return instance;
}
export async function currentUser() {
  if (!authConfigured()) return null;
  return (await getAuth().api.getSession({ headers: await headers() }))?.user ?? null;
}

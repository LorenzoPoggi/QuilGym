import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { headers } from "next/headers";
import { db } from "./db";
import { users, authSessions, authAccounts, authVerifications, authRateLimits } from "./db/schema";

export function authConfigured() {
  return process.env.NODE_ENV === "development" || Boolean((process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32 && process.env.BETTER_AUTH_URL?.startsWith("https://"));
}
export function googleConfigured() { return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && (process.env.BETTER_AUTH_SECRET?.length ?? 0) >= 32 && authConfigured()); }

function createAuth() {
  return betterAuth({
    appName: "QuilGym",
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
    secret: process.env.BETTER_AUTH_SECRET || "quilgym-development-only-auth-secret-never-use-in-production",
    database: drizzleAdapter(db, { provider: "pg", schema: {
      user: users, session: authSessions, account: authAccounts, verification: authVerifications, rateLimit: authRateLimits,
    } }),
    emailAndPassword: { enabled: true, minPasswordLength: 10, maxPasswordLength: 128 },
    user: { deleteUser: { enabled: true } },
    socialProviders: googleConfigured() ? { google: {
      clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    } } : {},
    account: { accountLinking: { enabled: true }, encryptOAuthTokens: true },
    advanced: { cookiePrefix: "quilgym" },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 100,
      customRules: { "/sign-in/email": { window: 60, max: 8 }, "/sign-up/email": { window: 60, max: 5 } } },
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

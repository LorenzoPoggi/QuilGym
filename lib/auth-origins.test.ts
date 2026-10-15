import { describe, expect, it } from "vitest";
import { authBaseUrl, authEnabled, googleEnabled, googleUsableOnHost } from "./auth-origins";

const preview = {
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  VERCEL_URL: "quilgym-a1b2-lorenzopoggis-projects.vercel.app",
  VERCEL_BRANCH_URL: "quilgym-git-mp-sandbox-lorenzopoggis-projects.vercel.app",
  BETTER_AUTH_SECRET: "a".repeat(32),
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
};

describe("orígenes de autenticación en Preview", () => {
  it("usa el deployment exacto para los callbacks sin depender del alias", () => {
    expect(authBaseUrl(preview)).toBe(`https://${preview.VERCEL_URL}`);
    expect(authEnabled(preview)).toBe(true);
  });

  it("ofrece Google solo desde el deployment exacto", () => {
    expect(googleEnabled(preview)).toBe(true);
    expect(googleUsableOnHost(preview, preview.VERCEL_URL)).toBe(true);
    expect(googleUsableOnHost(preview, preview.VERCEL_BRANCH_URL)).toBe(false);
    expect(googleEnabled({ ...preview, GOOGLE_CLIENT_SECRET: undefined })).toBe(false);
  });

  it("rechaza hosts o secretos inválidos y conserva producción estática", () => {
    expect(authBaseUrl({ ...preview, VERCEL_URL: "attacker.example" })).toBeNull();
    expect(googleEnabled({ ...preview, VERCEL_URL: "attacker.example" })).toBe(false);
    expect(authEnabled({ ...preview, BETTER_AUTH_SECRET: "short" })).toBe(false);
    const production = { NODE_ENV: "production", VERCEL_ENV: "production", BETTER_AUTH_URL: "https://quilgym.vercel.app", BETTER_AUTH_SECRET: "a".repeat(32) };
    expect(authBaseUrl(production)).toBe("https://quilgym.vercel.app");
  });
});

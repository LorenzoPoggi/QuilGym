import { describe, expect, it } from "vitest";
import { authBaseUrlOption, authEnabled, googleEnabled, googleUsableOnHost, previewBranchOrigin } from "./auth-origins";

const preview = {
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  VERCEL_URL: "quilgym-a1b2-lorenzopoggis-projects.vercel.app",
  VERCEL_BRANCH_URL: "quilgym-git-mp-sandbox-lorenzopoggis-projects.vercel.app",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://quilgym-git-mp-sandbox-lorenzopoggis-projects.vercel.app",
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
};

describe("orígenes de autenticación en Preview", () => {
  it("permite solo el deployment actual y el alias estable para resolver callbacks", () => {
    expect(authBaseUrlOption(preview)).toEqual({
      allowedHosts: [preview.VERCEL_URL, preview.VERCEL_BRANCH_URL],
      protocol: "https",
    });
    expect(previewBranchOrigin(preview)).toBe(preview.BETTER_AUTH_URL);
    expect(authEnabled(preview)).toBe(true);
  });

  it("ofrece Google solo desde el alias autorizado", () => {
    expect(googleEnabled(preview)).toBe(true);
    expect(googleUsableOnHost(preview, preview.VERCEL_BRANCH_URL)).toBe(true);
    expect(googleUsableOnHost(preview, preview.VERCEL_URL)).toBe(false);
    expect(googleEnabled({ ...preview, BETTER_AUTH_URL: `https://${preview.VERCEL_URL}` })).toBe(false);
  });

  it("rechaza hosts o secretos inválidos y conserva producción estática", () => {
    expect(authBaseUrlOption({ ...preview, VERCEL_BRANCH_URL: "attacker.example" })).toEqual({
      allowedHosts: [preview.VERCEL_URL], protocol: "https",
    });
    expect(googleEnabled({ ...preview, VERCEL_BRANCH_URL: "attacker.example" })).toBe(false);
    expect(authEnabled({ ...preview, BETTER_AUTH_SECRET: "short" })).toBe(false);
    const production = { NODE_ENV: "production", VERCEL_ENV: "production", BETTER_AUTH_URL: "https://quilgym.vercel.app", BETTER_AUTH_SECRET: "a".repeat(32) };
    expect(authBaseUrlOption(production)).toBe("https://quilgym.vercel.app");
  });
});

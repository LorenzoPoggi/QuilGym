import { describe, expect, it } from "vitest";
import { contentSecurityPolicy } from "./security-headers";

describe("Content Security Policy", () => {
  it("restricts production resource types to the app and required providers", () => {
    const policy = contentSecurityPolicy(false);
    for (const directive of [
      "default-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "connect-src 'self' https://api.mercadopago.com",
      "frame-src https://maps.google.com",
      "upgrade-insecure-requests",
    ]) expect(policy).toContain(directive);
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy.split(";").some((directive) => directive.trim() === "https:")).toBe(false);
  });

  it("allows eval only in development tooling", () => {
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(contentSecurityPolicy(true)).not.toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy(false)).not.toContain("'unsafe-eval'");
  });
});

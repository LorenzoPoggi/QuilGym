import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { googleAdvisorKey, googleAdvisorModel, advisorServiceError } from "./advisor-config";
afterEach(() => vi.unstubAllEnvs());
describe("configuración de Gemini directo", () => {
  it("prefiere la variable Google y acepta el nombre anterior temporalmente", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", " google-test "); vi.stubEnv("AI_GATEWAY_API_KEY", "legacy-test");
    expect(googleAdvisorKey()).toBe("google-test");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", ""); expect(googleAdvisorKey()).toBe("legacy-test");
    vi.stubEnv("AI_GATEWAY_API_KEY", ""); expect(googleAdvisorKey()).toBe("");
  });
  it("usa IDs Google y normaliza el prefijo anterior", () => {
    vi.stubEnv("ADVISOR_MODEL", ""); expect(googleAdvisorModel()).toBe("gemini-3.5-flash-lite");
    vi.stubEnv("ADVISOR_MODEL", "google/gemini-3.8-flash"); expect(googleAdvisorModel()).toBe("gemini-3.8-flash");
  });
  it.each([401, 403, 429, 404, 400, 503])("explica el error %s sin copiar respuestas privadas", (statusCode) => {
    const result = advisorServiceError({ statusCode, responseBody: "private-key", message: "private-key" });
    expect(result.message).not.toContain("private-key");
    expect(result.status).toBe(statusCode === 429 ? 429 : 503);
  });
  it("mantiene el error genérico para fallos de red o base de datos", () => {
    expect(advisorServiceError(new Error("private content")).status).toBe(502);
    expect(advisorServiceError(null).message).not.toContain("private content");
  });
});

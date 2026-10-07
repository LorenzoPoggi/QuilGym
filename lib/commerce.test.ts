import { describe, expect, it } from "vitest";
import { commerce, whatsappUrl } from "./commerce";

describe("whatsappUrl", () => {
  it("usa el número del local y codifica el mensaje por defecto", () => {
    const url = new URL(whatsappUrl());
    expect(url.origin + url.pathname).toBe(`https://wa.me/${commerce.whatsapp.phone}`);
    expect(url.searchParams.get("text")).toBe(commerce.whatsapp.message);
  });

  it("codifica un texto propio sin romper la URL", () => {
    expect(whatsappUrl("Hola & chau?")).toBe(`https://wa.me/${commerce.whatsapp.phone}?text=Hola%20%26%20chau%3F`);
  });
});

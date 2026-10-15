import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
import { acceptedCards, buildInstallmentsData, buildOffer, parseCostLabel, representativePlan } from "./installments-core";
import { fetchInstallmentsData } from "./installments";
import { brickCustomization } from "./brick-customization";

const cost = (n: number, rate: number, cft = 100) => ({ installments: n, installment_rate: rate, labels: [`CFT_${cft},00%|TEA_${cft - 20},00%`] });
const plan = (issuer: string, costs: ReturnType<typeof cost>[]) => ({ issuer: { name: issuer }, payer_costs: costs });
const visa = [
  plan("A", [cost(1, 0, 0), cost(3, 20, 200), cost(12, 55.39, 139)]),
  plan("B", [cost(1, 0, 0), cost(3, 20, 200), cost(12, 55.39, 139)]),
  plan("C", [cost(1, 0, 0)]),
];
const methods = [
  { id: "visa", status: "active", payment_type_id: "credit_card", secure_thumbnail: "https://http2.mlstatic.com/v.png" },
  { id: "debvisa", status: "active", payment_type_id: "debit_card", secure_thumbnail: "https://http2.mlstatic.com/v.png" },
  { id: "oldcard", status: "deactive", payment_type_id: "credit_card", secure_thumbnail: "https://http2.mlstatic.com/o.png" },
  { id: "efectivo", status: "active", payment_type_id: "ticket", secure_thumbnail: "https://http2.mlstatic.com/t.png" },
  { id: "evil", status: "active", payment_type_id: "credit_card", secure_thumbnail: "https://evil.example/x.png" },
  { id: "http", status: "active", payment_type_id: "credit_card", secure_thumbnail: "http://http2.mlstatic.com/h.png" },
];

describe("cuotas", () => {
  it("lee CFT y TEA de las etiquetas", () => {
    expect(parseCostLabel(["CFT_249,00%|TEA_184,50%"])).toEqual({ cft: 249, tea: 184.5 });
    expect(parseCostLabel(undefined)).toEqual({ cft: null, tea: null });
  });
  it("elige el plan más frecuente entre los bancos con cuotas", () => {
    const result = representativePlan(visa, "visa", "Visa");
    expect(result?.rows.map((row) => row.n)).toEqual([1, 3, 12]);
    expect(representativePlan([plan("C", [cost(1, 0)])], "x", "X")).toBeNull();
    expect(representativePlan({ message: "error" }, "x", "X")).toBeNull();
  });
  it("calcula cuota, total y CFT para un precio", () => {
    const data = buildInstallmentsData({ visa }, methods);
    const offer = buildOffer(45000, data);
    expect(offer?.headline).toMatchObject({ n: 12, total: 69925.5, amount: 5827.13, interestFree: false, cft: 139 });
    expect(offer?.interestFreeHeadline).toBeNull();
  });
  it("respeta el tope del negocio", () => {
    const offer = buildOffer(45000, buildInstallmentsData({ visa }, methods), { maxInstallments: 6 });
    expect(offer?.headline.n).toBe(3);
    expect(buildOffer(45000, buildInstallmentsData({ visa }, methods), { maxInstallments: 1 })).toBeNull();
  });
  it("destaca las cuotas sin interés solo si el negocio las confirmó", () => {
    const offer = buildOffer(60000, buildInstallmentsData({ visa }, methods), { interestFree: 3 });
    expect(offer?.interestFreeHeadline).toMatchObject({ n: 3, amount: 20000, total: 60000, interestFree: true, cft: 0 });
    expect(offer?.headline.n).toBe(12);
  });
  it("devuelve null sin datos o con precio inválido", () => {
    expect(buildOffer(1000, null)).toBeNull();
    expect(buildOffer(0, buildInstallmentsData({ visa }, methods))).toBeNull();
  });
  it("filtra marcas: solo activas, crédito o débito, https y hosts de Mercado Pago", () => {
    const cards = acceptedCards(methods);
    expect(cards.map((card) => `${card.id}:${card.type}`)).toEqual(["visa:credit", "debvisa:debit"]);
    expect(cards[0].name).toBe("Visa");
  });
});

describe("consulta a Mercado Pago", () => {
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  it("usa la public key, arma los planes y no expone la key en los datos", async () => {
    const fetcher = vi.fn((url: string | URL | Request) => String(url).includes("/installments") ? ok(String(url).includes("payment_method_id=visa") ? visa : []) : ok(methods));
    const data = await fetchInstallmentsData("TEST-key", fetcher as unknown as typeof fetch);
    expect(data.plans.map((item) => item.id)).toEqual(["visa"]);
    expect(data.cards).toHaveLength(2);
    expect(JSON.stringify(data)).not.toContain("TEST-key");
    expect(fetcher).toHaveBeenCalledTimes(6);
  });
  it("lanza ante un error HTTP para que no se cachee", async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response("{}", { status: 500 })));
    await expect(fetchInstallmentsData("k", fetcher as unknown as typeof fetch)).rejects.toThrow();
    const empty = vi.fn(() => ok([]));
    await expect(fetchInstallmentsData("k", empty as unknown as typeof fetch)).rejects.toThrow();
  });
});

describe("personalización del Brick", () => {
  it("excluye tipos, fija el tope de cuotas y muestra el monto en el botón", () => {
    const custom = brickCustomization({ amount: 45000, excludedTypes: ["debit_card"], maxInstallments: 12 });
    expect(custom.paymentMethods).toEqual({ types: { excluded: ["debit_card"] }, minInstallments: 1, maxInstallments: 12 });
    expect(custom.visual.texts.formSubmit).toBe("Pagar $45.000");
    expect(custom.visual.style.customVariables.baseColor).toBe("#1d2022");
  });
});

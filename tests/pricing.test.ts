import { describe, expect, it } from "vitest";
import { allocationPercent, businessBreakEven, businessReadiness, convertQuantity, ingredientBaseCost, localNarrativeReport, priceAnalysis, recipeCost } from "../lib/pricing";
import type { Business } from "../lib/types";

const business: Business = {
  id: "b", name: "Teste", owner: "", segment: "", contact: "", notes: "", desiredMargin: 20, sellingFeesPercent: 10, multiplierCostBasis: "total",
  allocationMode: "manual", reportText: "", reportGeneratedAt: "", updatedAt: "", expenses: [{ id: "e", name: "Aluguel", value: 1000, notes: "" }],
  ingredients: [{ id: "i", name: "Farinha", category: "", packageQuantity: 1, packageUnit: "kg", packagePrice: 10, yieldPercent: 100, supplier: "" }], subproducts: [],
  products: [{ id: "p", name: "Bolo", category: "", portions: 10, projectedSales: 100, allocationPercent: 100, recipe: [{ id: "r", ingredientId: "i", quantity: 500, unit: "g" }] }],
  competitors: [{ id: "c", productId: "p", name: "Vizinho", price: 28, rating: 4, researchedAt: "2026-06-01", notes: "" }]
};

describe("cálculos de custeio e preço", () => {
  it("calcula custo base considerando rendimento", () => {
    expect(ingredientBaseCost(business.ingredients[0])).toBe(.01);
  });
  it("divide a receita pelas porções", () => {
    expect(recipeCost(business.products[0], business.ingredients)).toBe(.5);
  });
  it("rateia despesas e forma a faixa de preço", () => {
    const result = priceAnalysis(business.products[0], business);
    expect(result.direct).toBe(.5);
    expect(result.indirect).toBe(10);
    expect(result.cost).toBe(10.5);
    expect(result.minimum).toBe(28);
    expect(result.maximum).toBe(29.75);
    expect(result.unitFloor).toBe(11.67);
    expect(result.targetPrice).toBe(15);
    expect(result.suggested).toBe(28);
  });
  it("usa somente custo quando não há concorrentes", () => {
    const result = priceAnalysis(business.products[0], { ...business, competitors: [] });
    expect(result.minimum).toBe(21);
    expect(result.maximum).toBe(31.5);
    expect(result.suggested).toBe(21);
  });
  it("impede conversões entre unidades incompatíveis", () => {
    expect(convertQuantity(1, "kg", "l")).toBe(0);
    expect(convertQuantity(1, "kg", "g")).toBe(1000);
    expect(convertQuantity(1, "l", "ml")).toBe(1000);
  });
  it("aumenta custo quando há perda de aproveitamento", () => {
    expect(ingredientBaseCost({ ...business.ingredients[0], yieldPercent: 50 })).toBe(.02);
  });
  it("normaliza os pesos do rateio manual", () => {
    const second = { ...business.products[0], id: "p2", allocationPercent: 25 };
    const first = { ...business.products[0], allocationPercent: 75 };
    const withProducts = { ...business, products: [first, second] };
    expect(allocationPercent(first, withProducts)).toBe(.75);
    expect(allocationPercent(second, withProducts)).toBe(.25);
  });
  it("sinaliza conflito quando todo o mercado está acima de três vezes o custo", () => {
    const result = priceAnalysis(business.products[0], { ...business, competitors: [{ ...business.competitors[0], price: 100 }] });
    expect(result.maximum).toBe(100);
    expect(result.warnings).toContain("O menor preço pesquisado está acima de 3 vezes a base escolhida; revise custos e posicionamento.");
  });
  it("dá maior peso ao concorrente com melhor experiência", () => {
    const competitors = [
      { ...business.competitors[0], id: "c1", price: 20, rating: 1 },
      { ...business.competitors[0], id: "c2", price: 40, rating: 5 }
    ];
    const result = priceAnalysis(business.products[0], { ...business, competitors });
    expect(result.weightedMarketPrice).toBe(36.67);
  });
  it("usa a média entre o concorrente mais caro e três vezes a base no preço máximo", () => {
    const competitors = [
      { ...business.competitors[0], id: "c1", price: 12 },
      { ...business.competitors[0], id: "c2", price: 40 }
    ];
    const result = priceAnalysis(business.products[0], { ...business, multiplierCostBasis: "direct", competitors });
    expect(result.maximum).toBe(20.75);
  });
  it("avisa quando uma pesquisa está desatualizada", () => {
    const competitors = [{ ...business.competitors[0], researchedAt: "2020-01-01" }];
    const result = priceAnalysis(business.products[0], { ...business, competitors });
    expect(result.warnings).toContain("Há pesquisa de concorrente com mais de 90 dias.");
  });
  it("permite usar o custo direto como base dos multiplicadores sem ignorar despesas", () => {
    const result = priceAnalysis(business.products[0], { ...business, multiplierCostBasis: "direct", competitors: [] });
    expect(result.multiplierBase).toBe(.5);
    expect(result.minimum).toBe(11.67);
    expect(result.suggested).toBe(15);
    expect(result.maximum).toBe(15);
  });
  it("protege o cálculo contra valores negativos e aproveitamento acima de 100%", () => {
    expect(ingredientBaseCost({ ...business.ingredients[0], packagePrice: -10 })).toBe(0);
    expect(ingredientBaseCost({ ...business.ingredients[0], yieldPercent: 150 })).toBe(.01);
    expect(convertQuantity(-5, "kg", "g")).toBe(0);
  });
  it("avisa quando taxas e margem tornam o preço inviável", () => {
    const result = priceAnalysis(business.products[0], { ...business, sellingFeesPercent: 60, desiredMargin: 40 });
    expect(result.warnings).toContain("A soma de taxas e margem desejada é matematicamente inviável.");
  });
  it("calcula um único ponto de equilíbrio mensal pelo mix previsto", () => {
    const result = businessBreakEven(business);
    expect(result.projectedRevenue).toBe(2800);
    expect(result.contributionMarginRatio).toBeCloseTo(.8821, 4);
    expect(result.breakEvenRevenue).toBe(1133.6);
    expect(result.safetyMargin).toBe(1666.4);
  });
  it("gera relatório local estruturado com até 2.000 caracteres", () => {
    const result = localNarrativeReport(business);
    expect(result.length).toBeLessThanOrEqual(2000);
    expect(result).toContain("Introdução:");
    expect(result).toContain("Situação de custos atual:");
    expect(result).toContain("Ponto de equilíbrio:");
  });
  it("distingue pendências obrigatórias de concorrentes opcionais", () => {
    const complete = businessReadiness({ ...business, competitors: [] });
    expect(complete.ready).toBe(true);
    expect(complete.warnings).toContain("Nenhum concorrente foi informado; os preços serão sugeridos somente pelos custos.");
    const incomplete = businessReadiness({ ...business, products: [{ ...business.products[0], recipe: [] }] });
    expect(incomplete.ready).toBe(false);
    expect(incomplete.blockers).toContain("Bolo está sem ficha técnica.");
  });
});

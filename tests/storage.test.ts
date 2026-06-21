import { describe, expect, it } from "vitest";
import { normalizeBusinesses } from "../lib/storage";

describe("importação segura de backup", () => {
  it("normaliza valores inválidos e remove referências quebradas", () => {
    const [business] = normalizeBusinesses([{
      name: 123,
      desiredMargin: -20,
      sellingFeesPercent: 200,
      ingredients: [{ id: "i", packageQuantity: -1, packagePrice: -5, yieldPercent: 500, packageUnit: "invalida" }],
      products: [{ id: "p", portions: 0, projectedSales: -10, recipe: [{ ingredientId: "inexistente", quantity: 5 }] }],
      competitors: [{ productId: "inexistente", price: 50 }],
      expenses: [{ value: -100 }],
      reportText: "x".repeat(3000)
    }]);
    expect(business.name).toBe("");
    expect(business.desiredMargin).toBe(0);
    expect(business.sellingFeesPercent).toBe(95);
    expect(business.ingredients[0].packagePrice).toBe(0);
    expect(business.ingredients[0].yieldPercent).toBe(100);
    expect(business.subproducts).toEqual([]);
    expect(business.products[0].portions).toBe(1);
    expect(business.products[0].recipe).toHaveLength(0);
    expect(business.competitors).toHaveLength(0);
    expect(business.expenses[0].value).toBe(0);
    expect(business.reportText).toHaveLength(2000);
  });
});

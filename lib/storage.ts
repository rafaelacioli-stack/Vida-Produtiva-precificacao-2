import type { Business } from "./types";

export const emptyBusiness = (): Business => ({
  id: crypto.randomUUID(), name: "", owner: "", segment: "", contact: "", notes: "",
  desiredMargin: 20, sellingFeesPercent: 10, multiplierCostBasis: "direct", allocationMode: "sales", ingredients: [], subproducts: [], products: [], competitors: [],
  expenses: [], reportText: "", reportGeneratedAt: "", updatedAt: new Date().toISOString()
});

const key = "precifica-social-businesses-v1";
const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown, fallback = 0) => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const array = (value: unknown) => Array.isArray(value) ? value : [];
const id = (value: unknown) => text(value) || crypto.randomUUID();
const normalize = (raw: unknown): Business => {
  const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const ingredients = array(item.ingredients).map(rawIngredient => {
    const ingredient = rawIngredient && typeof rawIngredient === "object" ? rawIngredient as Record<string, unknown> : {};
    const unit = ["g","kg","ml","l","un"].includes(text(ingredient.packageUnit)) ? text(ingredient.packageUnit) as "g"|"kg"|"ml"|"l"|"un" : "kg";
    return { id:id(ingredient.id), name:text(ingredient.name), category:text(ingredient.category), packageQuantity:Math.max(number(ingredient.packageQuantity,1),0), packageUnit:unit, packagePrice:Math.max(number(ingredient.packagePrice),0), yieldPercent:Math.min(Math.max(number(ingredient.yieldPercent,100),1),100), supplier:text(ingredient.supplier) };
  });
  const ingredientIds = new Set(ingredients.map(ingredient => ingredient.id));
  const subproducts = array(item.subproducts).map(rawSubproduct => {
    const subproduct = rawSubproduct && typeof rawSubproduct === "object" ? rawSubproduct as Record<string, unknown> : {};
    const yieldUnit = ["g","kg","ml","l","un"].includes(text(subproduct.yieldUnit)) ? text(subproduct.yieldUnit) as "g"|"kg"|"ml"|"l"|"un" : "un";
    const recipe = array(subproduct.recipe).flatMap(rawRow => {
      const row = rawRow && typeof rawRow === "object" ? rawRow as Record<string, unknown> : {};
      const ingredientId = text(row.ingredientId);
      if (!ingredientIds.has(ingredientId)) return [];
      const unit = ["g","kg","ml","l","un"].includes(text(row.unit)) ? text(row.unit) as "g"|"kg"|"ml"|"l"|"un" : "g";
      return [{ id:id(row.id), ingredientId, quantity:Math.max(number(row.quantity),0), unit }];
    });
    return { id:id(subproduct.id), name:text(subproduct.name), category:text(subproduct.category), yieldQuantity:Math.max(number(subproduct.yieldQuantity,1),0), yieldUnit, recipe };
  });
  const subproductIds = new Set(subproducts.map(subproduct => subproduct.id));
  const products = array(item.products).map(rawProduct => {
    const product = rawProduct && typeof rawProduct === "object" ? rawProduct as Record<string, unknown> : {};
    const recipe = array(product.recipe).flatMap(rawRow => {
      const row = rawRow && typeof rawRow === "object" ? rawRow as Record<string, unknown> : {};
      const ingredientId = text(row.ingredientId);
      const subproductId = text(row.subproductId);
      if (!ingredientIds.has(ingredientId) && !subproductIds.has(subproductId)) return [];
      const unit = ["g","kg","ml","l","un"].includes(text(row.unit)) ? text(row.unit) as "g"|"kg"|"ml"|"l"|"un" : "g";
      return [{ id:id(row.id), ingredientId:subproductId ? "" : ingredientId, subproductId:subproductId || undefined, quantity:Math.max(number(row.quantity),0), unit }];
    });
    return { id:id(product.id), name:text(product.name), category:text(product.category), portions:Math.max(number(product.portions,1),1), projectedSales:Math.max(number(product.projectedSales,1),0), allocationPercent:Math.max(number(product.allocationPercent),0), recipe };
  });
  const productIds = new Set(products.map(product => product.id));
  return {
    id:id(item.id), name:text(item.name), owner:text(item.owner), segment:text(item.segment), contact:text(item.contact), notes:text(item.notes),
    desiredMargin:Math.min(Math.max(number(item.desiredMargin,20),0),90), sellingFeesPercent:Math.min(Math.max(number(item.sellingFeesPercent,10),0),95),
    multiplierCostBasis:item.multiplierCostBasis === "total" ? "total" : "direct",
    allocationMode:item.allocationMode === "manual" || item.allocationMode === "equal" ? item.allocationMode : "sales",
    ingredients, subproducts, products,
    competitors:array(item.competitors).flatMap(rawCompetitor => {
      const competitor = rawCompetitor && typeof rawCompetitor === "object" ? rawCompetitor as Record<string, unknown> : {};
      const productId = text(competitor.productId);
      if (!productIds.has(productId)) return [];
      return [{ id:id(competitor.id), productId, name:text(competitor.name), price:Math.max(number(competitor.price),0), rating:Math.min(Math.max(number(competitor.rating,3),1),5), researchedAt:text(competitor.researchedAt) || new Date().toISOString().slice(0,10), notes:text(competitor.notes) }];
    }),
    expenses:array(item.expenses).map(rawExpense => { const expense=rawExpense&&typeof rawExpense==="object"?rawExpense as Record<string,unknown>:{}; return {id:id(expense.id),name:text(expense.name),value:Math.max(number(expense.value),0),notes:text(expense.notes)}; }),
    reportText:text(item.reportText).slice(0,2000), reportGeneratedAt:text(item.reportGeneratedAt), updatedAt:text(item.updatedAt)||new Date().toISOString()
  };
};
export const loadBusinesses = (): Business[] => {
  try { const data = JSON.parse(localStorage.getItem(key) ?? "[]"); return Array.isArray(data) ? data.map(normalize) : []; } catch { return []; }
};
export const saveBusinesses = (items: Business[]) => {
  try { localStorage.setItem(key, JSON.stringify(items)); return true; } catch { return false; }
};
export const exportBusinesses = (items: Business[]) => new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
export const normalizeBusinesses = (items: unknown[]) => items.map(normalize);

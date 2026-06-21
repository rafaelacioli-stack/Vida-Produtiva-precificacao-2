export type Unit = "g" | "kg" | "ml" | "l" | "un";
export type AllocationMode = "manual" | "equal" | "sales";
export type MultiplierCostBasis = "direct" | "total";

export type Ingredient = {
  id: string; name: string; category: string; packageQuantity: number; packageUnit: Unit;
  packagePrice: number; yieldPercent: number; supplier: string;
};
export type RecipeItem = { id: string; ingredientId: string; subproductId?: string; quantity: number; unit: Unit };
export type Subproduct = {
  id: string; name: string; category: string; yieldQuantity: number; yieldUnit: Unit; recipe: RecipeItem[];
};
export type Product = {
  id: string; name: string; category: string; portions: number; projectedSales: number;
  allocationPercent: number; recipe: RecipeItem[];
};
export type Competitor = {
  id: string; productId: string; name: string; price: number; rating: number; researchedAt: string; notes: string;
};
export type Expense = { id: string; name: string; value: number; notes: string };
export type Business = {
  id: string; name: string; owner: string; segment: string; contact: string; notes: string;
  desiredMargin: number; sellingFeesPercent: number; multiplierCostBasis: MultiplierCostBasis; allocationMode: AllocationMode; ingredients: Ingredient[];
  subproducts: Subproduct[]; products: Product[]; competitors: Competitor[]; expenses: Expense[]; reportText: string; reportGeneratedAt: string; updatedAt: string;
};

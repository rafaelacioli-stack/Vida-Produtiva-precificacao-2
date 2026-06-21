import type { Business, Ingredient, Product, RecipeItem, Subproduct, Unit } from "./types";

const round = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const toBase = (quantity: number, unit: Unit) => unit === "kg" || unit === "l" ? quantity * 1000 : quantity;
const nonNegative = (value: number) => Number.isFinite(value) ? Math.max(value, 0) : 0;
const ratingWeight = (value: number) => Number.isFinite(value) ? Math.min(Math.max(value, 1), 5) : 1;

export function ingredientBaseCost(item: Ingredient) {
  const usable = toBase(nonNegative(item.packageQuantity), item.packageUnit) * Math.min(Math.max(item.yieldPercent, 1), 100) / 100;
  return usable > 0 ? nonNegative(item.packagePrice) / usable : 0;
}

export function convertQuantity(quantity: number, from: Unit, packageUnit: Unit) {
  const mass = ["g", "kg"].includes(from) && ["g", "kg"].includes(packageUnit);
  const volume = ["ml", "l"].includes(from) && ["ml", "l"].includes(packageUnit);
  const units = from === "un" && packageUnit === "un";
  if (mass || volume) return toBase(nonNegative(quantity), from);
  if (units) return nonNegative(quantity);
  return 0;
}

export function subproductBatchCost(item: Subproduct, ingredients: Ingredient[]) {
  return round(item.recipe.reduce((sum, row) => {
    const ingredient = ingredients.find(ingredient => ingredient.id === row.ingredientId);
    return sum + (ingredient ? ingredientBaseCost(ingredient) * convertQuantity(row.quantity, row.unit, ingredient.packageUnit) : 0);
  }, 0));
}

export function subproductBaseCost(item: Subproduct, ingredients: Ingredient[]) {
  const output = toBase(nonNegative(item.yieldQuantity), item.yieldUnit);
  return output > 0 ? subproductBatchCost(item, ingredients) / output : 0;
}

export function recipeItemCost(row: RecipeItem, ingredients: Ingredient[], subproducts: Subproduct[] = []) {
  if (row.subproductId) {
    const item = subproducts.find(subproduct => subproduct.id === row.subproductId);
    return item ? subproductBaseCost(item, ingredients) * convertQuantity(row.quantity, row.unit, item.yieldUnit) : 0;
  }
  const ingredient = ingredients.find(item => item.id === row.ingredientId);
  return ingredient ? ingredientBaseCost(ingredient) * convertQuantity(row.quantity, row.unit, ingredient.packageUnit) : 0;
}

export function recipeCost(product: Product, ingredients: Ingredient[], subproducts: Subproduct[] = []) {
  const total = product.recipe.reduce((sum, row) => sum + recipeItemCost(row, ingredients, subproducts), 0);
  return round(total / Math.max(nonNegative(product.portions), 1));
}

export function allocationPercent(product: Product, business: Business) {
  if (business.allocationMode === "manual") {
    const total = business.products.reduce((sum, p) => sum + Math.max(p.allocationPercent, 0), 0);
    return total > 0 ? Math.max(product.allocationPercent, 0) / total : 0;
  }
  if (business.allocationMode === "equal") return business.products.length ? 1 / business.products.length : 0;
  const totalSales = business.products.reduce((sum, p) => sum + nonNegative(p.projectedSales), 0);
  return totalSales ? nonNegative(product.projectedSales) / totalSales : 0;
}

export function indirectUnitCost(product: Product, business: Business) {
  const expenses = business.expenses.reduce((sum, item) => sum + nonNegative(item.value), 0);
  return round(expenses * allocationPercent(product, business) / Math.max(nonNegative(product.projectedSales), 1));
}

export function priceAnalysis(product: Product, business: Business) {
  const direct = recipeCost(product, business.ingredients, business.subproducts);
  const indirect = indirectUnitCost(product, business);
  const cost = round(direct + indirect);
  const rivals = business.competitors.filter(c => c.productId === product.id && c.price > 0);
  const competitorMin = rivals.length ? Math.min(...rivals.map(c => c.price)) : null;
  const competitorMax = rivals.length ? Math.max(...rivals.map(c => c.price)) : null;
  const sellingRate = Math.min(Math.max(business.sellingFeesPercent ?? 0, 0), 95) / 100;
  const desiredMargin = Math.min(Math.max(business.desiredMargin ?? 0, 0), 90) / 100;
  const breakEven = round(cost / Math.max(1 - sellingRate, .05));
  const targetPrice = round(cost / Math.max(1 - sellingRate - desiredMargin, .05));
  const multiplierBase = business.multiplierCostBasis === "total" || direct <= 0 ? cost : direct;
  const minimum = round(competitorMin == null ? Math.max(multiplierBase * 2, breakEven) : Math.max(multiplierBase * 2, breakEven, competitorMin));
  const costCeiling = round(multiplierBase * 3);
  const marketCeiling = competitorMax == null ? costCeiling : round((competitorMax + costCeiling) / 2);
  const maximum = round(Math.max(minimum, targetPrice, marketCeiling));
  const weightTotal = rivals.reduce((sum, rival) => sum + ratingWeight(rival.rating), 0);
  const weightedMarketPrice = rivals.length ? round(rivals.reduce((sum, rival) => sum + rival.price * ratingWeight(rival.rating), 0) / weightTotal) : null;
  const blended = weightedMarketPrice == null ? targetPrice : targetPrice * .6 + weightedMarketPrice * .4;
  const suggested = round(Math.min(maximum, Math.max(minimum, blended)));
  const contributionMarginPercent = suggested > 0 ? (suggested * (1 - sellingRate) - direct) / suggested * 100 : 0;
  const netMarginPercent = suggested > 0 ? (suggested * (1 - sellingRate) - cost) / suggested * 100 : 0;
  const warnings = [
    ...(cost <= 0 ? ["Custo total zerado ou incompleto."] : []),
    ...(product.projectedSales <= 0 ? ["Informe uma estimativa de vendas maior que zero."] : []),
    ...(business.allocationMode === "manual" && business.products.reduce((sum, p) => sum + p.allocationPercent, 0) <= 0 ? ["O rateio manual ainda não foi preenchido."] : []),
    ...(competitorMin != null && competitorMin > costCeiling ? ["O menor preço pesquisado está acima de 3 vezes a base escolhida; revise custos e posicionamento."] : []),
    ...(targetPrice > costCeiling ? ["A margem desejada exige preço acima de 3 vezes a base escolhida."] : []),
    ...(targetPrice > maximum ? ["A faixa de mercado não comporta a margem desejada."] : []),
    ...(rivals.some(rival => rival.researchedAt && Date.now() - new Date(`${rival.researchedAt}T12:00:00`).getTime() > 90 * 86400000) ? ["Há pesquisa de concorrente com mais de 90 dias."] : []),
    ...(sellingRate + desiredMargin >= .95 ? ["A soma de taxas e margem desejada é matematicamente inviável."] : [])
  ];
  return { direct, indirect, cost, multiplierBase, competitorMin, competitorMax, minimum, maximum, suggested, rivals, unitFloor: breakEven, targetPrice, weightedMarketPrice, contributionMarginPercent, netMarginPercent, warnings };
}

export function businessBreakEven(business: Business) {
  const fixedExpenses = round(business.expenses.reduce((sum, item) => sum + nonNegative(item.value), 0));
  const sellingRate = Math.min(Math.max(business.sellingFeesPercent ?? 0, 0), 95) / 100;
  const products = business.products.map(product => {
    const analysis = priceAnalysis(product, business);
    const units = nonNegative(product.projectedSales);
    return { product, analysis, units, revenue: analysis.suggested * units, directCost: analysis.direct * units };
  });
  const projectedRevenue = round(products.reduce((sum, item) => sum + item.revenue, 0));
  const projectedDirectCosts = round(products.reduce((sum, item) => sum + item.directCost, 0));
  const projectedSellingFees = round(projectedRevenue * sellingRate);
  const contribution = round(projectedRevenue - projectedDirectCosts - projectedSellingFees);
  const contributionMarginRatio = projectedRevenue > 0 ? contribution / projectedRevenue : 0;
  const breakEvenRevenue = contributionMarginRatio > 0 ? round(fixedExpenses / contributionMarginRatio) : null;
  const safetyMargin = breakEvenRevenue != null && projectedRevenue > 0 ? round(projectedRevenue - breakEvenRevenue) : null;
  return { fixedExpenses, projectedRevenue, projectedDirectCosts, projectedSellingFees, contribution, contributionMarginRatio, breakEvenRevenue, safetyMargin, products };
}

export function businessReadiness(business: Business) {
  const blockers = [
    ...(!business.name.trim() ? ["Informe o nome do negócio."] : []),
    ...(!business.products.length ? ["Cadastre pelo menos um produto."] : []),
    ...business.products.flatMap(product => [
      ...(!product.name.trim() ? ["Há produto sem nome."] : []),
      ...(!product.recipe.length ? [`${product.name || "Produto sem nome"} está sem ficha técnica.`] : []),
      ...(recipeCost(product, business.ingredients, business.subproducts) <= 0 ? [`${product.name || "Produto sem nome"} está com custo direto zerado.`] : []),
      ...(product.projectedSales <= 0 ? [`Informe a previsão de vendas de ${product.name || "produto sem nome"}.`] : [])
    ]),
    ...business.subproducts.flatMap(item => [
      ...(!item.name.trim() ? ["Há subproduto sem nome."] : []),
      ...(!item.recipe.length ? [`${item.name || "Subproduto sem nome"} está sem ficha técnica.`] : []),
      ...(item.yieldQuantity <= 0 ? [`Informe o rendimento de ${item.name || "subproduto sem nome"}.`] : []),
      ...(subproductBatchCost(item, business.ingredients) <= 0 ? [`${item.name || "Subproduto sem nome"} está com custo zerado.`] : [])
    ]),
    ...(business.allocationMode === "manual" && business.products.length && business.products.reduce((sum, product) => sum + nonNegative(product.allocationPercent), 0) <= 0 ? ["Preencha os pesos do rateio manual."] : []),
    ...(nonNegative(business.sellingFeesPercent) + nonNegative(business.desiredMargin) >= 95 ? ["Reduza a soma de taxas e margem desejada para menos de 95%."] : [])
  ];
  const warnings = [
    ...(!business.expenses.some(expense => nonNegative(expense.value) > 0) ? ["Nenhuma despesa indireta foi informada. Confirme se isso representa a realidade."] : []),
    ...(!business.competitors.some(competitor => nonNegative(competitor.price) > 0) ? ["Nenhum concorrente foi informado; os preços serão sugeridos somente pelos custos."] : []),
    ...(business.products.some(product => !product.category.trim()) ? ["Há produto sem categoria."] : [])
  ];
  return { ready: blockers.length === 0, blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] };
}

export function localNarrativeReport(business: Business) {
  const equilibrium = businessBreakEven(business);
  const analyses = business.products.map(product => ({ product, analysis: priceAnalysis(product, business) }));
  const prices = analyses.slice(0, 8).map(({ product, analysis }) => `${product.name || "Produto sem nome"}: ${analysis.suggested.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`).join("; ");
  const extraProducts = analyses.length > 8 ? ` Outros ${analyses.length - 8} produto(s) constam na tabela completa.` : "";
  const marketRanges = analyses.filter(({ analysis }) => analysis.competitorMin != null).slice(0, 5).map(({ product, analysis }) => `${product.name || "Produto"}: ${analysis.competitorMin?.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} a ${analysis.competitorMax?.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}`).join("; ");
  const competitorCount = business.competitors.filter(item => item.price > 0).length;
  const text = `Introdução: O negócio ${business.name || "analisado"} possui ${business.products.length} produto(s) cadastrado(s) e previsão mensal de faturamento de ${equilibrium.projectedRevenue.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}.\n\nSituação de custos atual: As despesas indiretas mensais somam ${equilibrium.fixedExpenses.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}. Os custos diretos projetados são ${equilibrium.projectedDirectCosts.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}, além de ${equilibrium.projectedSellingFees.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} em taxas sobre vendas.\n\nSituação dos preços concorrentes: Foram consideradas ${competitorCount} referência(s). ${marketRanges || "Não há preços válidos de concorrentes; a análise usa os custos."}\n\nPreços sugeridos: ${prices || "Cadastre produtos e fichas técnicas para obter sugestões."}.${extraProducts}\n\nPonto de equilíbrio: O negócio precisa vender aproximadamente ${equilibrium.breakEvenRevenue?.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}) ?? "valor ainda não calculável"} por mês para cobrir despesas indiretas, custos diretos e taxas, considerando o mix previsto.`;
  return text.slice(0, 2000);
}

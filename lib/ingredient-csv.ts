import type { Ingredient, Unit } from "./types";

const headers = ["nome", "categoria", "fornecedor", "quantidade da embalagem", "unidade de medida", "preço da embalagem", "aproveitamento (%)"];
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g," ");
export const ingredientNameKey = normalize;
const parseNumber = (value: string) => {
  const clean = value.replace(/R\$/gi, "").replace(/\s/g, "");
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  return Number(normalized);
};
const unitAliases: Record<string, Unit> = {
  g:"g", grama:"g", gramas:"g", kg:"kg", quilograma:"kg", quilogramas:"kg",
  ml:"ml", mililitro:"ml", mililitros:"ml", l:"l", litro:"l", litros:"l",
  un:"un", unidade:"un", unidades:"un"
};

function splitRow(row: string) {
  const cells: string[] = []; let value = "", quoted = false;
  for (let index = 0; index < row.length; index++) {
    const char = row[index];
    if (char === '"' && row[index + 1] === '"') { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ";" && !quoted) { cells.push(value.trim()); value = ""; }
    else value += char;
  }
  cells.push(value.trim()); return cells;
}

export function ingredientCsvTemplate() {
  return new Blob(["\uFEFF" + headers.join(";") + "\r\n"], { type: "text/csv;charset=utf-8" });
}

export function parseIngredientCsv(text: string) {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(row => row.trim());
  if (!rows.length) return { ingredients: [] as Ingredient[], errors: ["A planilha está vazia."] };
  const actualHeaders = splitRow(rows[0]).map(normalize);
  const missing = headers.map(normalize).filter(header => !actualHeaders.includes(header));
  if (missing.length) return { ingredients: [] as Ingredient[], errors: [`Colunas ausentes: ${missing.join(", ")}.`] };
  const column = (name: string) => actualHeaders.indexOf(normalize(name));
  const ingredients: Ingredient[] = [], errors: string[] = [];
  rows.slice(1).forEach((row, rowIndex) => {
    const cells = splitRow(row), line = rowIndex + 2;
    const name = cells[column("nome")]?.trim() ?? "";
    const packageQuantity = parseNumber(cells[column("quantidade da embalagem")] ?? "");
    const packagePrice = parseNumber(cells[column("preço da embalagem")] ?? "");
    const yieldPercent = parseNumber(cells[column("aproveitamento (%)")] ?? "");
    const packageUnit = unitAliases[normalize(cells[column("unidade de medida")] ?? "")];
    if (!name || !packageUnit || !Number.isFinite(packageQuantity) || packageQuantity <= 0 || !Number.isFinite(packagePrice) || packagePrice < 0 || !Number.isFinite(yieldPercent) || yieldPercent < 1 || yieldPercent > 100) {
      errors.push(`Linha ${line}: confira nome, quantidade, unidade de medida, preço e aproveitamento.`); return;
    }
    ingredients.push({ id:crypto.randomUUID(), name, category:cells[column("categoria")]?.trim() ?? "", supplier:cells[column("fornecedor")]?.trim() ?? "", packageQuantity, packageUnit, packagePrice, yieldPercent });
  });
  return { ingredients, errors };
}

export const sortIngredientsAlphabetically = <T extends {name:string}>(items: T[]) => [...items].sort((a,b) => a.name.localeCompare(b.name,"pt-BR",{sensitivity:"base"}));

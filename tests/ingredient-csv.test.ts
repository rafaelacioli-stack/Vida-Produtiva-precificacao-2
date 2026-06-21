import { describe, expect, it } from "vitest";
import { ingredientCsvTemplate, ingredientNameKey, parseIngredientCsv, sortIngredientsAlphabetically } from "../lib/ingredient-csv";

describe("importação de insumos",()=>{
  it("lê o cabeçalho unidade de medida e números brasileiros",()=>{
    const csv="nome;categoria;fornecedor;quantidade da embalagem;unidade de medida;preço da embalagem;aproveitamento (%)\nFarinha;Secos;Loja;1;kg;12,50;95";
    const result=parseIngredientCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.ingredients[0]).toMatchObject({name:"Farinha",packageUnit:"kg",packagePrice:12.5,yieldPercent:95});
  });
  it("ordena nomes em português sem alterar a lista original",()=>{
    const input=[{name:"Óleo"},{name:"açúcar"},{name:"Farinha"}];
    expect(sortIngredientsAlphabetically(input).map(item=>item.name)).toEqual(["açúcar","Farinha","Óleo"]);
    expect(input[0].name).toBe("Óleo");
  });
  it("considera diferenças de acento, caixa e espaços como o mesmo nome",()=>{
    expect(ingredientNameKey("  Açúcar   Refinado ")).toBe(ingredientNameKey("acucar refinado"));
  });
  it("gera o modelo com o cabeçalho unidade de medida",async()=>{
    expect(await ingredientCsvTemplate().text()).toContain("unidade de medida");
  });
});

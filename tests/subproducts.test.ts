import { describe, expect, it } from "vitest";
import { recipeCost, subproductBaseCost, subproductBatchCost } from "../lib/pricing";
import type { Ingredient, Product, Subproduct } from "../lib/types";

const ingredients: Ingredient[] = [{ id:"farinha",name:"Farinha",category:"",supplier:"",packageQuantity:1,packageUnit:"kg",packagePrice:10,yieldPercent:100 }];
const mass: Subproduct = { id:"massa",name:"Massa de crepe",category:"",yieldQuantity:20,yieldUnit:"un",recipe:[{id:"r",ingredientId:"farinha",quantity:500,unit:"g"}] };

describe("custeio de subprodutos",()=>{
  it("calcula o lote e o custo por unidade de rendimento",()=>{
    expect(subproductBatchCost(mass,ingredients)).toBe(5);
    expect(subproductBaseCost(mass,ingredients)).toBe(.25);
  });
  it("inclui o subproduto no custo do produto final",()=>{
    const product:Product={id:"p",name:"Crepe",category:"",portions:1,projectedSales:1,allocationPercent:0,recipe:[{id:"x",ingredientId:"",subproductId:"massa",quantity:1,unit:"un"}]};
    expect(recipeCost(product,ingredients,[mass])).toBe(.25);
  });
});

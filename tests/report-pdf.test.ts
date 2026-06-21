import { describe, expect, it } from "vitest";
import { createReportPdf } from "../lib/report-pdf";

describe("relatório em PDF", () => {
  it("gera um arquivo PDF válido com texto em português", async () => {
    const blob = createReportPdf("Vida Produtiva - Café da Ana", "Introdução: análise de custos e preços.\n\nPonto de equilíbrio: R$ 2.500,00.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe("application/pdf");
    expect(String.fromCharCode(...bytes.slice(0, 8))).toBe("%PDF-1.4");
    expect(bytes.length).toBeGreaterThan(500);
  });
});

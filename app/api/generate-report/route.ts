import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server-auth";
import { isCloudMode } from "@/lib/server-db";

const extractText = (data: any) => {
  if (typeof data.output_text === "string") return data.output_text;
  return (data.output ?? []).flatMap((item: any) => item.content ?? []).filter((item: any) => item.type === "output_text").map((item: any) => item.text).join("\n");
};

export async function POST(request: Request) {
  if (isCloudMode() && !await currentUser()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ fallback: true, error: "OPENAI_API_KEY não configurada." });
  try {
    const raw = await request.text();
    if (raw.length > 100000) return NextResponse.json({ error: "Resumo grande demais." }, { status: 413 });
    const summary = JSON.parse(raw);
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.OPENAI_REPORT_MODEL || "gpt-5-mini",
        max_output_tokens: 900,
        reasoning: { effort: "low" },
        instructions: "Você é um consultor voluntário de pequenos negócios. Escreva em português brasileiro, linguagem simples, acolhedora e objetiva. Gere um relatório com no máximo 2.000 caracteres. Use exatamente estas seções: Introdução; Situação de custos atual; Situação dos preços concorrentes; Preços sugeridos; Ponto de equilíbrio. Não invente dados, não use markdown em tabela e explique riscos de forma prática.",
        input: JSON.stringify(summary)
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || "Falha na OpenAI.");
    const text = extractText(data).trim().slice(0, 2000);
    if (!text) throw new Error("A OpenAI não retornou texto.");
    return NextResponse.json({ text });
  } catch (error) {
    return NextResponse.json({ fallback: true, error: error instanceof Error ? error.message : "Falha ao gerar relatório." });
  }
}

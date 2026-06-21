import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server-auth";
import { getDb } from "@/lib/server-db";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const db = await getDb();
  await db.sql`SELECT 1`;
  return NextResponse.json({
    database: "online",
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_REPORT_MODEL || "gpt-5-mini"
  });
}

export async function POST() {
  const user = await currentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Apenas o administrador pode testar a OpenAI." }, { status: 403 });
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_REPORT_MODEL || "gpt-5-mini";
  if (!apiKey) return NextResponse.json({ connected: false, error: "OPENAI_API_KEY não configurada." });
  try {
    const response = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const data = await response.json();
    return response.ok
      ? NextResponse.json({ connected: true, model: data.id || model })
      : NextResponse.json({ connected: false, error: data?.error?.message || "A OpenAI recusou a conexão." });
  } catch (error) {
    return NextResponse.json({ connected: false, error: error instanceof Error ? error.message : "Falha ao testar a OpenAI." });
  }
}

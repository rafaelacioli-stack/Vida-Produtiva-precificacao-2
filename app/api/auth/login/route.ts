import { NextResponse } from "next/server";
import { authenticate } from "@/lib/server-auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (typeof email !== "string" || typeof password !== "string" || password.length > 200) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    const user = await authenticate(email, password);
    return user ? NextResponse.json({ user }) : NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível entrar." }, { status: 500 });
  }
}

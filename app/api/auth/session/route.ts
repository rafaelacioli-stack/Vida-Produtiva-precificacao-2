import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server-auth";
import { isCloudMode } from "@/lib/server-db";

export async function GET() {
  if (!isCloudMode()) return NextResponse.json({ mode: "local" });
  try {
    const user = await currentUser();
    return NextResponse.json({ mode: "cloud", authenticated: !!user, user, openaiConfigured: !!process.env.OPENAI_API_KEY });
  } catch {
    return NextResponse.json({ mode: "unavailable", error: "Banco online indisponível." }, { status: 503 });
  }
}

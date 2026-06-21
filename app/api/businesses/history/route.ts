import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server-auth";
import { getDb, workspaceId } from "@/lib/server-db";

export async function GET() {
  if (!await currentUser()) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const db = await getDb();
  const rows = await db.sql`SELECT revision, created_at FROM vp_state_history WHERE workspace_id = ${workspaceId} ORDER BY revision DESC LIMIT 50`;
  return NextResponse.json({ history: rows });
}

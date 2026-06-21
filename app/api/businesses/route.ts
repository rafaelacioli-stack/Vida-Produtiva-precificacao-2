import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server-auth";
import { getDb, workspaceId } from "@/lib/server-db";
import { canReplaceBusinesses } from "@/lib/permissions";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const db = await getDb();
  const [state] = await db.sql`SELECT payload, revision, updated_at FROM vp_state WHERE workspace_id = ${workspaceId}`;
  return NextResponse.json({ businesses: state?.payload ?? [], revision: Number(state?.revision ?? 0), updatedAt: state?.updated_at ?? null });
}

export async function PUT(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const raw = await request.text();
  if (raw.length > 5_000_000) return NextResponse.json({ error: "Dados grandes demais." }, { status: 413 });
  const { businesses, expectedRevision } = JSON.parse(raw);
  if (!Array.isArray(businesses)) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const db = await getDb(), client = await db.pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT revision, payload FROM vp_state WHERE workspace_id = $1 FOR UPDATE", [workspaceId]);
    const revision = Number(current.rows[0]?.revision ?? 0);
    if (revision !== Number(expectedRevision ?? 0)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Os dados foram alterados em outro computador.", conflict: true, revision }, { status: 409 });
    }
    if (!canReplaceBusinesses(user.role, current.rows[0]?.payload ?? [], businesses)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Apenas o administrador pode excluir negócios." }, { status: 403 });
    }
    const nextRevision = revision + 1, payload = JSON.stringify(businesses);
    await client.query("INSERT INTO vp_state_history (workspace_id, payload, revision, updated_by) VALUES ($1, $2::jsonb, $3, $4)", [workspaceId, payload, nextRevision, user.id]);
    await client.query("DELETE FROM vp_state_history WHERE workspace_id = $1 AND id NOT IN (SELECT id FROM vp_state_history WHERE workspace_id = $1 ORDER BY revision DESC LIMIT 500)", [workspaceId]);
    await client.query("INSERT INTO vp_state (workspace_id, payload, revision, updated_by, updated_at) VALUES ($1, $2::jsonb, $3, $4, NOW()) ON CONFLICT (workspace_id) DO UPDATE SET payload=EXCLUDED.payload, revision=EXCLUDED.revision, updated_by=EXCLUDED.updated_by, updated_at=NOW()", [workspaceId, payload, nextRevision, user.id]);
    await client.query("COMMIT");
    return NextResponse.json({ revision: nextRevision });
  } catch (error) {
    await client.query("ROLLBACK");
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao salvar." }, { status: 500 });
  } finally { client.release(); }
}

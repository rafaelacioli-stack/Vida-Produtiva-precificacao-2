import { NextResponse } from "next/server";
import { createVolunteer, currentUser } from "@/lib/server-auth";
import { getDb } from "@/lib/server-db";

const requireAdmin = async () => {
  const user = await currentUser();
  return user?.role === "admin" ? user : null;
};

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: "Apenas o administrador pode consultar usuários." }, { status: 403 });
  const db = await getDb();
  const users = await db.sql`SELECT id, email, role, created_at FROM vp_users ORDER BY created_at DESC`;
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  if (!await requireAdmin()) return NextResponse.json({ error: "Apenas o administrador pode criar usuários." }, { status: 403 });
  try {
    const { email, password } = await request.json();
    const user = await createVolunteer(String(email ?? ""), String(password ?? ""));
    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    const duplicate = error?.code === "23505" || String(error?.message).includes("unique");
    return NextResponse.json({ error: duplicate ? "Já existe um usuário com este e-mail." : error?.message || "Não foi possível criar o usuário." }, { status: 400 });
  }
}

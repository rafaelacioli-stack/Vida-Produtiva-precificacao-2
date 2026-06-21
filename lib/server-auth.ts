import "server-only";
import { cookies } from "next/headers";
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { getDb } from "./server-db";

const cookieName = "vp_session";
export type UserRole = "admin" | "volunteer";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const hashPassword = (password: string, salt = randomBytes(16).toString("hex")) => `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
const adminEmail = () => process.env.VP_ADMIN_EMAIL?.trim().toLowerCase();
const verifyPassword = (password: string, stored: string) => {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = scryptSync(password, salt, 64), expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export async function authenticate(email: string, password: string) {
  const db = await getDb();
  const normalizedEmail = email.trim().toLowerCase();
  const configuredAdminEmail = adminEmail();
  const configuredAdminPassword = process.env.VP_ADMIN_PASSWORD;
  const isAdminCredential = !!configuredAdminEmail && !!configuredAdminPassword && normalizedEmail === configuredAdminEmail && password === configuredAdminPassword;
  const [attempt] = await db.sql`SELECT attempts, locked_until FROM vp_login_attempts WHERE email = ${normalizedEmail}`;
  if (!isAdminCredential && attempt?.locked_until && new Date(attempt.locked_until).getTime() > Date.now()) throw new Error("Muitas tentativas. Aguarde 15 minutos.");
  let [user] = await db.sql`SELECT id, email, password_hash, role FROM vp_users WHERE email = ${normalizedEmail}`;
  if (!user) {
    if (!isAdminCredential) {
      await registerFailure(db, normalizedEmail);
      return null;
    }
    [user] = await db.sql`INSERT INTO vp_users (id, email, password_hash, role) VALUES (${randomUUID()}, ${configuredAdminEmail}, ${hashPassword(configuredAdminPassword!)}, 'admin') RETURNING id, email, password_hash, role`;
  } else if (isAdminCredential && (!verifyPassword(password, user.password_hash) || user.role !== "admin")) {
    const passwordHash = hashPassword(password);
    await db.sql`UPDATE vp_users SET password_hash = ${passwordHash}, role = 'admin' WHERE id = ${user.id}`;
    user.password_hash = passwordHash;
    user.role = "admin";
  }
  if (!verifyPassword(password, user.password_hash)) {
    await registerFailure(db, normalizedEmail);
    return null;
  }
  await db.sql`DELETE FROM vp_login_attempts WHERE email = ${normalizedEmail}`;
  if (normalizedEmail === adminEmail() && user.role !== "admin") {
    await db.sql`UPDATE vp_users SET role = 'admin' WHERE id = ${user.id}`;
    user.role = "admin";
  }
  const token = randomBytes(32).toString("hex");
  await db.sql`DELETE FROM vp_sessions WHERE expires_at < NOW()`;
  await db.sql`INSERT INTO vp_sessions (token_hash, user_id, expires_at) VALUES (${hashToken(token)}, ${user.id}, NOW() + INTERVAL '30 days')`;
  const jar = await cookies();
  jar.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return { id: user.id, email: user.email, role: user.role as UserRole };
}

async function registerFailure(db: any, email: string) {
  await db.sql`
    INSERT INTO vp_login_attempts (email, attempts, locked_until)
    VALUES (${email}, 1, NULL)
    ON CONFLICT (email) DO UPDATE SET
      attempts = vp_login_attempts.attempts + 1,
      locked_until = CASE WHEN vp_login_attempts.attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE vp_login_attempts.locked_until END,
      updated_at = NOW()
  `;
}

export async function currentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const db = await getDb();
  const [user] = await db.sql`SELECT u.id, u.email, u.role FROM vp_sessions s JOIN vp_users u ON u.id = s.user_id WHERE s.token_hash = ${hashToken(token)} AND s.expires_at > NOW()`;
  if (user && user.email === adminEmail() && user.role !== "admin") {
    await db.sql`UPDATE vp_users SET role = 'admin' WHERE id = ${user.id}`;
    user.role = "admin";
  }
  return user ?? null;
}

export async function createVolunteer(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new Error("Informe um e-mail válido.");
  if (password.length < 10) throw new Error("A senha precisa ter pelo menos 10 caracteres.");
  const db = await getDb();
  const [user] = await db.sql`
    INSERT INTO vp_users (id, email, password_hash, role)
    VALUES (${randomUUID()}, ${normalizedEmail}, ${hashPassword(password)}, 'volunteer')
    RETURNING id, email, role, created_at
  `;
  return user;
}

export async function logout() {
  const jar = await cookies(), token = jar.get(cookieName)?.value;
  if (token) {
    const db = await getDb();
    await db.sql`DELETE FROM vp_sessions WHERE token_hash = ${hashToken(token)}`;
  }
  jar.delete(cookieName);
}

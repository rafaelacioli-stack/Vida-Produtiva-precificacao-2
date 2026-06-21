import "server-only";
import { getDatabase } from "@netlify/database";

type Database = { sql: any; pool: any };

export async function getDb(): Promise<Database> {
  return getDatabase();
}

export const workspaceId = "vida-produtiva";
export const isCloudMode = () => process.env.VP_LOCAL_MODE !== "true";

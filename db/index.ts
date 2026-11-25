import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/**
 * The site's one database: Postgres at DATABASE_URL (Neon works, and on
 * Vercel you can add it from the Marketplace). Without it the site still
 * serves its pages; the blog is empty and publishing answers 503.
 */
export function databaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

const shared = globalThis as unknown as { sitePool?: Pool };
export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  shared.sitePool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
  });
  return drizzle(shared.sitePool, { schema });
}

export async function closeDb() {
  await shared.sitePool?.end();
  shared.sitePool = undefined;
}

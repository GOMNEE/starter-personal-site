import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/** Creates the test database when it is missing, then applies every migration. */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/starter_test");
  const name = url.pathname.slice(1);
  if (!/^[a-z0-9_]+_test$/.test(name)) throw new Error("Tests need a database whose name ends in _test.");
  const admin = new URL(url);
  admin.pathname = "/postgres";
  const adminPool = new Pool({ connectionString: admin.toString() });
  try {
    const exists = await adminPool.query("select 1 from pg_database where datname = $1", [name]);
    if (!exists.rowCount) await adminPool.query(`CREATE DATABASE "${name}"`);
  } finally {
    await adminPool.end();
  }
  const pool = new Pool({ connectionString: url.toString() });
  try {
    await migrate(drizzle(pool), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  } finally {
    await pool.end();
  }
}

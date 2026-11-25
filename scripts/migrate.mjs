// Applies the migrations in drizzle/ to the database at DATABASE_URL. `pnpm build`
// runs it first, so a deploy brings its own tables; without DATABASE_URL it
// does nothing and the site builds with an empty blog.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is not set: no migrations applied.");
  process.exit(0);
}
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
  console.log("Database migrations applied.");
} finally {
  await pool.end();
}

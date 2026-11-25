import { defineConfig } from "drizzle-kit";

// pnpm db:generate writes a new migration after a change to db/schema.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
});

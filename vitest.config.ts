import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Tests use a real Postgres: TEST_DATABASE_URL, whose database name must end in
// _test (tests/setup-database.ts creates and migrates it).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    environment: "node",
    globalSetup: ["./tests/setup-database.ts"],
    setupFiles: ["./tests/environment.ts"],
    fileParallelism: false,
  },
});

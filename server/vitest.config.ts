import "dotenv/config";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/helpers/db.ts";

export default defineConfig({
  test: {
    globalSetup: ["./tests/globalSetup.ts"],
    // Integration tests share one database and truncate between cases, so
    // they must not run in parallel across worker processes.
    fileParallelism: false,
    env: {
      // Resolved here too, because worker processes do not inherit env vars
      // that globalSetup assigns in the main process.
      DATABASE_URL: testDatabaseUrl(),
      NODE_ENV: "test",
    },
  },
});

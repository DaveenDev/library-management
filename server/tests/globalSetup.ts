import postgres from "postgres";
import { ensureTestDatabase, testDatabaseUrl } from "./helpers/db.ts";
import { pushSchema } from "../src/db/push.ts";

/**
 * Runs once before the whole suite: point the app at the test database,
 * create it if needed, and apply the schema.
 */
export async function setup() {
  const url = testDatabaseUrl();
  // Set before any module that reads DATABASE_URL is imported by a test file.
  process.env.DATABASE_URL = url;

  await ensureTestDatabase();

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await pushSchema(sql);
  } finally {
    await sql.end();
  }
}

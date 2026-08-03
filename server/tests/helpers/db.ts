import postgres from "postgres";

/**
 * Integration tests truncate every table between cases, so they must never
 * point at a developer's working database. Resolution order:
 *
 *   1. TEST_DATABASE_URL, if set (what CI uses).
 *   2. DATABASE_URL with `_test` appended to the database name.
 *
 * The second form means a normal local setup gets an isolated `*_test`
 * database automatically instead of destroying the seeded demo data.
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "Set TEST_DATABASE_URL or DATABASE_URL before running tests. See README > Running the tests.",
    );
  }

  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "") || "postgres";
  if (name.endsWith("_test")) return base;
  url.pathname = `/${name}_test`;
  return url.toString();
}

/** Create the test database if it does not exist yet. */
export async function ensureTestDatabase(): Promise<void> {
  const target = new URL(testDatabaseUrl());
  const dbName = target.pathname.replace(/^\//, "");

  // CREATE DATABASE cannot run inside the target database, so connect to the
  // default `postgres` database to issue it.
  const admin = new URL(target.toString());
  admin.pathname = "/postgres";
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    const existing = await sql`select 1 from pg_database where datname = ${dbName}`;
    if (existing.length === 0) {
      // Identifiers cannot be bound as parameters; dbName is derived from our
      // own connection string, not user input.
      await sql.unsafe(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await sql.end();
  }
}

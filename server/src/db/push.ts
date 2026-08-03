import "dotenv/config";

// Idempotent schema creation. Mirrors src/db/schema.ts.
// (Used instead of `drizzle-kit push` to avoid monorepo hoisting issues.)
const DDL = `
CREATE TABLE IF NOT EXISTS books (
  id serial PRIMARY KEY,
  barcode varchar(32) NOT NULL UNIQUE,
  accession_no varchar(32) UNIQUE,
  title text NOT NULL,
  author text NOT NULL,
  subject text NOT NULL DEFAULT 'Fiction',
  isbn varchar(20),
  total_copies integer NOT NULL DEFAULT 1,
  available_copies integer NOT NULL DEFAULT 1,
  shelf varchar(16),
  publication_year integer,
  publisher text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id serial PRIMARY KEY,
  member_code varchar(16) NOT NULL UNIQUE,
  name text NOT NULL,
  type varchar(16) NOT NULL DEFAULT 'Student',
  grade_or_dept text,
  email text,
  status varchar(16) NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loans (
  id serial PRIMARY KEY,
  book_id integer NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  borrowed_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  returned_at timestamptz
);

CREATE TABLE IF NOT EXISTS reservations (
  id serial PRIMARY KEY,
  book_id integer NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  status varchar(24) NOT NULL DEFAULT 'Waiting',
  queue_position integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS fines (
  id serial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  loan_id integer REFERENCES loans(id) ON DELETE SET NULL,
  book_id integer REFERENCES books(id) ON DELETE SET NULL,
  days_overdue integer NOT NULL DEFAULT 0,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  status varchar(16) NOT NULL DEFAULT 'Unpaid',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff_users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text,
  role varchar(16) NOT NULL DEFAULT 'Assistant',
  status varchar(16) NOT NULL DEFAULT 'Active',
  last_active_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  daily_fine_rate numeric(10,2) NOT NULL DEFAULT 0.50,
  grace_period_days integer NOT NULL DEFAULT 2,
  max_fine_cap numeric(10,2) NOT NULL DEFAULT 15.00,
  auto_suspend_days integer NOT NULL DEFAULT 14,
  email_reminders boolean NOT NULL DEFAULT true,
  loan_period_days integer NOT NULL DEFAULT 14,
  theme varchar(16) NOT NULL DEFAULT 'parchment',
  accent varchar(16)
);

CREATE TABLE IF NOT EXISTS lookups (
  id serial PRIMARY KEY,
  kind varchar(16) NOT NULL,
  value text NOT NULL,
  sort integer NOT NULL DEFAULT 0
);
`;

// The CREATE TABLE statements above only fire on a fresh database, so columns
// added after the first release need an explicit idempotent migration here.
const MIGRATIONS = `
ALTER TABLE books ADD COLUMN IF NOT EXISTS accession_no varchar(32);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'books_accession_no_key'
  ) THEN
    ALTER TABLE books ADD CONSTRAINT books_accession_no_key UNIQUE (accession_no);
  END IF;
END $$;

-- Backfill a register number for any copy catalogued before the column existed.
UPDATE books b
SET accession_no = lpad(s.rn::text, 4, '0')
FROM (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM books WHERE accession_no IS NULL) s
WHERE b.id = s.id AND b.accession_no IS NULL;

-- Staff sign-in. Left nullable and unbackfilled on purpose: accounts that
-- predate authentication have no password, and an account with no hash cannot
-- sign in until an Admin sets one.
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS password_hash text;

-- Addresses are matched case-insensitively at sign-in, so two rows differing
-- only in case would make one of them unreachable.
UPDATE staff_users SET email = lower(email)
WHERE email <> lower(email)
  AND NOT EXISTS (SELECT 1 FROM staff_users o WHERE o.email = lower(staff_users.email));
`;

/**
 * Create/upgrade the schema on an arbitrary connection. Exported so the test
 * suite can prepare its own database with exactly the same DDL rather than
 * keeping a second copy in sync.
 */
export async function pushSchema(client: { unsafe: (q: string) => Promise<unknown> }): Promise<void> {
  await client.unsafe(DDL);
  await client.unsafe(MIGRATIONS);
}

// Only run as a CLI when invoked directly (`npm run db:push`), so importing
// this module from tests does not tear down the process.
const invokedDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("/db/push.ts");
if (invokedDirectly) {
  // Imported here rather than at the top of the file: `db/index.ts` opens a
  // connection pool as a side effect of being imported, and throws when
  // DATABASE_URL is unset. The test suite imports `pushSchema` from this
  // module and sets DATABASE_URL itself before connecting — a static import
  // would run, and throw, before it got the chance.
  const { queryClient } = await import("./index.ts");
  try {
    console.log("Pushing schema…");
    await queryClient.unsafe(DDL);
    console.log("Applying migrations…");
    await queryClient.unsafe(MIGRATIONS);
    console.log("✔ Schema is up to date.");
    await queryClient.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    await queryClient.end();
    process.exit(1);
  }
}

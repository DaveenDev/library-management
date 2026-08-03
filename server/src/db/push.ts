import "dotenv/config";
import { queryClient } from "./index.ts";

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
`;

async function main() {
  console.log("Pushing schema…");
  await queryClient.unsafe(DDL);
  console.log("Applying migrations…");
  await queryClient.unsafe(MIGRATIONS);
  console.log("✔ Schema is up to date.");
}

main()
  .then(() => queryClient.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    queryClient.end().finally(() => process.exit(1));
  });

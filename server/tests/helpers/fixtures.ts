import { sql } from "drizzle-orm";
import { db } from "../../src/db/index.ts";
import { books, members, loans, fines, reservations, settings, staffUsers } from "../../src/db/schema.ts";

/**
 * The staff account the suite signs in as. `restart identity` on the truncate
 * below means re-inserting it always lands on the same id, so a session cookie
 * minted once at module load stays valid for every test.
 */
export const SESSION_USER_ID = 1;
export const SESSION_USER_EMAIL = "test-admin@lumenlibrary.org";

/** Wipe every table and restore default settings. Runs between tests. */
export async function resetDb(): Promise<void> {
  await db.execute(
    sql`truncate table ${fines}, ${reservations}, ${loans}, ${books}, ${members}, ${staffUsers} restart identity cascade`,
  );
  await db.delete(settings);
  await db.insert(settings).values({ id: 1 });
  // Every route behind /api requires a real, active staff row — the middleware
  // re-reads the account rather than trusting the token — so the signed-in
  // user has to survive the wipe. The id is left to the sequence rather than
  // set explicitly: assigning it by hand does not advance the sequence, and
  // the next staff insert would then collide on the primary key.
  const [session] = await db
    .insert(staffUsers)
    .values({
      name: "Test Admin",
      email: SESSION_USER_EMAIL,
      role: "Admin",
      status: "Active",
    })
    .returning();
  if (session.id !== SESSION_USER_ID) {
    throw new Error(
      `expected the session account to land on id ${SESSION_USER_ID}, got ${session.id} — ` +
        "the module-level cookie in helpers/auth.ts points at a row that no longer exists",
    );
  }
}

export async function makeStaff(overrides: Partial<typeof staffUsers.$inferInsert> = {}) {
  const n = Math.floor(Math.random() * 1_000_000);
  const [row] = await db
    .insert(staffUsers)
    .values({
      name: "Test Staff",
      email: `staff-${n}@lumenlibrary.org`,
      role: "Assistant",
      status: "Active",
      ...overrides,
    })
    .returning();
  return row;
}

export async function makeBook(overrides: Partial<typeof books.$inferInsert> = {}) {
  const n = Math.floor(Math.random() * 1_000_000);
  const [row] = await db
    .insert(books)
    .values({
      barcode: `LIB-T${String(n).padStart(6, "0")}`,
      accessionNo: `T${String(n).padStart(5, "0")}`,
      title: "Test Title",
      author: "Test Author",
      subject: "Fiction",
      totalCopies: 1,
      availableCopies: 1,
      ...overrides,
    })
    .returning();
  return row;
}

export async function makeMember(overrides: Partial<typeof members.$inferInsert> = {}) {
  const n = Math.floor(Math.random() * 1_000_000);
  const [row] = await db
    .insert(members)
    .values({
      memberCode: `S-T${String(n).padStart(5, "0")}`,
      name: "Test Member",
      type: "Student",
      status: "Active",
      ...overrides,
    })
    .returning();
  return row;
}

/** Insert a loan directly, bypassing the checkout route. */
export async function makeLoan(bookId: number, memberId: number, dueInDays: number) {
  const now = new Date();
  const [row] = await db
    .insert(loans)
    .values({
      bookId,
      memberId,
      borrowedAt: now,
      dueAt: new Date(now.getTime() + dueInDays * 86_400_000),
    })
    .returning();
  return row;
}

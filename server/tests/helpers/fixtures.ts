import { sql } from "drizzle-orm";
import { db } from "../../src/db/index.ts";
import { books, members, loans, fines, reservations, settings, staffUsers } from "../../src/db/schema.ts";

/** Wipe every table and restore default settings. Runs between tests. */
export async function resetDb(): Promise<void> {
  await db.execute(
    sql`truncate table ${fines}, ${reservations}, ${loans}, ${books}, ${members}, ${staffUsers} restart identity cascade`,
  );
  await db.delete(settings);
  await db.insert(settings).values({ id: 1 });
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

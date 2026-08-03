import { Router } from "express";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { loans, books, members, fines } from "../db/schema.ts";
import { ah, HttpError, pageParams } from "../lib/http.ts";
import { checkinSchema, checkoutSchema, parseBody, parseId } from "../lib/validate.ts";
import { getSettings } from "../lib/settings.ts";
import { computeFine, daysLate, loanStatus, MS_PER_DAY } from "../lib/domain.ts";
import type { Loan } from "@lumen/shared";

export const loansRouter = Router();

const selectShape = {
  id: loans.id,
  bookId: loans.bookId,
  memberId: loans.memberId,
  borrowedAt: loans.borrowedAt,
  dueAt: loans.dueAt,
  returnedAt: loans.returnedAt,
  bookTitle: books.title,
  bookBarcode: books.barcode,
  memberName: members.name,
  memberCode: members.memberCode,
};

/** Shape returned by a `selectShape` query, before date fields are stringified. */
type LoanRow = {
  [K in keyof typeof selectShape]: K extends "borrowedAt" | "dueAt"
    ? Date
    : K extends "returnedAt"
      ? Date | null
      : K extends "id" | "bookId" | "memberId"
        ? number
        : string;
};

function serialize(row: LoanRow, gracePeriodDays: number): Loan {
  const now = new Date();
  const due = new Date(row.dueAt);
  const returned = row.returnedAt ? new Date(row.returnedAt) : null;
  return {
    ...row,
    borrowedAt: new Date(row.borrowedAt).toISOString(),
    dueAt: due.toISOString(),
    returnedAt: returned ? returned.toISOString() : null,
    status: loanStatus(due, returned, now, gracePeriodDays),
    daysLate: daysLate(due, returned, now),
  };
}

// GET /api/loans?status=active|all
loansRouter.get(
  "/",
  ah(async (req, res) => {
    const { page, pageSize, offset } = pageParams(req);
    const status = String(req.query.status ?? "active");
    const cfg = await getSettings();
    const where = status === "all" ? undefined : isNull(loans.returnedAt);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans)
      .where(where);
    const rows = await db
      .select(selectShape)
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(members, eq(loans.memberId, members.id))
      .where(where)
      .orderBy(desc(loans.borrowedAt))
      .limit(pageSize)
      .offset(offset);

    res.json({
      items: rows.map((r) => serialize(r, cfg.gracePeriodDays)),
      total: count,
      page,
      pageSize,
    });
  }),
);

// POST /api/loans/checkout  { bookBarcode|bookId, memberCode|memberId }
loansRouter.post(
  "/checkout",
  ah(async (req, res) => {
    const cfg = await getSettings();
    const b = parseBody(checkoutSchema, req.body);

    const book = b.bookId
      ? (await db.select().from(books).where(eq(books.id, b.bookId)))[0]
      : (await db.select().from(books).where(eq(books.barcode, b.bookBarcode!)))[0];
    if (!book) throw new HttpError(404, "book not found");

    const member = b.memberId
      ? (await db.select().from(members).where(eq(members.id, b.memberId)))[0]
      : (await db.select().from(members).where(eq(members.memberCode, b.memberCode!)))[0];
    if (!member) throw new HttpError(404, "member not found");
    if (member.status === "Suspended") throw new HttpError(409, "member is suspended");

    const now = new Date();
    const dueAt = new Date(now.getTime() + cfg.loanPeriodDays * MS_PER_DAY);

    const loan = await db.transaction(async (tx) => {
      // Claim a copy with a single conditional UPDATE. Checking availability
      // in JS first and decrementing after would let two concurrent requests
      // both pass the check and oversubscribe the book; the `> 0` guard lives
      // in the WHERE clause so the database arbitrates instead.
      const [claimed] = await tx
        .update(books)
        .set({ availableCopies: sql`${books.availableCopies} - 1` })
        .where(and(eq(books.id, book.id), gt(books.availableCopies, 0)))
        .returning();
      if (!claimed) throw new HttpError(409, "no copies available");

      const [created] = await tx
        .insert(loans)
        .values({ bookId: book.id, memberId: member.id, borrowedAt: now, dueAt })
        .returning();
      return created;
    });

    const [row] = await db
      .select(selectShape)
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(members, eq(loans.memberId, members.id))
      .where(eq(loans.id, loan.id));
    res.status(201).json(serialize(row, cfg.gracePeriodDays));
  }),
);

// POST /api/loans/:id/return  (also accepts POST /checkin { bookBarcode })
async function returnLoan(loanId: number) {
  const cfg = await getSettings();
  const [exists] = await db.select().from(loans).where(eq(loans.id, loanId));
  if (!exists) throw new HttpError(404, "loan not found");

  const now = new Date();

  return db.transaction(async (tx) => {
    // Closing the loan is the atomic step: only the request that actually
    // flips returned_at from NULL proceeds. Without this, two concurrent
    // returns would both restock a copy and both raise a fine.
    const [loan] = await tx
      .update(loans)
      .set({ returnedAt: now })
      .where(and(eq(loans.id, loanId), isNull(loans.returnedAt)))
      .returning();
    if (!loan) throw new HttpError(409, "loan already returned");

    // `least(...)` keeps the restock from exceeding the copies actually owned.
    await tx
      .update(books)
      .set({ availableCopies: sql`least(${books.totalCopies}, ${books.availableCopies} + 1)` })
      .where(eq(books.id, loan.bookId));

    // Late? create an unpaid fine.
    const { days, amount } = computeFine(new Date(loan.dueAt), now, cfg);
    let fine = null;
    if (amount > 0) {
      [fine] = await tx
        .insert(fines)
        .values({
          memberId: loan.memberId,
          loanId: loan.id,
          bookId: loan.bookId,
          daysOverdue: days,
          amount: amount.toFixed(2),
          status: "Unpaid",
        })
        .returning();
    }
    return { fine, days, amount };
  });
}

loansRouter.post(
  "/:id/return",
  ah(async (req, res) => {
    const result = await returnLoan(parseId(req.params.id));
    res.json(result);
  }),
);

loansRouter.post(
  "/checkin",
  ah(async (req, res) => {
    const { bookBarcode } = parseBody(checkinSchema, req.body);
    const [book] = await db.select().from(books).where(eq(books.barcode, bookBarcode));
    if (!book) throw new HttpError(404, "book not found");
    const [open] = await db
      .select()
      .from(loans)
      .where(and(eq(loans.bookId, book.id), isNull(loans.returnedAt)))
      .orderBy(desc(loans.borrowedAt))
      .limit(1);
    if (!open) throw new HttpError(409, "no active loan for this book");
    const result = await returnLoan(open.id);
    res.json(result);
  }),
);

// POST /api/loans/:id/renew  — extends due date by the loan period
loansRouter.post(
  "/:id/renew",
  ah(async (req, res) => {
    const cfg = await getSettings();
    const id = parseId(req.params.id);
    const [exists] = await db.select().from(loans).where(eq(loans.id, id));
    if (!exists) throw new HttpError(404, "loan not found");

    // Extend from whichever is later, now or the current due date — computed
    // in SQL so two rapid renews extend by one period each rather than both
    // reading the same starting value.
    const [renewed] = await db
      .update(loans)
      .set({
        // make_interval keeps the loan period a bound parameter rather than
        // interpolated SQL text.
        dueAt: sql`greatest(now(), ${loans.dueAt}) + make_interval(days => ${cfg.loanPeriodDays})`,
      })
      .where(and(eq(loans.id, id), isNull(loans.returnedAt)))
      .returning();
    if (!renewed) throw new HttpError(409, "cannot renew a returned loan");
    const [row] = await db
      .select(selectShape)
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(members, eq(loans.memberId, members.id))
      .where(eq(loans.id, id));
    res.json(serialize(row, cfg.gracePeriodDays));
  }),
);

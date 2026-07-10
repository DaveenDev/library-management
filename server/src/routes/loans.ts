import { Router } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { loans, books, members, fines } from "../db/schema.ts";
import { ah, HttpError, pageParams } from "../lib/http.ts";
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

function serialize(row: any, gracePeriodDays: number): Loan {
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
    const b = req.body ?? {};

    const book = b.bookId
      ? (await db.select().from(books).where(eq(books.id, Number(b.bookId))))[0]
      : (await db.select().from(books).where(eq(books.barcode, String(b.bookBarcode ?? "").trim())))[0];
    if (!book) throw new HttpError(404, "book not found");
    if (book.availableCopies <= 0) throw new HttpError(409, "no copies available");

    const member = b.memberId
      ? (await db.select().from(members).where(eq(members.id, Number(b.memberId))))[0]
      : (await db.select().from(members).where(eq(members.memberCode, String(b.memberCode ?? "").trim())))[0];
    if (!member) throw new HttpError(404, "member not found");
    if (member.status === "Suspended") throw new HttpError(409, "member is suspended");

    const now = new Date();
    const dueAt = new Date(now.getTime() + cfg.loanPeriodDays * MS_PER_DAY);
    const [loan] = await db
      .insert(loans)
      .values({ bookId: book.id, memberId: member.id, borrowedAt: now, dueAt })
      .returning();
    await db
      .update(books)
      .set({ availableCopies: book.availableCopies - 1 })
      .where(eq(books.id, book.id));

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
  const [loan] = await db.select().from(loans).where(eq(loans.id, loanId));
  if (!loan) throw new HttpError(404, "loan not found");
  if (loan.returnedAt) throw new HttpError(409, "loan already returned");

  const now = new Date();
  await db.update(loans).set({ returnedAt: now }).where(eq(loans.id, loanId));

  const [book] = await db.select().from(books).where(eq(books.id, loan.bookId));
  if (book) {
    await db
      .update(books)
      .set({ availableCopies: Math.min(book.totalCopies, book.availableCopies + 1) })
      .where(eq(books.id, book.id));
  }

  // Late? create an unpaid fine.
  const { days, amount } = computeFine(new Date(loan.dueAt), now, cfg);
  let fine = null;
  if (amount > 0) {
    [fine] = await db
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
}

loansRouter.post(
  "/:id/return",
  ah(async (req, res) => {
    const result = await returnLoan(Number(req.params.id));
    res.json(result);
  }),
);

loansRouter.post(
  "/checkin",
  ah(async (req, res) => {
    const barcode = String(req.body?.bookBarcode ?? "").trim();
    const [book] = await db.select().from(books).where(eq(books.barcode, barcode));
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
    const id = Number(req.params.id);
    const [loan] = await db.select().from(loans).where(eq(loans.id, id));
    if (!loan) throw new HttpError(404, "loan not found");
    if (loan.returnedAt) throw new HttpError(409, "cannot renew a returned loan");
    const base = new Date(Math.max(Date.now(), new Date(loan.dueAt).getTime()));
    const dueAt = new Date(base.getTime() + cfg.loanPeriodDays * MS_PER_DAY);
    await db.update(loans).set({ dueAt }).where(eq(loans.id, id));
    const [row] = await db
      .select(selectShape)
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(members, eq(loans.memberId, members.id))
      .where(eq(loans.id, id));
    res.json(serialize(row, cfg.gracePeriodDays));
  }),
);

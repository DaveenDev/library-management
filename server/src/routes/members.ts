import { Router } from "express";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { members, loans, fines, books } from "../db/schema.ts";
import { ah, HttpError, pageParams } from "../lib/http.ts";
import { getSettings } from "../lib/settings.ts";
import { daysLate, loanStatus } from "../lib/domain.ts";

export const membersRouter = Router();

// Correlated subquery computed columns. NB: Drizzle renders interpolated
// columns *unqualified* inside a raw sql template, which breaks correlation
// (the outer members.id would resolve to loans.id). So these use literal,
// fully-qualified SQL against the known table/column names.
const booksOutExpr = sql<number>`(
  select count(*)::int from loans
  where loans.member_id = members.id and loans.returned_at is null
)`;
const finesDueExpr = sql<number>`(
  select coalesce(sum(fines.amount), 0)::float from fines
  where fines.member_id = members.id and fines.status = 'Unpaid'
)`;

async function nextMemberCode(type: string): Promise<string> {
  const prefix = type === "Faculty" ? "F" : "S";
  const [row] = await db
    .select({ max: sql<string>`max(nullif(regexp_replace(${members.memberCode}, '\\D', '', 'g'), ''))::int` })
    .from(members)
    .where(ilike(members.memberCode, `${prefix}-%`));
  const n = (Number(row?.max) || 1000) + 1;
  return `${prefix}-${String(n).padStart(4, "0")}`;
}

membersRouter.get(
  "/",
  ah(async (req, res) => {
    const { page, pageSize, offset } = pageParams(req);
    const q = String(req.query.q ?? "").trim();
    const where = q
      ? or(ilike(members.name, `%${q}%`), ilike(members.memberCode, `%${q}%`))
      : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .where(where);
    const items = await db
      .select({
        id: members.id,
        memberCode: members.memberCode,
        name: members.name,
        type: members.type,
        gradeOrDept: members.gradeOrDept,
        email: members.email,
        status: members.status,
        createdAt: members.createdAt,
        booksOut: booksOutExpr,
        finesDue: finesDueExpr,
      })
      .from(members)
      .where(where)
      .orderBy(asc(members.name))
      .limit(pageSize)
      .offset(offset);

    res.json({ items, total: count, page, pageSize });
  }),
);

// GET /api/members/:id/history — full borrowing record for one member.
membersRouter.get(
  "/:id/history",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const cfg = await getSettings();
    const [member] = await db.select().from(members).where(eq(members.id, id));
    if (!member) throw new HttpError(404, "member not found");

    const rows = await db
      .select({
        id: loans.id,
        bookTitle: books.title,
        bookBarcode: books.barcode,
        borrowedAt: loans.borrowedAt,
        dueAt: loans.dueAt,
        returnedAt: loans.returnedAt,
      })
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .where(eq(loans.memberId, id))
      .orderBy(desc(loans.borrowedAt));

    const now = new Date();
    const history = rows.map((r) => {
      const due = new Date(r.dueAt);
      const returned = r.returnedAt ? new Date(r.returnedAt) : null;
      return {
        id: r.id,
        bookTitle: r.bookTitle,
        bookBarcode: r.bookBarcode,
        borrowedAt: new Date(r.borrowedAt).toISOString(),
        dueAt: due.toISOString(),
        returnedAt: returned ? returned.toISOString() : null,
        status: loanStatus(due, returned, now, cfg.gracePeriodDays),
        daysLate: daysLate(due, returned, now),
      };
    });

    const [totals] = await db
      .select({
        unpaidFines: sql<number>`coalesce(sum(${fines.amount}) filter (where ${fines.status} = 'Unpaid'), 0)::float`,
        paidFines: sql<number>`coalesce(sum(${fines.amount}) filter (where ${fines.status} = 'Paid'), 0)::float`,
      })
      .from(fines)
      .where(eq(fines.memberId, id));

    res.json({
      member,
      history,
      totalLoans: history.length,
      openLoans: history.filter((h) => !h.returnedAt).length,
      unpaidFines: totals.unpaidFines,
      paidFines: totals.paidFines,
    });
  }),
);

membersRouter.post(
  "/",
  ah(async (req, res) => {
    const b = req.body ?? {};
    if (!b.name) throw new HttpError(400, "name is required");
    const type = b.type === "Faculty" ? "Faculty" : "Student";
    const memberCode = b.memberCode?.trim() || (await nextMemberCode(type));
    const [row] = await db
      .insert(members)
      .values({
        memberCode,
        name: String(b.name).trim(),
        type,
        gradeOrDept: b.gradeOrDept || null,
        email: b.email || null,
        status: b.status === "Suspended" ? "Suspended" : "Active",
      })
      .returning();
    res.status(201).json({ ...row, booksOut: 0, finesDue: 0 });
  }),
);

membersRouter.patch(
  "/:id",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body ?? {};
    const patch: Record<string, unknown> = {};
    for (const f of ["name", "type", "gradeOrDept", "email", "status"]) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    const [row] = await db.update(members).set(patch).where(eq(members.id, id)).returning();
    if (!row) throw new HttpError(404, "member not found");
    res.json(row);
  }),
);

membersRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const id = Number(req.params.id);
    const [open] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans)
      .where(and(eq(loans.memberId, id), sql`${loans.returnedAt} is null`));
    if (open.count > 0) throw new HttpError(409, "cannot delete a member with active loans");
    await db.delete(members).where(eq(members.id, id));
    res.status(204).end();
  }),
);

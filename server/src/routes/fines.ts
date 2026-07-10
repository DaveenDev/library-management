import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { fines, books, members } from "../db/schema.ts";
import { ah, HttpError, pageParams } from "../lib/http.ts";

export const finesRouter = Router();

const shape = {
  id: fines.id,
  memberId: fines.memberId,
  loanId: fines.loanId,
  bookId: fines.bookId,
  daysOverdue: fines.daysOverdue,
  amount: sql<number>`${fines.amount}::float`,
  status: fines.status,
  createdAt: fines.createdAt,
  memberName: members.name,
  bookTitle: sql<string>`coalesce(${books.title}, '—')`,
};

finesRouter.get(
  "/",
  ah(async (req, res) => {
    const { page, pageSize, offset } = pageParams(req);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(fines);
    const items = await db
      .select(shape)
      .from(fines)
      .innerJoin(members, eq(fines.memberId, members.id))
      .leftJoin(books, eq(fines.bookId, books.id))
      .orderBy(desc(fines.createdAt))
      .limit(pageSize)
      .offset(offset);
    res.json({ items, total: count, page, pageSize });
  }),
);

// summary tiles
finesRouter.get(
  "/summary",
  ah(async (_req, res) => {
    const [row] = await db
      .select({
        outstanding: sql<number>`coalesce(sum(${fines.amount}) filter (where ${fines.status} = 'Unpaid'), 0)::float`,
        collected: sql<number>`coalesce(sum(${fines.amount}) filter (where ${fines.status} = 'Paid'), 0)::float`,
        membersWithFines: sql<number>`count(distinct ${fines.memberId}) filter (where ${fines.status} = 'Unpaid')::int`,
      })
      .from(fines);
    res.json(row);
  }),
);

finesRouter.post(
  "/:id/collect",
  ah(async (req, res) => {
    const [row] = await db
      .update(fines)
      .set({ status: "Paid" })
      .where(eq(fines.id, Number(req.params.id)))
      .returning();
    if (!row) throw new HttpError(404, "fine not found");
    res.json(row);
  }),
);

finesRouter.post(
  "/:id/waive",
  ah(async (req, res) => {
    const [row] = await db
      .update(fines)
      .set({ status: "Waived" })
      .where(eq(fines.id, Number(req.params.id)))
      .returning();
    if (!row) throw new HttpError(404, "fine not found");
    res.json(row);
  }),
);

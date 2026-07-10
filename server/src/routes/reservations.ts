import { Router } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { reservations, books, members } from "../db/schema.ts";
import { ah, HttpError, pageParams } from "../lib/http.ts";

export const reservationsRouter = Router();

const shape = {
  id: reservations.id,
  bookId: reservations.bookId,
  memberId: reservations.memberId,
  reservedAt: reservations.reservedAt,
  status: reservations.status,
  queuePosition: reservations.queuePosition,
  bookTitle: books.title,
  memberName: members.name,
};

reservationsRouter.get(
  "/",
  ah(async (req, res) => {
    const { page, pageSize, offset } = pageParams(req);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(reservations);
    const items = await db
      .select(shape)
      .from(reservations)
      .innerJoin(books, eq(reservations.bookId, books.id))
      .innerJoin(members, eq(reservations.memberId, members.id))
      .orderBy(desc(reservations.reservedAt))
      .limit(pageSize)
      .offset(offset);
    res.json({ items, total: count, page, pageSize });
  }),
);

reservationsRouter.post(
  "/",
  ah(async (req, res) => {
    const b = req.body ?? {};
    if (!b.bookId || !b.memberId) throw new HttpError(400, "bookId and memberId are required");
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(eq(reservations.bookId, Number(b.bookId)));
    const [row] = await db
      .insert(reservations)
      .values({
        bookId: Number(b.bookId),
        memberId: Number(b.memberId),
        queuePosition: count + 1,
        status: count === 0 ? "Ready for pickup" : "Waiting",
      })
      .returning();
    res.status(201).json(row);
  }),
);

reservationsRouter.post(
  "/:id/fulfill",
  ah(async (req, res) => {
    const [row] = await db
      .update(reservations)
      .set({ status: "Fulfilled" })
      .where(eq(reservations.id, Number(req.params.id)))
      .returning();
    if (!row) throw new HttpError(404, "reservation not found");
    res.json(row);
  }),
);

reservationsRouter.post(
  "/:id/cancel",
  ah(async (req, res) => {
    const [row] = await db
      .update(reservations)
      .set({ status: "Cancelled" })
      .where(eq(reservations.id, Number(req.params.id)))
      .returning();
    if (!row) throw new HttpError(404, "reservation not found");
    res.json(row);
  }),
);

reservationsRouter.delete(
  "/:id",
  ah(async (req, res) => {
    await db.delete(reservations).where(eq(reservations.id, Number(req.params.id)));
    res.status(204).end();
  }),
);

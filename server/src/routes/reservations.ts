import { Router } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
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

// Holds that still occupy a slot in the queue. Cancelled and fulfilled rows
// stay in the table for history but must not push new holds down the line.
const OPEN_STATUSES = ["Waiting", "Ready for pickup"];

reservationsRouter.post(
  "/",
  ah(async (req, res) => {
    const b = req.body ?? {};

    const book = b.bookId
      ? (await db.select().from(books).where(eq(books.id, Number(b.bookId))))[0]
      : (await db.select().from(books).where(eq(books.barcode, String(b.bookBarcode ?? "").trim())))[0];
    if (!book) throw new HttpError(404, "book not found");

    const member = b.memberId
      ? (await db.select().from(members).where(eq(members.id, Number(b.memberId))))[0]
      : (await db.select().from(members).where(eq(members.memberCode, String(b.memberCode ?? "").trim())))[0];
    if (!member) throw new HttpError(404, "member not found");
    if (member.status === "Suspended") throw new HttpError(409, "member is suspended");

    const [dupe] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(
        and(
          eq(reservations.bookId, book.id),
          eq(reservations.memberId, member.id),
          inArray(reservations.status, OPEN_STATUSES),
        ),
      );
    if (dupe.count > 0) throw new HttpError(409, "this member already has a hold on that title");

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(and(eq(reservations.bookId, book.id), inArray(reservations.status, OPEN_STATUSES)));

    // A copy already on the shelf can be picked up right away; otherwise the
    // hold waits behind whoever is already in line.
    const ready = count === 0 && book.availableCopies > 0;
    const [row] = await db
      .insert(reservations)
      .values({
        bookId: book.id,
        memberId: member.id,
        queuePosition: count + 1,
        status: ready ? "Ready for pickup" : "Waiting",
      })
      .returning();
    res.status(201).json(row);
  }),
);

reservationsRouter.post(
  "/:id/fulfill",
  ah(async (req, res) => {
    const [existing] = await db.select().from(reservations).where(eq(reservations.id, Number(req.params.id)));
    if (!existing) throw new HttpError(404, "reservation not found");
    if (!OPEN_STATUSES.includes(existing.status)) {
      throw new HttpError(409, `hold is already ${existing.status.toLowerCase()}`);
    }
    const [row] = await db
      .update(reservations)
      .set({ status: "Fulfilled" })
      .where(eq(reservations.id, Number(req.params.id)))
      .returning();
    res.json(row);
  }),
);

reservationsRouter.post(
  "/:id/cancel",
  ah(async (req, res) => {
    const [existing] = await db.select().from(reservations).where(eq(reservations.id, Number(req.params.id)));
    if (!existing) throw new HttpError(404, "reservation not found");
    if (!OPEN_STATUSES.includes(existing.status)) {
      throw new HttpError(409, `hold is already ${existing.status.toLowerCase()}`);
    }
    const [row] = await db
      .update(reservations)
      .set({ status: "Cancelled" })
      .where(eq(reservations.id, Number(req.params.id)))
      .returning();
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

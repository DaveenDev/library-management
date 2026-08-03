import { Router } from "express";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { books, loans } from "../db/schema.ts";
import { ah, HttpError, pageParams } from "../lib/http.ts";
import { bookCreateSchema, bookUpdateSchema, parseBody, parseId } from "../lib/validate.ts";

export const booksRouter = Router();

async function nextBarcode(): Promise<string> {
  const [row] = await db
    .select({ max: sql<string>`max(nullif(regexp_replace(${books.barcode}, '\\D', '', 'g'), ''))::int` })
    .from(books);
  const n = (Number(row?.max) || 0) + 1;
  return "LIB-" + String(n).padStart(6, "0");
}

// Accession numbers run as a plain ascending register (0001, 0002, …), which
// is how school libraries number copies as they enter the collection.
async function nextAccessionNo(): Promise<string> {
  const [row] = await db
    .select({ max: sql<string>`max(nullif(regexp_replace(${books.accessionNo}, '\\D', '', 'g'), ''))::int` })
    .from(books);
  const n = (Number(row?.max) || 0) + 1;
  return String(n).padStart(4, "0");
}

booksRouter.get(
  "/",
  ah(async (req, res) => {
    const { page, pageSize, offset } = pageParams(req);
    const q = String(req.query.q ?? "").trim();
    const subject = String(req.query.subject ?? "").trim();

    const conds = [];
    if (q) {
      conds.push(
        or(
          ilike(books.title, `%${q}%`),
          ilike(books.author, `%${q}%`),
          ilike(books.subject, `%${q}%`),
          ilike(books.barcode, `%${q}%`),
          ilike(books.accessionNo, `%${q}%`),
          ilike(books.isbn, `%${q}%`),
        ),
      );
    }
    if (subject && subject !== "All") conds.push(eq(books.subject, subject));
    const where = conds.length ? and(...conds) : undefined;

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(books)
      .where(where);
    const items = await db
      .select()
      .from(books)
      .where(where)
      .orderBy(asc(books.title))
      .limit(pageSize)
      .offset(offset);

    res.json({ items, total: count, page, pageSize });
  }),
);

booksRouter.post(
  "/",
  ah(async (req, res) => {
    const b = parseBody(bookCreateSchema, req.body);
    const barcode = b.barcode || (await nextBarcode());
    const accessionNo = b.accessionNo || (await nextAccessionNo());
    const [row] = await db
      .insert(books)
      .values({
        barcode,
        accessionNo,
        title: b.title,
        author: b.author,
        subject: b.subject,
        isbn: b.isbn,
        totalCopies: b.totalCopies,
        availableCopies: b.totalCopies,
        shelf: b.shelf,
        publicationYear: b.publicationYear ?? null,
        publisher: b.publisher,
        description: b.description,
      })
      .returning();
    res.status(201).json(row);
  }),
);

booksRouter.patch(
  "/:id",
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const b = parseBody(bookUpdateSchema, req.body);
    const [existing] = await db.select().from(books).where(eq(books.id, id));
    if (!existing) throw new HttpError(404, "book not found");

    const patch: Record<string, unknown> = {};
    for (const f of ["title", "author", "subject", "isbn", "shelf", "publisher", "description", "accessionNo"] as const) {
      if (b[f] !== undefined) patch[f] = b[f];
    }
    if (b.publicationYear !== undefined) patch.publicationYear = b.publicationYear ?? null;
    if (b.totalCopies !== undefined) {
      // Adjusting the total shifts availability by the same delta, so adding
      // two copies while three are on loan leaves those loans intact.
      const delta = b.totalCopies - existing.totalCopies;
      patch.totalCopies = b.totalCopies;
      patch.availableCopies = Math.max(0, Math.min(b.totalCopies, existing.availableCopies + delta));
    }
    const [row] = await db.update(books).set(patch).where(eq(books.id, id)).returning();
    res.json(row);
  }),
);

booksRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const [open] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loans)
      .where(and(eq(loans.bookId, id), sql`${loans.returnedAt} is null`));
    if (open.count > 0) throw new HttpError(409, "cannot delete a book with active loans");
    await db.delete(books).where(eq(books.id, id));
    res.status(204).end();
  }),
);

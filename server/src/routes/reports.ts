import { Router } from "express";
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { books, members, loans, fines } from "../db/schema.ts";
import { ah } from "../lib/http.ts";
import { getSettings } from "../lib/settings.ts";
import { computeFine } from "../lib/domain.ts";

export const reportsRouter = Router();

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

// GET /api/reports/:type?from=&to=
reportsRouter.get(
  "/:type",
  ah(async (req, res) => {
    const type = req.params.type;
    const cfg = await getSettings();
    const from = req.query.from ? new Date(String(req.query.from) + "T00:00:00") : new Date(0);
    const to = req.query.to ? new Date(String(req.query.to) + "T23:59:59") : new Date();
    const now = new Date();

    if (type === "overdue") {
      const rows = await db
        .select({
          book: books.title,
          borrower: members.name,
          dueAt: loans.dueAt,
        })
        .from(loans)
        .innerJoin(books, eq(loans.bookId, books.id))
        .innerJoin(members, eq(loans.memberId, members.id))
        .where(
          sql`${loans.returnedAt} is null and (now()::date - ${loans.dueAt}::date) > ${cfg.gracePeriodDays}`,
        )
        .orderBy(loans.dueAt);
      let total = 0;
      const items = rows.map((r) => {
        const { days, amount } = computeFine(new Date(r.dueAt), now, cfg);
        total += amount;
        return { book: r.book, borrower: r.borrower, due: fmtShort(new Date(r.dueAt)), days: `${days} days`, amount: `$${amount.toFixed(2)}` };
      });
      return res.json({ items, footer: `Total outstanding: $${total.toFixed(2)} across ${items.length} loans` });
    }

    if (type === "fines") {
      const rows = await db
        .select({
          borrower: members.name,
          book: sql<string>`coalesce(${books.title}, '—')`,
          days: fines.daysOverdue,
          status: fines.status,
          amount: sql<number>`${fines.amount}::float`,
        })
        .from(fines)
        .innerJoin(members, eq(fines.memberId, members.id))
        .leftJoin(books, eq(fines.bookId, books.id))
        .orderBy(desc(fines.createdAt));
      const items = rows.map((r) => ({
        borrower: r.borrower,
        book: r.book,
        days: r.days ? `${r.days} days` : "—",
        status: r.status,
        amount: `$${r.amount.toFixed(2)}`,
      }));
      const [{ unpaid, collected }] = await db
        .select({
          unpaid: sql<number>`coalesce(sum(${fines.amount}) filter (where ${fines.status}='Unpaid'),0)::float`,
          collected: sql<number>`coalesce(sum(${fines.amount}) filter (where ${fines.status}='Paid'),0)::float`,
        })
        .from(fines);
      return res.json({ items, footer: `Unpaid: $${unpaid.toFixed(2)} · Collected: $${collected.toFixed(2)}` });
    }

    if (type === "books") {
      const rows = await db.select().from(books).orderBy(asc(books.title));
      const items = rows.map((b) => ({
        barcode: b.barcode,
        title: b.title,
        author: b.author,
        subject: b.subject,
        shelf: b.shelf ?? "—",
        availText: `${b.availableCopies} / ${b.totalCopies}`,
      }));
      const [{ titles, copies }] = await db
        .select({
          titles: sql<number>`count(*)::int`,
          copies: sql<number>`coalesce(sum(${books.totalCopies}),0)::int`,
        })
        .from(books);
      return res.json({ items, footer: `${titles} titles · ${copies} copies in collection` });
    }

    if (type === "borrowed") {
      const rows = await db
        .select({ title: books.title, count: sql<number>`count(*)::int` })
        .from(loans)
        .innerJoin(books, eq(loans.bookId, books.id))
        .where(and(gte(loans.borrowedAt, from), lte(loans.borrowedAt, to)))
        .groupBy(books.title)
        .orderBy(desc(sql`count(*)`))
        .limit(20);
      let total = 0;
      const items = rows.map((r, i) => {
        total += r.count;
        return { rank: String(i + 1), title: r.title, count: String(r.count) };
      });
      return res.json({ items, footer: `${total} total loans in period` });
    }

    if (type === "inventory") {
      const [row] = await db
        .select({
          totalTitles: sql<number>`count(*)::int`,
          totalCopies: sql<number>`coalesce(sum(${books.totalCopies}),0)::int`,
          available: sql<number>`coalesce(sum(${books.availableCopies}),0)::int`,
        })
        .from(books);
      const [{ onLoan }] = await db
        .select({ onLoan: sql<number>`count(*)::int` })
        .from(loans)
        .where(isNull(loans.returnedAt));
      const items = [
        { category: "Total titles", count: String(row.totalTitles) },
        { category: "Total copies", count: String(row.totalCopies) },
        { category: "On loan", count: String(onLoan) },
        { category: "Available", count: String(row.available) },
      ];
      const pct = row.totalCopies ? ((row.available / row.totalCopies) * 100).toFixed(1) : "0";
      return res.json({ items, footer: `${pct}% of collection currently on shelf` });
    }

    if (type === "members") {
      const rows = await db
        .select({
          name: members.name,
          id: members.memberCode,
          loans: sql<number>`(select count(*)::int from loans where loans.member_id = members.id)`,
          overdue: sql<number>`(select count(*)::int from loans where loans.member_id = members.id and loans.returned_at is null and (now()::date - loans.due_at::date) > ${cfg.gracePeriodDays})`,
          fines: sql<number>`(select coalesce(sum(fines.amount),0)::float from fines where fines.member_id = members.id and fines.status='Unpaid')`,
        })
        .from(members)
        .orderBy(desc(sql`(select count(*) from loans where loans.member_id = members.id)`));
      const items = rows.map((r) => ({
        name: r.name,
        id: r.id,
        loans: String(r.loans),
        overdue: String(r.overdue),
        fines: `$${r.fines.toFixed(2)}`,
      }));
      return res.json({ items, footer: `${items.length} active borrowers in period` });
    }

    res.status(404).json({ error: "unknown report type" });
  }),
);

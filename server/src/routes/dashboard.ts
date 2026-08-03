import { Router } from "express";
import { desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { books, members, loans } from "../db/schema.ts";
import { ah } from "../lib/http.ts";
import { getSettings } from "../lib/settings.ts";
import type { ActivityItem, DashboardStats } from "@lumen/shared";

export const dashboardRouter = Router();

function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

dashboardRouter.get(
  "/",
  ah(async (_req, res) => {
    const cfg = await getSettings();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    const [tiles] = await db
      .select({
        totalTitles: sql<number>`(select count(*)::int from books)`,
        titlesThisMonth: sql<number>`(select count(*)::int from books where books.created_at >= ${monthStart}::timestamptz)`,
        copiesInStock: sql<number>`(select coalesce(sum(books.total_copies),0)::int from books)`,
        copiesAvailable: sql<number>`(select coalesce(sum(books.available_copies),0)::int from books)`,
        activeLoans: sql<number>`(select count(*)::int from loans where loans.returned_at is null)`,
        checkedOutToday: sql<number>`(select count(*)::int from loans where loans.borrowed_at >= ${dayStart}::timestamptz)`,
        finesOutstanding: sql<number>`(select coalesce(sum(fines.amount),0)::float from fines where fines.status = 'Unpaid')`,
        membersWithFines: sql<number>`(select count(distinct fines.member_id)::int from fines where fines.status = 'Unpaid')`,
      })
      .from(sql`(select 1) as _`);

    // overdue count (past grace) computed in SQL
    const [{ overdue }] = await db
      .select({
        overdue: sql<number>`count(*)::int`,
      })
      .from(loans)
      .where(
        sql`${loans.returnedAt} is null and (now()::date - ${loans.dueAt}::date) > ${cfg.gracePeriodDays}`,
      );

    // recent activity: latest loans (out & returned) + fines + reservations
    const recentLoans = await db
      .select({
        borrowedAt: loans.borrowedAt,
        returnedAt: loans.returnedAt,
        title: books.title,
        member: members.name,
      })
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(members, eq(loans.memberId, members.id))
      .orderBy(desc(sql`greatest(${loans.borrowedAt}, coalesce(${loans.returnedAt}, ${loans.borrowedAt}))`))
      .limit(6);

    // `at` is a sort key only — stripped before the response goes out.
    type ActivityEntry = ActivityItem & { at: number };

    const activity: ActivityEntry[] = recentLoans.map((r) =>
      r.returnedAt
        ? {
            kind: "neutral",
            text: `${r.title} returned by ${r.member}`,
            when: timeAgo(new Date(r.returnedAt)),
            at: new Date(r.returnedAt).getTime(),
          }
        : {
            kind: "good",
            text: `${r.member} borrowed ${r.title}`,
            when: timeAgo(new Date(r.borrowedAt)),
            at: new Date(r.borrowedAt).getTime(),
          },
    );
    activity.sort((a, b) => b.at - a.at);
    const recentActivity: ActivityItem[] = activity
      .slice(0, 5)
      .map(({ at: _at, ...rest }) => rest);

    // due soon: open loans ordered by due date
    const dueSoonRows = await db
      .select({ title: books.title, member: members.name, dueAt: loans.dueAt })
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .innerJoin(members, eq(loans.memberId, members.id))
      .where(isNull(loans.returnedAt))
      .orderBy(loans.dueAt)
      .limit(4);
    const dueSoon = dueSoonRows.map((r) => ({
      title: r.title,
      member: r.member,
      due: fmtShort(new Date(r.dueAt)),
    }));

    // most borrowed (all-time by loan count)
    const mostBorrowedRows = await db
      .select({ title: books.title, count: sql<number>`count(*)::int` })
      .from(loans)
      .innerJoin(books, eq(loans.bookId, books.id))
      .groupBy(books.title)
      .orderBy(desc(sql`count(*)`))
      .limit(5);

    const stats: DashboardStats = {
      totalTitles: tiles.totalTitles,
      titlesThisMonth: tiles.titlesThisMonth,
      copiesInStock: tiles.copiesInStock,
      copiesAvailable: tiles.copiesAvailable,
      activeLoans: tiles.activeLoans,
      checkedOutToday: tiles.checkedOutToday,
      overdue,
      finesOutstanding: tiles.finesOutstanding,
      membersWithFines: tiles.membersWithFines,
      recentActivity,
      dueSoon,
      mostBorrowed: mostBorrowedRows,
    };
    res.json(stats);
  }),
);

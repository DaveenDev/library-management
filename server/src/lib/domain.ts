import type { LoanStatus } from "@lumen/shared";

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

/** Whole days `b` is after `a` (0 if b <= a). */
export function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / MS_PER_DAY));
}

export interface FineConfig {
  dailyFineRate: number;
  gracePeriodDays: number;
  maxFineCap: number;
}

/** Overdue days beyond the grace period. */
export function overdueDays(dueAt: Date, now: Date, gracePeriodDays: number): number {
  const raw = daysBetween(dueAt, now);
  return Math.max(0, raw - gracePeriodDays);
}

/** Compute the fine owed for an overdue loan, capped at maxFineCap. */
export function computeFine(dueAt: Date, now: Date, cfg: FineConfig): { days: number; amount: number } {
  const days = overdueDays(dueAt, now, cfg.gracePeriodDays);
  const amount = Math.min(days * cfg.dailyFineRate, cfg.maxFineCap);
  return { days, amount: Math.round(amount * 100) / 100 };
}

/** Derive display status for an open/closed loan. */
export function loanStatus(
  dueAt: Date,
  returnedAt: Date | null,
  now: Date,
  gracePeriodDays: number,
): LoanStatus {
  if (returnedAt) return "Returned";
  const raw = daysBetween(dueAt, now);
  if (raw > gracePeriodDays) return "Overdue";
  // "Due soon" when within 3 days of the due date (before or after within grace).
  const msLeft = dueAt.getTime() - now.getTime();
  if (msLeft <= 3 * MS_PER_DAY) return "Due soon";
  return "Active";
}

export function daysLate(dueAt: Date, returnedAt: Date | null, now: Date): number {
  const end = returnedAt ?? now;
  return daysBetween(dueAt, end);
}

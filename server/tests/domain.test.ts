import { describe, expect, it } from "vitest";
import {
  computeFine,
  daysBetween,
  daysLate,
  loanStatus,
  overdueDays,
  MS_PER_DAY,
  type FineConfig,
} from "../src/lib/domain.ts";

const cfg: FineConfig = { dailyFineRate: 0.5, gracePeriodDays: 2, maxFineCap: 15 };

/** A date `days` away from `base` (negative = in the past). */
const shift = (base: Date, days: number) => new Date(base.getTime() + days * MS_PER_DAY);
const NOW = new Date("2026-08-03T12:00:00.000Z");

describe("daysBetween", () => {
  it("counts whole days forward", () => {
    expect(daysBetween(new Date("2026-08-01T00:00:00Z"), new Date("2026-08-04T00:00:00Z"))).toBe(3);
  });

  it("floors partial days rather than rounding up", () => {
    expect(daysBetween(new Date("2026-08-01T00:00:00Z"), new Date("2026-08-02T23:59:00Z"))).toBe(1);
  });

  it("never returns a negative span", () => {
    expect(daysBetween(new Date("2026-08-10T00:00:00Z"), new Date("2026-08-01T00:00:00Z"))).toBe(0);
  });
});

describe("overdueDays", () => {
  it("is zero before the due date", () => {
    expect(overdueDays(shift(NOW, 5), NOW, cfg.gracePeriodDays)).toBe(0);
  });

  it("is zero inside the grace period", () => {
    expect(overdueDays(shift(NOW, -2), NOW, cfg.gracePeriodDays)).toBe(0);
  });

  it("starts counting only past the grace period", () => {
    expect(overdueDays(shift(NOW, -3), NOW, cfg.gracePeriodDays)).toBe(1);
    expect(overdueDays(shift(NOW, -10), NOW, cfg.gracePeriodDays)).toBe(8);
  });
});

describe("computeFine", () => {
  it("charges nothing for an on-time return", () => {
    expect(computeFine(shift(NOW, 1), NOW, cfg)).toEqual({ days: 0, amount: 0 });
  });

  it("charges nothing while within the grace period", () => {
    expect(computeFine(shift(NOW, -2), NOW, cfg)).toEqual({ days: 0, amount: 0 });
  });

  it("charges the daily rate per day past grace", () => {
    // 10 days late, 2 forgiven => 8 chargeable days x 0.50
    expect(computeFine(shift(NOW, -10), NOW, cfg)).toEqual({ days: 8, amount: 4 });
  });

  it("caps the fine at maxFineCap no matter how late", () => {
    const result = computeFine(shift(NOW, -3650), NOW, cfg);
    expect(result.amount).toBe(cfg.maxFineCap);
  });

  it("rounds to whole cents rather than leaking float noise", () => {
    // 0.1 x 3 is 0.30000000000000004 in float arithmetic.
    const result = computeFine(shift(NOW, -5), NOW, {
      dailyFineRate: 0.1,
      gracePeriodDays: 2,
      maxFineCap: 100,
    });
    expect(result).toEqual({ days: 3, amount: 0.3 });
  });

  it("treats a zero rate as free", () => {
    expect(computeFine(shift(NOW, -30), NOW, { ...cfg, dailyFineRate: 0 }).amount).toBe(0);
  });

  it("honours a zero grace period", () => {
    expect(computeFine(shift(NOW, -1), NOW, { ...cfg, gracePeriodDays: 0 })).toEqual({
      days: 1,
      amount: 0.5,
    });
  });
});

describe("loanStatus", () => {
  it("reports Returned regardless of lateness once returned", () => {
    expect(loanStatus(shift(NOW, -30), shift(NOW, -1), NOW, cfg.gracePeriodDays)).toBe("Returned");
  });

  it("reports Active when comfortably before the due date", () => {
    expect(loanStatus(shift(NOW, 10), null, NOW, cfg.gracePeriodDays)).toBe("Active");
  });

  it("reports Due soon within three days of the due date", () => {
    expect(loanStatus(shift(NOW, 2), null, NOW, cfg.gracePeriodDays)).toBe("Due soon");
  });

  it("reports Overdue only past the grace period", () => {
    expect(loanStatus(shift(NOW, -2), null, NOW, cfg.gracePeriodDays)).toBe("Due soon");
    expect(loanStatus(shift(NOW, -3), null, NOW, cfg.gracePeriodDays)).toBe("Overdue");
  });
});

describe("daysLate", () => {
  it("measures to the return date for a closed loan", () => {
    expect(daysLate(shift(NOW, -10), shift(NOW, -4), NOW)).toBe(6);
  });

  it("measures to now for an open loan", () => {
    expect(daysLate(shift(NOW, -6), null, NOW)).toBe(6);
  });

  it("is zero for a loan returned early", () => {
    expect(daysLate(shift(NOW, 5), NOW, NOW)).toBe(0);
  });
});

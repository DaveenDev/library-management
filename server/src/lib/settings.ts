import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { settings } from "../db/schema.ts";
import type { Settings } from "@lumen/shared";

export async function getSettings(): Promise<Settings> {
  let row = (await db.select().from(settings).where(eq(settings.id, 1)))[0];
  if (!row) {
    [row] = await db.insert(settings).values({ id: 1 }).returning();
  }
  return {
    dailyFineRate: Number(row.dailyFineRate),
    gracePeriodDays: row.gracePeriodDays,
    maxFineCap: Number(row.maxFineCap),
    autoSuspendDays: row.autoSuspendDays,
    emailReminders: row.emailReminders,
    loanPeriodDays: row.loanPeriodDays,
    theme: row.theme,
    accent: row.accent,
  };
}

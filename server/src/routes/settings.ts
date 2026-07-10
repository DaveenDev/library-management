import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { settings, lookups } from "../db/schema.ts";
import { ah, HttpError } from "../lib/http.ts";
import { getSettings } from "../lib/settings.ts";
import type { LookupLists } from "@lumen/shared";

export const settingsRouter = Router();

const KINDS = ["shelf", "subject", "grade", "section"] as const;
type Kind = (typeof KINDS)[number];
const PLURAL: Record<Kind, keyof LookupLists> = {
  shelf: "shelves",
  subject: "subjects",
  grade: "grades",
  section: "sections",
};

async function loadLookups(): Promise<LookupLists> {
  const rows = await db.select().from(lookups).orderBy(asc(lookups.sort), asc(lookups.id));
  const out: LookupLists = { shelves: [], subjects: [], grades: [], sections: [] };
  for (const r of rows) {
    const key = PLURAL[r.kind as Kind];
    if (key) out[key].push(r.value);
  }
  return out;
}

settingsRouter.get(
  "/",
  ah(async (_req, res) => {
    const [cfg, lists] = await Promise.all([getSettings(), loadLookups()]);
    res.json({ ...cfg, lists });
  }),
);

settingsRouter.put(
  "/",
  ah(async (req, res) => {
    const b = req.body ?? {};
    const patch: Record<string, unknown> = {};
    if (b.dailyFineRate !== undefined) patch.dailyFineRate = Number(b.dailyFineRate).toFixed(2);
    if (b.gracePeriodDays !== undefined) patch.gracePeriodDays = Number(b.gracePeriodDays);
    if (b.maxFineCap !== undefined) patch.maxFineCap = Number(b.maxFineCap).toFixed(2);
    if (b.autoSuspendDays !== undefined) patch.autoSuspendDays = Number(b.autoSuspendDays);
    if (b.emailReminders !== undefined) patch.emailReminders = !!b.emailReminders;
    if (b.loanPeriodDays !== undefined) patch.loanPeriodDays = Number(b.loanPeriodDays);
    if (b.theme !== undefined) patch.theme = b.theme;
    if (b.accent !== undefined) patch.accent = b.accent;
    await db.update(settings).set(patch).where(eq(settings.id, 1));
    res.json(await getSettings());
  }),
);

// lookups: add/remove a chip in a list
settingsRouter.post(
  "/lookups/:kind",
  ah(async (req, res) => {
    const kind = req.params.kind as Kind;
    if (!KINDS.includes(kind)) throw new HttpError(400, "invalid list kind");
    const value = String(req.body?.value ?? "").trim();
    if (!value) throw new HttpError(400, "value is required");
    await db.insert(lookups).values({ kind, value, sort: 999 });
    res.status(201).json(await loadLookups());
  }),
);

settingsRouter.delete(
  "/lookups/:kind/:value",
  ah(async (req, res) => {
    const kind = req.params.kind as Kind;
    if (!KINDS.includes(kind)) throw new HttpError(400, "invalid list kind");
    await db
      .delete(lookups)
      .where(and(eq(lookups.kind, kind), eq(lookups.value, decodeURIComponent(req.params.value))));
    res.json(await loadLookups());
  }),
);

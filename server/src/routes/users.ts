import { Router } from "express";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { staffUsers } from "../db/schema.ts";
import { ah, HttpError, pageParams } from "../lib/http.ts";
import { parseBody, parseId, staffCreateSchema } from "../lib/validate.ts";

export const usersRouter = Router();

usersRouter.get(
  "/",
  ah(async (req, res) => {
    const { page, pageSize, offset } = pageParams(req);
    const q = String(req.query.q ?? "").trim();
    const where = q ? or(ilike(staffUsers.name, `%${q}%`), ilike(staffUsers.email, `%${q}%`)) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(staffUsers).where(where);
    const items = await db
      .select()
      .from(staffUsers)
      .where(where)
      .orderBy(asc(staffUsers.name))
      .limit(pageSize)
      .offset(offset);
    res.json({ items, total: count, page, pageSize });
  }),
);

usersRouter.post(
  "/",
  ah(async (req, res) => {
    const b = parseBody(staffCreateSchema, req.body);
    const [row] = await db
      .insert(staffUsers)
      .values({
        name: b.name,
        email: b.email,
        role: b.role,
        status: b.status,
        lastActiveAt: new Date(),
      })
      .returning();
    res.status(201).json(row);
  }),
);

usersRouter.patch(
  "/:id",
  ah(async (req, res) => {
    const b = parseBody(staffCreateSchema.partial(), req.body);
    const patch: Record<string, unknown> = {};
    for (const f of ["name", "email", "role", "status"] as const) if (b[f] !== undefined) patch[f] = b[f];
    const [row] = await db.update(staffUsers).set(patch).where(eq(staffUsers.id, parseId(req.params.id))).returning();
    if (!row) throw new HttpError(404, "user not found");
    res.json(row);
  }),
);

usersRouter.delete(
  "/:id",
  ah(async (req, res) => {
    await db.delete(staffUsers).where(eq(staffUsers.id, parseId(req.params.id)));
    res.status(204).end();
  }),
);

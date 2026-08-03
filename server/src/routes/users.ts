import { Router } from "express";
import { asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { staffUsers } from "../db/schema.ts";
import { ah, HttpError, pageParams } from "../lib/http.ts";
import { hashPassword } from "../lib/auth.ts";
import { parseBody, parseId, staffCreateSchema, staffUpdateSchema } from "../lib/validate.ts";

export const usersRouter = Router();

/**
 * `select()` with no argument returns every column, which now includes the
 * password hash. Listing the columns explicitly means a hash can never reach
 * the client by accident.
 */
const PUBLIC_COLUMNS = {
  id: staffUsers.id,
  name: staffUsers.name,
  email: staffUsers.email,
  role: staffUsers.role,
  status: staffUsers.status,
  lastActiveAt: staffUsers.lastActiveAt,
  createdAt: staffUsers.createdAt,
};

usersRouter.get(
  "/",
  ah(async (req, res) => {
    const { page, pageSize, offset } = pageParams(req);
    const q = String(req.query.q ?? "").trim();
    const where = q ? or(ilike(staffUsers.name, `%${q}%`), ilike(staffUsers.email, `%${q}%`)) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(staffUsers).where(where);
    const items = await db
      .select(PUBLIC_COLUMNS)
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
        // An account created without one has a null hash and cannot sign in
        // until an Admin sets a password.
        passwordHash: b.password ? await hashPassword(b.password) : null,
        role: b.role,
        status: b.status,
        lastActiveAt: null,
      })
      .returning(PUBLIC_COLUMNS);
    res.status(201).json(row);
  }),
);

usersRouter.patch(
  "/:id",
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    const b = parseBody(staffUpdateSchema, req.body);
    const patch: Record<string, unknown> = {};
    for (const f of ["name", "email", "role", "status"] as const)
      if (b[f] !== undefined) patch[f] = b[f];
    if (b.password !== undefined) patch.passwordHash = await hashPassword(b.password);

    // Demoting or disabling yourself would leave the library with one fewer
    // admin than the person doing it expects — and possibly none at all.
    if (id === req.user!.id && (b.role !== undefined || b.status !== undefined)) {
      throw new HttpError(409, "you cannot change your own role or status");
    }

    const [row] = await db
      .update(staffUsers)
      .set(patch)
      .where(eq(staffUsers.id, id))
      .returning(PUBLIC_COLUMNS);
    if (!row) throw new HttpError(404, "user not found");
    res.json(row);
  }),
);

usersRouter.delete(
  "/:id",
  ah(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === req.user!.id) {
      throw new HttpError(409, "you cannot remove your own account");
    }
    await db.delete(staffUsers).where(eq(staffUsers.id, id));
    res.status(204).end();
  }),
);

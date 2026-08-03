import { Router } from "express";
import { eq } from "drizzle-orm";
import { ROLE_PERMISSIONS, type Session } from "@lumen/shared";
import { db } from "../db/index.ts";
import { staffUsers } from "../db/schema.ts";
import { ah, HttpError } from "../lib/http.ts";
import {
  SESSION_COOKIE,
  hashPassword,
  requireAuth,
  sessionCookieOptions,
  signSession,
  toAuthUser,
  verifyPassword,
} from "../lib/auth.ts";
import { loginSchema, parseBody } from "../lib/validate.ts";

export const authRouter = Router();

const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Fixed-window throttle keyed by email + client IP.
 *
 * Without it, a login endpoint is an offline password cracker with unlimited
 * guesses. In-memory state is enough for the single-process deployment this
 * app targets; more than one instance would need a shared store.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

function attemptKey(email: string, ip: string): string {
  return `${email}|${ip}`;
}

function throttled(key: string): boolean {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordFailure(key: string): void {
  const entry = attempts.get(key);
  if (!entry || Date.now() > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: Date.now() + ATTEMPT_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/**
 * A wrong email and a wrong password must cost the same amount of time, or the
 * difference tells an attacker which staff addresses are real. Verifying
 * against a throwaway hash keeps the unknown-email path just as slow.
 */
let decoyHash: Promise<string> | undefined;
function decoy(): Promise<string> {
  decoyHash ??= hashPassword(randomFiller());
  return decoyHash;
}
function randomFiller(): string {
  return `no-such-account-${Math.random()}`;
}

/** Exposed for tests, which need a clean slate between cases. */
export function resetLoginThrottle(): void {
  attempts.clear();
}

authRouter.post(
  "/login",
  ah(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const email = body.email.toLowerCase();
    const key = attemptKey(email, req.ip ?? "unknown");

    if (throttled(key)) {
      throw new HttpError(429, "too many sign-in attempts — try again in a few minutes");
    }

    const [row] = await db.select().from(staffUsers).where(eq(staffUsers.email, email));

    const ok = row
      ? await verifyPassword(body.password, row.passwordHash)
      : await verifyPassword(body.password, await decoy());

    if (!row || !ok) {
      recordFailure(key);
      throw new HttpError(401, "incorrect email or password");
    }

    // Checked only after the password is proven, so a disabled account is not
    // a way to discover which addresses exist.
    if (row.status !== "Active") {
      throw new HttpError(403, "this account has been disabled");
    }

    attempts.delete(key);
    await db.update(staffUsers).set({ lastActiveAt: new Date() }).where(eq(staffUsers.id, row.id));

    const user = toAuthUser(row);
    res.cookie(SESSION_COOKIE, signSession(row.id, user.role), sessionCookieOptions());
    res.json({ user, permissions: [...ROLE_PERMISSIONS[user.role]] } satisfies Session);
  }),
);

authRouter.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: undefined });
  res.status(204).end();
});

/** Lets a reloaded client discover whether its cookie is still good. */
authRouter.get("/me", requireAuth, (req, res) => {
  const user = req.user!;
  res.json({ user, permissions: [...ROLE_PERMISSIONS[user.role]] } satisfies Session);
});

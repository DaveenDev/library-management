import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { CookieOptions, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import type { AuthUser, Permission, StaffRole } from "@lumen/shared";
import { roleCan } from "@lumen/shared";
import { db } from "../db/index.ts";
import { staffUsers } from "../db/schema.ts";
import { HttpError } from "./http.ts";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE = "lumen_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const SCRYPT_KEYLEN = 64;

// Express' Request has no `user`; declaring it here means every route can read
// `req.user` with the right type instead of casting at each call site.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

let cachedSecret: string | undefined;

/**
 * The HMAC key that signs session tokens.
 *
 * A missing secret in production is fatal rather than silently defaulted — a
 * predictable key would let anyone mint an Admin session. Outside production
 * a random per-process key is generated instead, so sessions simply do not
 * survive a server restart, which is a visible nudge to configure one.
 */
function sessionSecret(): string {
  if (cachedSecret) return cachedSecret;
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) {
    cachedSecret = configured;
  } else if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set in production. See server/.env");
  } else {
    cachedSecret = randomBytes(32).toString("hex");
  }
  return cachedSecret;
}

// ---------- Passwords ----------

/**
 * Hash a password with scrypt, storing the salt alongside the digest.
 *
 * scrypt is deliberately slow and memory-hard, so a leaked table of hashes is
 * not a leaked table of passwords. It ships with Node, which keeps this free
 * of a native build step.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(plain, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(plain: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, salt, digest] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const expected = Buffer.from(digest, "hex");
  const derived = await scrypt(plain, salt, expected.length);
  // Length-equal buffers are required by timingSafeEqual, and a byte-by-byte
  // comparison would leak how much of the digest matched.
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

// ---------- Session tokens ----------

interface SessionClaims {
  sub: string;
  role: StaffRole;
}

export function signSession(userId: number, role: StaffRole): string {
  const claims: SessionClaims = { sub: String(userId), role };
  return jwt.sign(claims, sessionSecret(), { expiresIn: SESSION_TTL_SECONDS });
}

function readSession(token: string): SessionClaims | null {
  try {
    return jwt.verify(token, sessionSecret()) as SessionClaims;
  } catch {
    // Expired, tampered with, or signed by a previous process' random key.
    return null;
  }
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    // Script-readable tokens are stealable by any XSS; the cookie is not.
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

export function toAuthUser(row: {
  id: number;
  name: string;
  email: string;
  role: string;
}): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as StaffRole,
    initials: initialsOf(row.name),
  };
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

// ---------- Middleware ----------

/**
 * Reject anything without a valid session.
 *
 * The account is re-read on every request rather than trusted from the token,
 * so disabling or deleting a staff member takes effect immediately instead of
 * whenever their token happens to expire.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) {
    next(new HttpError(401, "sign in to continue"));
    return;
  }
  const claims = readSession(token);
  if (!claims) {
    next(new HttpError(401, "your session has expired"));
    return;
  }

  db.select()
    .from(staffUsers)
    .where(eq(staffUsers.id, Number(claims.sub)))
    .then(([row]) => {
      if (!row || row.status !== "Active") {
        next(new HttpError(401, "your account is no longer active"));
        return;
      }
      req.user = toAuthUser(row);
      next();
    })
    .catch(next);
};

/** Gate a request on the signed-in account's role. Runs after `requireAuth`. */
export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      next(new HttpError(401, "sign in to continue"));
      return;
    }
    if (!roleCan(user.role, permission)) {
      next(new HttpError(403, `your role (${user.role}) cannot perform this action`));
      return;
    }
    next();
  };
}

/**
 * Any signed-in account may read; changing anything needs the permission.
 *
 * Applied where a router is mounted rather than route by route, so a mutation
 * added to an existing router later is covered automatically instead of
 * shipping unguarded because someone forgot a line.
 */
export function writesRequire(permission: Permission): RequestHandler {
  const guard = requirePermission(permission);
  return (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      next();
      return;
    }
    guard(req, res, next);
  };
}

import request from "supertest";
import type { Express } from "express";
import type { StaffRole } from "@lumen/shared";
import { SESSION_COOKIE, signSession } from "../../src/lib/auth.ts";
import { makeStaff, SESSION_USER_ID } from "./fixtures.ts";

export function sessionCookie(userId: number, role: StaffRole): string {
  return `${SESSION_COOKIE}=${signSession(userId, role)}`;
}

/**
 * A supertest agent that carries an Admin session on every request.
 *
 * Built once per test file rather than per test: the account it points at is
 * re-created by `resetDb`, so the cookie stays valid across the whole file.
 */
export function asAdmin(app: Express) {
  return request.agent(app).set("Cookie", sessionCookie(SESSION_USER_ID, "Admin"));
}

/**
 * Create a staff account with `role` and return an agent signed in as it.
 *
 * The role that actually decides a request comes from the database row, not
 * the cookie, so a role test needs a matching account to exist.
 */
export async function asRole(app: Express, role: StaffRole) {
  const staff = await makeStaff({ role });
  return request.agent(app).set("Cookie", sessionCookie(staff.id, role));
}

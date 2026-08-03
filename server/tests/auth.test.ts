import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.ts";
import { db, queryClient } from "../src/db/index.ts";
import { staffUsers } from "../src/db/schema.ts";
import { hashPassword, SESSION_COOKIE } from "../src/lib/auth.ts";
import { resetLoginThrottle } from "../src/routes/auth.ts";
import { makeBook, makeMember, makeStaff, resetDb } from "./helpers/fixtures.ts";
import { asAdmin, asRole } from "./helpers/auth.ts";

const app = createApp();
const agent = asAdmin(app);

const PASSWORD = "correct-horse-battery";

beforeEach(async () => {
  await resetDb();
  resetLoginThrottle();
});
afterAll(async () => {
  await queryClient.end();
});

/** A staff account that can actually sign in. */
async function makeSignInUser(overrides: Partial<typeof staffUsers.$inferInsert> = {}) {
  return makeStaff({ passwordHash: await hashPassword(PASSWORD), ...overrides });
}

describe("POST /api/auth/login", () => {
  it("sets an httpOnly session cookie and returns the account with its permissions", async () => {
    const staff = await makeSignInUser({ role: "Librarian", name: "Elena Rossi" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: staff.email, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: staff.id, role: "Librarian", initials: "ER" });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.permissions).toContain("catalog:write");
    expect(res.body.permissions).not.toContain("users:manage");

    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("accepts the address in any case", async () => {
    const staff = await makeSignInUser({ email: "mixed.case@lumenlibrary.org" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "Mixed.Case@LumenLibrary.ORG", password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(staff.id);
  });

  it("rejects a wrong password", async () => {
    const staff = await makeSignInUser();

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: staff.email, password: "not-the-password" });

    expect(res.status).toBe(401);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("gives an unknown address the same answer as a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@lumenlibrary.org", password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("incorrect email or password");
  });

  it("refuses an account with no password set", async () => {
    const staff = await makeStaff({ passwordHash: null });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: staff.email, password: PASSWORD });

    expect(res.status).toBe(401);
  });

  it("refuses a disabled account even with the right password", async () => {
    const staff = await makeSignInUser({ status: "Disabled" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: staff.email, password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/disabled/i);
  });

  it("records the sign-in time", async () => {
    const staff = await makeSignInUser({ lastActiveAt: null });

    await request(app).post("/api/auth/login").send({ email: staff.email, password: PASSWORD });

    const [after] = await db.select().from(staffUsers).where(eq(staffUsers.id, staff.id));
    expect(after.lastActiveAt).not.toBeNull();
  });

  it("throttles repeated failures for the same address", async () => {
    const staff = await makeSignInUser();
    const wrong = { email: staff.email, password: "wrong" };

    for (let i = 0; i < 8; i++) {
      expect((await request(app).post("/api/auth/login").send(wrong)).status).toBe(401);
    }

    const blocked = await request(app).post("/api/auth/login").send(wrong);
    expect(blocked.status).toBe(429);

    // The correct password is refused too — otherwise the throttle would be
    // trivially bypassed by whoever eventually guesses it.
    const right = await request(app)
      .post("/api/auth/login")
      .send({ email: staff.email, password: PASSWORD });
    expect(right.status).toBe(429);
  });
});

describe("session lifecycle", () => {
  it("keeps a cookie from login working on other routes", async () => {
    const staff = await makeSignInUser({ role: "Librarian" });
    const session = request.agent(app);

    await session.post("/api/auth/login").send({ email: staff.email, password: PASSWORD });

    const me = await session.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(staff.id);
    expect((await session.get("/api/books")).status).toBe(200);
  });

  it("logs out by clearing the cookie", async () => {
    const staff = await makeSignInUser();
    const session = request.agent(app);
    await session.post("/api/auth/login").send({ email: staff.email, password: PASSWORD });

    expect((await session.post("/api/auth/logout")).status).toBe(204);
    expect((await session.get("/api/auth/me")).status).toBe(401);
  });

  it("stops honouring a session once the account is disabled", async () => {
    const staff = await makeSignInUser();
    const session = request.agent(app);
    await session.post("/api/auth/login").send({ email: staff.email, password: PASSWORD });
    expect((await session.get("/api/books")).status).toBe(200);

    await db.update(staffUsers).set({ status: "Disabled" }).where(eq(staffUsers.id, staff.id));

    // The token is still cryptographically valid; the account behind it is not.
    expect((await session.get("/api/books")).status).toBe(401);
  });

  it("rejects a tampered cookie", async () => {
    const res = await request(app).get("/api/books").set("Cookie", `${SESSION_COOKIE}=not.a.token`);
    expect(res.status).toBe(401);
  });
});

describe("unauthenticated requests", () => {
  it("401s on every data route", async () => {
    for (const path of [
      "/api/books",
      "/api/members",
      "/api/loans",
      "/api/reservations",
      "/api/fines",
      "/api/users",
      "/api/settings",
      "/api/dashboard",
      "/api/reports/inventory",
    ]) {
      expect((await request(app).get(path)).status, path).toBe(401);
    }
  });

  it("401s on mutations rather than falling through to validation", async () => {
    const res = await request(app).post("/api/books").send({ title: "T", author: "A" });
    expect(res.status).toBe(401);
  });

  it("leaves the health check open, so a load balancer needs no credentials", async () => {
    expect((await request(app).get("/api/health")).status).toBe(200);
  });
});

describe("role gating", () => {
  it("lets an Assistant circulate but not catalogue", async () => {
    const assistant = await asRole(app, "Assistant");
    const book = await makeBook({ totalCopies: 1, availableCopies: 1 });
    const member = await makeMember();

    const checkout = await assistant
      .post("/api/loans/checkout")
      .send({ bookBarcode: book.barcode, memberCode: member.memberCode });
    expect(checkout.status).toBe(201);

    const create = await assistant.post("/api/books").send({ title: "T", author: "A" });
    expect(create.status).toBe(403);
    expect(create.body.error).toMatch(/Assistant/);

    const edit = await assistant.patch(`/api/books/${book.id}`).send({ title: "Renamed" });
    expect(edit.status).toBe(403);

    const remove = await assistant.delete(`/api/members/${member.id}`);
    expect(remove.status).toBe(403);
  });

  it("still lets every role read", async () => {
    const assistant = await asRole(app, "Assistant");
    await makeBook();

    expect((await assistant.get("/api/books")).status).toBe(200);
    expect((await assistant.get("/api/members")).status).toBe(200);
    expect((await assistant.get("/api/reports/inventory")).status).toBe(200);
  });

  it("lets a Librarian catalogue and collect fines but not manage staff", async () => {
    const librarian = await asRole(app, "Librarian");

    expect((await librarian.post("/api/books").send({ title: "T", author: "A" })).status).toBe(201);
    expect((await librarian.get("/api/users")).status).toBe(403);
    expect(
      (await librarian.post("/api/users").send({ name: "N", email: "n@lumenlibrary.org" })).status,
    ).toBe(403);
  });

  it("keeps library policy to Admins while leaving appearance to everyone", async () => {
    const librarian = await asRole(app, "Librarian");

    const policy = await librarian.put("/api/settings").send({ dailyFineRate: 5 });
    expect(policy.status).toBe(403);

    // The topbar theme picker writes through this same route, so it must work
    // for a non-Admin.
    const appearance = await librarian.put("/api/settings").send({ theme: "sage" });
    expect(appearance.status).toBe(200);
    expect(appearance.body.theme).toBe("sage");

    const list = await librarian.post("/api/settings/lookups/subject").send({ value: "Poetry" });
    expect(list.status).toBe(403);

    expect((await agent.put("/api/settings").send({ dailyFineRate: 5 })).status).toBe(200);
  });

  it("lets an Admin manage staff", async () => {
    const res = await agent
      .post("/api/users")
      .send({ name: "New Person", email: "new@lumenlibrary.org", role: "Assistant" });
    expect(res.status).toBe(201);
  });
});

describe("staff account management", () => {
  it("never returns a password hash", async () => {
    await makeSignInUser();

    const created = await agent
      .post("/api/users")
      .send({ name: "P", email: "p@lumenlibrary.org", password: "a-long-enough-password" });
    expect(created.body.passwordHash).toBeUndefined();

    const list = await agent.get("/api/users");
    for (const row of list.body.items) {
      expect(row.passwordHash).toBeUndefined();
    }
  });

  it("stores a password as a hash, not as the password", async () => {
    const res = await agent
      .post("/api/users")
      .send({ name: "P", email: "hashme@lumenlibrary.org", password: "a-long-enough-password" });

    const [row] = await db.select().from(staffUsers).where(eq(staffUsers.id, res.body.id));
    expect(row.passwordHash).toMatch(/^scrypt\$/);
    expect(row.passwordHash).not.toContain("a-long-enough-password");
  });

  it("rejects a password too short to be worth hashing", async () => {
    const res = await agent
      .post("/api/users")
      .send({ name: "P", email: "short@lumenlibrary.org", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 10/);
  });

  it("lets an Admin set a password that then works for sign-in", async () => {
    const staff = await makeStaff({ passwordHash: null });

    await agent.patch(`/api/users/${staff.id}`).send({ password: "issued-by-an-admin" });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: staff.email, password: "issued-by-an-admin" });
    expect(res.status).toBe(200);
  });

  it("stops an Admin locking themselves out", async () => {
    const self = await agent.patch("/api/users/1").send({ role: "Assistant" });
    expect(self.status).toBe(409);

    const disable = await agent.patch("/api/users/1").send({ status: "Disabled" });
    expect(disable.status).toBe(409);

    const remove = await agent.delete("/api/users/1");
    expect(remove.status).toBe(409);

    // Renaming yourself is still fine — it is not a way to lose access.
    expect((await agent.patch("/api/users/1").send({ name: "Renamed" })).status).toBe(200);
  });
});

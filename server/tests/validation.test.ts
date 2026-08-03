import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.ts";
import { queryClient } from "../src/db/index.ts";
import { makeBook, makeMember, resetDb } from "./helpers/fixtures.ts";
import { asAdmin } from "./helpers/auth.ts";

const app = createApp();
const agent = asAdmin(app);

beforeEach(resetDb);
afterAll(async () => {
  await queryClient.end();
});

describe("route param validation", () => {
  it.each([
    ["/api/books/abc", "patch"],
    ["/api/members/abc", "patch"],
  ])("400s on a non-numeric id: %s", async (path, method) => {
    const res = await (method === "patch"
      ? agent.patch(path).send({ title: "x", name: "x" })
      : agent.get(path));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid id/i);
  });

  it("400s rather than silently returning nothing for NaN ids", async () => {
    // Number("abc") is NaN, which previously produced `WHERE id = NULL` and an
    // empty result set instead of an error.
    const res = await agent.get("/api/members/abc/history");
    expect(res.status).toBe(400);
  });

  it("400s on a negative id", async () => {
    expect((await agent.post("/api/loans/-1/renew")).status).toBe(400);
  });
});

describe("body validation", () => {
  it("rejects a book with no title or author", async () => {
    const res = await agent.post("/api/books").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/i);
  });

  it("rejects a non-positive copy count", async () => {
    const res = await agent
      .post("/api/books")
      .send({ title: "T", author: "A", totalCopies: 0 });
    expect(res.status).toBe(400);
  });

  it("coerces numeric strings from form-style clients", async () => {
    const res = await agent
      .post("/api/books")
      .send({ title: "T", author: "A", totalCopies: "3" });
    expect(res.status).toBe(201);
    expect(res.body.totalCopies).toBe(3);
  });

  it("trims surrounding whitespace", async () => {
    const res = await agent
      .post("/api/books")
      .send({ title: "  Spaced  ", author: "  Author  " });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe("Spaced");
    expect(res.body.author).toBe("Author");
  });

  it("rejects an invalid staff email", async () => {
    const res = await agent.post("/api/users").send({ name: "N", email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it("rejects out-of-range settings", async () => {
    expect((await agent.put("/api/settings").send({ loanPeriodDays: 0 })).status).toBe(400);
    expect((await agent.put("/api/settings").send({ gracePeriodDays: -1 })).status).toBe(400);
  });

  it("rejects an empty lookup value", async () => {
    expect((await agent.post("/api/settings/lookups/subject").send({ value: "   " })).status).toBe(400);
  });

  it("rejects an unknown lookup kind", async () => {
    expect((await agent.post("/api/settings/lookups/nope").send({ value: "x" })).status).toBe(400);
  });
});

describe("constraint errors surface as 4xx, not 500", () => {
  it("returns 409 for a duplicate barcode", async () => {
    const existing = await makeBook();
    const res = await agent
      .post("/api/books")
      .send({ title: "Other", author: "A", barcode: existing.barcode });
    expect(res.status).toBe(409);
  });

  it("returns 409 for a duplicate staff email", async () => {
    const body = { name: "A", email: "dupe@example.org" };
    expect((await agent.post("/api/users").send(body)).status).toBe(201);
    expect((await agent.post("/api/users").send(body)).status).toBe(409);
  });
});

describe("delete guards", () => {
  it("refuses to delete a book that is on loan", async () => {
    const book = await makeBook({ totalCopies: 1, availableCopies: 1 });
    const member = await makeMember();
    await agent
      .post("/api/loans/checkout")
      .send({ bookId: book.id, memberId: member.id });

    const res = await agent.delete(`/api/books/${book.id}`);
    expect(res.status).toBe(409);
  });

  it("refuses to delete a member with an open loan", async () => {
    const book = await makeBook({ totalCopies: 1, availableCopies: 1 });
    const member = await makeMember();
    await agent
      .post("/api/loans/checkout")
      .send({ bookId: book.id, memberId: member.id });

    const res = await agent.delete(`/api/members/${member.id}`);
    expect(res.status).toBe(409);
  });
});

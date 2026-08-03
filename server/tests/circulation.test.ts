import { afterAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.ts";
import { db, queryClient } from "../src/db/index.ts";
import { books, loans, fines } from "../src/db/schema.ts";
import { makeBook, makeLoan, makeMember, resetDb } from "./helpers/fixtures.ts";

const app = createApp();

beforeEach(resetDb);
afterAll(async () => {
  await queryClient.end();
});

describe("POST /api/loans/checkout", () => {
  it("issues a loan and decrements availability", async () => {
    const book = await makeBook({ totalCopies: 2, availableCopies: 2 });
    const member = await makeMember();

    const res = await request(app)
      .post("/api/loans/checkout")
      .send({ bookBarcode: book.barcode, memberCode: member.memberCode });

    expect(res.status).toBe(201);
    expect(res.body.bookTitle).toBe(book.title);

    const [after] = await db.select().from(books).where(eq(books.id, book.id));
    expect(after.availableCopies).toBe(1);
  });

  it("refuses when no copies are left", async () => {
    const book = await makeBook({ totalCopies: 1, availableCopies: 0 });
    const member = await makeMember();

    const res = await request(app)
      .post("/api/loans/checkout")
      .send({ bookBarcode: book.barcode, memberCode: member.memberCode });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/no copies available/i);
  });

  it("refuses a suspended member", async () => {
    const book = await makeBook();
    const member = await makeMember({ status: "Suspended" });

    const res = await request(app)
      .post("/api/loans/checkout")
      .send({ bookBarcode: book.barcode, memberCode: member.memberCode });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/suspended/i);
  });

  it("404s on an unknown barcode or member code", async () => {
    const member = await makeMember();
    const book = await makeBook();

    const noBook = await request(app)
      .post("/api/loans/checkout")
      .send({ bookBarcode: "LIB-NOPE", memberCode: member.memberCode });
    expect(noBook.status).toBe(404);

    const noMember = await request(app)
      .post("/api/loans/checkout")
      .send({ bookBarcode: book.barcode, memberCode: "S-NOPE" });
    expect(noMember.status).toBe(404);
  });

  it("rejects a body with neither id nor code", async () => {
    const res = await request(app).post("/api/loans/checkout").send({});
    expect(res.status).toBe(400);
  });

  // Regression: concurrent checkouts used to read availableCopies, all pass the
  // check, then each write availableCopies - 1, oversubscribing the book.
  it("never issues more concurrent loans than there are copies", async () => {
    const COPIES = 3;
    const ATTEMPTS = 15;
    const book = await makeBook({ totalCopies: COPIES, availableCopies: COPIES });
    const member = await makeMember();

    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, () =>
        request(app)
          .post("/api/loans/checkout")
          .send({ bookBarcode: book.barcode, memberCode: member.memberCode }),
      ),
    );

    const created = results.filter((r) => r.status === 201).length;
    const rejected = results.filter((r) => r.status === 409).length;
    expect(created).toBe(COPIES);
    expect(rejected).toBe(ATTEMPTS - COPIES);

    const [after] = await db.select().from(books).where(eq(books.id, book.id));
    expect(after.availableCopies).toBe(0);

    const open = await db.select().from(loans).where(eq(loans.bookId, book.id));
    expect(open).toHaveLength(COPIES);
  });
});

describe("POST /api/loans/:id/return", () => {
  it("restocks the copy and raises no fine when on time", async () => {
    const book = await makeBook({ totalCopies: 1, availableCopies: 0 });
    const member = await makeMember();
    const loan = await makeLoan(book.id, member.id, 7);

    const res = await request(app).post(`/api/loans/${loan.id}/return`);
    expect(res.status).toBe(200);
    expect(res.body.amount).toBe(0);

    const [after] = await db.select().from(books).where(eq(books.id, book.id));
    expect(after.availableCopies).toBe(1);
    expect(await db.select().from(fines)).toHaveLength(0);
  });

  it("raises a fine for an overdue return", async () => {
    const book = await makeBook({ totalCopies: 1, availableCopies: 0 });
    const member = await makeMember();
    // 10 days overdue, default 2-day grace, 0.50/day => 8 x 0.50 = 4.00
    const loan = await makeLoan(book.id, member.id, -10);

    const res = await request(app).post(`/api/loans/${loan.id}/return`);
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(8);
    expect(res.body.amount).toBe(4);

    const raised = await db.select().from(fines);
    expect(raised).toHaveLength(1);
    expect(Number(raised[0].amount)).toBe(4);
  });

  // Regression: a double return used to restock twice and raise two fines.
  it("only lets one concurrent return succeed", async () => {
    const book = await makeBook({ totalCopies: 1, availableCopies: 0 });
    const member = await makeMember();
    const loan = await makeLoan(book.id, member.id, -10);

    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post(`/api/loans/${loan.id}/return`)),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);

    const [after] = await db.select().from(books).where(eq(books.id, book.id));
    expect(after.availableCopies).toBe(1);
    expect(await db.select().from(fines)).toHaveLength(1);
  });

  it("never restocks beyond the number of copies owned", async () => {
    const book = await makeBook({ totalCopies: 1, availableCopies: 1 });
    const member = await makeMember();
    const loan = await makeLoan(book.id, member.id, 5);

    await request(app).post(`/api/loans/${loan.id}/return`);

    const [after] = await db.select().from(books).where(eq(books.id, book.id));
    expect(after.availableCopies).toBe(1);
  });
});

describe("POST /api/loans/:id/renew", () => {
  it("extends the due date by the loan period", async () => {
    const book = await makeBook({ availableCopies: 0 });
    const member = await makeMember();
    const loan = await makeLoan(book.id, member.id, 3);

    const res = await request(app).post(`/api/loans/${loan.id}/renew`);
    expect(res.status).toBe(200);
    expect(new Date(res.body.dueAt).getTime()).toBeGreaterThan(new Date(loan.dueAt).getTime());
  });

  it("refuses to renew a loan that was already returned", async () => {
    const book = await makeBook({ availableCopies: 0 });
    const member = await makeMember();
    const loan = await makeLoan(book.id, member.id, 3);
    await request(app).post(`/api/loans/${loan.id}/return`);

    const res = await request(app).post(`/api/loans/${loan.id}/renew`);
    expect(res.status).toBe(409);
  });

  it("400s on a non-numeric id", async () => {
    const res = await request(app).post("/api/loans/abc/renew");
    expect(res.status).toBe(400);
  });
});

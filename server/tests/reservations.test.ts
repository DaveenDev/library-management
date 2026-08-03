import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApp } from "../src/app.ts";
import { db, queryClient } from "../src/db/index.ts";
import { reservations } from "../src/db/schema.ts";
import { makeBook, makeMember, resetDb } from "./helpers/fixtures.ts";
import { asAdmin } from "./helpers/auth.ts";

const app = createApp();
const agent = asAdmin(app);

beforeEach(resetDb);
afterAll(async () => {
  await queryClient.end();
});

describe("POST /api/reservations", () => {
  it("marks a hold ready when a copy is on the shelf", async () => {
    const book = await makeBook({ totalCopies: 2, availableCopies: 2 });
    const member = await makeMember();

    const res = await agent
      .post("/api/reservations")
      .send({ bookId: book.id, memberCode: member.memberCode });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Ready for pickup");
    expect(res.body.queuePosition).toBe(1);
  });

  it("queues a hold when every copy is out", async () => {
    const book = await makeBook({ totalCopies: 1, availableCopies: 0 });
    const member = await makeMember();

    const res = await agent
      .post("/api/reservations")
      .send({ bookId: book.id, memberCode: member.memberCode });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("Waiting");
  });

  it("rejects a duplicate open hold from the same member", async () => {
    const book = await makeBook({ availableCopies: 0 });
    const member = await makeMember();
    const body = { bookId: book.id, memberCode: member.memberCode };

    expect((await agent.post("/api/reservations").send(body)).status).toBe(201);
    const second = await agent.post("/api/reservations").send(body);
    expect(second.status).toBe(409);
    expect(second.body.error).toMatch(/already has a hold/i);
  });

  it("lets the same member re-hold after cancelling", async () => {
    const book = await makeBook({ availableCopies: 0 });
    const member = await makeMember();
    const body = { bookId: book.id, memberCode: member.memberCode };

    const first = await agent.post("/api/reservations").send(body);
    await agent.post(`/api/reservations/${first.body.id}/cancel`);

    const again = await agent.post("/api/reservations").send(body);
    expect(again.status).toBe(201);
  });

  // Regression: cancelled/fulfilled holds used to count toward the queue, so
  // positions crept upward forever.
  it("does not count resolved holds toward queue position", async () => {
    const book = await makeBook({ availableCopies: 0 });
    const a = await makeMember();
    const b = await makeMember();

    const first = await agent
      .post("/api/reservations")
      .send({ bookId: book.id, memberCode: a.memberCode });
    await agent.post(`/api/reservations/${first.body.id}/cancel`);

    const second = await agent
      .post("/api/reservations")
      .send({ bookId: book.id, memberCode: b.memberCode });

    expect(second.body.queuePosition).toBe(1);
  });

  it("refuses a suspended member", async () => {
    const book = await makeBook({ availableCopies: 0 });
    const member = await makeMember({ status: "Suspended" });

    const res = await agent
      .post("/api/reservations")
      .send({ bookId: book.id, memberCode: member.memberCode });

    expect(res.status).toBe(409);
  });

  // Regression: concurrent holds could share a queue position and slip past
  // the duplicate check.
  it("assigns distinct queue positions under concurrency", async () => {
    const book = await makeBook({ availableCopies: 0 });
    const people = await Promise.all([makeMember(), makeMember(), makeMember(), makeMember()]);

    const results = await Promise.all(
      people.map((m) =>
        agent.post("/api/reservations").send({ bookId: book.id, memberCode: m.memberCode }),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);

    const rows = await db.select().from(reservations).where(eq(reservations.bookId, book.id));
    const positions = rows.map((r) => r.queuePosition).sort((x, y) => x - y);
    expect(positions).toEqual([1, 2, 3, 4]);
  });
});

describe("hold state transitions", () => {
  it("refuses to cancel an already-fulfilled hold", async () => {
    const book = await makeBook({ availableCopies: 1 });
    const member = await makeMember();
    const hold = await agent
      .post("/api/reservations")
      .send({ bookId: book.id, memberCode: member.memberCode });

    expect((await agent.post(`/api/reservations/${hold.body.id}/fulfill`)).status).toBe(200);

    const res = await agent.post(`/api/reservations/${hold.body.id}/cancel`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already fulfilled/i);
  });

  it("refuses to fulfil an already-cancelled hold", async () => {
    const book = await makeBook({ availableCopies: 1 });
    const member = await makeMember();
    const hold = await agent
      .post("/api/reservations")
      .send({ bookId: book.id, memberCode: member.memberCode });

    await agent.post(`/api/reservations/${hold.body.id}/cancel`);

    const res = await agent.post(`/api/reservations/${hold.body.id}/fulfill`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already cancelled/i);
  });

  it("404s for a hold that does not exist", async () => {
    expect((await agent.post("/api/reservations/999999/fulfill")).status).toBe(404);
  });
});

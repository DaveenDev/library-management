import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.ts";
import { requireAuth, requirePermission, writesRequire } from "./lib/auth.ts";
import { booksRouter } from "./routes/books.ts";
import { membersRouter } from "./routes/members.ts";
import { loansRouter } from "./routes/loans.ts";
import { reservationsRouter } from "./routes/reservations.ts";
import { finesRouter } from "./routes/fines.ts";
import { usersRouter } from "./routes/users.ts";
import { settingsRouter } from "./routes/settings.ts";
import { dashboardRouter } from "./routes/dashboard.ts";
import { reportsRouter } from "./routes/reports.ts";
import { HttpError } from "./lib/http.ts";

/**
 * Builds the Express app without binding a port, so tests can drive it
 * in-process via supertest while `index.ts` owns the actual listen().
 */
export function createApp() {
  const app = express();
  // Sessions ride in a cookie, so a wildcard origin is not an option: it would
  // let any site on the internet issue authenticated requests on a signed-in
  // librarian's behalf. In production the client is served from this same
  // origin and needs no entry at all; CORS_ORIGIN covers a split deployment.
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) ?? "http://localhost:5173",
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "lumen-library" }));

  app.use("/api/auth", authRouter);

  // Everything mounted past this line requires a signed-in staff account.
  // Applied here rather than per router so a new router cannot be added
  // unprotected by omission.
  app.use("/api", requireAuth);

  app.use("/api/books", writesRequire("catalog:write"), booksRouter);
  app.use("/api/members", writesRequire("members:write"), membersRouter);
  app.use("/api/loans", writesRequire("circulation:write"), loansRouter);
  app.use("/api/reservations", writesRequire("circulation:write"), reservationsRouter);
  app.use("/api/fines", writesRequire("fines:write"), finesRouter);
  // Staff accounts are not readable by non-admins either — the whole screen is
  // account administration, not reference data.
  app.use("/api/users", requirePermission("users:manage"), usersRouter);
  // Mixed: appearance is everyone's, fine policy is not. Gated in the router.
  app.use("/api/settings", settingsRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/reports", reportsRouter);

  // 404 for unknown API routes
  app.use("/api", (_req, res) => res.status(404).json({ error: "not found" }));

  // error handler
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      return res.status(err.status).json({ error: err.message });
    }
    // Postgres surfaces constraint violations as errors with a `code`; map the
    // ones a client can actually cause so they don't read as server faults.
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") {
      return res.status(409).json({ error: "that value is already taken" });
    }
    if (pgCode === "23503") {
      return res.status(409).json({ error: "referenced record does not exist" });
    }
    console.error(err);
    // Don't leak internals (stack traces, SQL) to the client.
    res.status(500).json({ error: "internal error" });
  });

  return app;
}

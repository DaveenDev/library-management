import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
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

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "lumen-library" }));

app.use("/api/books", booksRouter);
app.use("/api/members", membersRouter);
app.use("/api/loans", loansRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/fines", finesRouter);
app.use("/api/users", usersRouter);
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
  console.error(err);
  const msg = err instanceof Error ? err.message : "internal error";
  res.status(500).json({ error: msg });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`✔ Lumen API listening on http://localhost:${port}`);
});

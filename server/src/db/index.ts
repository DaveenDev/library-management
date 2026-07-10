import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. See server/.env");
}

// `max: 1` keeps things simple for a local dev app; bump for production.
export const queryClient = postgres(connectionString, { max: 10 });
export const db = drizzle(queryClient, { schema, logger: process.env.SQL_LOG === "1" });
export { schema };

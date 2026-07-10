import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  barcode: varchar("barcode", { length: 32 }).notNull().unique(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  subject: text("subject").notNull().default("Fiction"),
  isbn: varchar("isbn", { length: 20 }),
  totalCopies: integer("total_copies").notNull().default(1),
  availableCopies: integer("available_copies").notNull().default(1),
  shelf: varchar("shelf", { length: 16 }),
  publicationYear: integer("publication_year"),
  publisher: text("publisher"),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable("members", {
  id: serial("id").primaryKey(),
  memberCode: varchar("member_code", { length: 16 }).notNull().unique(),
  name: text("name").notNull(),
  type: varchar("type", { length: 16 }).notNull().default("Student"),
  gradeOrDept: text("grade_or_dept"),
  email: text("email"),
  status: varchar("status", { length: 16 }).notNull().default("Active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const loans = pgTable("loans", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  borrowedAt: timestamp("borrowed_at", { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
});

export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id")
    .notNull()
    .references(() => books.id, { onDelete: "cascade" }),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  reservedAt: timestamp("reserved_at", { withTimezone: true }).notNull().defaultNow(),
  status: varchar("status", { length: 24 }).notNull().default("Waiting"),
  queuePosition: integer("queue_position").notNull().default(1),
});

export const fines = pgTable("fines", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "cascade" }),
  loanId: integer("loan_id").references(() => loans.id, { onDelete: "set null" }),
  bookId: integer("book_id").references(() => books.id, { onDelete: "set null" }),
  daysOverdue: integer("days_overdue").notNull().default(0),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: varchar("status", { length: 16 }).notNull().default("Unpaid"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffUsers = pgTable("staff_users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: varchar("role", { length: 16 }).notNull().default("Assistant"),
  status: varchar("status", { length: 16 }).notNull().default("Active"),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Single-row app settings (id is always 1).
export const settings = pgTable("settings", {
  id: integer("id").primaryKey().default(1),
  dailyFineRate: numeric("daily_fine_rate", { precision: 10, scale: 2 }).notNull().default("0.50"),
  gracePeriodDays: integer("grace_period_days").notNull().default(2),
  maxFineCap: numeric("max_fine_cap", { precision: 10, scale: 2 }).notNull().default("15.00"),
  autoSuspendDays: integer("auto_suspend_days").notNull().default(14),
  emailReminders: boolean("email_reminders").notNull().default(true),
  loanPeriodDays: integer("loan_period_days").notNull().default(14),
  theme: varchar("theme", { length: 16 }).notNull().default("parchment"),
  accent: varchar("accent", { length: 16 }),
});

// Editable lookup lists (shelves / subjects / grades / sections).
export const lookups = pgTable("lookups", {
  id: serial("id").primaryKey(),
  kind: varchar("kind", { length: 16 }).notNull(), // shelf | subject | grade | section
  value: text("value").notNull(),
  sort: integer("sort").notNull().default(0),
});

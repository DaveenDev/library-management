import { z } from "zod";
import { HttpError } from "./http.ts";

/**
 * Parse a request body against a schema, converting Zod's error into a 400
 * with a readable message ("title: Required, totalCopies: Expected number").
 */
export function parseBody<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "body"}: ${i.message}`)
      .join(", ");
    throw new HttpError(400, detail);
  }
  return result.data;
}

/**
 * Route params arrive as strings. `Number("abc")` is NaN, which silently
 * becomes `WHERE id = NULL` and returns an empty result instead of an error,
 * so ids are validated up front.
 */
export function parseId(raw: string | undefined, label = "id"): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, `invalid ${label}`);
  }
  return n;
}

// Trim incoming strings, and treat "" as absent for optional fields.
const trimmed = z.string().transform((s) => s.trim());
const optionalText = trimmed.nullish().transform((v) => (v ? v : null));

export const bookCreateSchema = z.object({
  title: trimmed.pipe(z.string().min(1, "title is required")),
  author: trimmed.pipe(z.string().min(1, "author is required")),
  subject: trimmed.default("Fiction"),
  isbn: optionalText,
  totalCopies: z.coerce.number().int().min(1).max(10_000).default(1),
  shelf: optionalText,
  publicationYear: z.coerce.number().int().min(0).max(3000).nullish(),
  publisher: optionalText,
  description: optionalText,
  barcode: optionalText,
  accessionNo: optionalText,
});

export const bookUpdateSchema = bookCreateSchema.partial();

export const memberCreateSchema = z.object({
  name: trimmed.pipe(z.string().min(1, "name is required")),
  type: z.enum(["Student", "Faculty"]).default("Student"),
  gradeOrDept: optionalText,
  email: z.union([z.string().email(), z.literal(""), z.null()]).optional().transform((v) => (v ? v : null)),
  status: z.enum(["Active", "Suspended"]).default("Active"),
  memberCode: optionalText,
});

export const memberUpdateSchema = memberCreateSchema.partial();

/** Checkout/checkin/hold all accept either an id or a scanned code. */
export const checkoutSchema = z
  .object({
    bookId: z.coerce.number().int().positive().optional(),
    bookBarcode: trimmed.optional(),
    memberId: z.coerce.number().int().positive().optional(),
    memberCode: trimmed.optional(),
  })
  .refine((v) => v.bookId !== undefined || !!v.bookBarcode, {
    message: "bookId or bookBarcode is required",
  })
  .refine((v) => v.memberId !== undefined || !!v.memberCode, {
    message: "memberId or memberCode is required",
  });

/** Placing a hold takes the same identifiers as a checkout. */
export const holdSchema = checkoutSchema;

export const checkinSchema = z.object({
  bookBarcode: trimmed.pipe(z.string().min(1, "bookBarcode is required")),
});

export const staffCreateSchema = z.object({
  name: trimmed.pipe(z.string().min(1, "name is required")),
  email: z.string().email("must be a valid email"),
  role: z.enum(["Admin", "Librarian", "Assistant"]).default("Assistant"),
  status: z.enum(["Active", "Disabled"]).default("Active"),
});

export const settingsSchema = z.object({
  dailyFineRate: z.coerce.number().min(0).max(100_000).optional(),
  gracePeriodDays: z.coerce.number().int().min(0).max(365).optional(),
  maxFineCap: z.coerce.number().min(0).max(1_000_000).optional(),
  autoSuspendDays: z.coerce.number().int().min(0).max(3650).optional(),
  emailReminders: z.boolean().optional(),
  loanPeriodDays: z.coerce.number().int().min(1).max(365).optional(),
  theme: trimmed.optional(),
  accent: optionalText,
});

export const lookupValueSchema = z.object({
  value: trimmed.pipe(z.string().min(1, "value is required")),
});

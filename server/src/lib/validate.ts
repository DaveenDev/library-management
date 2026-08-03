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

/**
 * Update schemas are built from these field maps rather than from
 * `createSchema.partial()`.
 *
 * `.partial()` makes a field optional but leaves its `.default()` in place, so
 * an omitted field still arrives with the default value — and the PATCH
 * handlers, which only skip keys that are `undefined`, would write it. A
 * rename would silently reset a book to one copy or un-suspend a member. The
 * defaults belong to creation only.
 */
const bookFields = {
  title: trimmed.pipe(z.string().min(1, "title is required")),
  author: trimmed.pipe(z.string().min(1, "author is required")),
  subject: trimmed,
  isbn: optionalText,
  totalCopies: z.coerce.number().int().min(1).max(10_000),
  shelf: optionalText,
  publicationYear: z.coerce.number().int().min(0).max(3000).nullish(),
  publisher: optionalText,
  description: optionalText,
  barcode: optionalText,
  accessionNo: optionalText,
};

export const bookCreateSchema = z.object({
  ...bookFields,
  subject: bookFields.subject.default("Fiction"),
  totalCopies: bookFields.totalCopies.default(1),
});

export const bookUpdateSchema = z.object(bookFields).partial();

const memberFields = {
  name: trimmed.pipe(z.string().min(1, "name is required")),
  type: z.enum(["Student", "Faculty"]),
  gradeOrDept: optionalText,
  email: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v ? v : null)),
  status: z.enum(["Active", "Suspended"]),
  memberCode: optionalText,
};

export const memberCreateSchema = z.object({
  ...memberFields,
  type: memberFields.type.default("Student"),
  status: memberFields.status.default("Active"),
});

export const memberUpdateSchema = z.object(memberFields).partial();

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

/**
 * Long enough to resist a dictionary attack, capped because scrypt hashes the
 * whole input and an unbounded password is an easy way to burn server CPU.
 */
const password = z.string().min(10, "must be at least 10 characters").max(200);

const staffFields = {
  name: trimmed.pipe(z.string().min(1, "name is required")),
  email: z
    .string()
    .email("must be a valid email")
    .transform((s) => s.trim().toLowerCase()),
  password: password,
  role: z.enum(["Admin", "Librarian", "Assistant"]),
  status: z.enum(["Active", "Disabled"]),
};

export const staffCreateSchema = z.object({
  ...staffFields,
  password: staffFields.password.optional(),
  role: staffFields.role.default("Assistant"),
  status: staffFields.status.default("Active"),
});

export const staffUpdateSchema = z.object(staffFields).partial();

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "email is required")
    .transform((s) => s.trim().toLowerCase()),
  // Deliberately not length-checked: a rejected short password would answer
  // "is this the right password shape?" for free, and the stored hash decides.
  password: z.string().min(1, "password is required"),
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

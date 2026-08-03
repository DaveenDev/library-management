// Shared domain types used by both the Express API and the React client.

// ---------- Currency ----------
// Single source of truth so the server's report strings and the client's
// tables/tiles can never drift apart.
export const CURRENCY_SYMBOL = "₱"; // ₱
export const CURRENCY_CODE = "PHP";

/** Format an amount for display, e.g. 12.5 -> "₱12.50". */
export function money(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${CURRENCY_SYMBOL}${n.toFixed(2)}`;
}

/** Inverse of `money` — pulls the number back out of a formatted string. */
export function parseMoney(text: string | number): number {
  if (typeof text === "number") return text;
  return Number(String(text).replace(/[^0-9.-]/g, ""));
}

export type BadgeKind = "good" | "bad" | "warn" | "neutral";

export type MemberType = "Student" | "Faculty";
export type MemberStatus = "Active" | "Suspended";
export type LoanStatus = "Active" | "Overdue" | "Due soon" | "Returned";
export type ReservationStatus =
  | "Waiting"
  | "Ready for pickup"
  | "Fulfilled"
  | "Cancelled";
export type FineStatus = "Unpaid" | "Paid" | "Waived";
export type StaffRole = "Admin" | "Librarian" | "Assistant";
export type StaffStatus = "Active" | "Disabled";

export interface Book {
  id: number;
  barcode: string;
  accessionNo: string | null;
  title: string;
  author: string;
  subject: string;
  isbn: string | null;
  totalCopies: number;
  availableCopies: number;
  shelf: string | null;
  publicationYear: number | null;
  publisher: string | null;
  description: string | null;
  createdAt: string;
}

export interface BookInput {
  accessionNo?: string | null;
  title: string;
  author: string;
  subject: string;
  isbn?: string | null;
  totalCopies: number;
  shelf?: string | null;
  publicationYear?: number | null;
  publisher?: string | null;
  description?: string | null;
  barcode?: string | null;
}

export interface Member {
  id: number;
  memberCode: string;
  name: string;
  type: MemberType;
  gradeOrDept: string | null;
  email: string | null;
  status: MemberStatus;
  createdAt: string;
  // computed
  booksOut: number;
  finesDue: number;
}

export interface MemberInput {
  name: string;
  type: MemberType;
  gradeOrDept?: string | null;
  email?: string | null;
  status?: MemberStatus;
}

export interface MemberHistoryEntry {
  id: number;
  bookTitle: string;
  bookBarcode: string;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: LoanStatus;
  daysLate: number;
}

export interface MemberHistory {
  member: Member;
  history: MemberHistoryEntry[];
  totalLoans: number;
  openLoans: number;
  unpaidFines: number;
  paidFines: number;
}

export interface Loan {
  id: number;
  bookId: number;
  memberId: number;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  // computed / joined
  bookTitle: string;
  bookBarcode: string;
  memberName: string;
  memberCode: string;
  status: LoanStatus;
  daysLate: number;
}

export interface Reservation {
  id: number;
  bookId: number;
  memberId: number;
  reservedAt: string;
  status: ReservationStatus;
  queuePosition: number;
  // joined
  bookTitle: string;
  memberName: string;
}

export interface Fine {
  id: number;
  memberId: number;
  loanId: number | null;
  bookId: number | null;
  daysOverdue: number;
  amount: number;
  status: FineStatus;
  createdAt: string;
  // joined
  memberName: string;
  bookTitle: string;
}

export interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  lastActiveAt: string | null;
  createdAt: string;
}

// ---------- Access control ----------

/**
 * A single capability a route can require. Reading is open to any signed-in
 * staff account; only the mutations below are gated.
 *
 * Roles map to permissions here, in shared code, so the server's middleware
 * and the client's UI gating can never drift apart — a button the client
 * hides is exactly a route the server refuses.
 */
export type Permission =
  | "catalog:write"
  | "members:write"
  | "circulation:write"
  | "fines:write"
  | "settings:write"
  | "users:manage";

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  Admin: [
    "catalog:write",
    "members:write",
    "circulation:write",
    "fines:write",
    "settings:write",
    "users:manage",
  ],
  Librarian: ["catalog:write", "members:write", "circulation:write", "fines:write"],
  Assistant: ["circulation:write"],
};

export function roleCan(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * The signed-in account, as returned by the auth endpoints. Deliberately
 * narrower than `StaffUser` — a session response carries no password hash and
 * no bookkeeping columns.
 */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: StaffRole;
  /** Derived server-side so every avatar renders the same initials. */
  initials: string;
}

export interface Session {
  user: AuthUser;
  permissions: Permission[];
}

export interface Settings {
  dailyFineRate: number;
  gracePeriodDays: number;
  maxFineCap: number;
  autoSuspendDays: number;
  emailReminders: boolean;
  theme: string;
  accent: string | null;
  loanPeriodDays: number;
}

export interface LookupLists {
  shelves: string[];
  subjects: string[];
  grades: string[];
  sections: string[];
}

export interface DashboardStats {
  totalTitles: number;
  titlesThisMonth: number;
  copiesInStock: number;
  copiesAvailable: number;
  activeLoans: number;
  checkedOutToday: number;
  overdue: number;
  finesOutstanding: number;
  membersWithFines: number;
  recentActivity: ActivityItem[];
  dueSoon: DueSoonItem[];
  mostBorrowed: MostBorrowedItem[];
}

export interface ActivityItem {
  kind: BadgeKind;
  text: string;
  when: string;
}

export interface DueSoonItem {
  title: string;
  member: string;
  due: string;
}

export interface MostBorrowedItem {
  title: string;
  count: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Shared domain types used by both the Express API and the React client.

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

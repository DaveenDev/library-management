import type {
  Book, BookInput, Member, MemberInput, MemberHistory, Loan, Reservation, Fine,
  StaffUser, Session, Settings, LookupLists, DashboardStats, Paginated,
} from "@lumen/shared";

const BASE = "/api";

type UnauthorizedHandler = () => void;
const unauthorizedHandlers = new Set<UnauthorizedHandler>();

/**
 * Register a callback for "the server no longer accepts this session".
 *
 * Any request can be the one that discovers an expired cookie, so the auth
 * provider subscribes here rather than every page having to notice a 401 and
 * decide what to do about it. Returns an unsubscribe function.
 */
export function onUnauthorized(handler: UnauthorizedHandler): () => void {
  unauthorizedHandlers.add(handler);
  return () => unauthorizedHandlers.delete(handler);
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    // The session cookie has to ride along even when the client is served from
    // a different origin than the API.
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch { /* ignore */ }
    // `/auth/me` 401s as its normal "not signed in" answer, and the login form
    // 401s on a bad password; neither means an established session just ended.
    if (res.status === 401 && !path.startsWith("/auth/")) {
      unauthorizedHandlers.forEach((h) => h());
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const qs = <T extends object>(params: T) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  }
  const str = s.toString();
  return str ? `?${str}` : "";
};

export interface ListParams {
  page?: number;
  pageSize?: number;
  q?: string;
  subject?: string;
  status?: string;
}

export interface ReportResult {
  items: Record<string, string>[];
  footer: string;
}

export interface SettingsResponse extends Settings {
  lists: LookupLists;
}

export interface FinesSummary {
  outstanding: number;
  collected: number;
  membersWithFines: number;
}

export const api = {
  // auth
  me: () => req<Session>("/auth/me"),
  login: (email: string, password: string) =>
    req<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => req<void>("/auth/logout", { method: "POST" }),

  // dashboard
  dashboard: () => req<DashboardStats>("/dashboard"),

  // books
  books: (p: ListParams = {}) => req<Paginated<Book>>(`/books${qs(p)}`),
  createBook: (b: BookInput) => req<Book>("/books", { method: "POST", body: JSON.stringify(b) }),
  updateBook: (id: number, b: Partial<BookInput>) => req<Book>(`/books/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
  deleteBook: (id: number) => req<void>(`/books/${id}`, { method: "DELETE" }),

  // members
  members: (p: ListParams = {}) => req<Paginated<Member>>(`/members${qs(p)}`),
  memberHistory: (id: number) => req<MemberHistory>(`/members/${id}/history`),
  createMember: (m: MemberInput) => req<Member>("/members", { method: "POST", body: JSON.stringify(m) }),
  updateMember: (id: number, m: Partial<MemberInput>) => req<Member>(`/members/${id}`, { method: "PATCH", body: JSON.stringify(m) }),
  deleteMember: (id: number) => req<void>(`/members/${id}`, { method: "DELETE" }),

  // loans
  loans: (p: ListParams = {}) => req<Paginated<Loan>>(`/loans${qs(p)}`),
  checkout: (body: { bookBarcode?: string; memberCode?: string; bookId?: number; memberId?: number }) =>
    req<Loan>("/loans/checkout", { method: "POST", body: JSON.stringify(body) }),
  checkin: (bookBarcode: string) => req<{ amount: number; days: number }>("/loans/checkin", { method: "POST", body: JSON.stringify({ bookBarcode }) }),
  returnLoan: (id: number) => req<{ amount: number; days: number }>(`/loans/${id}/return`, { method: "POST" }),
  renewLoan: (id: number) => req<Loan>(`/loans/${id}/renew`, { method: "POST" }),

  // reservations
  reservations: (p: ListParams = {}) => req<Paginated<Reservation>>(`/reservations${qs(p)}`),
  createReservation: (body: { bookId?: number; memberId?: number; bookBarcode?: string; memberCode?: string }) =>
    req<Reservation>("/reservations", { method: "POST", body: JSON.stringify(body) }),
  fulfillReservation: (id: number) => req<Reservation>(`/reservations/${id}/fulfill`, { method: "POST" }),
  cancelReservation: (id: number) => req<Reservation>(`/reservations/${id}/cancel`, { method: "POST" }),

  // fines
  fines: (p: ListParams = {}) => req<Paginated<Fine>>(`/fines${qs(p)}`),
  finesSummary: () => req<FinesSummary>("/fines/summary"),
  collectFine: (id: number) => req<Fine>(`/fines/${id}/collect`, { method: "POST" }),
  waiveFine: (id: number) => req<Fine>(`/fines/${id}/waive`, { method: "POST" }),

  // users
  users: (p: ListParams = {}) => req<Paginated<StaffUser>>(`/users${qs(p)}`),
  createUser: (body: Partial<StaffUser> & { password?: string }) =>
    req<StaffUser>("/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: number, body: Partial<StaffUser> & { password?: string }) =>
    req<StaffUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteUser: (id: number) => req<void>(`/users/${id}`, { method: "DELETE" }),

  // settings
  settings: () => req<SettingsResponse>("/settings"),
  saveSettings: (body: Partial<Settings>) => req<Settings>("/settings", { method: "PUT", body: JSON.stringify(body) }),
  addLookup: (kind: string, value: string) => req<LookupLists>(`/settings/lookups/${kind}`, { method: "POST", body: JSON.stringify({ value }) }),
  removeLookup: (kind: string, value: string) => req<LookupLists>(`/settings/lookups/${kind}/${encodeURIComponent(value)}`, { method: "DELETE" }),

  // reports
  report: (type: string, from: string, to: string) => req<ReportResult>(`/reports/${type}${qs({ from, to })}`),
};

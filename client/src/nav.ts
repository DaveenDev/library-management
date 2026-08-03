export type Section =
  | "home" | "dashboard" | "catalog" | "borrowers" | "circulation"
  | "reservations" | "fines" | "reports" | "labels" | "settings" | "userManagement";

// [key, label, icon]
export const NAV_ITEMS: [Section, string, string][] = [
  ["home", "Front Desk", "home"],
  ["dashboard", "Dashboard", "grid"],
  ["catalog", "Book Catalog", "book"],
  ["borrowers", "Borrowers", "users"],
  ["circulation", "Circulation", "swap"],
  ["reservations", "Reservations", "bookmark"],
  ["fines", "Fines & Penalties", "coin"],
  ["reports", "Reports", "chart"],
  ["labels", "Labels & Barcodes", "tag"],
];

import type { Permission } from "@lumen/shared";

/**
 * Sections that only some roles can reach. The server refuses these routes
 * anyway; hiding them keeps a librarian from clicking into a screen that can
 * only ever show them an error.
 */
export const SECTION_PERMISSION: Partial<Record<Section, Permission>> = {
  userManagement: "users:manage",
};

export const SETTINGS_ITEMS: [Section, string, string][] = [
  ["settings", "Misc", "settings"],
  ["userManagement", "User Management", "shield"],
];

export const TITLES: Record<Section, string> = {
  home: "Front Desk", dashboard: "Dashboard", catalog: "Book Catalog", borrowers: "Borrowers",
  circulation: "Circulation", reservations: "Reservations & Holds", fines: "Fines & Penalties",
  reports: "Reports", labels: "Labels & Barcodes", settings: "Settings", userManagement: "User Management",
};

export const SUBS: Record<Section, string> = {
  home: "Search, borrow, and return in one place",
  dashboard: "Overview of your library at a glance",
  catalog: "Add, edit, search and manage every title",
  borrowers: "Student and faculty membership records",
  circulation: "Borrow, renew and return with barcode scan",
  reservations: "Manage holds and the pickup queue",
  fines: "Overdue penalties and fine collection",
  reports: "Insights, inventory and exports",
  labels: "Print barcode and QR labels",
  settings: "Configure fines, shelves, categories and lists",
  userManagement: "Manage staff accounts, roles and permissions",
};

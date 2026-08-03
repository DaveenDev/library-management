/**
 * The people the journeys act as.
 *
 * These are the seeded demo accounts (`server/src/db/seed.ts`), so a beta run
 * needs no fixture of its own — it signs in the way a reviewer following the
 * README would.
 */
export const PERSONAS = {
  admin: {
    email: "daveen.dev@lumenlibrary.org",
    password: "lumen-demo-2024",
    role: "Admin",
    name: "Daveen Dev",
  },
  librarian: {
    email: "e.rossi@lumenlibrary.org",
    password: "lumen-demo-2024",
    role: "Librarian",
    name: "Dr. Elena Rossi",
  },
  assistant: {
    email: "m.lee@lumenlibrary.org",
    password: "lumen-demo-2024",
    role: "Assistant",
    name: "Marcus Lee",
  },
  disabled: {
    email: "s.kim@lumenlibrary.org",
    password: "lumen-demo-2024",
    role: "Librarian",
    name: "Sara Kim",
  },
};

/** Seeded records the journeys refer to by the codes printed on them. */
export const FIXTURES = {
  books: {
    dune: { barcode: "LIB-000845", title: "Dune", author: "Frank Herbert" },
    atomicHabits: { barcode: "LIB-000521", title: "Atomic Habits" },
    midnightLibrary: { barcode: "LIB-000412", title: "The Midnight Library" },
    cleanCode: { barcode: "LIB-000956", title: "Clean Code" },
  },
  members: {
    amara: { code: "S-1042", name: "Amara Okonkwo" },
    elena: { code: "F-0231", name: "Dr. Elena Rossi" },
    marcusBell: { code: "S-1198", name: "Marcus Bell" }, // suspended
  },
};

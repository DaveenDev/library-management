import "dotenv/config";
import { db, queryClient } from "./index.ts";
import { books, members, loans, reservations, fines, staffUsers, settings, lookups } from "./schema.ts";
import { MS_PER_DAY } from "../lib/domain.ts";

const now = new Date();
const daysFromNow = (d: number) => new Date(now.getTime() + d * MS_PER_DAY);

async function main() {
  console.log("Clearing existing data…");
  // order matters for FKs
  await db.delete(fines);
  await db.delete(reservations);
  await db.delete(loans);
  await db.delete(books);
  await db.delete(members);
  await db.delete(staffUsers);
  await db.delete(settings);
  await db.delete(lookups);

  console.log("Seeding settings…");
  await db.insert(settings).values({
    id: 1,
    dailyFineRate: "0.50",
    gracePeriodDays: 2,
    maxFineCap: "15.00",
    autoSuspendDays: 14,
    emailReminders: true,
    loanPeriodDays: 14,
    theme: "parchment",
    accent: null,
  });

  console.log("Seeding lookup lists…");
  const lookupRows: { kind: string; value: string; sort: number }[] = [];
  const pushList = (kind: string, values: string[]) =>
    values.forEach((value, i) => lookupRows.push({ kind, value, sort: i }));
  pushList("shelf", ["A-01", "B-04", "B-12", "B-22", "C-09", "D-15", "E-07", "F-03"]);
  pushList("subject", [
    "Fiction", "Non-Fiction", "Science", "History", "Technology",
    "Self-Help", "Biography", "Classic", "Memoir", "Science Fiction", "Reference",
  ]);
  pushList("grade", ["Grade 9", "Grade 10", "Grade 11", "Grade 12"]);
  pushList("section", ["Section A", "Section B", "Section C", "Section D"]);
  await db.insert(lookups).values(lookupRows);

  console.log("Seeding books…");
  // [barcode, title, author, subject, totalCopies, shelf, isbn, year, publisher]
  const bookDefs: [string, string, string, string, number, string, string | null, number | null, string | null][] = [
    ["LIB-000412", "The Midnight Library", "Matt Haig", "Fiction", 4, "B-12", "9780525559474", 2020, "Viking"],
    ["LIB-000318", "Sapiens", "Yuval Noah Harari", "History", 3, "B-04", "9780062316097", 2011, "Harper"],
    ["LIB-000521", "Atomic Habits", "James Clear", "Self-Help", 5, "C-09", "9780735211292", 2018, "Avery"],
    ["LIB-000107", "The Great Gatsby", "F. Scott Fitzgerald", "Classic", 6, "A-01", "9780743273565", 1925, "Scribner"],
    ["LIB-000733", "A Brief History of Time", "Stephen Hawking", "Science", 2, "D-15", "9780553380163", 1988, "Bantam"],
    ["LIB-000689", "Educated", "Tara Westover", "Memoir", 3, "B-22", "9780399590504", 2018, "Random House"],
    ["LIB-000845", "Dune", "Frank Herbert", "Science Fiction", 4, "E-07", "9780441013593", 1965, "Ace Books"],
    ["LIB-000956", "Clean Code", "Robert C. Martin", "Technology", 3, "F-03", "9780132350884", 2008, "Prentice Hall"],
  ];

  // Open loans per book title — used to derive availableCopies.
  const openLoanCountByTitle: Record<string, number> = {
    Sapiens: 1, "Atomic Habits": 1, "A Brief History of Time": 1,
    Dune: 1, Educated: 1, "Clean Code": 1,
  };

  const bookRows = await db
    .insert(books)
    .values(
      bookDefs.map(([barcode, title, author, subject, total, shelf, isbn, year, publisher], i) => ({
        barcode,
        accessionNo: String(i + 1).padStart(4, "0"),
        title,
        author,
        subject,
        totalCopies: total,
        availableCopies: total - (openLoanCountByTitle[title] ?? 0),
        shelf,
        isbn,
        publicationYear: year,
        publisher,
      })),
    )
    .returning();
  const bookByTitle = new Map(bookRows.map((b) => [b.title, b]));

  console.log("Seeding members…");
  // [code, name, type, gradeOrDept, email, status]
  const memberDefs: [string, string, string, string, string, string][] = [
    ["S-1042", "Amara Okonkwo", "Student", "Grade 11", "amara.o@student.lumen.org", "Active"],
    ["S-0876", "Liang Wei", "Student", "Grade 9", "liang.w@student.lumen.org", "Active"],
    ["F-0231", "Dr. Elena Rossi", "Faculty", "Sciences", "e.rossi@lumenlibrary.org", "Active"],
    ["S-1198", "Marcus Bell", "Student", "Grade 12", "marcus.b@student.lumen.org", "Suspended"],
    ["S-0654", "Priya Nair", "Student", "Grade 10", "priya.n@student.lumen.org", "Active"],
    ["S-0912", "Tomas Novak", "Student", "Grade 11", "tomas.n@student.lumen.org", "Active"],
  ];
  const memberRows = await db
    .insert(members)
    .values(
      memberDefs.map(([memberCode, name, type, gradeOrDept, email, status]) => ({
        memberCode, name, type, gradeOrDept, email, status,
      })),
    )
    .returning();
  const memberByName = new Map(memberRows.map((m) => [m.name, m]));

  console.log("Seeding loans…");
  // [title, memberName, dueOffsetDays, returnedOffsetDays|null]
  // dueOffset < 0 (past-grace) => overdue; small positive => due soon; larger => active.
  const loanDefs: [string, string, number, number | null][] = [
    ["Sapiens", "Amara Okonkwo", -6, null],          // overdue
    ["Atomic Habits", "Liang Wei", 5, null],         // active
    ["A Brief History of Time", "Dr. Elena Rossi", 2, null], // due soon
    ["Dune", "Marcus Bell", -12, null],              // overdue
    ["Educated", "Tomas Novak", 9, null],            // active
    ["Clean Code", "Priya Nair", 1, null],           // due soon
    // returned history (feeds "most borrowed" + recent activity)
    ["Sapiens", "Dr. Elena Rossi", -20, -1],
    ["Atomic Habits", "Amara Okonkwo", -30, -16],
    ["Dune", "Amara Okonkwo", -25, -11],
    ["The Midnight Library", "Priya Nair", -18, -4],
    ["Educated", "Marcus Bell", -22, -8],
  ];
  await db.insert(loans).values(
    loanDefs.map(([title, memberName, dueOffset, returnedOffset]) => {
      const book = bookByTitle.get(title)!;
      const member = memberByName.get(memberName)!;
      const dueAt = daysFromNow(dueOffset);
      const borrowedAt = new Date(dueAt.getTime() - 14 * MS_PER_DAY);
      return {
        bookId: book.id,
        memberId: member.id,
        borrowedAt,
        dueAt,
        returnedAt: returnedOffset === null ? null : daysFromNow(returnedOffset),
      };
    }),
  );

  console.log("Seeding reservations…");
  // [title, memberName, reservedOffsetDays, status, queue]
  const reservationDefs: [string, string, number, string, number][] = [
    ["The Midnight Library", "Priya Nair", -2, "Ready for pickup", 1],
    ["A Brief History of Time", "Liang Wei", -3, "Ready for pickup", 1],
    ["Dune", "Amara Okonkwo", -1, "Waiting", 1],
    ["Sapiens", "Tomas Novak", -4, "Waiting", 2],
  ];
  await db.insert(reservations).values(
    reservationDefs.map(([title, memberName, off, status, queue]) => ({
      bookId: bookByTitle.get(title)!.id,
      memberId: memberByName.get(memberName)!.id,
      reservedAt: daysFromNow(off),
      status,
      queuePosition: queue,
    })),
  );

  console.log("Seeding fines…");
  // [memberName, title, daysOverdue, amount, status]
  const fineDefs: [string, string, number, string, string][] = [
    ["Marcus Bell", "Dune", 12, "6.00", "Unpaid"],
    ["Amara Okonkwo", "Sapiens", 6, "3.00", "Unpaid"],
    ["Liang Wei", "The Great Gatsby", 5, "2.50", "Unpaid"],
    ["Tomas Novak", "Educated", 0, "1.25", "Paid"],
  ];
  await db.insert(fines).values(
    fineDefs.map(([memberName, title, days, amount, status]) => ({
      memberId: memberByName.get(memberName)!.id,
      bookId: bookByTitle.get(title)!.id,
      daysOverdue: days,
      amount,
      status,
    })),
  );

  console.log("Seeding staff users…");
  const staffDefs: [string, string, string, string, number][] = [
    ["Bill Higham", "bill.higham@lumenlibrary.org", "Admin", "Active", 0],
    ["Dr. Elena Rossi", "e.rossi@lumenlibrary.org", "Librarian", "Active", -1],
    ["Marcus Lee", "m.lee@lumenlibrary.org", "Assistant", "Active", -1],
    ["Sara Kim", "s.kim@lumenlibrary.org", "Librarian", "Disabled", -21],
  ];
  await db.insert(staffUsers).values(
    staffDefs.map(([name, email, role, status, off]) => ({
      name, email, role, status,
      lastActiveAt: daysFromNow(off),
    })),
  );

  console.log("✔ Seed complete.");
}

main()
  .then(() => queryClient.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    queryClient.end().finally(() => process.exit(1));
  });

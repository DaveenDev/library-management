# Beta test run — 2026-08-03 22:55 UTC

**Verdict: PASS** · 16 passed, 0 failed, 0 blocked · 455s

| | |
|---|---|
| Commit | `719440d` on `claude/handoff-md-yxppg8` |
| Node | v22.22.2 |
| Browser | Chromium 141.0.7390.37 |
| Database | `library_system_beta` (seeded fresh for this run) |
| Viewports | 1400×900, 390×844 |

## Journeys

| | Journey | As | Steps | Time |
|---|---|---|---|---|
| ✅ | A librarian signs in and finds their own name on screen | signed out | 7/7 | 43s |
| ✅ | A disabled account cannot get in, and is told why | signed out | 2/2 | 27s |
| ✅ | A whole shift at the desk: check out, renew, check in | librarian | 8/8 | 18s |
| ✅ | The desk refuses what it should: suspended readers and empty shelves | librarian | 3/3 | 18s |
| ✅ | Catalogue a new title, correct it, then withdraw it | librarian | 7/7 | 20s |
| ✅ | Register a borrower, read their history, suspend them | librarian | 7/7 | 21s |
| ✅ | Place a hold on a title that is out, then fulfil it | librarian | 8/8 | 53s |
| ✅ | Collect and waive an overdue fine | librarian | 5/5 | 16s |
| ✅ | An assistant can work the desk but not run the library | assistant | 9/9 | 17s |
| ✅ | A librarian runs the collection but not the staff list | librarian | 5/5 | 32s |
| ✅ | An administrator manages staff accounts | admin | 7/7 | 19s |
| ✅ | Pull a report and export it | librarian | 6/6 | 33s |
| ✅ | Generate a sheet of scannable labels | librarian | 6/6 | 22s |
| ✅ | An administrator changes fine policy and the shelf list | admin | 6/6 | 44s |
| ✅ | A librarian works from a phone | librarian | 6/6 | 35s |
| ✅ | Someone working without a mouse can still get around | librarian | 6/6 | 31s |

## Observations

Not failures. Things a tester noticed that someone should decide about.

| Severity | Journey | Note |
|---|---|---|
| major | An administrator changes fine policy and the shelf list | Settings has an editable Book Shelves list ("Shelf codes used for physical placement"), but Add Book takes the shelf as free text and never offers it — so the configured codes are decorative and a typo creates a shelf that does not exist |
| minor | Pull a report and export it | The report period picker sits above every report, but only Most Borrowed and the Transaction Log consult it — Overdue, Fines, List of Books, Inventory and Member Activity ignore it silently, so a narrowed range looks like it did nothing |
| polish | A whole shift at the desk: check out, renew, check in | Unknown barcode says: “book not found” |
| polish | The desk refuses what it should: suspended readers and empty shelves | "A Brief History of Time" starts at 1 / 2 copies available |
| polish | A librarian runs the collection but not the staff list | Theme persisted across reload as rgb(221, 227, 208) |
| polish | Pull a report and export it | Excel export produced overdue-report-2030-01-01.xlsx |
| polish | Pull a report and export it | PDF export produced overdue-report-2030-01-01.pdf |
| polish | An administrator changes fine policy and the shelf list | Loaded policy: 0.50 per day, 14-day loans |

## Browser console

Uncaught exceptions, 5xx responses and network-level failures only. 4xx is left out: the journeys provoke wrong passwords, suspended borrowers and duplicate holds on purpose, and each one is a 4xx the app handles correctly.

Clean — nothing on any journey.

## Coverage

What this run did and did not touch, so the verdict is not read as more than it is.

**Exercised:** A librarian signs in and finds their own name on screen · A disabled account cannot get in, and is told why · A whole shift at the desk: check out, renew, check in · The desk refuses what it should: suspended readers and empty shelves · Catalogue a new title, correct it, then withdraw it · Register a borrower, read their history, suspend them · Place a hold on a title that is out, then fulfil it · Collect and waive an overdue fine · An assistant can work the desk but not run the library · A librarian runs the collection but not the staff list · An administrator manages staff accounts · Pull a report and export it · Generate a sheet of scannable labels · An administrator changes fine policy and the shelf list · A librarian works from a phone · Someone working without a mouse can still get around

**Not exercised:** printing to paper · the contents of exported PDF and Excel files (the download is triggered and named, never opened) · real barcode-scanner hardware · email reminders (unimplemented) · two staff using the app at once · any browser other than Chromium.

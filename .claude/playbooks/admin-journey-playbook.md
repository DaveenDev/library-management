# Recurring Playbook — Admin Journey (full-permission staff account, whole-system shift)

**Created:** 2026-09-14
**Recurrence:** on demand (re-execute this file any time)
**Driver:** Playwright MCP (interactive — the AI drives a real Chromium via accessibility snapshots). **Read §A "How to drive the browser" before starting** — it is the concrete how-to; everything below it is the what-to-do.
**App URL:** `http://localhost:<CLIENT_PORT>` — **pick free ports at run start** (see §1 step 0). **Do NOT use 4000/5173** (the developer's own `npm run dev` stack) **or 4100/5273** (the `beta-test` harness). Suggested first try: API **4300**, client **5374**.
**Data isolation:** a dedicated scratch Postgres database (`library_system_playbook`), pushed and **reseeded fresh every run**.

> **Port convention.** Example URLs below use **5374** (client) and **4300**
> (API). Substitute the ports you actually chose in §1 step 0. API probes go to
> `/api/…` on the client origin — Vite proxies it.

> **Purpose.** You are the **Admin** — the librarian who owns the system. You
> hold every permission in `ROLE_PERMISSIONS.Admin`: `catalog:write`,
> `members:write`, `circulation:write`, `fines:write`, `settings:write`,
> `users:manage`. Nothing is hidden from you, which makes this the opposite test
> from `.claude/playbooks/user-journey-playbook.md`: there the question was
> *"does the cage hold?"*; here it is **"does the whole product actually work,
> end to end, for the person who runs it?"**
>
> You will:
>
> 1. **Phase 1 — Surface audit.** All ten Main-Menu/Settings destinations plus
>    **User Management**, each showing its full control set.
> 2. **Phase 2 — A full working day, module by module.** Catalogue a book and
>    delete it again; register a borrower; lend, renew and take back; run the
>    holds queue; collect and waive a fine; run all seven reports and export
>    them; print label sheets; set fine policy and edit the lookup lists;
>    administer staff accounts.
> 3. **Phase 3 — Policy actually bites.** Prove the settings you changed reach
>    the domain logic (loan period moves a due date; fine rate changes a computed
>    fine) — and name the two settings that are stored but **never enforced**.
> 4. **Phase 4 — Admin power over other people's sessions.** Disable a signed-in
>    colleague and watch their session die on the next request; reset a password
>    and sign in with it; the self-protection rules that stop an Admin locking
>    the library out of itself.
> 5. **Phase 2.5 / R / S / F — server sweep, responsive, session lifecycle,
>    friction.**
>
> The scripted regression suite is `.claude/skills/beta-test` (`node runner.mjs`).
> Run it first — it is faster and deterministic. This file is the exploratory
> counterpart: wider, adversarial about data integrity, and where "works but is
> wrong-feeling" gets written down.
>
> **Report only** — never print to a real printer, never send real mail. Write a
> separate results file (§7).

---

## HOW TO USE THIS FILE (read this first — it is written for a low-effort agent)

Do the steps **strictly in order, top to bottom.** Every step tells you **WHERE**
to go (a sidebar destination — this app has no URL routes, see §A.2), **WHAT** to
click/type, the **EXACT VALUES** (§2 data tables), **HOW to prove it worked**, and
**what to write down** (a one-line result keyed by the step id).

If a value isn't given, use the one from §2 — never invent your own. Every action
uses the **same 5-move loop** (§A.1). When unsure how to do anything, copy the
worked example in §A.8.

**Leave the library as you found it.** Unlike the restricted-role playbook, this
one writes constantly. Every record you create is tagged `AD<runid>` and every
section below ends with its own cleanup line. A run that leaves twelve orphan
books behind makes the next run's assertions ambiguous.

---

## A. How to drive the browser (Playwright MCP) — read first

### A.0 The tools

Every tool name is prefixed `mcp__playwright__`; short names used below.

| Tool | What it does | Needs `ref`? |
|---|---|---|
| `browser_navigate` | Go to a URL (only ever the app root — §A.2) | no |
| `browser_snapshot` | **Your eyes.** The a11y tree, with a `ref` per element | no |
| `browser_click` | Click an element | **yes** — `element` + `ref` |
| `browser_type` | Type into a field | **yes** |
| `browser_fill_form` | Fill several fields at once — the Add Book / Add User forms | yes |
| `browser_select_option` | `<select>` — Type, Status, Role | **yes** |
| `browser_press_key` | `Enter` / `Escape` / `Tab` — the scanner flow needs this | no |
| `browser_wait_for` | Wait for text (never fixed-sleep) | no |
| `browser_network_requests` | Requests + status codes | no |
| `browser_console_messages` | JS errors, uncaught throws, 5xx | no |
| `browser_take_screenshot` | Pixels — for `NEEDS-HUMAN` records | no |
| `browser_resize` | Viewport (Phase R) | no |
| `browser_handle_dialog` | **Required before every Delete and every Waive** | no |
| `browser_evaluate` | `fetch()` from inside the session — Phase 2.5 | no |
| `browser_tabs` | Two concurrent sessions — Phases 4, F | no |

> `ref`s are valid only for the snapshot they came from. Re-snapshot after
> anything that re-renders.

### A.1 The core loop

Snapshot → locate by **role + accessible name** → act (passing `element` + `ref`)
→ re-snapshot → **assert**. Where a change is meant to persist, prove it: for
this role that usually means the row is still right after navigating away and
back (not after a reload — see Phase F).

### A.2 Finding things — **this app has no URL routes**

`client/src/App.tsx` holds the current screen in React state (`Section`), not in
the URL. There is one URL. So:

- You reach a screen by clicking its **sidebar button** (`client/src/nav.ts`):
  Front Desk, Dashboard, Book Catalog, Borrowers, Circulation, Reservations,
  Fines & Penalties, Reports, Labels & Barcodes, and under **Settings**: Misc,
  **User Management**.
- **A reload always lands on Front Desk.** Expected — but it means a reload
  loses your place mid-task, which is worth a §7b note if it bites you.
- Modals render in place. Find them by heading text and their `Cancel` / confirm
  buttons.
- **No test ids exist.** Icon buttons carry explicit `aria-label`s — `Edit Dune`,
  `Delete Dune`, `Set password for Marcus Lee`, `Remove Fiction`,
  `Borrowing history for Amara Okonkwo`, `Sign out Daveen Dev`. Use those.

### A.3 Waiting

`browser_wait_for` the text you expect — a toast, a new row, a heading. Toasts
fade; assert them promptly. Tables show `Loading…` first.

### A.4 Verifying without eyeballs

- **Network** — the truth about whether a write landed (`201`, `204`, `409`).
- **Console** — the app provokes 4xx deliberately (duplicate holds, suspended
  members, wrong passwords); those are fine. **Uncaught exceptions and 5xx are
  never fine.** A 500 from a constraint the API should have mapped is a bug
  (`server/src/app.ts` maps `23505` → 409 and `23503` → 409; anything reaching
  the generic 500 handler is unmapped).
- **Screenshot** — for genuinely visual judgements (label sheets, the printable
  report letterhead); pair with `NEEDS-HUMAN`.

### A.5 Dialogs and destructive actions — **this matters most in this playbook**

Delete book, delete member, remove staff user and **Waive fine** all go through
native `window.confirm()`. Playwright auto-dismisses an unhandled dialog, so the
delete silently does not happen and a naive assertion ("the row is gone") fails
for a confusing reason — or worse, a "nothing happened" step is recorded as a
pass. **Arm `browser_handle_dialog` immediately before every one of those
clicks.**

### A.6 Recovery moves

- **Click did nothing** → stale `ref`. Re-snapshot.
- **A write appeared to work but the row is unchanged** → check
  `browser_network_requests` for the real status; a 409 surfaces as a toast that
  may already have faded.
- **Which identity am I?** The sidebar footer prints name and role
  (`Daveen Dev` / `Admin`).
- **Lost** → click `Front Desk` and resume.

### A.7 Responsive

`browser_resize` 390×844; below 900px the sidebar is a drawer — click
`Open navigation` first, `Escape` closes it. Resize back to 1400×900.

### A.8 Worked example — one full step, end-to-end (COPY THIS PATTERN)

```
1. browser_snapshot          → find button "Book Catalog" (sidebar)
2. browser_click             → element: "Book Catalog sidebar link", ref: <from 1>
3. browser_wait_for          → text: "Add, edit, search and manage every title"
4. browser_snapshot          → find button "Add Book"
5. browser_click             → opens the modal
6. browser_fill_form         → Title "Playbook Primer AD0914", Author "A. Tester",
                               Subject "Reference", Total Copies 2
7. browser_click             → the modal's `Save Book` button
8. browser_wait_for          → the toast
9. browser_snapshot          → assert the row exists AND that an accession number
                               and barcode were auto-assigned (both non-empty)
→ Record:  PASS   a-cat-create   book created, accession + barcode auto-assigned
```

Generalises: a create step is not done when the toast fires — it is done when the
**record reads back correctly**, including the fields the server filled in.

---

## 0. One-time setup (skip if already done)

### 0a. Browser driver

Playwright MCP must be connected (`mcp__playwright__*` available). If it is not,
stop and say so rather than improvising. Chromium is already present at
`PLAYWRIGHT_BROWSERS_PATH`; never run `playwright install`. Fallback that still
produces real coverage: `cd .claude/skills/beta-test && npm install &&
node runner.mjs` — record clearly in §7 that the run was harness-driven and which
phases were therefore not executed.

### 0b. Postgres

Reachable locally with the credentials in `server/.env`. Create the scratch
database once — idempotent:

```bash
psql -U postgres -c "CREATE DATABASE library_system_playbook;" 2>/dev/null || true
```

### 0c. Dependencies

`npm install` at the repo root.

---

## 1. Per-run setup — reseed and start an isolated stack

0. **Pick free ports.** Try API **4300**, client **5374**; check with
   `ss -ltn | grep -E '4300|5374'` and walk upward if taken. **Never 4000/5173 or
   4100/5273.**

1. **Reseed the scratch database:**

   ```bash
   export PLAYBOOK_DB="postgres://postgres@localhost:5432/library_system_playbook"
   DATABASE_URL=$PLAYBOOK_DB npm run db:push
   DATABASE_URL=$PLAYBOOK_DB npm run db:seed
   ```

   `dotenv` does not override an already-set variable, so the explicit
   `DATABASE_URL` wins over `server/.env`. The seed prints the database it wrote
   to — **if it names your dev database, stop.** The seed is this app's fixture:
   books, members, live loans, overdue fines and four staff accounts (§2).

2. **Start the stack** — two background shells, then poll:

   ```bash
   DATABASE_URL=$PLAYBOOK_DB PORT=4300 npm run dev:server
   VITE_PORT=5374 VITE_API_PROXY=http://localhost:4300 npm run dev:client
   ```

   Wait for `✔ Lumen API listening on http://localhost:4300`, then
   `browser_navigate` `http://localhost:5374` and `browser_wait_for`
   `Staff sign-in`.

   > `AUTH_SECRET` is unset in development, so the API mints a **random signing
   > key per process** (`server/src/lib/auth.ts`): restarting the API invalidates
   > every session. Do not restart mid-run. Phase S records this deliberately.

3. **Generate a `runid`** (e.g. `0914-1145`) and tag everything you create
   `AD<runid>`. The placeholder **`AD0914`** below stands for your real tag.

4. **Sign in as the Admin:** `daveen.dev@lumenlibrary.org` / `lumen-demo-2024`.
   `browser_wait_for` the Front Desk. Snapshot and assert the sidebar footer
   reads `Daveen Dev` / `Admin`. Record
   `a0-baseline PASS signed in as Admin, Front Desk renders, no console throw`.

---

## 2. The user & their data — persona & data tables (USE THESE EXACT VALUES)

You are **Daveen Dev**, the administrator. You run the library and its staff.

### 2.1 Logins (`server/src/db/seed.ts`)

| Identity | Email | Password | Role/status |
|---|---|---|---|
| **Admin (you)** | `daveen.dev@lumenlibrary.org` | `lumen-demo-2024` | Admin, Active |
| Librarian | `e.rossi@lumenlibrary.org` | `lumen-demo-2024` | Librarian, Active |
| Assistant | `m.lee@lumenlibrary.org` | `lumen-demo-2024` | Assistant, Active |
| Disabled | `s.kim@lumenlibrary.org` | `lumen-demo-2024` | Librarian, **Disabled** |

### 2.2 Seeded records

| Kind | Value |
|---|---|
| Books | `Dune` `LIB-000845` · `Atomic Habits` `LIB-000521` · `The Midnight Library` `LIB-000412` · `Clean Code` `LIB-000956` |
| Members | `Amara Okonkwo` `S-1042` · `Dr. Elena Rossi` `F-0231` · `Marcus Bell` `S-1198` (**Suspended**) |
| Live data | active and overdue loans, unpaid fines — the seed backdates them so the Overdue Report and Fines screen are not empty |

If a code is missing after a fresh seed, the seed changed: use what is there and
**say so in the results file**.

### 2.3 Records you create this run (all tagged, all cleaned up)

| Kind | Value | Created in |
|---|---|---|
| Book | `Playbook Primer AD0914`, author `A. Tester`, subject `Reference`, copies 2 | §u-A |
| Member | `Vera Quill AD0914`, Student, grade from the list, `vera.ad0914@student.lumen.org` | §u-B |
| Staff | `Nia Frost AD0914`, `nia.frost.ad0914@lumenlibrary.org`, password `playbook-2026`, Librarian | §u-I |
| Staff | `Passwordless AD0914`, `no.pass.ad0914@lumenlibrary.org`, **no password**, Assistant | §u-I |
| Lookups | shelf `Z-99 AD0914`, subject `Playbook AD0914` | §u-H |

### 2.4 Admin permissions (source of truth: `shared/types.ts`)

All six: `catalog:write`, `members:write`, `circulation:write`, `fines:write`,
`settings:write`, `users:manage`. **Every** control in the app should be present
and working for this account — an absent one is an under-permissioning bug, and
just as reportable as a leak is in the restricted-role playbook.

---

## PHASE 1 — Surface audit (as the Admin)

### a-p1-nav · The sidebar is complete

Snapshot the sidebar. Assert **Main Menu** shows all nine (Front Desk, Dashboard,
Book Catalog, Borrowers, Circulation, Reservations, Fines & Penalties, Reports,
Labels & Barcodes) and **Settings** shows both `Misc` **and** `User Management`.
A missing User Management means the session is not Admin — check the footer role
before doing anything else.

### a-p1-section-* · Every section shows its full control set

Visit each in turn; wait for the subtitle, snapshot, assert, check the console.

| ID | Section | Must be PRESENT |
|---|---|---|
| `a-p1-home` | Front Desk | search; `Borrow` / `Reserve`; `Just Happened` feed |
| `a-p1-dashboard` | Dashboard | stat tiles; Recent Activity; Due Soon; Most Borrowed; Quick Actions (each navigates) |
| `a-p1-catalog` | Book Catalog | `Add Book`; per row `Reserve` + `Edit <title>` + `Delete <title>` |
| `a-p1-borrowers` | Borrowers | `New Member`; per row history + `Edit <name>` + `Delete <name>` |
| `a-p1-circulation` | Circulation | `Check Out` and `Check In / Return` panels; the `Active Loans` table with `Renew` / `Return` |
| `a-p1-reservations` | Reservations | `New Hold`; `Fulfill` / `Cancel` on open holds |
| `a-p1-fines` | Fines & Penalties | summary tiles; `Collect` **and** `Waive` on every Unpaid row |
| `a-p1-reports` | Reports | seven tabs; date range; `Excel` / `PDF` / print |
| `a-p1-labels` | Labels & Barcodes | Books / Borrower IDs; label type; Quantity; `Print Sheet` |
| `a-p1-settings` | Settings → Misc | every policy field **enabled**; `Save Fine Settings`; all four chip lists with `Remove <chip>` and an `Add to <list>` input |
| `a-p1-usermgmt` | User Management | `Add User`; per row `Set password for <name>`, edit, `Remove <name>` — and **no Remove on your own row** (see `a-users-self`) |

Record one line each. Any missing control is a FAIL and a §7c bug.

---

## PHASE 2 — A full working day, module by module

### u-A · Book Catalog — create, read, update, delete

1. **a-cat-create** — `Add Book` → Title `Playbook Primer AD0914`, Author
   `A. Tester`, Subject `Reference`, Total Copies `2`. Leave Accession Number and
   Barcode **blank**. Click `Save Book`. Assert the toast, then find the row and assert both
   an **accession number and a barcode were auto-assigned** (the placeholders
   promise this: "Auto-generated on save").
2. **a-cat-search** — search the new title by **title**, then by its **barcode**,
   then by **author**. Assert each finds it. Searching by a field the UI claims
   to support and getting nothing is a P1.
3. **a-cat-edit** — `Edit Playbook Primer AD0914` → change Shelf to `Z-99 AD0914`
   and Total Copies to `3`. Click `Save Changes`. Assert the row shows the new values, and that
   **available copies moved with total copies** (3 total, 3 available — none are
   lent yet).
4. **a-cat-validation** — open `Add Book`, submit with Title and Author blank.
   Record the message verbatim; then fill them one at a time and assert each
   message clears (this is the `f2` shape, done where the form is).
5. **a-cat-duplicate-barcode** — try to save a second book with barcode
   `LIB-000845` (Dune's). Expect a clean **409 "that value is already taken"**,
   not a 500. A 500 here is a bug (`server/src/app.ts` maps `23505`).
6. **a-cat-delete-guard** — try to `Delete Dune` while it has an active loan
   (arm `browser_handle_dialog` first). Record what happens: a clean refusal
   (409 `referenced record does not exist` / a readable message) is correct; a
   500, or a deletion that orphans a loan, is a **P0 data-integrity bug**.
7. **a-cat-delete** — delete `Playbook Primer AD0914` (dialog armed). Assert the
   row is gone and stays gone after navigating away and back. **Cleanup done.**

### u-B · Borrowers

1. **a-bor-create** — `New Member` → `Vera Quill AD0914`, Type **Student**,
   Grade/Department picked **from the list** (it is fed by the lookup lists —
   remember this for `a-set-propagate`), Email `vera.ad0914@student.lumen.org`,
   Status Active. Save. Assert the row, and that a **member code was
   auto-assigned**.
2. **a-bor-computed** — assert her row shows `0` books out and `0` fines due.
3. **a-bor-history** — open `Borrowing history for Vera Quill AD0914`. Assert a
   clean empty state, not a broken table. (A guided empty state here is worth a
   §7b nod if it is good, and a P1 if it is a bare box.)
4. **a-bor-edit** — edit her to Status **Suspended**. Assert the badge changes.
5. **a-bor-suspend-bites** — try to check a book out to her (Circulation, code
   from step 1). Assert **409 `member is suspended`**, readably. Then set her
   back to Active and assert the checkout now succeeds. Return the book.
6. **a-bor-delete** — delete her (dialog armed). Assert gone. **Cleanup done.**
   If she cannot be deleted because of loan history, that is correct behaviour —
   record it as such, and instead leave her Suspended with the tag in her name.

### u-C · Circulation

1. **a-circ-scan** — Book barcode `LIB-000845`, `Enter`; assert focus moves to
   Member ID; `S-1042`, `Enter` (the second Enter submits; `Confirm Check Out`
   is the mouse equivalent). Assert the toast, cleared fields, refocus on the
   book field, and the new Active Loans row with a due date.
2. **a-circ-due-date** — assert the due date equals today + the **Loan Period**
   currently in Settings. Note the number; Phase 3 changes it and re-checks.
3. **a-circ-renew** — `Renew` the row. Assert the due date extends.
4. **a-circ-return** — return it via the `Check In / Return` panel. Assert the toast reports
   days late and fine amount (0 for a fresh loan) and the row leaves the list.
5. **a-circ-overdue-return** — return one of the **seeded overdue** books.
   Assert a non-zero fine is reported and that a matching row appears in Fines &
   Penalties **without a reload** after navigating there.
6. **a-circ-double-return** — return the same barcode again. Assert a clean
   `loan already returned` (409), no throw.

### u-D · Reservations

1. **a-res-new** — `New Hold`: `Atomic Habits` for `S-1042`. Assert queue
   position 1 (or the next free position).
2. **a-res-queue** — add a second hold on the same title for `F-0231`. Assert
   position 2 and that the two rows order correctly.
3. **a-res-duplicate** — repeat the first hold. Assert a clean duplicate refusal.
4. **a-res-ready** — return the last copy of that title and assert the front hold
   flips to **Ready for pickup** (this is the reservation feature's whole point;
   if it does not flip, that is a P1).
5. **a-res-fulfil** — `Fulfill` the ready hold. Assert the status change.
6. **a-res-cancel** — `Cancel` the remaining hold. Assert the status change and
   sane positions afterwards. **Cleanup done.**

### u-E · Fines & Penalties

1. **a-fine-tiles** — assert the summary tiles (outstanding, collected this
   month, members with fines) show numbers consistent with the table below them.
2. **a-fine-collect** — `Collect` an Unpaid fine. Assert the toast naming the
   amount and member, the row's status becomes Paid, and the **outstanding tile
   drops by that amount without a reload**.
3. **a-fine-waive** — **arm `browser_handle_dialog`**, then `Waive` another
   Unpaid fine. Assert the confirm text names the amount and the member, the
   status becomes Waived, and the tiles move.
4. **a-fine-waive-dismiss** — arm the dialog to **dismiss**, click `Waive` on a
   third fine, and assert **nothing changed**. A confirm that acts on dismissal
   is a P0.
5. **a-fine-terminal** — assert a Paid/Waived row offers no further action.

### u-F · Reports & exports

1. **a-rep-tabs** — visit all seven: `Overdue Report`, `Fines & Penalties`,
   `List of Books`, `Most Borrowed`, `Inventory`, `Transaction Log`,
   `Member Activity`. Assert each renders its documented columns
   (`client/src/pages/Reports.tsx` → `COLUMNS`) and either rows or a clean empty
   state. One line per tab.
2. **a-rep-range** — set a range that excludes everything (e.g. two dates in
   1990). Assert an honest empty state, not a crash or a silently ignored range.
   Then restore a sensible range and assert rows return.
3. **a-rep-consistency** — cross-check one number against another screen: the
   Overdue Report's row count vs. the Dashboard's overdue tile. A mismatch is a
   real finding — record both numbers.
4. **a-rep-excel** / **a-rep-pdf** — trigger each export and record the
   downloaded filename. **Do not open or assert the file contents** (§5).
5. **a-rep-print** — the print button opens the browser's print dialog. Dismiss
   it; record `SKIPPED (external) — printing`. Screenshot the on-screen
   letterhead sheet as a `NEEDS-HUMAN` visual record.

### u-G · Labels & Barcodes

1. **a-lab-book-barcode** — Label for **Books**, type `Spine + Barcode`,
   Quantity `2`.
   Assert two label elements render with a real generated code (an `svg`/`img`
   per label, not an empty frame).
2. **a-lab-book-qr** — same with `QR Pocket`. Assert QR images render.
3. **a-lab-borrower** — Label for **Borrower IDs**, quantity `1`, both types.
   Assert the card renders the member code.
4. **a-lab-quantity** — set a larger quantity (e.g. `12`) and assert the sheet
   grows to match. A quantity that is ignored is a P1 — it is the one control on
   this screen.
5. **a-lab-print** — `Print Sheet` opens the print dialog; dismiss and record
   `SKIPPED (external)`.

### u-H · Settings → Misc

1. **a-set-read** — assert every policy field is **enabled** and shows current
   values. Note them all; you will restore them in `a-set-restore`.
2. **a-set-save** — change **Daily Fine Rate** to `5.00`, **Grace Period** to
   `0`, **Loan Period** to `3` days. `Save Fine Settings`. Assert the toast, then
   navigate away and back and assert the values **persisted**.
3. **a-set-invalid** — try a nonsense value (negative rate, a letter, an absurd
   number). Assert a clean validation refusal (the server validates with zod:
   `server/src/lib/validate.ts`), not a 500 and not a silent save.
4. **a-set-lookup-add** — add shelf `Z-99 AD0914` and subject `Playbook AD0914`.
   Assert both chips appear.
5. **a-set-propagate** — **the cross-screen check.** Without reloading, open
   `Add Book`: does the Subject list offer `Playbook AD0914`? Open `New Member`:
   does Grade offer the list you edited? A chip that only shows after a reload is
   a **P1 stale view** — log it in §7c with the reload that fixes it.
6. **a-set-lookup-remove** — remove both chips. Assert they are gone, and decide
   (and record) what happens to a book already using that subject — orphaned
   value or blocked removal; either can be right, but the app should not crash.
7. **a-set-appearance** — change theme and accent. Assert the UI changes and
   that the change persists across a navigation. **Note:** appearance is stored
   in the single settings row, not per user (`server/src/routes/settings.ts`), so
   it applies to **every** staff account — confirm that in Phase 4 with a second
   session and record it as an observation.

### u-I · User Management

1. **a-users-list** — assert all four seeded accounts list with role and status,
   and that **no password hash or password field** appears anywhere in the row
   data (the server selects explicit public columns; confirm the UI matches).
2. **a-users-create** — `Add User` → `Nia Frost AD0914`,
   `nia.frost.ad0914@lumenlibrary.org`, password `playbook-2026`, Role
   **Librarian**, Status Active. `Create User`. Assert the row.
3. **a-users-duplicate-email** — create another with the same email. Assert a
   clean **409 "that value is already taken"**, not a 500.
4. **a-users-passwordless** — create `Passwordless AD0914`
   (`no.pass.ad0914@lumenlibrary.org`, Assistant) **with the password field
   blank**, if the form allows it. The API stores a null hash and the account
   "cannot sign in until an Admin sets a password" (`server/src/routes/users.ts`).
   Sign out, try to sign in as it, and assert it is refused with the same generic
   `incorrect email or password` — **not** a message that reveals the account
   exists without a password. Sign back in as Admin. If the form requires a
   password, record `SKIPPED (form requires a password)` and note that the API
   path is therefore unreachable from the UI.
5. **a-users-setpassword** — `Set password for Passwordless AD0914` → set
   `playbook-2026`. Sign out, sign in as that account, assert it works, sign back
   in as Admin. This is the real-world "member of staff is locked out" flow and
   it is worth proving end to end.
6. **a-users-role-change** — change `Nia Frost AD0914` from Librarian to
   Assistant. Assert the row updates. (Phase 4 checks what that does to a live
   session.)
7. **a-users-disable** — set `Nia Frost AD0914` to **Disabled**. Sign out, try to
   sign in as her, assert `this account has been disabled`. Sign back in as Admin.
8. **a-users-self-role** — try to change **your own** role or status. The API
   answers **409 `you cannot change your own role or status`**. Assert the UI
   surfaces that readably — and note in §7b whether the control should be
   disabled up front rather than failing on submit.
9. **a-users-self-delete** — try to remove **your own** account (dialog armed).
   Assert **409 `you cannot remove your own account`**, and that you are still
   signed in afterwards.
10. **a-users-last-admin** — demote or disable **the only other Admin**, if one
    exists, and check whether the app can be left with **zero** Admins. The code
    guards self-change only (`server/src/routes/users.ts`), so an Admin
    demoting a second Admin while a third disables the first is possible in
    principle. Record what you find: if a single Admin can end up with no Admin
    account able to sign in, that is a **P1 lockout risk** even though no single
    call is "wrong". Restore any account you changed.
11. **a-users-delete** — remove `Nia Frost AD0914` and `Passwordless AD0914`
    (dialog armed each time). Assert both gone. **Cleanup done.**

---

## PHASE 3 — Policy actually bites (does Settings reach the domain logic?)

A settings screen that saves values nothing reads is worse than no settings
screen. With the policy from `a-set-save` in place (rate `5.00`, grace `0`, loan
period `3`):

1. **a-pol-loan-period** — check a book out. Assert the due date is **today + 3
   days**, matching the new Loan Period. If it still uses the old period, the
   setting is decorative — **P1**.
2. **a-pol-fine-rate** — take a seeded overdue book back and assert the fine
   reported equals `days overdue × 5.00`, capped at the Maximum Fine Cap, with
   the grace period applied (`server/src/lib/domain.ts` → `computeFine`,
   `overdueDays`). Record the numbers you saw and the arithmetic you expected.
3. **a-pol-grace** — set Grace Period to a number larger than a loan's days
   overdue, take that book back, and assert the fine is **zero**.
4. **a-pol-cap** — set Maximum Fine Cap low (e.g. `1.00`) and assert a long
   overdue return is capped at it.
5. **a-pol-autosuspend** — **named check.** Settings offers *"Auto-suspend After
   (days overdue)"* and the value is stored (`settings.auto_suspend_days`), but
   a grep of `server/src` finds **no code that ever sets a member to
   Suspended** — only the checkout/hold guards that read an already-Suspended
   status. Verify that: set it to `1`, leave a member well past due, and check
   whether they are ever auto-suspended. If not, this is a **P1 "setting that
   does nothing"** — the screen promises enforcement the system does not do.
   Record it in §7c with the file, and in §7b with the suggestion (implement it,
   or label the field as advisory).
6. **a-pol-email-reminders** — same shape for the *"Send automatic email
   reminders"* checkbox. Email is **unimplemented** (the beta-test skill says so
   in its coverage note). Assert the checkbox saves, and record the same
   finding: a toggle that changes nothing. Do **not** attempt to trigger a real
   send.
7. **a-set-restore** — put every policy value back to what `a-set-read` recorded.
   Assert they persisted. **Cleanup done.**

---

## PHASE 4 — Admin power over other people's sessions (two tabs)

Use `browser_tabs`: tab 1 = you (Admin), tab 2 = a colleague signed in as
`m.lee@lumenlibrary.org` / `lumen-demo-2024` (Assistant).

1. **a-x-disable-live** — with tab 2 signed in and working, disable that account
   from tab 1. In tab 2, **without reloading**, click any destination that hits
   the API. `requireAuth` re-reads the account on every request, so tab 2 should
   401 and drop straight to the login form. Assert that. If tab 2 keeps working,
   a disabled account retains access for up to the 8-hour session TTL — **P0**.
   Re-enable the account afterwards.
2. **a-x-role-change-live** — promote the Assistant in tab 2 to **Librarian**
   from tab 1. In tab 2 without reloading, does Book Catalog gain `Add Book`?
   Permissions are fetched once at sign-in (`client/src/auth.tsx`), so expect
   **no** until reload — while the server will now accept the write. Record it:
   a UI that hides a control the server allows is a **P2 staleness** note (the
   safe direction); the reverse — a control still shown after a **demotion**,
   which then 403s — is the same bug in the unsafe direction, so **test the
   demotion too** and record both.
3. **a-x-appearance-global** — change the theme in tab 2 (appearance is writable
   by every role) and reload tab 1. If your Admin theme changed, confirm the
   finding from `a-set-appearance`: **appearance is global, not per user**, and
   the most restricted account can change it for everyone. Record in §7c (repro)
   and §7b (suggestion: per-user appearance, or gate it behind
   `settings:write`).
4. **a-x-concurrent-write** — both tabs edit the **same** record (e.g. both open
   `Edit Dune`, both save different shelves). Record what happens: last-write-
   wins is acceptable and worth documenting; a 500 or a corrupted row is not.
   The beta harness explicitly does not cover two staff at once, so this is the
   only place it gets tested.
5. Sign tab 2 out and close it.

---

## PHASE 2.5 — Server-side sweep (as the Admin)

Drive `fetch()` from inside your own session with `browser_evaluate`. For the
Admin the interesting answers are the **refusals that should still happen** —
everything else is a 200 and proves little.

| ID | Call | Expected |
|---|---|---|
| `a-api-me` | `GET /api/auth/me` | 200; `permissions` contains **all six** |
| `a-api-users-read` | `GET /api/users` | 200, and **no `passwordHash` field** on any row — the router selects public columns; a hash in the payload is a **P0 credential leak** |
| `a-api-write-any` | `POST /api/books`, `POST /api/members`, `POST /api/fines/<id>/collect`, `PUT /api/settings {dailyFineRate}`, `POST /api/settings/lookups/shelf` | 200/201 each — an unexpected 403 means the Admin is under-permissioned |
| `a-api-self-role` | `PATCH /api/users/<ownId>` `{"role":"Librarian"}` | **409** `you cannot change your own role or status` |
| `a-api-self-status` | `PATCH /api/users/<ownId>` `{"status":"Disabled"}` | **409** |
| `a-api-self-delete` | `DELETE /api/users/<ownId>` | **409** `you cannot remove your own account` |
| `a-api-self-rename` | `PATCH /api/users/<ownId>` `{"name":"Daveen Dev AD0914"}` | 200 — renaming yourself is allowed; the guard is role/status only. Rename back |
| `a-api-bad-id` | `PATCH /api/users/999999` | 404 `user not found`, not a 500 |
| `a-api-bad-body` | `POST /api/books` `{}` | 400-class validation error with a readable message, not a 500 |
| `a-api-404` | `GET /api/no-such-thing` | 404 `{"error":"not found"}` |
| `a-api-unauth` | the same calls from a fresh, signed-out tab | 401 `sign in to continue` — **every** one of them, `/api/users` included |

Clean up anything these probes created (the probe book, the probe lookup, the
policy change) before moving on.

---

## PHASE R — Responsive

1. **r-mobile-nav** — 390×844: `Open navigation` present; the drawer lists all
   nine + Misc + **User Management**; `Escape` closes it.
2. **r-mobile-circulation** — run one full scan-checkout and return at 390×844.
3. **r-mobile-forms** — open `Add Book` and `Add User` at 390×844. Assert every
   field is reachable and the save button is not pushed off-screen.
4. **r-mobile-tables** — Catalog, Fines, User Management: do the wide tables
   scroll rather than overflow the page? Visual → `NEEDS-HUMAN` + screenshot.
5. **r-tablet** — repeat `r-mobile-nav` and one form at 768×1024.
6. Resize back to 1400×900.

---

## PHASE S — Session & auth lifecycle

1. **s-reload-persists** — reload. Assert still signed in (httpOnly cookie
   re-checked via `/auth/me`) and that you land on **Front Desk** — the section
   is not in the URL. Record whether losing your place mid-task feels like a bug
   (§7b).
2. **s-signout-clears** — sign out; assert the login form; press back; assert no
   authenticated content returns from cache.
3. **s-bad-password** — wrong password → `incorrect email or password`, naming
   neither half. **Keep failed attempts under 8 per email** —
   `server/src/routes/auth.ts` throttles at `MAX_ATTEMPTS = 8` per email+IP over
   10 minutes, then answers 429. If you trip it, record it and wait; do **not**
   restart the API to clear it (that invalidates every session, §1 step 2).
4. **s-throttle** — *optional, run last if at all:* deliberately exceed 8 failed
   attempts on a **throwaway** address and assert the 429 message
   (`too many sign-in attempts — try again in a few minutes`). Never do this on
   an address you still need this run.
5. **s-disabled** — sign in as `s.kim@lumenlibrary.org`; assert
   `this account has been disabled` (403) and that you stay on the login form.
6. **s-server-restart** — *documented, not required:* restarting the API in
   development regenerates the random signing key, so every session ends. If you
   restart for any reason, record it as the cause of any sudden sign-out rather
   than filing a session bug.

---

## PHASE F — Friction sweep (the checks the happy path never makes)

Two rules:

- **No reloading.** Sidebar navigation only. A reload hides staleness. If you
  reload by accident, that step's result is void — redo it.
- **Assert the negative** — read absences out of the snapshot.

### F-1 · Create on one screen, consume on another (no reload)

| ID | Create | Consume | Assert |
|---|---|---|---|
| `f1-subject-picker` | Settings → add subject `Playbook AD0914` | Catalog → `Add Book` → Subject | the new subject is offered |
| `f1-grade-picker` | Settings → add grade `Grade 13 AD0914` | Borrowers → `New Member` → Grade | the new grade is offered |
| `f1-book-circulation` | Catalog → add `Playbook Primer AD0914` | Circulation → scan its new barcode | checkout succeeds |
| `f1-member-circulation` | Borrowers → add `Vera Quill AD0914` | Circulation → scan her new code | checkout succeeds |
| `f1-fine-appears` | Circulation → return an overdue book | Fines & Penalties | the new fine is listed |
| `f1-dashboard-counters` | any of the above | Dashboard | the tiles moved |

A value that only appears after a reload is a **P1 stale view** — the exact bug
class this phase exists for. Log it in §7c with the reload that fixes it.
**Clean up every record created here.**

### F-2 · Validation recovery on every create form

Drive **empty-first**: submit blank, record each message verbatim, then satisfy
fields one at a time, asserting each message and its highlight clears as soon as
its field is valid. Nothing may remain once all are filled.

| ID | Form |
|---|---|
| `f2-add-book` | Add Book (Title, Author required) |
| `f2-add-borrower` | New Member (Full Name required) |
| `f2-add-user` | Add User (Name, Email, Password required) — also try an email that is not an email |
| `f2-settings` | Settings policy fields — a letter in a numeric field |
| `f2-login` | the sign-in form (mind the 8-attempt throttle) |

A message that survives its field being fixed is a **P1**; one that survives a
**successful** submit is **P0**.

### F-3 · No-manual-reload recovery

`f3-nav-recovery` — after any refused action (409 duplicate, 409 suspended
member, a validation failure), navigate away via the sidebar and back. Assert the
screen renders clean: no stale error, no half-open modal, no lingering toast.

---

## 3. Per-step procedure (applies to every step above)

1. **Act** — as Daveen would (§A loop). Arm `browser_handle_dialog` before every
   delete and every waive.
2. **Assert** — through the UI *and* the network. A create is proven by the
   record reading back correctly, including server-filled fields.
3. **Record** one result line (§4), keyed by the step id.
4. **Record every bug — always, in the same pass** — in **§7c**, not merely as a
   `FAIL` line. Each entry: step id, symptom, exact repro, file/route if known.
5. **Note UX friction** — anything that would slow a real administrator: a
   confirm that does not say what it will destroy, a setting that saves but does
   nothing, an error that reads like a crash. **§7b**, even when the step PASSes.

> **Bug + UX improvement travel together.** Every §7c entry has a matching
> `→ Suggestion:` line in §7b.

> **Three bug shapes to name explicitly.** A **stale view** (correct only after a
> reload). A **sticky validation message** (still showing after its field was
> fixed). An **inert setting** (saves, but nothing reads it — see
> `a-pol-autosuspend`). Log any of them in §7c whenever you see them, in any
> phase.

## 4. Result statuses

- **PASS** — the assertion held, including "the app correctly refused this".
- **FAIL** — errored, the assertion did not hold, or a control the Admin should
  have was missing. Add a short parenthetical symptom.
- **BLOCKED** — a prerequisite step failed. Name the blocker.
- **NEEDS-HUMAN** — driven, but the judgement is visual (label sheets, the
  printable report).
- **SKIPPED (external)** — real printing, real mail. Never trigger one.

## 5. Scope & safe-skips

The §1 reseed is the only destructive setup action and it targets the scratch
database only. Never point any step at the dev database or at ports
4000/5173/4100/5273. Not covered, and say so in the report: printing to paper,
the **contents** of exported XLSX/PDF (the download is triggered and named, never
opened), real barcode-scanner hardware, email reminders (unimplemented), and any
browser other than Chromium. Two-staff concurrency **is** covered here
(Phase 4) — the scripted harness does not cover it, so those results are the
only signal that exists.

## 6. Orientation aids

- **Roles and permissions:** `shared/types.ts` → `Permission`,
  `ROLE_PERMISSIONS`, `roleCan`.
- **Sections:** `client/src/nav.ts` (`NAV_ITEMS`, `SETTINGS_ITEMS`,
  `SECTION_PERMISSION`); screens in `client/src/pages/`.
- **Server gating:** `server/src/app.ts` (mount order; `writesRequire` lets GETs
  through for any signed-in account; `/api/users` is
  `requirePermission("users:manage")`), `server/src/lib/auth.ts` (`requireAuth`
  re-reads the account on every request — the basis of `a-x-disable-live`),
  `server/src/routes/settings.ts` (`APPEARANCE_FIELDS`),
  `server/src/routes/users.ts` (the two 409 self-protection rules and the public
  column list).
- **Domain rules:** `server/src/lib/domain.ts` (`computeFine`, `overdueDays`,
  `loanStatus`), validated by `server/tests/*.test.ts`.
- **Validation:** `server/src/lib/validate.ts` (zod schemas; the source of the
  messages `f2-*` asserts).
- **Fixtures:** `server/src/db/seed.ts`, mirrored in
  `.claude/skills/beta-test/personas.mjs`.
- **Existing scripted coverage:** `.claude/skills/beta-test/journeys/` — run it
  first. Where this playbook and a journey disagree, the code is the tie-breaker
  and one of the two needs updating.

## 7. Output (the artifact that matters)

Write one file, phase-grouped, one line per step id:

`.claude/playbooks/admin-journey-results/admin-run-YYYYMMDD-HHMM.md`
(create `admin-journey-results/` if it does not exist)

Three **required** sections: **§7a results table**, **§7b UX / admin friction
notes**, **§7c Bugs found**. A run that found bugs but recorded no §7c entries is
an **incomplete run**.

### 7a. Results format

```
# Admin Journey — <YYYY-MM-DD HH:MM> (scratch DB, API <PORT>, client <PORT>)

Account: daveen.dev@lumenlibrary.org (Admin)
Created and cleaned up: book Playbook Primer AD0914 · member Vera Quill AD0914 ·
staff Nia Frost AD0914, Passwordless AD0914 · lookups Z-99 AD0914, Playbook AD0914
Policy restored to: rate <x>, grace <y>, cap <z>, loan period <n>, auto-suspend <m>

## Bootstrap
PASS   a0-baseline          signed in as Admin, Front Desk renders

## Phase 1 — Surface audit
PASS   a-p1-nav             nine Main Menu items + Misc + User Management
PASS   a-p1-catalog         Add Book + per-row Reserve/Edit/Delete present
...    (one line per a-p1-* id)

## Phase 2 — A full working day
PASS   a-cat-create         book created, accession + barcode auto-assigned
PASS   a-cat-duplicate-barcode  409 "that value is already taken" (not a 500)
FAIL   a-cat-delete-guard   deleting a loaned book returned 500 (see §7c P0)
PASS   a-circ-scan          two Enters complete the checkout, focus returns
PASS   a-fine-waive-dismiss dismissing the confirm changed nothing
...    (one line per id, in section order u-A … u-I)

## Phase 3 — Policy actually bites
PASS   a-pol-loan-period    due date honoured the 3-day loan period
FAIL   a-pol-autosuspend    setting stored but never enforced (see §7c P1)

## Phase 4 — Admin power over other sessions
PASS   a-x-disable-live     tab 2 dropped to the login form on its next request

## Phase 2.5 — Server-side sweep
PASS   a-api-users-read     200, no passwordHash in the payload
PASS   a-api-self-role      409 "you cannot change your own role or status"
...

## Phase R — Responsive
## Phase S — Session & auth lifecycle
## Phase F — Friction sweep

— Items: N · PASS x · FAIL y · BLOCKED z · NEEDS-HUMAN w · SKIPPED s
```

If every checkable item passed:
`Admin whole-system journey passing — N checkable items (M NEEDS-HUMAN).`

### 7b. UX / admin friction notes (required)

A `## Admin friction observations` section. One line each: where the friction
hit, what happened, the file if known, **and a concrete `→ Suggestion:`**. Group
**P0** (destructive action without adequate confirmation; a crash on a core
screen), **P1** (a setting that promises enforcement it does not do; a stale
view; a lockout risk), **P2** (polish — a confirm that does not name what it will
delete, a control that fails on submit where it could have been disabled). This
role's characteristic failure is **the quiet lie**: a saved value nothing reads.
"No friction noted this run" is a valid line; write it explicitly.

### 7c. Bugs found (required)

```
## Bugs found

### P0
- **a-cat-delete-guard** — Symptom: deleting a book with an active loan returned
  500 "internal error" instead of a mapped 409.
  Repro: Admin → Book Catalog → Delete Dune (which has an active loan) → confirm.
  File/route: server/src/routes/books.ts DELETE + the 23503 mapping in
  server/src/app.ts.

### P1
- **a-pol-autosuspend** — Symptom: "Auto-suspend After (days overdue)" saves but
  nothing ever suspends a member; no code path in server/src sets status to
  Suspended.
  Repro: set it to 1 → leave a loan days overdue → the member stays Active.
  File/route: settings.auto_suspend_days is written by
  server/src/routes/settings.ts and read by nothing.
```

If a run genuinely found nothing, write `No bugs found this run.` — never omit
the section.

## 8. Re-run

Execute this file. Complements:

- `.claude/playbooks/user-journey-playbook.md` — the restricted-role counterpart
  (Assistant; proves the write cage holds). Run both when permissions change:
  this one proves the Admin can do everything, that one proves nobody else can.
- `.claude/skills/beta-test` — the scripted regression suite; run it first, it is
  cheaper and deterministic.

Re-run this playbook whenever `shared/types.ts`, `server/src/app.ts`,
`server/src/lib/auth.ts`, `server/src/routes/users.ts`,
`server/src/routes/settings.ts`, `server/src/lib/domain.ts`, or any page under
`client/src/pages/` changes — and always before tagging a release.

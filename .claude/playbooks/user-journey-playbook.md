# Recurring Playbook — User Journey (restricted staff account, circulation-only)

**Created:** 2026-09-14
**Recurrence:** on demand (re-execute this file any time)
**Driver:** Playwright MCP (interactive — the AI drives a real Chromium via accessibility snapshots). **Read §A "How to drive the browser" before starting** — it is the concrete how-to; everything below it is the what-to-do.
**App URL:** `http://localhost:<CLIENT_PORT>` — **pick free ports at run start** (see §1 step 0). **Do NOT use 4000/5173** (the developer's own `npm run dev` stack) **or 4100/5273** (the `beta-test` harness). Suggested first try: API **4300**, client **5374**.
**Data isolation:** a dedicated scratch Postgres database (`library_system_playbook`), pushed and **reseeded fresh every run**.

> **Port convention — read once, applies everywhere below.** This file writes
> example URLs as `http://localhost:5374/…` and API probes as `/api/…` (same
> origin — Vite proxies `/api` to the API port). Wherever you see **5374** or
> **4300**, substitute the ports you actually chose in §1 step 0.

> **Who "the user" is in this app.** Lumen has **no borrower/public login** —
> every account is a staff account, and the three roles are **Admin**,
> **Librarian**, **Assistant** (`shared/types.ts` → `ROLE_PERMISSIONS`). The
> most restricted login the app offers is **Assistant**, which holds exactly
> one permission: `circulation:write`. That is "the user" for this playbook.
> The Admin counterpart is `.claude/playbooks/admin-journey-playbook.md`.
>
> **The cage in this app is on writes, not on screens — know this before you
> start, or you will file nine false P0s.** Every signed-in staff account may
> **read** every section: the sidebar renders all nine Main Menu destinations
> plus Settings → Misc for all three roles, and `server/src/app.ts` mounts each
> router behind `writesRequire(...)`, which lets `GET`/`HEAD`/`OPTIONS`
> through for anyone signed in. Exactly **one** destination is hidden by role —
> **User Management** (`SECTION_PERMISSION.userManagement = "users:manage"` in
> `client/src/nav.ts`), whose whole router is admin-only
> (`requirePermission("users:manage")`). So a restricted account *seeing* the
> Fines table or the Reports screen is **correct behaviour**, not a leak. A
> leak is: a **write control that is visible or works**, or a **write endpoint
> that answers anything but 403**.
>
> You will:
>
> 1. **Phase 1 — Role-boundary audit.** Prove the sidebar hides User Management
>    and nothing else, and walk **all ten reachable sections** confirming that
>    each one shows exactly the controls an Assistant should have and none of
>    the ones it should not.
> 2. **Phase 2 — Do the job the role exists for.** A full circulation shift:
>    borrow from the Front Desk, scan-checkout and scan-return on Circulation,
>    renew, place and fulfil a hold, cancel a hold — and confirm the read-only
>    screens (Catalog, Borrowers, Fines, Reports, Labels, Settings) are usable
>    but inert.
> 3. **Phase 2.5 — Server-side authorization sweep.** Hidden buttons are not a
>    boundary. Drive `fetch()` from inside the Assistant's own session and
>    confirm every forbidden write answers **403** — and that the ones the role
>    *is* meant to make still answer 200/201.
> 4. **Phase R / S / F — responsive, session lifecycle, friction.** The drawer
>    nav on a phone, sign-out and mid-session account disable, and the two bug
>    classes a happy path structurally cannot see (stale views, sticky
>    validation).
>
> This is a **journey / role-boundary** test. The scripted regression suite is
> `.claude/skills/beta-test` (`node runner.mjs`) — run that too; it is faster
> and deterministic. This file is the exploratory counterpart: it goes wider,
> probes the server directly, and is where "limited vs. broken" perception
> problems get written down.
>
> **Report only** — never print to a real printer, never send real mail. Write
> a separate results file (§7).

---

## HOW TO USE THIS FILE (read this first — it is written for a low-effort agent)

Do the steps **strictly in order, top to bottom.** Do not skip ahead. Every step
tells you exactly:

- **WHERE** to go (a sidebar destination, since this app is a single page — see
  the note in §A.2),
- **WHAT** to click/type (by the on-screen control name),
- **the EXACT VALUES** to enter (copy them literally from the data tables in §2),
- **HOW to prove it worked** (the assertion), and
- **what to write down** (a one-line result keyed by the step id).

If a value isn't given, use the one from the **§2 data tables** — never invent
your own. Every action uses the **same 5-move loop** from §A.1 (snapshot → find →
act → re-snapshot → assert). When unsure how to do *anything*, copy the worked
example in §A.8. If you get stuck, use the recovery moves in §A.6.

**Which login am I?** §1.B does a short bootstrap as **Admin** (to create the
run-tagged Assistant account and note the fixture ids). **B4 hands the session
over to the Assistant, and everything from Phase 1 onward is done as the
Assistant.** If **User Management** ever appears in the sidebar during Phase 1–2,
you are still Admin: sign out and sign back in as the Assistant before
continuing.

---

## A. How to drive the browser (Playwright MCP) — read first

You control a **real Chromium** through Playwright MCP tools. You never "see"
the page as pixels by default — you read its **accessibility snapshot** (a text
tree of roles + names), find the element you want, and act on it by its `ref`.

### A.0 The tools (and the one job of each)

Every tool name is prefixed `mcp__playwright__` (e.g. `mcp__playwright__browser_click`);
short names are used below for brevity.

| Tool | What it does | Needs `ref`? |
|---|---|---|
| `browser_navigate` | Go to a URL (only ever the app root here — see §A.2) | no |
| `browser_snapshot` | **Your eyes.** The a11y tree, with a `ref` per element | no |
| `browser_click` | Click an element | **yes** — `element` + `ref` |
| `browser_type` | Type into a field | **yes** — `element` + `ref` + `text` |
| `browser_fill_form` | Fill several fields in one call | yes |
| `browser_select_option` | Pick from a `<select>` | **yes** |
| `browser_press_key` | Press a key (`Enter`, `Escape`, `Tab`) — the scanner flow needs this | no |
| `browser_wait_for` | Wait for text to appear/disappear (never fixed-sleep) | no |
| `browser_network_requests` | Requests + status codes — how you prove a 403 | no |
| `browser_console_messages` | JS errors, uncaught throws, 5xx | no |
| `browser_take_screenshot` | Pixels — for `NEEDS-HUMAN` visual records | no |
| `browser_resize` | Viewport (Phase R) | no |
| `browser_handle_dialog` | **Required.** Deletes and waives use native `window.confirm()` | no |
| `browser_evaluate` | Run JS in the page — **the Phase 2.5 API sweep depends on this** | no |
| `browser_tabs` | List/open/close/select tabs — Phase F and S need two sessions | no |

> `ref` values come **from the most recent `browser_snapshot`** and are valid
> only for it. After any click that re-renders, any modal open/close, or any
> list refresh, old refs are **stale** — re-snapshot before acting.

### A.1 The core loop (do this for every action)

1. **Snapshot** — `browser_snapshot`. Read the tree.
2. **Locate** — find the target by **role + accessible name** (priority:
   `role+name` → visible text → label/placeholder). Note its `ref`.
3. **Act** — `browser_click` / `browser_type` / …, passing a short human
   `element` description *and* the `ref`.
4. **Re-snapshot** — the page changed; refs are stale.
5. **Assert** — confirm the expected change: a row appeared, a toast fired, a
   button is absent, a request returned 403.

### A.2 Finding things — **this app has no URL routes**

`client/src/App.tsx` keeps the current screen in React state (`Section`), not in
the URL. There is **one** URL. Consequences you must internalise:

- **You cannot deep-link.** "Navigate to /catalog" is meaningless here. You get
  to a screen by clicking its **sidebar button** — `button "Book Catalog"`,
  `button "Fines & Penalties"`, and so on (`client/src/nav.ts` → `NAV_ITEMS`).
- **Reloading always lands on Front Desk** (`section` resets to `home`). That is
  expected, not a bug — but it also means a reload destroys your place, which is
  why Phase F forbids reloading.
- **A hidden destination is genuinely unreachable** by a restricted role: there
  is no address to type. The client-side boundary is therefore only as strong as
  the sidebar filter, and the *real* boundary is the API — hence Phase 2.5.
- Modals (Add Book, Borrow, New Hold, borrowing history) render in place, not in
  a portal. Find them by their heading text and their `Cancel` / confirm buttons.
- **Test ids do not exist in this codebase.** Everything is addressed by
  accessible name. Where a control is an icon button it carries an explicit
  `aria-label` — e.g. `Edit Dune`, `Delete Dune`, `Remove Fiction`,
  `Borrowing history for Amara Okonkwo`, `Sign out Marcus Lee`. Use those.

### A.3 Waiting

After any action, `browser_wait_for` the **text you expect** (a toast, a row, a
heading). Tables render `Loading…` / an empty-state row first; waiting on the
real text avoids asserting against a skeleton. Toasts fade — assert them
promptly.

### A.4 Verifying without eyeballs

- **Network** — `browser_network_requests` is how you prove a boundary: a `403`
  on `POST /api/books`, a `401` after the account is disabled.
- **Console** — `browser_console_messages`. The app provokes 4xx on purpose
  (wrong password, suspended member); those are fine. **Uncaught exceptions and
  5xx are never fine** — a screen that renders but threw is a FAIL.
- **Screenshot** — only for genuinely visual judgements; pair with `NEEDS-HUMAN`.

### A.5 Dialogs and destructive actions

Delete (book, member, staff) and **Waive fine** go through native
`window.confirm()`. Playwright auto-dismisses an unhandled dialog, so the action
silently does nothing and your step "passes" for the wrong reason. **Arm
`browser_handle_dialog` before any such click.** As the Assistant you should
never reach one of these — if you do, that is itself the finding.

### A.6 Recovery moves

- **Click did nothing** → almost always a stale `ref`. Re-snapshot, click again.
- **A write control you expected to be absent is present** → do not assume it
  works. Click it, drive it to submit, and read the network: a visible control
  the server refuses at 403 is a **P2 UX bug** (the app shouldn't offer it); a
  visible control that **succeeds** is a **P0 boundary leak**. Record which.
- **Which identity am I?** Snapshot the sidebar footer: it prints the account
  name and role (`Marcus Lee` / `Assistant`). That is the fastest identity check
  in the app.
- **Lost** → click `Front Desk` in the sidebar and resume.

### A.7 Responsive

`browser_resize` to 390×844. Below 900px the sidebar becomes an off-canvas
drawer: click `button "Open navigation"` first, then the destination. `Escape`
closes it. Resize back to 1400×900 when done.

### A.8 Worked example — one full step, end-to-end (COPY THIS PATTERN)

```
1. browser_snapshot                → find button "Book Catalog" in the sidebar
2. browser_click                   → element: "Book Catalog sidebar link", ref: <from 1>
3. browser_wait_for                → text: "Add, edit, search and manage every title"
4. browser_snapshot                → assert: NO button named "Add Book"
                                   → assert: NO control named "Edit Dune" / "Delete Dune"
                                   → assert: control "Reserve Dune" IS present (circulation:write)
5. browser_console_messages        → clean of uncaught errors
→ Record:  PASS   u-p1-catalog   read-only: no Add/Edit/Delete, Reserve present
```

Generalises: for this role most steps prove **a control is absent** or **a
request is refused**. Asserting an absence means reading it out of the snapshot —
never assuming it.

---

## 0. One-time setup (skip if already done)

### 0a. Browser driver

Playwright MCP must be connected (`mcp__playwright__*` tools available). If it
is not, stop and say so rather than improvising — do **not** substitute
`curl` for the browser phases. Chromium is already present in this environment
at `PLAYWRIGHT_BROWSERS_PATH`; never run `playwright install`.

If Playwright MCP is unavailable, the fallback that still produces real
coverage is the repo's own harness:
`cd .claude/skills/beta-test && npm install && node runner.mjs --only role`.
Record clearly in §7 that the run was harness-driven and which phases were
therefore not executed.

### 0b. Postgres

A local Postgres reachable with the credentials in `server/.env`
(`DATABASE_URL`). Create the scratch database once — idempotent:

```bash
psql -U postgres -c "CREATE DATABASE library_system_playbook;" 2>/dev/null || true
```

Its contents are disposable: §1 reseeds it every run.

### 0c. Dependencies

`npm install` at the repo root (workspaces: `shared`, `server`, `client`).

---

## 1. Per-run setup — reseed, start an isolated stack, bootstrap the account

> **Three sets of credentials, don't confuse them.** The **database** login is in
> `DATABASE_URL`. The **app** logins are seeded staff accounts sharing the demo
> password `lumen-demo-2024` (`server/src/db/seed.ts`). The **run-tagged
> Assistant** you create in B2 is the account this playbook actually tests.

0. **Pick free ports.** Try API **4300** and client **5374**. Check with
   `ss -ltn | grep -E '4300|5374'` (empty = free) and walk upward if taken.
   **Never 4000/5173** (dev stack) or **4100/5273** (beta harness) — binding
   those would test someone else's data.

1. **Reseed the scratch database.** Foreground, confirm each exits 0:

   ```bash
   export PLAYBOOK_DB="postgres://postgres@localhost:5432/library_system_playbook"
   DATABASE_URL=$PLAYBOOK_DB npm run db:push    # schema
   DATABASE_URL=$PLAYBOOK_DB npm run db:seed    # demo library + the 4 staff accounts
   ```

   `db:seed` is this app's fixture: ~the books, members, loans, fines and staff
   listed in §2. Unlike systems where a run starts empty, **here the seed IS the
   test data** — the beta harness signs in the same way, and the journeys below
   refer to seeded records by the codes printed on them. A run against an empty
   database is a run that cannot check anything out.

   `dotenv` does not override a variable already in the environment, so the
   explicit `DATABASE_URL` wins over `server/.env`. Confirm it: the seed script
   prints the database it wrote to. **If it names your dev database, stop.**

2. **Start the stack** — two background shells, then poll, never fixed-sleep:

   ```bash
   DATABASE_URL=$PLAYBOOK_DB PORT=4300 npm run dev:server
   VITE_PORT=5374 VITE_API_PROXY=http://localhost:4300 npm run dev:client
   ```

   Wait for `✔ Lumen API listening on http://localhost:4300`, then
   `browser_navigate` to `http://localhost:5374` and `browser_wait_for` the text
   `Staff sign-in`. If either process reports the port is in use, it was not
   free — back to step 0.

   > `AUTH_SECRET` is unset in development, so the API mints a **random signing
   > key per process**. Restarting the API invalidates every session
   > (`server/src/lib/auth.ts`). Do not restart it mid-run, and expect a signed-in
   > tab to drop to the login form if you do — that is by design, and Phase S
   > records it deliberately rather than tripping over it.

3. **Generate a `runid`** (e.g. `0914-1145`) and tag every record you create with
   the suffix `AS<runid>`. In this file the placeholder **`AS0914`** stands for
   your real tag — substitute yours.

### 1.B — Bootstrap (as Admin; do this ONCE, then hand the session over)

**B0 · Sign in as Admin.** `browser_snapshot` the login form → type
`daveen.dev@lumenlibrary.org` / `lumen-demo-2024` → click `Sign in` →
`browser_wait_for` the Front Desk. Snapshot and confirm **User Management** IS
in the sidebar under Settings. That sighting is your control case for
`u-p1-nav`: it proves the destination exists and that its absence later is role
filtering, not a missing feature.

**B1 · Note the fixtures.** Go to `Book Catalog` and confirm `Dune` (`LIB-000845`)
and `Atomic Habits` (`LIB-000521`) are listed; go to `Borrowers` and confirm
`Amara Okonkwo` (`S-1042`) and the **Suspended** `Marcus Bell` (`S-1198`).
Record the exact barcodes/codes you see — Phase 2 uses them, and a seed change
that renames them should surface here, not three phases later.

**B2 · Create the run-tagged Assistant.** Sidebar → `User Management` →
`Add User`. Fill: Full Name `Uma Reed AS0914`, Email
`uma.reed.as0914@lumenlibrary.org`, Password `playbook-2026`, Role **Assistant**,
Status **Active**. Click `Create User`. Assert the row lists with role
**Assistant** and status **Active**.

**B3 · (reserved).** No further seeding needed — the demo library is the fixture.

**B4 · Hand the session over.** Sidebar footer → the sign-out button
(`aria-label` = `Sign out Daveen Dev`). At the login form, sign in as
`uma.reed.as0914@lumenlibrary.org` / `playbook-2026`. `browser_wait_for` the
Front Desk. **From here on you are the Assistant.**

**B5 · Baseline assertion.** Snapshot: (a) the sidebar footer reads
`Uma Reed AS0914` / `Assistant`; (b) **User Management is not in the sidebar**;
(c) the Front Desk rendered with no console throw. Record
`u0-baseline PASS signed in as Assistant, User Management absent, Front Desk renders`.
If User Management is present, you are still Admin — repeat B4.

---

## 2. The user & their access — persona & data tables (USE THESE EXACT VALUES)

You are **Uma Reed**, a new library assistant on the desk. You lend and take back
books all day. You can *look* at everything the library keeps, and you may
*change* nothing except loans and holds.

### 2.0 Naming rule

Anything you create gets the suffix, e.g. a hold note or a staff account named
`… AS0914`. This keeps the run identifiable and avoids clashes across runs.

### 2.1 Logins (from `server/src/db/seed.ts` / `.claude/skills/beta-test/personas.mjs`)

| Identity | Email | Password | Used for |
|---|---|---|---|
| Admin | `daveen.dev@lumenlibrary.org` | `lumen-demo-2024` | §1.B bootstrap + the second tab in Phases F/S |
| **Assistant (you)** | `uma.reed.as0914@lumenlibrary.org` | `playbook-2026` | Phase 1 onward |
| Assistant (seeded) | `m.lee@lumenlibrary.org` | `lumen-demo-2024` | fallback if B2 fails |
| Librarian | `e.rossi@lumenlibrary.org` | `lumen-demo-2024` | the middle role — see §8 |
| Disabled | `s.kim@lumenlibrary.org` | `lumen-demo-2024` | must be refused: "this account has been disabled" |

### 2.2 Seeded records this playbook acts on

| Kind | Value | Used by |
|---|---|---|
| Book | `Dune` — barcode `LIB-000845` | checkout / return / renew |
| Book | `Atomic Habits` — barcode `LIB-000521` | hold queue |
| Book | `The Midnight Library` — `LIB-000412` | Front Desk borrow |
| Book | `Clean Code` — `LIB-000956` | labels / catalog read |
| Member | `Amara Okonkwo` — `S-1042` | the borrower in every loan |
| Member | `Dr. Elena Rossi` — `F-0231` | the second borrower (holds) |
| Member | `Marcus Bell` — `S-1198`, **Suspended** | must be refused at checkout (409) |

If a code above is not in the catalogue after a fresh seed, the seed changed:
use what is actually there and **say so in the results file** rather than
silently substituting.

### 2.3 What the Assistant may do (source of truth: `shared/types.ts`)

| Permission | Assistant | What it gates |
|---|---|---|
| `circulation:write` | **yes** | checkout, check-in, renew, holds (create/fulfil/cancel) |
| `catalog:write` | no | add/edit/delete books |
| `members:write` | no | add/edit/delete borrowers |
| `fines:write` | no | collect / waive fines |
| `settings:write` | no | fine policy + the shelf/subject/grade/section lists |
| `users:manage` | no | the whole User Management screen and `/api/users` |

**Reads are not gated at all** for a signed-in account, with the single
exception of `/api/users`. Appearance (theme/accent) is writable by everyone —
see `u-appearance-global`, which is the sharpest question this playbook asks.

---

## PHASE 1 — Role-boundary audit (as the Assistant)

### u-p1-nav · The sidebar is filtered by exactly one item

1. Snapshot the sidebar on any screen.
2. Assert **Main Menu** shows all nine, in order: Front Desk, Dashboard, Book
   Catalog, Borrowers, Circulation, Reservations, Fines & Penalties, Reports,
   Labels & Barcodes.
3. Assert **Settings** shows `Misc` and **not** `User Management`.
4. Assert the footer shows the account name and the role text `Assistant`.
5. PASS only if that is exactly the list. A missing Main Menu item is a FAIL
   (over-hiding); a visible User Management is a **P0** (§7c).

### u-p1-section-* · Every reachable section shows the right controls

Click each destination in turn. For each: wait for its subtitle text, snapshot,
assert the **present** and **absent** columns, and check
`browser_console_messages` for throws. One result line per row.

| ID | Section | Must be PRESENT | Must be ABSENT |
|---|---|---|---|
| `u-p1-home` | Front Desk | search box `Search the catalog`; `Borrow` on an available title; `Reserve` on an all-out title; the `Just Happened` feed | — (both actions are `circulation:write`, which this role holds) |
| `u-p1-dashboard` | Dashboard | stat tiles; `Recent Activity`; `Due Soon`; `Most Borrowed`; `Quick Actions` | any control that writes — Quick Actions must only navigate |
| `u-p1-catalog` | Book Catalog | search; per-row `Reserve <title>` | `Add Book`; `Edit <title>`; `Delete <title>` |
| `u-p1-borrowers` | Borrowers | search; `Borrowing history for <name>` | `New Member`; `Edit <name>`; `Delete <name>` |
| `u-p1-circulation` | Circulation | `Check Out` panel; `Check In / Return` panel; `Confirm Return`; the `Active Loans` table with `Renew` / `Return` per row | — (the whole screen is this role's job) |
| `u-p1-reservations` | Reservations | `New Hold`; `Fulfill` / `Cancel` on an open hold | — |
| `u-p1-fines` | Fines & Penalties | summary tiles; the fines table | `Collect`; `Waive` on **every** row, Unpaid included |
| `u-p1-reports` | Reports | all seven tabs; the date range; `Excel` / `PDF` / print | — (reads only; but see §7b — this role can export the whole member and fines dataset) |
| `u-p1-labels` | Labels & Barcodes | `Books` / `Borrower IDs`; label type; `Quantity`; `Print Sheet` | — (labels are generated client-side from reads) |
| `u-p1-settings` | Settings → Misc | every policy field **disabled**; the text `Only an administrator can change fine policy.`; chips listed | `Save Fine Settings`; `Remove <chip>`; `Add to Book Shelves` (and the other three add inputs) |

`u-p1-usermgmt` · **Unreachable by construction.** There is no URL to type
(§A.2), so record `PASS u-p1-usermgmt no sidebar entry; no address to reach it`
and let `u-api-users` (Phase 2.5) carry the real proof.

> **Calibration.** Rows 8, 9 and 10's read access is deliberate
> (`writesRequire` lets GETs through; Settings is read-only "because knowing the
> library's fine rate is useful to anyone at the desk"). Do not file those as
> bugs. Do note the reports/export exposure in §7b as an observation — it is a
> product question, not a defect.

---

## PHASE 2 — Do the job the role exists for (as the Assistant)

Work a desk shift. Every step is a real action with a real assertion.

### u-A · Front Desk

1. **u-home-search** — type `Dune` into `Search the catalog`. Assert the row
   appears with an availability badge.
2. **u-home-borrow** — click `Borrow` on `Dune`. In the modal, fill `Member ID`
   with `S-1042` and click `Confirm`. Assert a toast naming the book/borrower, and that
   the `Just Happened` feed gains the entry **without a reload**.
3. **u-home-suspended** — repeat the borrow against `S-1198` (Marcus Bell,
   Suspended). Assert it is **refused** with a readable message (server returns
   409 `member is suspended`) and that the failure reads as a *rule*, not a
   crash. Note in §7b if it reads as a crash.
4. **u-home-reserve** — find an all-out title (or make one by borrowing the last
   copy) and click `Reserve`. Assert the hold is taken.
5. **u-home-empty** — search for `zzzz AS0914`. Assert the `No matches.` state.

### u-B · Circulation — the barcode-scanner flow

The screen is built for a USB scanner, which types then presses Enter. Drive it
that way with `browser_press_key`, not by clicking.

1. **u-circ-scan-checkout** — in `Book barcode` type `LIB-000521`, press
   `Enter`; assert focus moved to `Member ID`; type `F-0231`, press `Enter`
   (the second Enter submits — the panel also has a `Confirm Check Out`
   button if the key flow fails, and a flow that only works by mouse is a P1
   for a scanner-first screen). Assert the toast, the cleared fields, and a new row in **Active Loans**.
2. **u-circ-refocus** — assert the book field is focused again afterwards (the
   next borrower can be scanned straight away). A focus that does not return is
   a P1 for this role: it breaks the one workflow they own.
3. **u-circ-renew** — click `Renew` on that row. Assert the due date moves.
4. **u-circ-return-panel** — in the `Check In / Return` panel type `LIB-000521`, click
   `Confirm Return`. Assert the toast reports the fine amount/days and the row
   leaves Active Loans.
5. **u-circ-return-row** — return the `Dune` loan from B2's borrow via the row's
   `Return` button. Assert it leaves the list.
6. **u-circ-unknown** — scan a barcode that does not exist (`LIB-000000`).
   Assert a clean "book not found" message, no console throw.

### u-C · Reservations

1. **u-res-new** — `New Hold` for `Atomic Habits` / `S-1042`. Assert the queue
   row with a position.
2. **u-res-duplicate** — place the same hold again. Assert it is refused as a
   duplicate, readably.
3. **u-res-fulfil** — `Fulfill` a hold that is ready. Assert the status changes.
4. **u-res-cancel** — `Cancel` another hold. Assert the status changes and the
   queue positions behind it stay sane.

### u-D · The read-only screens, exercised rather than glanced at

1. **u-read-catalog** — page through the catalogue; run a search by author and
   by barcode. Assert results, and that no write control appeared on any page of
   results (re-check after paging — controls rendered per row are exactly where
   a gating mistake hides).
2. **u-read-borrower-history** — open `Borrowing history for Amara Okonkwo`.
   Assert the modal shows loans/fines totals and closes cleanly.
3. **u-read-fines** — confirm Unpaid rows exist and carry **no** action buttons.
4. **u-read-reports** — visit all seven tabs (`Overdue Report`, `Fines &
   Penalties`, `List of Books`, `Most Borrowed`, `Inventory`, `Transaction Log`,
   `Member Activity`). Assert each renders headers and either rows or a clean
   empty state. Change the date range once and assert the table re-queries.
5. **u-read-export** — trigger the `Excel` and `PDF` exports and record the
   downloaded filenames. **Do not assert their contents** (§5). Record in §7b
   that a restricted account can export the full member list.
6. **u-read-labels** — generate `Books` × `Spine + Barcode` and `Borrower IDs` ×
   `QR Pocket` at quantity 2. Assert the sheet renders real codes (an `img`/`svg` per label,
   not empty boxes). **Do not click print to a real printer** — `Print Sheet`
   opens the browser print dialog; if a native dialog appears, dismiss it and
   record `SKIPPED (external) — printing`.
7. **u-read-settings** — confirm the policy values are readable, every input is
   `disabled`, and the administrator note is shown.

### u-E · Global chrome

1. **u-chrome-search** — use the topbar `Search the whole system` box with
   `Herbert`. Assert it lands on Book Catalog with results (it is a catalogue
   search; if the placeholder promises more than it delivers, that is a §7b
   note).
2. **u-chrome-appearance** — open `Appearance`, switch theme and accent. Assert
   the UI changes.
3. **u-appearance-global** — **the named question of this playbook.** Appearance
   is stored in the single settings row (`server/src/routes/settings.ts`,
   `settings.id = 1`), not per user, and `APPEARANCE_FIELDS` lets **any** signed-in
   account write it. So: with the Admin signed in in a second tab
   (`browser_tabs`), reload the Admin tab and see whether the Assistant's theme
   change followed. Record what actually happens. If it did follow, the finding
   is *"the most restricted account can change every staff member's UI
   theme"* — a **P2 by impact, worth a decision** (per-user appearance, or gate
   it). Record it in §7c with the repro and in §7b with the suggestion.
4. **u-chrome-notifications** — the bell is decorative
   (`aria-label="Notifications — none new"`, `cursor: default`). Assert it does
   nothing; note in §7b if it looks clickable.
5. **u-chrome-signout** — confirm the sign-out control exists in the sidebar
   footer with a labelled name. (Phase S actually uses it.)

---

## PHASE 2.5 — Server-side authorization sweep (the boundary that actually matters)

Hidden buttons are cosmetics. Drive `fetch()` **from inside the Assistant's own
session** with `browser_evaluate`, so the real httpOnly session cookie is used
and the result is what a scripted attacker would get. Read both the **status**
and enough of the **body** to know what happened.

```js
() => fetch('/api/books', { method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Leak Probe AS0914', author: 'Nobody',
                             subject: 'Test', totalCopies: 1 }) })
      .then(async r => `${r.status} ${(await r.text()).slice(0, 120)}`)
```

### u-api-read · Reads (all 200 **except one**)

A 403 in this table would be a **bug in the other direction** — it would break a
screen this role is meant to use.

| ID | Call | Expected |
|---|---|---|
| `u-api-read-books` | `GET /api/books` | 200 |
| `u-api-read-members` | `GET /api/members` | 200 |
| `u-api-read-loans` | `GET /api/loans` | 200 |
| `u-api-read-reservations` | `GET /api/reservations` | 200 |
| `u-api-read-fines` | `GET /api/fines` + `/api/fines/summary` | 200 |
| `u-api-read-dashboard` | `GET /api/dashboard` | 200 |
| `u-api-read-reports` | `GET /api/reports/members?from=…&to=…` | 200 |
| `u-api-read-settings` | `GET /api/settings` | 200 |
| `u-api-read-me` | `GET /api/auth/me` | 200, `permissions` is **exactly** `["circulation:write"]` |
| **`u-api-users`** | `GET /api/users` | **403** — the one read this role must not have; `/api/users` is mounted behind `requirePermission("users:manage")` |
| `u-api-404` | `GET /api/no-such-thing` | 404 `{"error":"not found"}` — confirms an unknown path is not a silent 200 |

### u-api-write-forbidden · Writes that must answer **403**

| ID | Call | Expected |
|---|---|---|
| `u-api-w-book-create` | `POST /api/books` | 403 |
| `u-api-w-book-patch` | `PATCH /api/books/<id>` | 403 |
| `u-api-w-book-delete` | `DELETE /api/books/<id>` | 403 |
| `u-api-w-member-create` | `POST /api/members` | 403 |
| `u-api-w-member-delete` | `DELETE /api/members/<id>` | 403 |
| `u-api-w-fine-collect` | `POST /api/fines/<id>/collect` | 403 |
| `u-api-w-fine-waive` | `POST /api/fines/<id>/waive` | 403 |
| `u-api-w-policy` | `PUT /api/settings` with `{"dailyFineRate": 99}` | 403 — `settings.ts` refuses any non-appearance field without `settings:write` |
| `u-api-w-lookup-add` | `POST /api/settings/lookups/shelf` `{"value":"Z-99 AS0914"}` | 403 |
| `u-api-w-lookup-del` | `DELETE /api/settings/lookups/shelf/E-07` | 403 |
| `u-api-w-user-create` | `POST /api/users` | 403 |
| `u-api-w-user-patch` | `PATCH /api/users/<adminId>` `{"role":"Assistant"}` | 403 — a privilege-escalation probe; a 200 here is the worst outcome in this file |
| `u-api-w-self-promote` | `PATCH /api/users/<ownId>` `{"role":"Admin"}` | 403 |

**After the forbidden writes, verify in the Admin tab that nothing changed** —
book count, member count, the fine's status, the shelf chip list, the staff
list. A 403 that still had a side effect is worse than an honest 200.

### u-api-write-allowed · Writes this role **is** meant to make

| ID | Call | Expected |
|---|---|---|
| `u-api-a-checkout` | `POST /api/loans/checkout` `{"bookBarcode":"LIB-000956","memberCode":"S-1042"}` | 200/201 |
| `u-api-a-renew` | `POST /api/loans/<id>/renew` | 200 |
| `u-api-a-return` | `POST /api/loans/<id>/return` | 200 — also your cleanup for the line above |
| `u-api-a-hold` | `POST /api/reservations` | 200/201 |
| `u-api-a-hold-cancel` | `POST /api/reservations/<id>/cancel` | 200 — cleanup |
| `u-api-a-appearance` | `PUT /api/settings` with `{"theme":"parchment"}` | 200 — appearance is deliberately ungated; feeds `u-appearance-global` |

### u-api-unauth · No session at all

Open a fresh tab (`browser_tabs`), do **not** sign in, and probe from there:

| ID | Call | Expected |
|---|---|---|
| `u-api-unauth-read` | `GET /api/books` | 401 `sign in to continue` |
| `u-api-unauth-write` | `POST /api/loans/checkout` | 401 |
| `u-api-unauth-me` | `GET /api/auth/me` | 401 — the client treats this as "show the login form", not an error |

---

## PHASE R — Responsive

1. **r-mobile-nav** — `browser_resize` 390×844. The sidebar is now a drawer:
   assert `Open navigation` is present, click it, assert the same nine + Misc and
   **no User Management**, and that `Escape` closes it.
2. **r-mobile-circulation** — at 390×844, run one full scan-checkout
   (`u-circ-scan-checkout`). This is the role's core task on the device a desk
   assistant is most likely to be handed. Assert the panels stack and the fields
   are reachable; return the book afterwards.
3. **r-mobile-tables** — Catalog and Fines at 390×844: do the tables scroll
   rather than overflow the page? Visual → `NEEDS-HUMAN` + screenshot.
4. **r-tablet-nav** — repeat `r-mobile-nav` at 768×1024.
5. Resize back to 1400×900.

---

## PHASE S — Session & auth lifecycle

1. **s-reload-persists** — reload. Assert you are still signed in as the
   Assistant (the session is an httpOnly cookie re-checked via `/auth/me`) and
   that you land on **Front Desk** — the section is not in the URL, so the
   screen resets. Record both facts; the reset is expected, and §7b should note
   whether it *feels* like a bug to a user mid-task.
2. **s-signout-clears** — sign out. Assert the login form. Press browser back;
   assert the app does **not** show authenticated content from cache.
3. **s-bad-password** — sign in with the right email and a wrong password.
   Assert the alert reads `incorrect email or password` and that it names
   neither which half was wrong nor whether the account exists.
   **Keep total failed attempts under 8 per email** — `server/src/routes/auth.ts`
   throttles at `MAX_ATTEMPTS = 8` per email+IP over 10 minutes and then answers
   429. If you trip it, record it and wait it out; do not restart the API to
   clear it (that would invalidate every session, §1 step 2).
4. **s-disabled-account** — sign in as `s.kim@lumenlibrary.org` /
   `lumen-demo-2024`. Assert `this account has been disabled` (403) and that you
   stay on the login form.
5. **s-disabled-midsession** — **the sharpest session check in this app.** Signed
   in as the Assistant in tab 1, use tab 2 (Admin) → User Management → set
   `Uma Reed AS0914` to **Disabled**. Back in tab 1, with **no reload**, do any
   action that hits the API (click Dashboard). `requireAuth` re-reads the account
   on every request, so the next call should 401 and the client should drop
   straight to the login form. Assert that. If tab 1 keeps working, a disabled
   account keeps its access for up to 8 hours — **P0**. Re-enable the account
   afterwards.
6. **s-role-change-midsession** — same shape: Admin promotes the Assistant to
   Librarian in tab 2. In tab 1 without reloading, does the Catalog gain
   `Add Book`? Permissions are fetched once at sign-in (`auth.tsx`), so expect
   **no** until reload — and the server *will* now accept the write. Record what
   happens: a UI that hides a control the server allows is a **P2 staleness**
   note, not a breach. Demote the account afterwards.

---

## PHASE F — Friction sweep (the checks the happy path never makes)

Two rules for this phase:

- **No reloading.** Move between screens with the sidebar only. A reload
  refetches everything and hides staleness. If you reload by accident, that
  step's result is void — redo it.
- **Assert the negative.** "No message remains", "no write control appeared" are
  assertions read out of the snapshot, never assumed.

### F-1 · Freshness — someone else writes, this account must see it

Needs the Admin in a second tab (`browser_tabs`).

| ID | As Admin (tab 2) | Then as the Assistant (tab 1), NO reload | Assert |
|---|---|---|---|
| `f1-catalog-fresh` | add book `Playbook Primer AS0914` | sidebar → Dashboard → Book Catalog, search `AS0914` | the new title is found |
| `f1-member-fresh` | add member `Vera Quill AS0914` | Front Desk → borrow flow, enter her member code | the checkout is accepted |
| `f1-dash-fresh` | (same writes) | Dashboard | the title/member counters moved |
| `f1-settings-fresh` | add shelf chip `Z-99 AS0914` | Catalog (read-only for this role) → confirm the chip shows in Settings → Misc | the new chip is listed |

Stale-until-reload is a **P1**: a desk assistant who cannot see the book a
colleague catalogued thirty seconds ago will tell the borrower it does not
exist. If a plain in-app navigation refetches correctly, that is a **PASS** —
record which navigation you used.

**Clean up:** have the Admin delete `Playbook Primer AS0914`, `Vera Quill AS0914`
and the `Z-99 AS0914` chip before finishing.

### F-2 · Validation recovery on the forms this role has

Drive **empty-first**: submit blank, record every message verbatim, then satisfy
fields **one at a time** and assert each message — and its highlight — clears as
soon as its field is valid.

| ID | Form | Notes |
|---|---|---|
| `f2-login` | the sign-in form | blank submit → what happens? then wrong password → `incorrect email or password`; then correct → the alert must be **gone** and sign-in must succeed. **Mind the 8-attempt throttle** (`s-bad-password`) |
| `f2-borrow-modal` | the Front Desk `Borrow` modal | confirm with an empty `Member ID`; then with a nonsense code `S-9999`; then the real `S-1042`. Assert each error clears and the final attempt succeeds |
| `f2-hold-modal` | `New Hold` | same shape |
| `f2-scan-fields` | Circulation scan fields | a bad barcode then a good one — assert the error from the first does not survive the second |

An error that survives its field being corrected is a **P1**; a sign-in error
that persists after a *successful* sign-in is **P0** (it reads as a failed
login).

### F-3 · No-manual-reload recovery

`f3-nav-recovery` — after any refused action (a suspended-member checkout, a
403 probe), navigate back to Front Desk via the sidebar and assert it renders
correctly with no stale fragment of the failed screen and no lingering toast.

---

## 3. Per-step procedure (applies to every step above)

1. **Act** — perform the action as Uma would (§A loop).
2. **Assert** — through the UI *and* the network. Absences are read out of the
   snapshot; refusals are confirmed by status code.
3. **Record** one result line (§4), keyed by the step id.
4. **Record every bug — always, in the same pass.** The moment you observe
   anything broken or any boundary that leaks (a FAIL, a working write this role
   should not have, a console throw, a 403 with a side effect, a stale view),
   record it as a distinct **bug** in **§7c** — not merely as a `FAIL` line.
   Each entry: step id, symptom, exact repro, and the file/route if known
   (role gating: `shared/types.ts` `ROLE_PERMISSIONS` → `client/src/nav.ts`
   `SECTION_PERMISSION` → each page's `can(...)` → `server/src/app.ts`
   `writesRequire` / `requirePermission`).
5. **Note UX friction** — anything that would confuse this user: a screen that
   looks broken rather than deliberately read-only, a control that is visible
   but refused, an error that reads like a crash when it is a rule. These go in
   **§7b** even when the step PASSes.

> **Bug + UX improvement travel together.** A bug in §7c gets a matching
> `→ Suggestion:` line in §7b. Never report one without the other.

> **Two bug shapes to name explicitly.** A **stale view**: data correct only
> after a reload. A **sticky validation message**: an error still showing after
> its field was fixed. Log either in §7c whenever you see it, in any phase — not
> only during Phase F.

## 4. Result statuses

- **PASS** — the assertion held, including "the role correctly refused this".
- **FAIL** — errored, or the assertion did not hold, **or a boundary leaked**.
  Add a short parenthetical symptom.
- **BLOCKED** — a prerequisite step failed. Name the blocker.
- **NEEDS-HUMAN** — driven, but the judgement is visual.
- **SKIPPED (external)** — a real printer, a real mail send. Never trigger one.

## 5. Scope & safe-skips

The §1 reseed is the only destructive action and it targets the scratch database
only. Never point any step at the dev database or at ports 4000/5173/4100/5273.
Not covered, and say so in the report: printing to paper, the **contents** of
the exported XLSX/PDF (the download is triggered and named, never opened), real
barcode-scanner hardware, email reminders (unimplemented), and any browser other
than Chromium. Do the Admin bootstrap (B0–B2) only to create the account and
note fixtures — the test subject is the **Assistant** session.

## 6. Orientation aids

- **Roles and permissions:** `shared/types.ts` → `Permission`, `ROLE_PERMISSIONS`,
  `roleCan`.
- **Which sections hide:** `client/src/nav.ts` → `NAV_ITEMS`, `SETTINGS_ITEMS`,
  `SECTION_PERMISSION` (only `userManagement`).
- **Which controls hide:** each page's `useAuth().can(...)` — `Catalog.tsx`
  (`catalog:write`, `circulation:write`), `Borrowers.tsx` (`members:write`),
  `Circulation.tsx` / `Reservations.tsx` / `Home.tsx` (`circulation:write`),
  `Fines.tsx` (`fines:write`), `Settings.tsx` (`settings:write`).
- **Server gating:** `server/src/app.ts` (mount order; `writesRequire` lets GETs
  through), `server/src/lib/auth.ts` (`requireAuth` re-reads the account every
  request; `requirePermission`), `server/src/routes/settings.ts`
  (`APPEARANCE_FIELDS` — the one write everyone gets).
- **Fixtures:** `server/src/db/seed.ts`, mirrored in
  `.claude/skills/beta-test/personas.mjs`.
- **Existing scripted coverage:** `.claude/skills/beta-test/journeys/05-roles.mjs`
  already asserts a slice of this. Where this playbook and that file disagree,
  the code is the tie-breaker — and one of the two needs updating.

## 7. Output (the artifact that matters)

Write one file, phase-grouped, one line per step id:

`.claude/playbooks/user-journey-results/user-run-YYYYMMDD-HHMM.md`
(create `user-journey-results/` if it does not exist)

Three **required** sections: **§7a results table**, **§7b UX / restricted-user
friction notes**, **§7c Bugs found**. A run that found bugs but recorded no §7c
entries is an **incomplete run**.

### 7a. Results format

```
# User Journey (Assistant role) — <YYYY-MM-DD HH:MM> (scratch DB, API <PORT>, client <PORT>)

Account: uma.reed.as0914@lumenlibrary.org (Assistant, created this run)
Fixtures: Dune LIB-000845 · Atomic Habits LIB-000521 · Amara Okonkwo S-1042 · Marcus Bell S-1198 (Suspended)

## Bootstrap (as Admin)
PASS   u0-baseline           signed in as Assistant, User Management absent, Front Desk renders

## Phase 1 — Role-boundary audit
PASS   u-p1-nav              nine Main Menu items + Misc; User Management hidden
PASS   u-p1-catalog          no Add/Edit/Delete; Reserve present
PASS   u-p1-fines            no Collect/Waive on any row
PASS   u-p1-settings         policy fields disabled; admin-only note shown; no chip editing
...    (one line per u-p1-* id)

## Phase 2 — The job the role exists for
PASS   u-home-borrow         Dune → S-1042, feed updated without reload
PASS   u-circ-scan-checkout  scan flow completes on two Enters
PASS   u-circ-refocus        focus returns to the book field
...    (one line per u-* id)

## Phase 2.5 — Server-side authorization sweep
PASS   u-api-read-books      GET /api/books → 200
PASS   u-api-users           GET /api/users → 403
PASS   u-api-w-book-create   POST /api/books → 403, no book created (admin-verified)
PASS   u-api-w-user-patch    PATCH /api/users/<admin> → 403 (privilege escalation refused)
PASS   u-api-a-checkout      POST /api/loans/checkout → 201
...    (one line per u-api-* id)

## Phase R — Responsive
## Phase S — Session & auth lifecycle
## Phase F — Friction sweep

— Items: N · PASS x · FAIL y · BLOCKED z · NEEDS-HUMAN w · SKIPPED s
```

If every checkable item passed:
`Assistant-role journey passing — N checkable items (M NEEDS-HUMAN).`

### 7b. UX / restricted-user friction notes (required)

A `## Restricted-user friction observations` section. One line each: where the
friction hit, what happened, the file if known, **and a concrete
`→ Suggestion:`**. Group **P0** (a leak, a crash on a permitted screen), **P1**
(a screen that reads as broken rather than deliberately read-only; a stale
view), **P2** (polish). This role's characteristic failure is the **"limited vs.
broken" perception gap** — an assistant looking at a Fines table with no buttons
should understand *why*. "No friction noted this run" is a valid line; write it
explicitly.

### 7c. Bugs found (required)

```
## Bugs found

### P0
- **u-api-w-user-patch** — Symptom: PATCH /api/users/<id> returned 200 for an
  Assistant, changing another account's role.
  Repro: sign in as the Assistant → browser_evaluate the fetch in §2.5 → 200.
  File/route: server/src/app.ts mount for /api/users.

### P1
- **f1-catalog-fresh** — Symptom: a book added by an Admin is not found by the
  Assistant's catalogue search until a full page reload.
  Repro: tab 2 Admin adds "Playbook Primer AS0914" → tab 1 sidebar to Catalog →
  search finds nothing → reload → found.
  File/route: client/src/hooks.ts useAsync caching on Catalog.tsx.
```

If a run genuinely found nothing, write `No bugs found this run.` — never omit
the section.

## 8. Re-run

Execute this file. Complements:

- `.claude/playbooks/admin-journey-playbook.md` — the full-permission counterpart.
- `.claude/skills/beta-test` — the scripted regression suite; run it first, it is
  cheaper.

**Librarian delta (optional, ~10 minutes).** To cover the middle role, repeat
Phase 1 and Phase 2.5 signed in as `e.rossi@lumenlibrary.org`. Expected
differences: `Add Book`, `New Member`, `Collect`/`Waive` and all row
edit/delete controls become **present and working**; Settings stays read-only;
User Management stays hidden; `POST /api/books` and `POST /api/fines/<id>/collect`
become 200, while `PUT /api/settings {dailyFineRate}`, the lookup routes and
everything under `/api/users` stay **403**. Record those as `l-*` ids in the same
results file.

Re-run this playbook whenever `shared/types.ts`, `client/src/nav.ts`,
`server/src/app.ts`, `server/src/lib/auth.ts`, or any page's `can(...)` gating
changes.

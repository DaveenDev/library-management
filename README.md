# Library Management System

A complete, self-hostable library management system for schools and small
libraries — cataloguing, circulation, borrower records, holds, fines, printable
barcode/QR labels, and exportable reports.

Built with **React + TypeScript**, **Express**, and **PostgreSQL** (Drizzle ORM),
in an npm-workspaces monorepo.

> **Before you deploy this:** set `AUTH_SECRET` and change the demo staff
> passwords. Staff sign-in and role enforcement are in place, but the seeded
> accounts all share a published password. See [Security](#security).

---

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Demo data](#demo-data)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [API reference](#api-reference)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Credits](#credits)
- [License](#license)

---

## Features

| Module | What it does |
|--------|--------------|
| **Front Desk** | Live catalogue search, one-click borrow, reserve when a title is out, recent-activity feed |
| **Dashboard** | Live stats — titles, copies, active loans, overdue, outstanding fines — plus most-borrowed and due-soon lists |
| **Book Catalog** | Add / edit / delete titles. Search by title, author, subject, accession number, barcode or ISBN. Accession numbers and barcodes auto-assign |
| **Borrowers** | Student and faculty records with computed books-out and fines-due, plus a full per-member borrowing history |
| **Circulation** | Check-out, check-in and renewals. Built for a **USB barcode scanner**: scan book → scan member card → done, no mouse |
| **Reservations** | Holds queue with position tracking, ready-for-pickup detection, duplicate-hold prevention, fulfil / cancel |
| **Fines** | Automatic overdue calculation with configurable daily rate, grace period and maximum cap. Collect or waive |
| **Reports** | Seven reports over any date range — overdue, fines, catalogue, most-borrowed, inventory, transaction log, member activity |
| **Exports** | Every report exports to **Excel (.xlsx)** and **PDF**, plus a print-ready letterhead sheet |
| **Labels** | Genuine scannable **Code 128 barcodes** and **QR codes** for both book spines and borrower ID cards, with quantity-driven print sheets |
| **Settings** | Fine rules, loan period, and editable shelf / subject / grade / section lists |
| **Staff accounts** | Password sign-in with three roles — Admin, Librarian, Assistant — enforced on the server, not just displayed. See [Security](#security) |
| **Appearance** | Three themes and four accent colours, persisted server-side |

### Barcode scanning

A USB barcode scanner acts as a keyboard — it types the code then presses Enter.
The Circulation screen is built around that: the book field is focused on
arrival, Enter jumps to the member field, and the second Enter completes the
checkout, clears both fields and refocuses for the next borrower. No special
drivers or scanner SDK required — any standard USB scanner works.

Labels are real encodings (via `jsbarcode` and `qrcode`), not decorative
graphics, so the labels you print are the labels your scanner reads.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | React 18, TypeScript, Vite 6 |
| Backend | Express 4, TypeScript, run directly via `tsx` |
| Database | PostgreSQL 14+ with Drizzle ORM |
| Exports | SheetJS (`xlsx`), jsPDF + autotable — both lazy-loaded on first use |
| Codes | `jsbarcode` (Code 128), `qrcode` (QR) |
| Monorepo | npm workspaces (`shared` / `server` / `client`) |

No CSS framework and no component library — styling is plain inline styles plus
CSS custom properties for theming.

---

## Quick start

### 1. Prerequisites

- **Node.js 18 or newer** (20+ recommended) — `node -v`
- **PostgreSQL 14 or newer** — `psql --version`
- **npm 9+** (ships with Node)

<details>
<summary>Installing PostgreSQL</summary>

**Windows** — download the installer from
[postgresql.org/download/windows](https://www.postgresql.org/download/windows/).
Remember the password you set for the `postgres` user; you'll need it in step 3.
Make sure "Add to PATH" is selected, or add `C:\Program Files\PostgreSQL\16\bin`
to your PATH manually.

**macOS** — `brew install postgresql@16 && brew services start postgresql@16`

**Linux (Debian/Ubuntu)** —
`sudo apt install postgresql && sudo systemctl start postgresql`

</details>

### 2. Clone and install

```bash
git clone https://github.com/DaveenDev/library-management.git
cd library-management
npm install
```

One `npm install` at the root installs all three workspaces.

### 3. Create the database

```bash
createdb library_system
```

If `createdb` isn't on your PATH, use psql instead:

```bash
psql -U postgres -c "CREATE DATABASE library_system;"
```

### 4. Configure the connection

Copy the example environment file to `server/.env`:

```bash
cp .env.example server/.env
```

On Windows PowerShell:

```bash
Copy-Item .env.example server/.env
```

Then edit `server/.env` so the connection string matches your setup:

```ini
# No password (common on macOS/Linux Homebrew installs):
DATABASE_URL=postgres://postgres@localhost:5432/library_system

# With a password (typical on Windows):
DATABASE_URL=postgres://postgres:YOUR_PASSWORD@localhost:5432/library_system

PORT=4000
```

> If your password contains `@`, `:`, `/` or other URL-special characters, it
> must be percent-encoded (`@` → `%40`, and so on).

`server/.env` is gitignored — your credentials never get committed.

Two further variables matter once you deploy:

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Signs session cookies. **Required in production** — the server refuses to start without it. Left unset in development, a random key is generated per process, so sessions end when the server restarts. |
| `CORS_ORIGIN` | Comma-separated browser origins allowed to send authenticated requests. Defaults to the Vite dev server; only needed when the client is served from a different origin than the API. |

### 5. Create the schema and load sample data

```bash
npm run setup
```

This runs `db:push` (creates tables and applies migrations — safe to re-run) and
then `db:seed` (loads a demo catalogue, borrowers, loans and fines).

> **`db:seed` wipes all existing data first.** It is for getting a demo running,
> not for topping up a real collection. Skip it — run only `npm run db:push` — if
> you want to start with an empty library.

### 6. Run it

```bash
npm run dev
```

This starts the API on **http://localhost:4000** and the web client on
**http://localhost:5173**. Open the client URL in your browser and sign in as
`daveen.dev@lumenlibrary.org` with the password `lumen-demo-2024` — the seeded
Admin account. Other demo sign-ins are listed under [Demo data](#demo-data).

> If port 5173 is already taken, Vite will pick the next free one and print the
> actual URL — read the terminal rather than assuming 5173.

---

## Configuration

### Your library's name and address

Everything identifying your library lives in
[`client/src/branding.ts`](client/src/branding.ts). Edit it to rebrand:

```ts
export const LIBRARY = {
  name: "Your Library Name",             // report letterhead + QR labels
  contactLine: "123 Main St · you.org",  // second letterhead line
  footerName: "Your Library System",     // printed report footer
  emailDomain: "you.org",                // staff email placeholder
};
```

The account shown in the sidebar is the signed-in staff member, taken from the
session — there is nothing to configure.

### Currency

The app ships with the Philippine peso (`₱`). It is defined once, in
[`shared/types.ts`](shared/types.ts):

```ts
export const CURRENCY_SYMBOL = "₱";
export const CURRENCY_CODE = "PHP";
```

Change those two lines and every amount across the UI, reports and exports
follows — screen, PDF, and Excel column headers included.

> PDF exports deliberately write amounts as bare numbers with the currency in
> the column header (`Fine (PHP)`) rather than a symbol. jsPDF's built-in fonts
> are Latin-1 only and cannot render `₱`, `€` or most non-ASCII symbols. If you
> want the symbol inside the PDF itself, you'll need to embed a Unicode font.

### Fine rules and lists

Daily fine rate, grace period, maximum cap, loan period and auto-suspend
threshold are all editable in the app under **Settings → Misc**, as are the
shelf, subject, grade and section lists. No code changes needed.

### Changing the API port

If you change `PORT` in `server/.env`, you must also update the proxy target in
[`client/vite.config.ts`](client/vite.config.ts) to match:

```ts
proxy: { "/api": "http://localhost:4000" }  // ← keep these in sync
```

---

## Demo data

After `npm run db:seed`, these exist and are handy for trying the scanner flows
by typing the codes manually:

**Book barcodes**

| Barcode | Title |
|---------|-------|
| `LIB-000845` | Dune |
| `LIB-000521` | Atomic Habits |
| `LIB-000412` | The Midnight Library |
| `LIB-000956` | Clean Code |

**Member IDs**

| Code | Name | Notes |
|------|------|-------|
| `S-1042` | Amara Okonkwo | Student, has an overdue loan |
| `F-0231` | Dr. Elena Rossi | Faculty |
| `S-1198` | Marcus Bell | **Suspended** — good for testing rejection |

**Staff sign-ins** — every seeded account uses the password
`lumen-demo-2024`. Sign in as each to see the roles enforced.

| Email | Role | Notes |
|-------|------|-------|
| `daveen.dev@lumenlibrary.org` | Admin | Full access |
| `e.rossi@lumenlibrary.org` | Librarian | No staff or policy management |
| `m.lee@lumenlibrary.org` | Assistant | Circulation only |
| `s.kim@lumenlibrary.org` | Librarian | **Disabled** — sign-in is refused |

Try it: sign in as the Admin, go to **Circulation**, type `LIB-000845`, press
Enter, type `S-1042`, press Enter.

---

## Scripts

Run these from the repository root.

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run API and client together |
| `npm run dev:server` | API only (port 4000) |
| `npm run dev:client` | Client only (port 5173) |
| `npm run db:push` | Create/update schema — idempotent, safe to re-run |
| `npm run db:seed` | **Wipe** and reload demo data |
| `npm run setup` | `db:push` then `db:seed` |
| `npm run build` | Type-check and build the client to `client/dist` |

### Adding a database column

`db:push` creates tables only if they don't already exist, so it will **not**
alter a table that's already there. When you add a column to
`server/src/db/schema.ts`, also add an idempotent `ALTER TABLE ... ADD COLUMN IF
NOT EXISTS` to the `MIGRATIONS` block in
[`server/src/db/push.ts`](server/src/db/push.ts). Otherwise `db:push` will
cheerfully report "Schema is up to date" while your new column doesn't exist.

---

## Project structure

```
├── client/              React + Vite frontend
│   └── src/
│       ├── branding.ts      ← your library's name/address
│       ├── components/      Sidebar, Topbar, Barcode, ReserveModal, shared UI
│       ├── pages/           One file per screen
│       ├── api.ts           Typed fetch wrapper for every endpoint
│       ├── theme.ts         Themes, accents, shared style tokens
│       └── nav.ts           Sections, titles, sidebar items
├── server/              Express + Drizzle API
│   └── src/
│       ├── db/              schema.ts, push.ts (schema+migrations), seed.ts
│       ├── lib/             domain rules (fines, loan status), http helpers
│       └── routes/          One router per resource
├── shared/              Types + currency helpers used by both sides
└── .env.example         Copy to server/.env
```

`shared/` is imported as `@lumen/shared` from both the client and the server, so
domain types and the money formatter can never drift apart.

---

## API reference

Base URL `http://localhost:4000/api`.

| Resource | Endpoints |
|----------|-----------|
| Health | `GET /health` |
| Auth | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` |
| Dashboard | `GET /dashboard` |
| Books | `GET /books` · `POST /books` · `PATCH /books/:id` · `DELETE /books/:id` |
| Members | `GET /members` · `GET /members/:id/history` · `POST /members` · `PATCH /members/:id` · `DELETE /members/:id` |
| Loans | `GET /loans` · `POST /loans/checkout` · `POST /loans/checkin` · `POST /loans/:id/return` · `POST /loans/:id/renew` |
| Reservations | `GET /reservations` · `POST /reservations` · `POST /reservations/:id/fulfill` · `POST /reservations/:id/cancel` |
| Fines | `GET /fines` · `GET /fines/summary` · `POST /fines/:id/collect` · `POST /fines/:id/waive` |
| Staff | `GET /users` · `POST /users` · `PATCH /users/:id` · `DELETE /users/:id` |
| Settings | `GET /settings` · `PUT /settings` · `POST /settings/lookups/:kind` · `DELETE /settings/lookups/:kind/:value` |
| Reports | `GET /reports/:type?from=&to=` |

Report types: `overdue` · `fines` · `books` · `borrowed` · `inventory` ·
`transactions` · `members`

Every route except `/health` and `/auth/*` requires a session cookie, and each
mutation additionally requires the [permission](#roles) for that resource.

Checkout and check-in accept either database ids or human codes, so a scanner
can drive them directly — note the cookie jar, without which the request is a
401:

```bash
curl -c jar -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"daveen.dev@lumenlibrary.org","password":"lumen-demo-2024"}'

curl -b jar -X POST http://localhost:4000/api/loans/checkout \
  -H "Content-Type: application/json" \
  -d '{"bookBarcode":"LIB-000845","memberCode":"S-1042"}'
```

---

## Security

### How authentication works

Staff sign in with an email and password. The password is hashed with scrypt
(salted, one hash per account) and never leaves the server. A successful
sign-in returns a signed session token in an **httpOnly** cookie, so no script
on the page can read it — an XSS bug cannot steal a session.

`requireAuth` is mounted on `/api` as a whole, so every route except the health
check and the sign-in endpoints needs a session. It re-reads the staff account
from the database on each request rather than trusting the token's claims,
which means disabling an account takes effect immediately rather than whenever
that person's token happens to expire.

Sign-in is throttled per address, answers an unknown address exactly as it
answers a wrong password, and only reveals that an account is disabled after
the password has been proven — so it cannot be used to enumerate staff.

### Roles

Roles map to permissions in [`shared/types.ts`](shared/types.ts), which both
the client and the server import. The client hides what a role cannot do and
the server refuses it; because they read the same table, they cannot disagree.

| | Admin | Librarian | Assistant |
|---|---|---|---|
| Read every screen | ✅ | ✅ | ✅ |
| Check out / return / renew / hold | ✅ | ✅ | ✅ |
| Add, edit, remove books | ✅ | ✅ | — |
| Register and edit borrowers | ✅ | ✅ | — |
| Collect and waive fines | ✅ | ✅ | — |
| Change fine policy and lists | ✅ | — | — |
| Manage staff accounts | ✅ | — | — |

Theme and accent are exempt from the settings permission — they are appearance,
not policy, and every role can change them.

An Admin cannot demote, disable or delete their own account, which is the easy
way to leave a library with no administrator.

### Before deploying

1. **Set `AUTH_SECRET`** to a long random value. The server refuses to start in
   production without one, because a predictable signing key would let anyone
   mint an Admin session.
2. **Change the demo passwords.** Every seeded account uses the password
   printed by `npm run db:seed`, and it is in this repository.
3. **Set `CORS_ORIGIN`** to your actual frontend origin if the client is served
   from somewhere other than the API.
4. **Put it behind HTTPS.** Session cookies are marked `secure` in production,
   so sign-in will not work over plain HTTP.
5. Consider that borrower records are personal data, with the obligations that
   carry in your jurisdiction.

**Known advisory:** this project pins `drizzle-orm` 0.38.x, which is affected by
[GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9) (SQL
injection via improperly escaped identifiers). Upgrading to 0.45.2+ is a
breaking change and hasn't been done yet. Run `npm audit` to see the current
picture.

---

## Troubleshooting

**`password authentication failed for user "postgres"`**
The password in `DATABASE_URL` is wrong, or it contains special characters that
need percent-encoding. On a fresh Windows install it's whatever you chose during
setup — not blank.

**`database "library_system" does not exist`**
You skipped step 3. Run `createdb library_system`.

**`ECONNREFUSED 127.0.0.1:5432`**
PostgreSQL isn't running. Windows: check the `postgresql-x64-16` service.
macOS: `brew services start postgresql@16`. Linux:
`sudo systemctl start postgresql`.

**`EADDRINUSE: address already in use :::4000`**
Something already holds port 4000 — often a previous run that didn't exit.
Find and stop it, or change `PORT` (and the Vite proxy — see
[Configuration](#changing-the-api-port)).

**The client loads but every screen is empty**
The API isn't reachable. Check the server terminal for errors, and confirm
`http://localhost:4000/api/health` returns `{"ok":true}`.

**`db:push` says "Schema is up to date" but my new column is missing**
Expected — see [Adding a database column](#adding-a-database-column).

**Barcodes look wrong or won't scan**
Print at 100% scale with no "fit to page" scaling, which distorts bar widths.
Confirm your scanner is set to read Code 128 (nearly all are by default).

---

## Contributing

Issues and pull requests are welcome.

```bash
git checkout -b feat/your-feature
npm run build                       # type-check + build the client
cd server && npx tsc --noEmit       # type-check the server
```

Please keep both type-checks clean. The repo has a `.gitattributes` that
normalises line endings, so cross-platform contributions shouldn't produce
whole-file diffs.

---

## Credits

Built and maintained by **[Daveen Dev](https://github.com/DaveenDev)**.

If you use this project, a link back is appreciated but not required — see
[License](#license).

## License

Released under the MIT License — see [LICENSE](LICENSE). You are free to use,
modify and distribute this, including commercially.

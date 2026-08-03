# Handoff — portfolio-readiness work

Context for an agent picking this repo up fresh. Everything the previous
handoff listed is now done; what follows records how, and what is left.

## Start here

```bash
npm install
cp .env.example server/.env      # then edit DATABASE_URL for your Postgres
npm run setup                    # schema + demo data
npm run dev                      # API :4000, client :5173
```

Sign in as `daveen.dev@lumenlibrary.org` / `lumen-demo-2024` (Admin). The
other seeded accounts, and what each role can do, are in the README.

Verification gates — **all four must stay green**, and CI runs them on every
push and PR:

```bash
npm run typecheck   # server tsc --noEmit + client tsc -b
npm run lint        # 0 errors, 0 warnings
npm test            # 87 tests
npm run build       # client production build
```

`npm test` needs a reachable Postgres. It resolves `TEST_DATABASE_URL`, else
`DATABASE_URL` with `_test` appended to the database name, then creates that
database and applies the schema itself. It never touches the dev database —
please keep it that way.

## Done (do not redo)

- **Concurrency correctness.** Checkout/return/renew and hold placement are
  transactional with atomic guards. Regression tests exist for both races in
  `server/tests/circulation.test.ts`.
- **Input validation.** Zod schemas in `server/src/lib/validate.ts`, applied to
  every route. `parseId()` rejects NaN/negative ids. Postgres constraint codes
  map to 409 rather than 500.
- **Tests + lint/format.** Vitest (87 tests), ESLint flat config, Prettier.
- **CI.** `.github/workflows/ci.yml` runs all four gates on Node 20 and 22
  against a `postgres:16` service container.
- **Authentication and roles.** Covered below.
- **Accessibility.** aria-labels on every icon-only button, `Field` wires
  label/control ids for all 29 form fields, toasts are a live region, `Modal`
  traps focus, closes on Escape and restores focus to its trigger.
- **Responsive layout.** Off-canvas sidebar below 900px, collapsing grids,
  fluid search boxes. Verified at 390 / 820 / 1400px with no horizontal
  overflow on any screen.
- **The set-state-in-effect warnings.** All six removed by deriving state or
  keying the component on loaded data; the rule is back to `error`.

## How authentication works

Read this before touching a route or adding a screen.

- Passwords are scrypt hashes in `staff_users.password_hash`. The column is
  nullable: an account with no hash simply cannot sign in until an Admin sets
  a password.
- Sign-in returns a signed JWT in an **httpOnly** cookie. `AUTH_SECRET` signs
  it and is mandatory in production; in development a random per-process key
  is generated, so sessions end when the server restarts. That is deliberate.
- `requireAuth` is mounted on `/api` as a whole in `server/src/app.ts`, not per
  router, so **a new router is protected by default**. It re-reads the staff
  row on every request rather than trusting the token, so disabling an account
  takes effect immediately.
- Roles map to permissions in `shared/types.ts` (`ROLE_PERMISSIONS`), imported
  by both sides. **Add a permission there first**, then gate the route and the
  UI from the same table — that shared source is what stops the client
  offering something the server refuses.
- Mutations are gated where the router is mounted, via `writesRequire(...)`.
  Reads are open to any signed-in account. Theme and accent are exempt from
  `settings:write`, because the topbar theme picker writes through the
  settings route and must work for every role.

## Remaining

### 1. Password self-service — not started

An Admin can set anyone's password from User Management, but nobody can
change their own, and there is no reset flow. A "change my password" endpoint
taking the current password would be the obvious next step; a reset by email
needs mail sending, which the app does not do yet (`emailReminders` in
settings is likewise unimplemented).

### 2. Session lifetime — worth a decision

Sessions last 8 hours with no refresh, so a librarian on a long shift is
signed out mid-day. Either lengthen it or issue a fresh cookie on activity.

### 3. Prettier is not clean — 37 files

`npm run format:check` fails on files that predate the Prettier config. It is
deliberately **not** a CI step, because reformatting them belongs in its own
commit rather than buried in an unrelated one. Run `npm run format`, commit
the result alone, then add `format:check` to `.github/workflows/ci.yml`.

### 4. drizzle-orm advisory

The project pins `drizzle-orm` 0.38.x, affected by
[GHSA-gpj5-g38j-94v9](https://github.com/advisories/GHSA-gpj5-g38j-94v9).
Upgrading to 0.45.2+ is a breaking change and has not been done.

## Conventions worth matching

- **Commit messages explain the "why" and the failure mode**, not just the
  change. See `git log` — that standard is deliberate and worth keeping.
- Comments explain *why*, not what. Don't narrate the code.
- No `any`. `catch` binds `unknown`; use `errorMessage()` from
  `client/src/lib/errors.ts`.
- Currency lives in `shared/types.ts` (`CURRENCY_SYMBOL`, `money()`), library
  identity in `client/src/branding.ts`. Don't reintroduce hardcoded values.
- `server/src/db/push.ts` only runs `CREATE TABLE IF NOT EXISTS` for tables —
  **new columns need an entry in its `MIGRATIONS` block**, or they'll be
  silently skipped on an existing database while it still prints "up to date".
- Zod: build update schemas from a default-free field map, **not** from
  `createSchema.partial()`. `.partial()` keeps `.default()`, so an omitted
  field arrives as the default and the PATCH handlers write it. That silently
  un-suspended members before it was fixed.
- The app is styled with inline `style` objects, which cannot express a media
  query, so anything responsive is a class in `client/src/index.css`. An
  inline value beats a class rule — if a media query needs to change a
  property, that property has to move out of the element and into the
  stylesheet.

## Deliberately out of scope

A live deployed demo. The repo owner is handling that separately.

# Handoff — remaining portfolio-readiness work

Context for an agent picking this repo up fresh. Everything below was
identified in an audit of the app as a portfolio piece; the first three items
are done, the rest are not.

## Start here

```bash
npm install
cp .env.example server/.env      # then edit DATABASE_URL for your Postgres
npm run setup                    # schema + demo data
npm run dev                      # API :4000, client :5173
```

Verification gates — **all four must stay green**:

```bash
npm run typecheck   # server tsc --noEmit + client tsc -b
npm run lint        # 0 errors (6 known warnings, see below)
npm test            # 59 tests
npm run build       # client production build
```

`npm test` needs a reachable Postgres. It resolves `TEST_DATABASE_URL`, else
`DATABASE_URL` with `_test` appended to the database name, then creates that
database and applies the schema itself. It never touches the dev database —
please keep it that way.

## Done (do not redo)

- **Concurrency correctness.** Checkout/return/renew and hold placement are
  transactional with atomic guards. Regression tests exist for both races in
  `server/tests/circulation.test.ts`. Before the fix, 5 concurrent checkouts
  of a 1-copy book all succeeded.
- **Input validation.** Zod schemas in `server/src/lib/validate.ts`, applied to
  every route. `parseId()` rejects NaN/negative ids. Postgres constraint codes
  map to 409 rather than 500.
- **Tests + lint/format.** Vitest (59 tests), ESLint flat config, Prettier.

## Remaining, in priority order

### 1. GitHub Actions CI — not started

No `.github/workflows` exists. Add one running the four gates above on push
and PR. Needs a Postgres service container; set `TEST_DATABASE_URL` to point
at it. Suggested matrix: Node 20 and 22.

### 2. Accessibility — not started

Currently **0** `aria-*` attributes, **0** `htmlFor` associations, **0** `alt`
attributes across 54 buttons.

- Icon-only buttons (Edit/Delete/Reserve in Catalog, history/edit/delete in
  Borrowers) have no accessible name. They already carry `title`; add
  `aria-label` too — `title` alone is not reliably announced.
- `Field` in `client/src/components/ui.tsx` renders a `<label>` with no
  `htmlFor`. Wire an id through so labels associate with their inputs; this
  fixes every form at once.
- Toasts (`ToastProvider`, same file) need `role="status"` / `aria-live="polite"`
  so they're announced.
- `Modal` (same file) does not trap focus, does not close on Escape, and does
  not restore focus to the trigger on close.

### 3. Responsive layout — not started

Effectively desktop-only: **1** media query (print), 26 hardcoded pixel widths.

- `Sidebar` is fixed-width and always visible — needs an off-canvas/collapsible
  mode below ~900px.
- Several `gridTemplateColumns: "1fr 1fr"` and `"repeat(4,1fr)"` need to
  collapse to one column on narrow screens (Circulation, Labels, the borrower
  history modal, Dashboard's two-column rows).
- Search inputs use fixed `width: "340px"` / `"400px"`; make them fluid.
- Tables already sit in `overflow-x: auto` wrappers, so they mostly work — verify
  rather than rewrite.

### 4. Authentication — not started, largest item

There is **no auth at all**: `app.use(cors())` is fully open and no route checks
identity. The User Management screen shows roles and permissions that are purely
decorative. `CURRENT_USER` in `client/src/branding.ts` is a hardcoded
placeholder standing in for a session.

This is the single biggest gap between "impressive demo" and "real system".
Scope it deliberately — session or JWT, password hashing, route middleware,
and making the existing Admin/Librarian/Assistant roles actually gate actions.

### 5. Known lint warnings — 6, deliberate

`react-hooks/set-state-in-effect` is set to `warn` in `eslint.config.js` with an
explanatory comment. Several pages (Settings, Catalog, Borrowers) seed form
state from fetched data inside an effect. The correct fix is deriving the state
or keying the component on the loaded data, not adding a dependency. If you fix
them, promote the rule back to `error`.

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

## Deliberately out of scope

A live deployed demo. The repo owner is handling that separately.

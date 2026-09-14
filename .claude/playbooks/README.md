# Browser test playbooks

Two role-scoped, browser-driven journey playbooks. They are **documents an agent
executes**, not scripts — each one tells you which ports to bring up, which
account to sign in as, what to click, what to assert, and what file to write at
the end.

| File | Persona | Question it answers |
|---|---|---|
| `user-journey-playbook.md` | **Assistant** (`circulation:write` only — the most restricted login Lumen has; there is no borrower/public account) | Does the write cage hold? Can a restricted account reach, or drive, anything it shouldn't — in the UI *and* against the API directly? |
| `admin-journey-playbook.md` | **Admin** (all six permissions) | Does the whole product work end to end for the person who runs the library — including the settings, staff administration and data-integrity paths nothing else tests? |

Results are written to `user-journey-results/` and `admin-journey-results/`
(created on first run), one file per run, each with a results table, UX friction
notes and a bugs section.

## Relationship to the other suites

- `.claude/skills/beta-test` — the **scripted** regression suite
  (`node runner.mjs`). Faster, deterministic, exits non-zero on failure. **Run it
  first**; these playbooks are the exploratory layer on top.
- `npm run typecheck && npm run lint && npm test && npm run build` — the four
  gates. They prove the code is sound; the playbooks prove the product works.

## Before running either

Both playbooks bring up their **own** API and client against a scratch database
(`library_system_playbook`) on their own ports. They must never touch:

- **4000 / 5173** — the developer's `npm run dev` stack,
- **4100 / 5273** — the `beta-test` harness,
- the dev database named in `server/.env`.

Run the two in sequence, not concurrently: they share the scratch database, and
the admin playbook changes fine policy while the user playbook asserts against it.

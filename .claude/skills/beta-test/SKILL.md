---
name: beta-test
description: Run the browser-driven beta test of the Lumen library app — signs in as real staff accounts and works through real library tasks in Chromium, then writes a report to .claude/testings. Use when asked to beta test, smoke test, regression test, QA, or verify the app end to end in a browser, or before tagging a release or opening a PR that touches the client.
---

# Beta testing playbook

This is not a unit test suite. It is a tester sitting down at the app and doing
a shift: signing in, lending books, taking fines, printing labels, and writing
down what went wrong and what felt wrong.

The four gates (`npm run typecheck`, `lint`, `test`, `build`) prove the code is
sound. This proves the *product* works. Run both.

## Run it

```bash
cd .claude/skills/beta-test
npm install            # first time only
node runner.mjs
```

Roughly three minutes for the full set. Then read the report it names, which is
also copied to `.claude/testings/latest.md`.

| Flag | What it does |
|---|---|
| `--only <text>` | Run journeys whose id contains `<text>`, e.g. `--only circulation` |
| `--headed` | Show the browser. The only way to see what a failing step looks like live |
| `--keep-open` | Leave the browser open at the end, to poke at the final state |

The exit code is 0 only if every journey passed, so it drops straight into a
release script.

### What it does to your data

Nothing. The runner brings up its own API and client on ports 4100 and 5273,
against a database named after your dev one with `_beta` appended, seeded fresh
at the start of every run. Your `npm run dev` stack and its data are untouched
and can stay running.

Override with `BETA_DATABASE_URL`, `BETA_API_PORT`, `BETA_CLIENT_PORT` if those
ports are taken. The runner refuses to start if either port is already serving
something, rather than silently testing whatever is there.

### Prerequisites

- Postgres reachable, and `server/.env` present (the runner reads `DATABASE_URL`
  from it to derive the beta database name).
- `npm install` at the repo root.
- Chromium. Found automatically at `PLAYWRIGHT_BROWSERS_PATH`, otherwise
  Playwright downloads its own; `BETA_CHROMIUM` overrides.

## Reading a result

A journey is a sequence of steps and stops at the first one that fails —
because a tester who cannot check a book out cannot then return it, and the
five cascading failures that follow would say nothing new.

Every run produces three things in `.claude/testings/run-<timestamp>/`:

- `report.md` — the readable one. Verdict, journey table, failures with the
  step that broke and a screenshot, observations, console errors, coverage.
- `results.json` — the same thing structured, for diffing runs.
- `screenshots/` — a shot at each failure, plus the ones journeys take
  deliberately at moments worth looking at.

### Failure, observation, or my mistake

Triage in that order — most reported failures on a first run are the third.

1. **Reproduce it by hand.** `--headed --only <id>`, watch the step fail. If it
   passes when a human does it, the journey is wrong, not the app.
2. **Check the screenshot.** It is taken at the moment of failure and usually
   answers the question immediately.
3. **Ask whether the assertion is right.** Real examples from writing these:
   an "empty" table still has one row, the one saying *No books found*;
   `hasText: "Paid"` also matches *Unpaid*; the sidebar has a **Fines &
   Penalties** destination with the same words as a report tab, so an unscoped
   click navigates away instead of switching tabs. All three looked like app
   bugs and were not.
4. **If the app really is wrong**, fix the app, not the assertion. Weakening a
   journey to make it green is the one thing that makes this whole exercise
   worthless.

Not everything worth saying is a failure. `t.observe(severity, text)` records a
note that appears in the report without failing the run — use it for things a
human would mention but not block on. Severities: `blocker`, `major`, `minor`,
`polish`.

## Adding a journey

Journeys live in `journeys/`, loaded in filename order. Add to an existing file
if it fits the area; make a new numbered one if it does not.

```js
import { defineJourney, step } from "../lib/tester.mjs";

export default [
  defineJourney({
    id: "overdue-notice",            // stable; --only matches on it
    title: "A librarian chases an overdue book",
    persona: "librarian",            // see personas.mjs; "signed out" to test sign-in
    viewport: { width: 390, height: 844 },   // optional, defaults to 1400×900
    steps: [
      step("Open the overdue report", async (t) => {
        await t.goTo("Reports");
        await t.inPage("Overdue Report").first().click();
        await t.expectVisible("Days Late");
      }),
    ],
  }),
];
```

The runner signs the persona in before the first step, so journeys start where
a working day starts.

### Write steps the way a tester would talk

Name a step after the outcome a person cares about — *"The returned loan leaves
the active list"* — not after the mechanics. When it fails, that sentence is
the bug report.

Address the page by what is on it. `t.click("Add Book")`,
`t.fillField("Member ID", "S-1042")`, `t.expectToast(/Checked out/i)`. Never
CSS classes or `nth(3)` positions. Two reasons: the journey stays readable as a
description of the work, and a test that finds its controls by accessible name
fails the moment a control loses its accessible name — which is a real bug the
harness catches for free.

| Method | |
|---|---|
| `t.goTo(section)` | Sidebar destination; opens the drawer first on narrow screens |
| `t.click(name)` · `t.inPage(name)` | Any button · one in the page body, excluding the sidebar and topbar |
| `t.fillField(label)` · `t.chooseOption(label, value)` · `t.pressEnterIn(label)` | Form controls, addressed by their label |
| `t.expectVisible(text)` · `t.expectHidden(text)` · `t.expectButton(name, {present})` | Presence |
| `t.expectToast(/pattern/)` | Catches a toast before it fades. Returns its text |
| `t.rowMatching(a, b)` · `t.rowWithStatus(s)` | A table row, by two of its cells or by an exactly-matched status badge |
| `t.expectEmptyTable(msg)` · `t.rowCount()` · `t.fieldValue(label)` | Table and field state |
| `t.expectDownload(fn)` | Runs `fn`, returns the downloaded filename |
| `t.acceptDialog()` | Arms an answer for the next `confirm`/`prompt`. **Required before any Delete or Waive** |
| `t.observe(severity, text)` · `t.shot(name)` | Record a note · take a screenshot |
| `t.settle(ms)` | Wait. Prefer an `expect*` that waits on a condition |

### Leave the library as you found it

The database is reseeded per run but not per journey, so a journey that creates
a book should delete it. Two journeys that both assume a title is on the shelf
will otherwise fight, and which one fails depends on filename order.

## Before a release

1. `npm run typecheck && npm run lint && npm test && npm run build`
2. `node runner.mjs` from this directory
3. Read the observations, not just the verdict. The verdict says nothing broke;
   the observations are where a tester tells you what is awkward.
4. Commit the run directory. `.claude/testings/` is history: a report from the
   commit before a regression is how you find out when it started.

## What this does not cover

Stated in every report so a green run is not read as more than it is: printing
to paper, the *contents* of exported PDF and Excel files (the download is
triggered and named, never opened), real barcode-scanner hardware, email
reminders (unimplemented), two staff using the app at once, and any browser
other than Chromium.

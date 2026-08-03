# Beta test results

Output of the beta-test playbook (`.claude/skills/beta-test`). One directory
per run, kept as history — a report from the commit before a regression is how
you find out when it started.

```
latest.md                 A copy of the most recent report, for a quick look
run-<timestamp>/
  report.md               The readable one
  results.json            The same run, structured, for diffing against another
  screenshots/            Failures, plus moments the journeys capture on purpose
```

## Reading a report

**Verdict** is the headline, but the **Observations** table is usually where
the value is: things that work but are wrong-feeling, recorded without failing
the run. `blocker` and `major` want a decision; `polish` is often just a fact
worth having written down.

**Browser console** carries uncaught exceptions, 5xx responses and network
failures only. Anything in it is real — 4xx is filtered out because the
journeys provoke wrong passwords, suspended borrowers and duplicate holds on
purpose.

**Coverage** says what the run did not touch, so a green verdict is not read as
more than it is.

## Running one

```bash
cd .claude/skills/beta-test
npm install    # first time only
node runner.mjs
```

It uses its own database and ports; your dev stack and its data are untouched.
See the playbook for triage guidance and how to add a journey.

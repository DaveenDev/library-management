# Beta test run — 2026-09-14 02:18 UTC

**Verdict: PASS** · 3 passed, 0 failed, 0 blocked · 77s

| | |
|---|---|
| Commit | `dd85954` on `claude/dreamy-goldberg-scu6qn` |
| Node | v22.22.2 |
| Browser | Chromium 141.0.7390.37 |
| Database | `library_system_beta` (seeded fresh for this run) |
| Viewports | 1400×900 |

## Journeys

| | Journey | As | Steps | Time |
|---|---|---|---|---|
| ✅ | An assistant can work the desk but not run the library | assistant | 9/9 | 18s |
| ✅ | A librarian runs the collection but not the staff list | librarian | 5/5 | 32s |
| ✅ | An administrator manages staff accounts | admin | 7/7 | 19s |

## Observations

Not failures. Things a tester noticed that someone should decide about.

| Severity | Journey | Note |
|---|---|---|
| polish | A librarian runs the collection but not the staff list | Theme persisted across reload as rgb(221, 227, 208) |

## Browser console

Uncaught exceptions, 5xx responses and network-level failures only. 4xx is left out: the journeys provoke wrong passwords, suspended borrowers and duplicate holds on purpose, and each one is a 4xx the app handles correctly.

Clean — nothing on any journey.

## Coverage

What this run did and did not touch, so the verdict is not read as more than it is.

**Exercised:** An assistant can work the desk but not run the library · A librarian runs the collection but not the staff list · An administrator manages staff accounts

**Not exercised:** printing to paper · the contents of exported PDF and Excel files (the download is triggered and named, never opened) · real barcode-scanner hardware · email reminders (unimplemented) · two staff using the app at once · any browser other than Chromium.

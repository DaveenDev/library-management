/** Renders a run into the markdown a reviewer actually reads. */

const ICON = { passed: "✅", failed: "❌", blocked: "⏭️", skipped: "⏭️" };
const SEVERITY_ORDER = { blocker: 0, major: 1, minor: 2, polish: 3 };

export function renderReport({ startedAt, finishedAt, results, stack, environment }) {
  const passed = results.filter((r) => r.status === "passed");
  const failed = results.filter((r) => r.status === "failed");
  const blocked = results.filter((r) => r.status === "blocked");
  const observations = results
    .flatMap((r) => r.observations.map((o) => ({ ...o, journey: r.title })))
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9));
  const consoleErrors = results.flatMap((r) =>
    r.consoleErrors.map((e) => ({ journey: r.title, error: e })),
  );

  const durationS = Math.round((finishedAt - startedAt) / 1000);
  const verdict = failed.length === 0 && blocked.length === 0 ? "PASS" : "FAIL";

  const out = [];
  const w = (line = "") => out.push(line);

  w(`# Beta test run — ${new Date(startedAt).toISOString().replace("T", " ").slice(0, 16)} UTC`);
  w();
  w(`**Verdict: ${verdict}** · ${passed.length} passed, ${failed.length} failed, ${blocked.length} blocked · ${durationS}s`);
  w();
  w("| | |");
  w("|---|---|");
  w(`| Commit | \`${environment.commit}\` on \`${environment.branch}\` |`);
  w(`| Node | ${environment.node} |`);
  w(`| Browser | ${environment.browser} |`);
  w(`| Database | \`${stack.dbName}\` (seeded fresh for this run) |`);
  w(`| Viewports | ${environment.viewports} |`);
  w();

  w("## Journeys");
  w();
  w("| | Journey | As | Steps | Time |");
  w("|---|---|---|---|---|");
  for (const r of results) {
    const done = r.steps.filter((s) => s.status === "passed").length;
    w(`| ${ICON[r.status] ?? "•"} | ${r.title} | ${r.persona} | ${done}/${r.steps.length} | ${Math.round(r.ms / 1000)}s |`);
  }
  w();

  if (failed.length) {
    w("## Failures");
    w();
    for (const r of failed) {
      const bad = r.steps.find((s) => s.status === "failed");
      w(`### ❌ ${r.title}`);
      w();
      w(`Signed in as **${r.persona}**. Failed at step ${r.steps.indexOf(bad) + 1} of ${r.steps.length}.`);
      w();
      w("| | Step |");
      w("|---|---|");
      for (const s of r.steps) w(`| ${ICON[s.status] ?? "•"} | ${s.name} |`);
      w();
      w("**What went wrong**");
      w();
      w("```");
      w(bad?.detail ?? "unknown");
      w("```");
      w();
      if (r.screenshots.length) {
        w(`**Screenshots:** ${r.screenshots.map((s) => `[${s}](screenshots/${s})`).join(" · ")}`);
        w();
      }
    }
  }

  if (blocked.length) {
    w("## Blocked");
    w();
    for (const r of blocked) w(`- **${r.title}** — ${r.blockedReason}`);
    w();
  }

  w("## Observations");
  w();
  if (observations.length === 0) {
    w("None — nothing outside the pass/fail checks was worth writing down.");
  } else {
    w("Not failures. Things a tester noticed that someone should decide about.");
    w();
    w("| Severity | Journey | Note |");
    w("|---|---|---|");
    for (const o of observations) w(`| ${o.severity} | ${o.journey} | ${o.text} |`);
  }
  w();

  w("## Browser console");
  w();
  w(
    "Uncaught exceptions, 5xx responses and network-level failures only. " +
      "4xx is left out: the journeys provoke wrong passwords, suspended " +
      "borrowers and duplicate holds on purpose, and each one is a 4xx the " +
      "app handles correctly.",
  );
  w();
  if (consoleErrors.length === 0) {
    w("Clean — nothing on any journey.");
  } else {
    w("| Journey | Error |");
    w("|---|---|");
    for (const c of consoleErrors) w(`| ${c.journey} | \`${c.error.replace(/\|/g, "\\|").slice(0, 160)}\` |`);
  }
  w();

  w("## Coverage");
  w();
  w("What this run did and did not touch, so the verdict is not read as more than it is.");
  w();
  w("**Exercised:** " + results.map((r) => r.title).join(" · "));
  w();
  w(
    "**Not exercised:** printing to paper · the contents of exported PDF and " +
      "Excel files (the download is triggered and named, never opened) · real " +
      "barcode-scanner hardware · email reminders (unimplemented) · two staff " +
      "using the app at once · any browser other than Chromium.",
  );
  w();

  return out.join("\n");
}

export function renderSummaryLine({ results }) {
  const failed = results.filter((r) => r.status === "failed");
  const blocked = results.filter((r) => r.status === "blocked");
  return failed.length === 0 && blocked.length === 0
    ? `PASS — all ${results.length} journeys`
    : `FAIL — ${failed.length} failed, ${blocked.length} blocked of ${results.length}`;
}

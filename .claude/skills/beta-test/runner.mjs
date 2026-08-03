#!/usr/bin/env node
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startStack, BASE_URL } from "./lib/stack.mjs";
import { Tester } from "./lib/tester.mjs";
import { renderReport, renderSummaryLine } from "./lib/report.mjs";
import { PERSONAS } from "./personas.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "../../..");
const RESULTS_ROOT = path.join(REPO_ROOT, ".claude", "testings");

const args = process.argv.slice(2);
const only = argValue("--only");
const headed = args.includes("--headed");
const keepOpen = args.includes("--keep-open");

function argValue(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? undefined : args[i + 1];
}

const log = (line) => process.stdout.write(`${line}\n`);

// A pending Playwright waiter that rejects after its step has moved on would
// otherwise abort the process and lose every result gathered so far.
process.on("unhandledRejection", (err) => {
  log(`  ! stray rejection ignored: ${err?.message ?? err}`);
});

/** Chromium may be preinstalled at a known path, or managed by Playwright. */
function chromiumPath() {
  if (process.env.BETA_CHROMIUM) return process.env.BETA_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (root && existsSync(root)) {
    const dir = readdirSync(root).find((d) => /^chromium-\d/.test(d));
    const exe = dir && path.join(root, dir, "chrome-linux", "chrome");
    if (exe && existsSync(exe)) return exe;
  }
  return undefined; // let Playwright use its own download
}

async function loadJourneys() {
  const dir = path.join(HERE, "journeys");
  const files = readdirSync(dir).filter((f) => f.endsWith(".mjs")).sort();
  const loaded = [];
  for (const file of files) {
    const mod = await import(path.join(dir, file));
    for (const journey of mod.default) loaded.push(journey);
  }
  return only ? loaded.filter((j) => j.id.includes(only)) : loaded;
}

async function main() {
  const startedAt = Date.now();
  const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const runDir = path.join(RESULTS_ROOT, `run-${stamp}`);
  const shotDir = path.join(runDir, "screenshots");
  mkdirSync(shotDir, { recursive: true });

  const journeys = await loadJourneys();
  if (journeys.length === 0) {
    log(only ? `No journey matches “${only}”.` : "No journeys found.");
    process.exit(1);
  }
  log(`Beta test — ${journeys.length} journeys\n`);

  const stack = await startStack({ repoRoot: REPO_ROOT, log });
  const browser = await chromium.launch({ headless: !headed, executablePath: chromiumPath() });
  const results = [];

  try {
    for (const journey of journeys) {
      results.push(await runJourney({ browser, journey, shotDir }));
    }
  } finally {
    if (!keepOpen) await browser.close();
    await stack.stop();
  }

  const finishedAt = Date.now();
  const report = renderReport({
    startedAt,
    finishedAt,
    results,
    stack,
    environment: {
      commit: git("rev-parse --short HEAD"),
      branch: git("rev-parse --abbrev-ref HEAD"),
      node: process.version,
      browser: `Chromium ${browser.version?.() ?? ""}`.trim(),
      viewports: [...new Set(journeys.map((j) => viewportLabel(j)))].join(", "),
    },
  });

  writeFileSync(path.join(runDir, "report.md"), report);
  writeFileSync(path.join(runDir, "results.json"), JSON.stringify({ startedAt, finishedAt, results }, null, 2));
  writeFileSync(path.join(RESULTS_ROOT, "latest.md"), report);

  log(`\n${renderSummaryLine({ results })}`);
  log(`Report: ${path.relative(REPO_ROOT, path.join(runDir, "report.md"))}`);
  process.exit(results.some((r) => r.status !== "passed") ? 1 : 0);
}

function viewportLabel(journey) {
  const v = journey.viewport ?? { width: 1400, height: 900 };
  return `${v.width}×${v.height}`;
}

async function runJourney({ browser, journey, shotDir }) {
  const started = Date.now();
  log(`▶ ${journey.title}  (as ${journey.persona})`);

  const context = await browser.newContext({
    viewport: journey.viewport ?? { width: 1400, height: 900 },
    baseURL: BASE_URL,
  });
  const page = await context.newPage();
  const t = new Tester(page, { journeyId: journey.id, artifactDir: shotDir, log });

  const result = {
    id: journey.id,
    title: journey.title,
    persona: journey.persona,
    status: "passed",
    steps: journey.steps.map((s) => ({ name: s.name, status: "skipped", detail: null })),
    observations: [],
    consoleErrors: [],
    screenshots: [],
    ms: 0,
  };

  try {
    await t.open();
    // Every journey starts signed in as its persona unless it is the journey
    // that tests signing in.
    if (journey.persona !== "signed out") {
      const who = PERSONAS[journey.persona];
      if (!who) throw new Error(`unknown persona “${journey.persona}”`);
      await t.signIn(who);
      await page.waitForSelector("aside", { timeout: 20_000 });
      await t.settle(800);
    }

    for (const [i, s] of journey.steps.entries()) {
      try {
        await s.run(t);
        result.steps[i].status = "passed";
        log(`  ✓ ${s.name}`);
      } catch (err) {
        result.steps[i].status = "failed";
        result.steps[i].detail = err.message;
        result.status = "failed";
        log(`  ✗ ${s.name}\n      ${err.message}`);
        await t.shot("failure").catch(() => {});
        break;
      }
    }
  } catch (err) {
    result.status = "blocked";
    result.blockedReason = err.message;
    log(`  ⏭ blocked before the first step: ${err.message}`);
    await t.shot("blocked").catch(() => {});
  } finally {
    result.observations = t.observations;
    result.consoleErrors = t.consoleErrors;
    result.screenshots = t.screenshots;
    result.ms = Date.now() - started;
    await context.close();
  }

  return result;
}

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: REPO_ROOT }).toString().trim();
  } catch {
    return "unknown";
  }
}

main().catch((err) => {
  log(`\nRun failed to start: ${err.message}`);
  process.exit(1);
});

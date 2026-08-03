import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Brings up an API and client dedicated to the beta run.
 *
 * Deliberately not the developer's dev stack: these journeys borrow books,
 * collect fines and delete records, and a tester should never have to wonder
 * whether a run just emptied the catalogue they were working with. The run
 * gets its own database, seeded fresh so every run starts from the same
 * library, and its own ports so `npm run dev` can stay up alongside it.
 */

export const API_PORT = Number(process.env.BETA_API_PORT ?? 4100);
export const CLIENT_PORT = Number(process.env.BETA_CLIENT_PORT ?? 5273);
export const BASE_URL = `http://localhost:${CLIENT_PORT}`;

/**
 * Resolve the throwaway database. Mirrors how the Vitest suite picks its own:
 * an explicit URL wins, otherwise the dev database name with a suffix.
 */
export function betaDatabaseUrl(repoRoot) {
  const explicit = process.env.BETA_DATABASE_URL;
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL ?? readEnvFile(repoRoot).DATABASE_URL;
  if (!base) {
    throw new Error(
      "No database configured. Set BETA_DATABASE_URL, or create server/.env with DATABASE_URL.",
    );
  }
  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "") || "postgres";
  if (name.endsWith("_beta")) return base;
  url.pathname = `/${name}_beta`;
  return url.toString();
}

function readEnvFile(repoRoot) {
  const file = path.join(repoRoot, "server", ".env");
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function run(command, args, { cwd, env, label, log }) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    // Its own process group. `npm run` spawns tsx and vite as grandchildren,
    // and signalling npm alone leaves those running — they then hold the
    // ports and the next run refuses to start.
    detached: true,
  });
  const record = (buf) => log?.(`[${label}] ${buf.toString().trimEnd()}`);
  child.stdout.on("data", record);
  child.stderr.on("data", record);
  return child;
}

function once(command, args, opts) {
  return new Promise((resolve, reject) => {
    const child = run(command, args, opts);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${opts.label} exited with code ${code}`)),
    );
  });
}

/** Signal the whole group, so npm's tsx/vite children go with it. */
function killGroup(child, signal) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    // Already gone.
  }
}

async function waitFor(url, { timeoutMs = 90_000, label }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(400);
  }
  throw new Error(`${label} did not come up at ${url} within ${timeoutMs / 1000}s`);
}

/**
 * Fail fast if something is already listening.
 *
 * Otherwise a leftover server from an aborted run answers instead, and the
 * journeys quietly test yesterday's code against a database nobody reseeded.
 */
async function requirePortFree(port, what) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1500) });
    throw new Error(
      `port ${port} is already serving something (HTTP ${res.status}). ` +
        `Stop it before running the beta test, or set BETA_${what}_PORT to another port.`,
    );
  } catch (err) {
    if (err.message.startsWith("port ")) throw err;
    // Connection refused is what we want.
  }
}

export async function startStack({ repoRoot, log }) {
  await requirePortFree(API_PORT, "API");
  await requirePortFree(CLIENT_PORT, "CLIENT");

  const databaseUrl = betaDatabaseUrl(repoRoot);
  const dbName = new URL(databaseUrl).pathname.replace(/^\//, "");

  // A fixed secret keeps sessions valid across the run; it signs nothing that
  // outlives it.
  const env = {
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: "beta-test-secret-not-for-production",
    PORT: String(API_PORT),
    NODE_ENV: "development",
  };

  log(`Beta database: ${dbName}`);
  await createDatabaseIfMissing(databaseUrl, { repoRoot, env, log });

  log("Applying schema…");
  await once("npm", ["run", "db:push", "--workspace", "server"], {
    cwd: repoRoot,
    env,
    label: "db:push",
    log,
  });

  log("Seeding demo library…");
  await once("npm", ["run", "db:seed", "--workspace", "server"], {
    cwd: repoRoot,
    env,
    label: "db:seed",
    log,
  });

  log(`Starting API on :${API_PORT}…`);
  const api = run("npm", ["run", "start", "--workspace", "server"], {
    cwd: repoRoot,
    env,
    label: "api",
    log,
  });
  await waitFor(`http://localhost:${API_PORT}/api/health`, { label: "API" });

  log(`Starting client on :${CLIENT_PORT}…`);
  const client = run("npm", ["run", "dev", "--workspace", "client"], {
    cwd: repoRoot,
    env: {
      VITE_PORT: String(CLIENT_PORT),
      VITE_API_PROXY: `http://localhost:${API_PORT}`,
    },
    label: "client",
    log,
  });
  await waitFor(BASE_URL, { label: "Client" });

  return {
    databaseUrl,
    dbName,
    async stop() {
      for (const child of [client, api]) killGroup(child, "SIGTERM");
      await sleep(800);
      for (const child of [client, api]) killGroup(child, "SIGKILL");
    },
  };
}

/**
 * `db:push` connects to the target database, so it has to exist first. Done
 * through the server workspace's own `postgres` dependency to avoid requiring
 * psql on the tester's machine.
 */
async function createDatabaseIfMissing(databaseUrl, { repoRoot, log }) {
  const script = `
    import postgres from "postgres";
    const target = new URL(process.env.TARGET_URL);
    const name = target.pathname.replace(/^\\//, "");
    const admin = new URL(target.toString());
    admin.pathname = "/postgres";
    const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
    try {
      const rows = await sql\`select 1 from pg_database where datname = \${name}\`;
      if (rows.length === 0) {
        await sql.unsafe('CREATE DATABASE "' + name.replace(/"/g, '""') + '"');
        console.log("created " + name);
      }
    } finally {
      await sql.end();
    }
  `;
  await once("node", ["--input-type=module", "-e", script], {
    cwd: path.join(repoRoot, "server"),
    env: { TARGET_URL: databaseUrl },
    label: "createdb",
    log,
  });
}

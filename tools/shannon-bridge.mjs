#!/usr/bin/env node
// ==================================================
// SHANNON BRIDGE (runs on Windows, not in the container)
// ==================================================
// Shannon needs Docker for its ephemeral worker container. The app container
// deliberately has neither the docker binary nor /var/run/docker.sock, because
// mounting a Docker socket into a publicly reachable web app hands anyone who
// can sign up root-equivalent control of the host.
//
// So the phone talks to this process instead. It is a small Windows-side HTTP
// service that starts Shannon inside WSL2, buffers its output, and reports the
// phase. It binds to loopback only and requires a shared token, so it is not a
// new attack surface on the network.
//
//   node tools/shannon-bridge.mjs        (start it)
//   curl 127.0.0.1:7071/health           (check it)
//
// Environment:
//   SHANNON_BRIDGE_PORT   default 7071
//   SHANNON_BRIDGE_TOKEN  REQUIRED - shared secret, also set on the app
//   SHANNON_AI_API_KEY    REQUIRED - model key used inside WSL
//   SHANNON_AI_MODEL      default nvidia/nemotron-3.5-lightning-30b-a3b
//   SHANNON_NODE22        default /tmp/node22/bin (Node 22+ inside WSL)
// ==================================================

import http from "node:http";
import { spawn } from "node:child_process";
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// ---- configuration -------------------------------------------------------

const PORT = Number(process.env.SHANNON_BRIDGE_PORT || 7071);
const TOKEN = process.env.SHANNON_BRIDGE_TOKEN || "";
const API_KEY = process.env.SHANNON_AI_API_KEY || "";

// Shannon wants "<provider>:<model-id>", where the provider is the key in
// models.json and the id is the model's own name - hence the colon followed by
// a slash. The plain slash form is rejected at startup.
const MODEL =
  process.env.SHANNON_AI_MODEL || "nvidia:nvidia/nemotron-3.5-lightning-30b-a3b";

const NODE_BIN = process.env.SHANNON_NODE22 || "/tmp/node22/bin";

const REPO =
  process.env.SHANNON_REPO ||
  "E:/Security/Project 2/project/ai-smartphone-security";

// Staging lives outside the repository so a scan never reads its own output.
const PROJECT = path.dirname(REPO);
const STAGE = path.join(PROJECT, ".shannon-target");
const STATE_DIR = path.join(PROJECT, ".shannon");
const OUT_DIR = path.join(REPO, "tools", "out", "shannon");
const MODELS = path.join(REPO, "tools", "shannon-models.json");

// Only this lab may be scanned. Same rule as the Attack Lab terminal: the bridge
// must not become a way to point an autonomous exploiter at a third party.
const ALLOWED_HOSTS = new Set([
  "shekin.tail97139a.ts.net",
  "host.docker.internal",
  "127.0.0.1",
  "localhost"
]);

const MAX_LINES = 4000;

// ---- state ---------------------------------------------------------------

/** @type {{scanId:string|null,running:boolean,state:string,phase:string,url:string,
 *   startedAt:number|null,finishedAt:number|null,exitCode:number|null,
 *   lines:string[],error:string|null,profile:string,workspace:string|null}} */
const run = {
  scanId: null,
  running: false,
  state: "idle", // idle | staging | running | completed | failed | stopped
  phase: "none",
  url: "",
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  lines: [],
  lastKey: null,
  error: null,
  profile: "full",
  workspace: null
};

let child = null;
let scriptPath = null;
let healthCache = { at: 0, value: null };

// ---- helpers -------------------------------------------------------------

const wslPath = winPath =>
  "/mnt/" +
  winPath
    .replace(/^([A-Za-z]):[\\/]?/, (_, drive) => `${drive.toLowerCase()}/`)
    .replace(/\\/g, "/");

const shellQuote = value => `'${String(value).replace(/'/g, "'\\''")}'`;

// Shannon draws a live spinner with \r and ANSI escapes. Left alone that is
// hundreds of identical "Starting Temporal" frames in the transcript, so each
// frame is reduced to its final form and pure progress noise is dropped.
const ANSI_ALL = /\u001b\[[0-9;?]*[A-Za-z]|\u001b\][^\u0007]*\u0007/g;
const SPINNER = /^[\u2800-\u28ff\u25cb\u25cf\u25d0-\u25d3\u25c7\u25c6\u25b6\u25a0\u2022\u2500-\u257f]+\s*/;

// Progress lines that carry no information once the step is done.
const NOISE = [
  /^(Starting|Stopping) Temporal\.{0,3}$/i,
  /^Waiting for .*\.{0,3}$/i,
  /^Running preflight checks.*\.{0,3}$/i,
  /^Validating model.*\.{0,3}$/i,
  /^Waiting for model validation.*\.{0,3}$/i
];

function cleanLine(line) {
  // Take the last carriage-return segment: that is the frame still on screen.
  const segments = String(line).split("\r").filter(Boolean);
  const last = segments.length ? segments[segments.length - 1] : "";

  return last.replace(ANSI_ALL, "").replace(/\u0000/g, "").trimEnd();
}

function push(line) {
  const text = cleanLine(line);
  const bare = text.replace(SPINNER, "").trim();

  if (!bare.length) {
    return;
  }

  if (NOISE.some(pattern => pattern.test(bare))) {
    return;
  }

  // Collapse the trailing dots so "Waiting" and "Waiting..." dedupe together.
  const key = bare.replace(/\.{1,3}$/, "");

  if (run.lines.length && run.lastKey === key) {
    return;
  }

  run.lastKey = key;
  run.lines.push(text);

  if (run.lines.length > MAX_LINES) {
    run.lines.splice(0, run.lines.length - MAX_LINES);
  }

  // Phase is read from Shannon's own progress output rather than guessed.
  const phase = /pre-?recon/i.test(bare)
    ? "pre-recon"
    : /vulnerability[- ]analysis/i.test(bare)
      ? "vulnerability-analysis"
      : /exploitation|exploit agent/i.test(bare)
        ? "exploitation"
        : /reporting|generating report/i.test(bare)
          ? "reporting"
          : /\brecon(n?naissance)?\b/i.test(bare)
            ? "recon"
            : null;

  if (phase) {
    run.phase = phase;
  }
}

function hostOf(value) {
  let v = String(value).trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
  v = v.split("/")[0].split("?")[0].split("#")[0];
  const at = v.lastIndexOf("@");

  if (at !== -1) v = v.slice(at + 1);

  if (v.startsWith("[")) {
    const end = v.indexOf("]");
    return (end === -1 ? v.slice(1) : v.slice(1, end)).toLowerCase();
  }

  const colon = v.indexOf(":");
  if (colon !== -1) v = v.slice(0, colon);

  return v.toLowerCase();
}

/** Runs a short WSL command and resolves with { code, stdout, stderr }. */
function wsl(args, { timeout = 20000 } = {}) {
  return new Promise(resolve => {
    const proc = spawn("wsl.exe", args, { windowsHide: true });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        try {
          proc.kill();
        } catch {
          /* already gone */
        }
        resolve({ code: -1, stdout, stderr: stderr + "\n[timeout]" });
      }
    }, timeout);

    proc.stdout.on("data", chunk => (stdout += chunk.toString("utf8")));
    proc.stderr.on("data", chunk => (stderr += chunk.toString("utf8")));

    proc.on("error", error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: error.message });
    });

    proc.on("close", code => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

// Copies the repository without the files Shannon must not see. Shannon mounts
// the tree read-only and sends source context to the model endpoint, and
// .env.stack holds SESSION_SECRET, TOTP_ENCRYPTION_KEY and the database
// password, so those never go into the staged copy.
const SKIP = new Set(["node_modules", ".git", "backups"]);

function keepForShannon(source) {
  const base = path.basename(source);

  if (SKIP.has(base)) return false;
  if (base.startsWith(".env")) return false;
  if (base.startsWith(".shannon")) return false;
  if (base.endsWith(".log") || base.endsWith(".dump")) return false;
  if (/\.bak-/.test(base)) return false;

  // Reports the scanners produce are not application source.
  if (path.relative(REPO, source).replace(/\\/g, "/").startsWith("tools/out")) {
    return false;
  }

  return true;
}

async function health() {
  if (Date.now() - healthCache.at < 30000 && healthCache.value) {
    return healthCache.value;
  }

  const [distro, node22, docker] = await Promise.all([
    wsl(["-l", "-q"], { timeout: 15000 }),
    wsl(["-e", "bash", "-lc", `test -x ${NODE_BIN}/node && ${NODE_BIN}/node -v`], {
      timeout: 20000
    }),
    wsl(["-e", "bash", "-lc", "docker version --format '{{.Server.Version}}'"], {
      timeout: 25000
    })
  ]);

  const value = {
    windows: true,
    wsl: distro.code === 0 && /[a-z]/i.test(distro.stdout.replace(/\0/g, "")),
    node: node22.code === 0 ? node22.stdout.replace(/\0/g, "").trim() : null,
    docker: docker.code === 0 ? docker.stdout.replace(/\0/g, "").trim() : null,
    model: MODEL,
    keyConfigured: Boolean(API_KEY),
    staged: existsSync(STAGE),
    running: run.running,
    state: run.state
  };

  healthCache = { at: Date.now(), value };
  return value;
}

// ---- the run -------------------------------------------------------------

async function stageRepo() {
  await rm(STAGE, { recursive: true, force: true });
  await mkdir(STAGE, { recursive: true });
  await cp(REPO, STAGE, { recursive: true, filter: keepForShannon });
}

function buildScript({ url, workspace, profile }) {
  const flags = [
    "start",
    "-u", shellQuote(url),
    "-r", shellQuote(wslPath(STAGE)),
    "--models-config", shellQuote(wslPath(MODELS)),
    "-w", shellQuote(workspace),
    "-o", shellQuote(wslPath(OUT_DIR)),
    "-f"
  ];

  // --pipeline-testing uses minimal prompts: much faster, much shallower. It is
  // the right choice for a demo where the point is that the pipeline runs.
  if (profile === "pipeline") {
    flags.push("--pipeline-testing");
  }

  // --validate-model checks the credentials and target URL and stops. That is
  // the cheap way to prove the wiring before committing to a full scan.
  if (profile === "validate") {
    flags.push("--validate-model");
  }

  return [
    "set -e",
    `export PATH=${shellQuote(NODE_BIN)}:$PATH`,
    `export SHANNON_AI_API_KEY=${shellQuote(API_KEY)}`,
    `export SHANNON_AI_MODEL=${shellQuote(MODEL)}`,
    "cd /tmp",
    `exec npx --yes @keygraph/shannon@latest ${flags.join(" ")}`,
    ""
  ].join("\n");
}

async function start({ url, profile }) {
  if (run.running) {
    return { ok: false, error: "A scan is already running", scanId: run.scanId };
  }

  const host = hostOf(url);

  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, error: `Out of scope: ${host}` };
  }

  if (!API_KEY) {
    return { ok: false, error: "SHANNON_AI_API_KEY is not set on the bridge" };
  }

  if (!existsSync(MODELS)) {
    return { ok: false, error: `Missing ${MODELS}` };
  }

  run.scanId = `shannon-${Date.now().toString(36)}`;
  run.state = "staging";
  run.phase = "none";
  run.url = url;
  run.lines = [];
  run.lastKey = null;
  run.error = null;
  run.exitCode = null;
  run.finishedAt = null;
  run.startedAt = Date.now();
  run.profile = profile;
  run.workspace = `lab-${run.scanId}`;
  run.running = true;

  push(`[bridge] scan ${run.scanId}`);
  push(`[bridge] target ${url}`);
  push(`[bridge] model  ${MODEL} (${profile})`);
  push(`[bridge] staging a sanitised copy of the source tree...`);

  try {
    await stageRepo();
  } catch (error) {
    run.running = false;
    run.state = "failed";
    run.error = `staging failed: ${error.message}`;
    push(`[!] staging failed: ${error.message}`);
    return { ok: false, error: run.error, scanId: run.scanId };
  }

  push(`[bridge] staged to ${STAGE} (secrets and node_modules excluded)`);

  await mkdir(STATE_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  scriptPath = path.join(STATE_DIR, `${run.scanId}.sh`);
  await writeFile(scriptPath, buildScript({ url, workspace: run.workspace, profile }), "utf8");

  run.state = "running";

  // wsl.exe is spawned directly, so the Windows process owns the child and the
  // scan survives for as long as this bridge runs.
  child = spawn("wsl.exe", ["-e", "bash", wslPath(scriptPath)], {
    windowsHide: true
  });

  child.stdout.on("data", chunk => {
    for (const line of chunk.toString("utf8").split("\n")) {
      if (line.trim()) push(line);
    }
  });

  child.stderr.on("data", chunk => {
    for (const line of chunk.toString("utf8").split("\n")) {
      if (line.trim()) push(line);
    }
  });

  child.on("error", error => {
    run.error = error.message;
    push(`[!] ${error.message}`);
  });

  child.on("close", code => {
    run.running = false;
    run.exitCode = code ?? -1;
    run.finishedAt = Date.now();

    if (run.state === "stopped") {
      push("[bridge] stopped");
    } else if (code === 0) {
      run.state = "completed";
      run.phase = "completed";
      push("[bridge] scan completed");
    } else {
      run.state = "failed";
      run.error = `shannon exited with ${code}`;
      push(`[bridge] scan failed (exit ${code})`);
    }

    healthCache.at = 0;
    child = null;
  });

  return { ok: true, scanId: run.scanId };
}

async function stop() {
  if (!run.running) {
    return { ok: true, alreadyStopped: true };
  }

  run.state = "stopped";
  push("[bridge] stopping...");

  // wsl.exe is only the launcher; the node process runs inside the VM, so kill
  // the whole Windows process tree and then ask Shannon to clean up its own
  // containers.
  if (child && child.pid) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true });
  }

  wsl(
    ["-e", "bash", "-lc", `export PATH=${shellQuote(NODE_BIN)}:$PATH; cd /tmp && npx --yes @keygraph/shannon@latest stop --all --yes`],
    { timeout: 60000 }
  ).then(result => {
    if (result.stdout.trim()) push(result.stdout.trim());
  });

  return { ok: true };
}

// ---- reports -------------------------------------------------------------

async function listReports() {
  if (!existsSync(OUT_DIR)) {
    return [];
  }

  const names = await readdir(OUT_DIR);
  const files = [];

  for (const name of names) {
    const full = path.join(OUT_DIR, name);
    const info = await stat(full);

    if (info.isFile()) {
      files.push({ name, size: info.size, mtime: info.mtimeMs });
    }
  }

  return files.sort((a, b) => b.mtime - a.mtime);
}

// ---- HTTP ----------------------------------------------------------------

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(text),
    "cache-control": "no-store"
  });
  res.end(text);
}

function readBody(req) {
  return new Promise(resolve => {
    let data = "";
    let size = 0;

    req.on("data", chunk => {
      size += chunk.length;
      if (size > 32 * 1024) {
        req.destroy();
        return;
      }
      data += chunk;
    });

    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });

    req.on("error", () => resolve({}));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

  // A shared token, not just loopback: Docker Desktop forwards host.docker.internal
  // to loopback, so "only local" would still include the container.
  if (req.headers["x-bridge-token"] !== TOKEN) {
    return json(res, 401, { error: "Bad or missing x-bridge-token" });
  }

  try {
    if (url.pathname === "/health") {
      return json(res, 200, {
        ok: true,
        pid: process.pid,
        platform: os.platform(),
        uptime: Math.round(process.uptime()),
        checks: await health(),
        run: {
          scanId: run.scanId,
          running: run.running,
          state: run.state,
          phase: run.phase
        }
      });
    }

    if (url.pathname === "/start" && req.method === "POST") {
      const body = await readBody(req);
      const target = String(body.url || "").trim();

      if (!target) {
        return json(res, 400, { error: "url is required" });
      }

      const profile = ["pipeline", "validate"].includes(body.profile)
        ? body.profile
        : "full";
      return json(res, 200, await start({ url: target, profile }));
    }

    if (url.pathname === "/status") {
      return json(res, 200, {
        ok: true,
        scanId: run.scanId,
        running: run.running,
        state: run.state,
        phase: run.phase,
        url: run.url,
        profile: run.profile,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        elapsedSec: run.startedAt
          ? Math.round(((run.finishedAt || Date.now()) - run.startedAt) / 1000)
          : 0,
        exitCode: run.exitCode,
        error: run.error,
        total: run.lines.length
      });
    }

    if (url.pathname === "/logs") {
      const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
      const slice = run.lines.slice(offset);

      return json(res, 200, {
        ok: true,
        offset,
        next: offset + slice.length,
        lines: slice,
        total: run.lines.length
      });
    }

    if (url.pathname === "/stop" && req.method === "POST") {
      return json(res, 200, await stop());
    }

    if (url.pathname === "/reports") {
      return json(res, 200, { ok: true, dir: OUT_DIR, files: await listReports() });
    }

    if (url.pathname === "/report") {
      const files = await listReports();
      const wanted = String(url.searchParams.get("format") || "md");

      const pick =
        files.find(file => file.name.toLowerCase().endsWith(`.${wanted}`)) ||
        files.find(file => /\.md$/i.test(file.name));

      if (!pick) {
        return json(res, 404, { error: "No Shannon report yet", files });
      }

      const full = path.join(OUT_DIR, pick.name);
      res.writeHead(200, {
        "content-type": pick.name.endsWith(".pdf")
          ? "application/pdf"
          : pick.name.endsWith(".json")
            ? "application/json; charset=utf-8"
            : "text/markdown; charset=utf-8",
        "content-length": pick.size,
        "cache-control": "no-store"
      });

      return createReadStream(full).pipe(res);
    }

    return json(res, 404, { error: "Not found" });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
});

if (!TOKEN) {
  console.error("[bridge] SHANNON_BRIDGE_TOKEN is required - refusing to start");
  process.exit(1);
}

if (!API_KEY) {
  console.error("[bridge] SHANNON_AI_API_KEY is required - refusing to start");
  process.exit(1);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log("========================================");
  console.log("SHANNON BRIDGE");
  console.log("========================================");
  console.log(`listening   127.0.0.1:${PORT} (loopback only)`);
  console.log(`model       ${MODEL}`);
  console.log(`repo        ${REPO}`);
  console.log(`staging     ${STAGE}`);
  console.log(`reports     ${OUT_DIR}`);
  console.log("========================================");
});

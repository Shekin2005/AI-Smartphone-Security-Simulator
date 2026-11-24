#!/usr/bin/env node
// ==========================================================
// THIN AI PENTEST AGENT  (free model, no paid key required)
// ==========================================================
// Strix gives its model ~44 tools. Small/free models given that
// many choices spend every turn on planning tools (create_todo,
// get_threat_model, view_agent_graph) and never touch the
// target. Given 8 tools or fewer, the same model calls
// exec_command correctly.
//
// So this agent is deliberately minimal: THREE tools, one
// clear job. The model still decides what to attack and what
// is a vulnerability - it is genuinely driving the test - but
// it cannot disappear into an orchestration loop.
//
// Auth is handled for it (real password + TOTP, same flow the
// browser uses) so every turn is spent on the target, not on
// logging in.
//
// Usage:
//   node tools/ai-agent.mjs
//   AI_MAX_STEPS=20 node tools/ai-agent.mjs
// ==========================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";

const HERE = dirname(fileURLToPath(import.meta.url));

// AI_OUT_DIR lets the web app point the report at a writable location, since
// the application directory is owned by root inside the container.
const OUT_DIR = process.env.AI_OUT_DIR || join(HERE, "out");

// ---------------------- configuration ----------------------

const BASE = (process.env.AI_BASE || "https://shekin.tail97139a.ts.net").replace(/\/+$/, "");
const ORIGIN = BASE;

// Free, no card required. This endpoint needs no credits.
const LLM_BASE = process.env.AI_LLM_BASE || "https://integrate.api.nvidia.com/v1";
// Lightning: 30B MoE with 3B active parameters - answers a tool-calling turn in
// well under a second on the free tier, unlike the reasoning model this lab
// used before (about 26 s for a 16-token reply, which stalled real runs).
const LLM_MODEL = process.env.AI_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";

// If the primary model errors or times out, try this one before failing the run.
const MODEL_FALLBACK = [
  LLM_MODEL,
  process.env.AI_MODEL_FALLBACK || "nvidia/nemotron-3.5-bolt-e4b",
].filter((model, index, all) => model && all.indexOf(model) === index);

// The lab owner supplied this free NVIDIA key so the agent runs with no setup.
// NVIDIA NIM's free tier needs no card. Override it any time with AI_LLM_KEY.
// If you fork this project, get your own key at https://build.nvidia.com
// and treat the one below as public.
const LLM_KEY =
  process.env.AI_LLM_KEY ||
  "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";

const MAX_STEPS = Number(process.env.AI_MAX_STEPS || 16);
const DEADLINE_MS = Number(process.env.AI_DEADLINE_MS || 600000);
const REQUEST_TIMEOUT = 20000;

// Which application this run covers. The terminal passes AI_TARGET so a run can
// be scoped to the bank app, the school app, or both.
const REQUESTED_TARGET = String(process.env.AI_TARGET || "both").toLowerCase();
const TARGET = ["bank", "school"].includes(REQUESTED_TARGET)
  ? REQUESTED_TARGET
  : "both";
const IN_SCOPE = TARGET === "both" ? ["bank", "school"] : [TARGET];

// The caller reaches the terminal with an MFA-verified session already, so the
// server passes that cookie down. Adopting it avoids a second TOTP login, which
// would replay the same 30-second code and count against the auth rate limit.
const REUSE_COOKIE = process.env.AI_SESSION_COOKIE || "";
const REUSE_APP = process.env.AI_SESSION_APP || "";

const ACCOUNTS = {
  bank: {
    username: process.env.AI_BANK_USER || "scan-bank",
    password: process.env.AI_BANK_PASS || "ScanLab!2026pass",
    app: "bank",
    role: "bank_user",
    totp: process.env.AI_BANK_TOTP || "OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI",
  },
  school: {
    username: process.env.AI_SCHOOL_USER || "scan-student",
    password: process.env.AI_SCHOOL_PASS || "ScanLab!2026pass",
    app: "acadia",
    role: "student",
    totp: process.env.AI_SCHOOL_TOTP || "NAWFGQ2TKBTW2PSUJVDSCKLTH5KG4ZLC",
  },
};

// ---------------------- TOTP ----------------------

function base32Decode(input) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";

  for (const char of String(input).replace(/=+$/, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) throw new Error(`bad base32 char ${char}`);
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, atMs = Date.now()) {
  const counter = Math.floor(atMs / 1000 / 30);
  const message = Buffer.alloc(8);
  message.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  message.writeUInt32BE(counter % 2 ** 32, 4);

  const digest = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

// ---------------------- HTTP session ----------------------

class Session {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  store(response) {
    for (const line of response.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const at = pair.indexOf("=");
      if (at > 0) this.cookies.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
    }
  }

  // Load an existing cookie header, used to adopt the caller's session.
  seed(cookieHeader) {
    for (const part of String(cookieHeader).split(";")) {
      const at = part.indexOf("=");
      if (at > 0) {
        this.cookies.set(part.slice(0, at).trim(), part.slice(at + 1).trim());
      }
    }
  }

  async request(method, path, body) {
    const headers = { origin: ORIGIN };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (this.cookies.size) {
      headers.cookie = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    try {
      const response = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
        redirect: "manual",
      });
      this.store(response);

      const text = await response.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* keep raw text */
      }

      return { status: response.status, text, json };
    } finally {
      clearTimeout(timer);
    }
  }
}

async function login(account) {
  const session = new Session(account.username);

  // Fast path: adopt the caller's session when it is for this application.
  // Verified with /api/auth/me so a stale or wrong cookie falls through to a
  // real login rather than producing 401s for the rest of the run.
  if (REUSE_COOKIE && REUSE_APP === account.app) {
    session.seed(REUSE_COOKIE);

    const me = await session.request("GET", "/api/auth/me");

    if (
      me.status === 200 &&
      me.json?.authenticated === true &&
      me.json?.app === account.app
    ) {
      console.log(`    reused the signed-in ${account.app} session`);
      return session;
    }

    session.cookies.clear();
  }

  const password = await session.request("POST", "/api/auth/login", {
    app: account.app,
    username: account.username,
    password: account.password,
    role: account.role,
  });

  if (password.status !== 200) {
    throw new Error(`${account.username} password step: ${password.status} ${password.text.slice(0, 120)}`);
  }

  // Avoid wasting a code at a 30s boundary - a reused code is a replay.
  if (Date.now() % 30000 > 24000) {
    await new Promise((r) => setTimeout(r, 30000 - (Date.now() % 30000) + 500));
  }

  const verify = await session.request("POST", "/api/auth/verify", { code: totp(account.totp) });

  if (verify.status !== 200) {
    // A code from this 30-second window may already have been used - most
    // likely by the person who just signed in to the site before pressing
    // "Run AI Agent". Replay protection then rejects the identical code.
    // Wait for a fresh window and try once more instead of failing the run.
    const replay = /already used|expired|Invalid/i.test(verify.text);

    if (!replay) {
      throw new Error(`${account.username} MFA step: ${verify.status} ${verify.text.slice(0, 120)}`);
    }

    await new Promise((r) =>
      setTimeout(r, 30000 - (Date.now() % 30000) + 1200)
    );

    const retry = await session.request("POST", "/api/auth/verify", {
      code: totp(account.totp)
    });

    if (retry.status !== 200) {
      throw new Error(
        `${account.username} MFA step after retry: ${retry.status} ${retry.text.slice(0, 120)}`
      );
    }
  }

  return session;
}

// ---------------------- tools ----------------------
// Exactly three. This is the whole point: a free model can hold
// three options in mind and pick the useful one.

const TOOLS = [
  {
    type: "function",
    function: {
      name: "http_request",
      description:
        "Send an authenticated HTTP request to the target application and read the response. " +
        "Use this to test endpoints. You are already logged in.",
      parameters: {
        type: "object",
        properties: {
          app: {
            type: "string",
            enum: ["bank", "school"],
            description: "Which application's session to use for this request.",
          },
          method: { type: "string", enum: ["GET", "POST"], description: "HTTP method." },
          path: {
            type: "string",
            description: "Path beginning with /api, e.g. /api/bank/accounts",
          },
          body: {
            type: "string",
            description: "Optional JSON body as a string, for POST requests.",
          },
        },
        required: ["app", "method", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_finding",
      description:
        "Record a confirmed vulnerability. Only record what you actually observed in a response.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short vulnerability name." },
          severity: {
            type: "string",
            enum: ["critical", "high", "medium", "low"],
          },
          endpoint: { type: "string", description: "The exact path that was vulnerable." },
          evidence: {
            type: "string",
            description: "The literal response text that proves it.",
          },
          impact: { type: "string", description: "What an attacker gains." },
        },
        required: ["title", "severity", "endpoint", "evidence", "impact"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "End the assessment and summarise what you found.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Two or three sentences." },
        },
        required: ["summary"],
      },
    },
  },
];

// ---------------------- system prompt ----------------------

function buildSystem() {
  const endpoints =
    IN_SCOPE.map((app) =>
      app === "bank"
        ? `  bank:   /api/bank/accounts
          /api/bank/payments
          /api/bank/tuition/student/AC00000001
          (student ids are sequential: AC + 8 digits)
          Seeded id wordlist for this lab: AC00000034, AC00000035, AC00000036,
          AC00000048, AC00000050, AC00000063. Start with these - they exist.`
        : `  school: /api/school/enrollments
          /api/school/services/summary
          /api/school/admin/students`
    ).join("\n");

  const scope =
    TARGET === "both"
      ? `Two applications share this site.
  app="bank"   -> endpoints under /api/bank/...
  app="school" -> endpoints under /api/school/...`
      : `This run covers ONE application only.
  app="${TARGET}" -> endpoints under /api/${TARGET}/...`;

  return `You are an autonomous web penetration tester. You have three tools: http_request, record_finding, finish.

RULES
- You are already authenticated. Do not test login again.
- Compare responses across different identifiers: if a request returns another user's data, that is a vulnerability.
- RECORD IMMEDIATELY. The moment a response shows you data that belongs to someone else, call record_finding for it in the SAME turn. Do not keep exploring first - you may run out of turns.
- Only record a finding when a response you actually received proves it.
- Keep each http_request small and focused. At most 3 requests per turn.
- After you have tested the main endpoints and recorded what you saw, call finish.

WATCH FOR THIS SPECIFIC PATTERN
A 200 response that returns a name, balance or grade for an identifier you supplied is the
vulnerability. A 404 means that id does not exist; a 403 means access control held.

TARGET: ${BASE}
${scope}

KNOWN ENDPOINTS (start here)
${endpoints}

Look specifically for:
1. BOLA/IDOR - reading data belonging to other users by changing an identifier.
2. Broken access control - a student session reaching /api/school/admin/* .
3. Leaked PII or balances in responses that the caller should not see.

Work efficiently. Every tool call must teach you something.`;
}

const SYSTEM = buildSystem();

// ---------------------- LLM call ----------------------

let activeModel = LLM_MODEL;

async function callModelOnce(model, messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75000);

  try {
    const response = await fetch(`${LLM_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${LLM_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        tools: TOOLS,
        tool_choice: "auto",
        temperature: 0.2,
        max_tokens: 900,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM ${response.status}: ${text.slice(0, 300)}`);
    }

    const payload = await response.json();
    return payload.choices?.[0]?.message ?? {};
  } finally {
    clearTimeout(timer);
  }
}

// Keeps the audit trail on a model that demonstrably answers, and records which
// one produced the run so the report never names a model that was not used.
async function callModel(messages) {
  let lastError;

  for (const model of MODEL_FALLBACK) {
    try {
      const message = await callModelOnce(model, messages);

      if (model !== activeModel) {
        console.log(`\n[i] switched to fallback model ${model}`);
        activeModel = model;
      }

      return message;
    } catch (error) {
      lastError = error;
      console.log(`\n[!] ${model}: ${error.message}`);
    }
  }

  throw lastError;
}

// ---------------------- tool execution ----------------------

function runTool(name, args, sessions) {
  if (name === "http_request") {
    const session = sessions[args.app];
    if (!session) return { error: `unknown app ${args.app}` };

    let body;
    if (args.body) {
      try {
        body = JSON.parse(args.body);
      } catch {
        return { error: "body was not valid JSON" };
      }
    }

    return session.request(args.method, args.path, body).then((r) => ({
      status: r.status,
      body: r.text.slice(0, 1200),
    }));
  }

  return Promise.resolve({ ok: true });
}

// ---------- deterministic assessment of the agent's traffic ----------
// The free model issues requests reliably but does not reliably call
// record_finding. Rather than pretend otherwise, the responses it received
// are assessed here. The agent still chooses what to attack; this only
// records what its own requests proved, so every finding below is traceable
// to a request the model decided to make.

function detectFindings(observations) {
  const out = [];
  const students = new Map();

  for (const obs of observations) {
    if (obs.status !== 200) {
      continue;
    }

    const direct = /^\/api\/bank\/tuition\/student\/(AC\d{8})$/i.exec(obs.path);
    const query = /[?&]student_?id=(AC\d{8})/i.exec(obs.path);
    const id = direct?.[1] || query?.[1];

    if (!id) {
      continue;
    }

    let payload;

    try {
      payload = JSON.parse(obs.body);
    } catch {
      continue;
    }

    const record = payload?.student ?? payload?.data ?? payload?.summary ?? payload;
    const name = record?.name ?? record?.studentName ?? null;
    const tuition = record?.tuitionCents ?? record?.balanceCents ?? null;

    if (name || tuition != null) {
      students.set(id, { id, path: obs.path, app: obs.app, name, tuition, body: obs.body });
    }
  }

  // A single record is enough here. The caller is a bank account and every
  // record below belongs to an acadia student account - different users. The
  // endpoint filters only on the supplied id and never on the caller's own
  // identity, so it cannot know whether the caller is entitled to the record.
  if (students.size >= 1) {
    const list = [...students.values()];
    const many = list.length > 1;

    out.push({
      title: "Any signed-in bank user can read a student's name and tuition balance by id",
      severity: "medium",
      endpoint: list[0].path,
      evidence: list
        .slice(0, 6)
        .map((s) => `${s.path} -> 200 ${s.body.slice(0, 200)}`)
        .join("\n"),
      impact:
        `The bank session retrieved ${list.length} student record${many ? "s" : ""} ` +
        `(${list.map((s) => s.id).join(", ")}) including name and outstanding tuition. ` +
        "Those records belong to acadia student accounts, not to the bank user. " +
        "The handler filters on the supplied identifier only - it never checks that the " +
        "caller is linked to the student - so any authenticated bank user can walk the " +
        "sequential identifier space and read every student's financial record.",
    });
  }

  for (const obs of observations) {
    if (obs.status === 200 && /\/admin\//i.test(obs.path)) {
      out.push({
        title: "An administrator endpoint answered a non-administrator session",
        severity: "critical",
        endpoint: obs.path,
        evidence: `${obs.method} ${obs.path} as ${obs.app} -> 200 ${obs.body.slice(0, 300)}`,
        impact: "A non-privileged session reached an administrator-only function.",
      });
    }
  }

  return out;
}

// ---------------------- main ----------------------

async function main() {
  const startedAt = Date.now();
  console.log("=".repeat(64));
  console.log("THIN AI PENTEST AGENT");
  console.log("=".repeat(64));
  console.log(`Target : ${BASE}`);
  console.log(`Model  : ${LLM_MODEL} (free endpoint)`);
  console.log(`Steps  : max ${MAX_STEPS}`);
  console.log("");

  if (!LLM_KEY) {
    console.error("[!] No LLM key set.");
    console.error("    Get a free NVIDIA key at https://build.nvidia.com (no card), then:");
    console.error("      AI_LLM_KEY=nvapi-... node tools/ai-agent.mjs");
    console.error("");
    console.error("    The deterministic suite needs no key: npm run pentest");
    process.exitCode = 1;
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const authenticated = {};

  try {
    for (const app of IN_SCOPE) {
      console.log(`[*] Logging in as ${app}...`);
      authenticated[app] = await login(ACCOUNTS[app]);
      console.log("    OK");
    }
  } catch (error) {
    console.error(`\n[!] Login failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  const sessions = authenticated;
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: "Begin the assessment. Test the endpoints and record what you find." },
  ];

  const findings = [];
  const observations = [];
  const trace = [];
  let summary = null;
  let stalls = 0;

  for (let step = 1; step <= MAX_STEPS; step++) {
    if (Date.now() - startedAt > DEADLINE_MS) {
      console.log("[!] Deadline reached - stopping.");
      break;
    }

    process.stdout.write(`[${String(step).padStart(2)}] `);

    let message;

    try {
      message = await callModel(messages);
    } catch (error) {
      console.log(`LLM error: ${error.message}`);
      trace.push({ step, error: error.message });
      break;
    }

    messages.push(message);

    const calls = message.tool_calls ?? [];

    if (!calls.length) {
      const note = (message.content || "").replace(/\s+/g, " ").slice(0, 100);
      console.log(`(no tool call) ${note}`);
      trace.push({ step, note });
      stalls += 1;

      if (stalls < 2) {
        messages.push({
          role: "user",
          content: "You must use a tool. Call http_request, or record_finding, or finish.",
        });
        continue;
      }

      // A weak model loses the thread as the transcript grows: after a few
      // turns it answers with prose instead of a tool call. Rebuild a short
      // context so the next turn is a real decision rather than a repeat.
      const recent = observations
        .slice(-5)
        .map((o) => `${o.method} ${o.path} -> ${o.status}`)
        .join("; ");

      messages.length = 0;
      messages.push({ role: "system", content: SYSTEM });
      messages.push({
        role: "user",
        content:
          `You have made ${observations.length} requests. Recent: ${recent || "none"}. ` +
          "Some ids returned 404. Use the seeded lab wordlist instead, one id per " +
          "http_request call: AC00000034, AC00000035, AC00000036, AC00000048, " +
          "AC00000050, AC00000063. When a response returns a student name and tuition, " +
          "call record_finding in the same turn.",
      });

      stalls = 0;
      continue;
    }

    for (const call of calls) {
      const name = call.function?.name;
      let args = {};

      try {
        args = JSON.parse(call.function?.arguments || "{}");
      } catch {
        args = {};
      }

      if (name === "finish") {
        summary = args.summary || "(no summary)";
        console.log(`finish -> ${summary.slice(0, 90)}`);
        trace.push({ step, tool: "finish", summary });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: true }),
        });
        step = MAX_STEPS + 1;
        break;
      }

      if (name === "record_finding") {
        findings.push({
          title: args.title,
          severity: args.severity,
          endpoint: args.endpoint,
          evidence: args.evidence,
          impact: args.impact,
        });
        console.log(`FINDING [${args.severity}] ${args.title} (${args.endpoint})`);
        trace.push({ step, tool: "record_finding", args });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: true, recorded: findings.length }),
        });
        continue;
      }

      if (name === "http_request") {
        const result = await runTool(name, args, sessions);
        const label = `${args.method} ${args.path} as ${args.app}`;
        console.log(`${label} -> ${result.status}`);

        trace.push({ step, tool: "http_request", request: label, status: result.status, body: result.body });
        observations.push({
          app: args.app,
          method: args.method,
          path: args.path,
          status: result.status,
          body: result.body,
        });

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
        continue;
      }

      console.log(`unknown tool ${name}`);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ error: `unknown tool ${name}` }),
      });
    }
  }

  // Assess everything the agent actually received before writing the report.
  const detected = detectFindings(observations);

  // ---------------------- report ----------------------

  const lines = [];
  lines.push("# AI Agent Penetration Test Report");
  lines.push("");
  lines.push(`**Target:** ${BASE}`);
  lines.push("");
  lines.push(`**Scope:** ${TARGET === "both" ? "bank and school applications" : `${TARGET} application only`}`);
  lines.push("");
  lines.push(`**Model:** \`${activeModel}\` (free hosted endpoint, no paid credits)`);
  lines.push("");
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("**Method:** an LLM agent was given three tools - send an authenticated request,");
  lines.push("record a finding, finish - and drove the test itself. The account");
  lines.push(`${IN_SCOPE.length === 1 ? "for the scoped application was" : "s for both applications were"} signed in`);
  lines.push("through the real password + TOTP flow before it started, so every");
  lines.push("turn was spent attacking the application.");
  lines.push("");
  lines.push("**Disclosure:** as in a normal engagement, the agent was handed a starting list of");
  lines.push("target identifiers (the six student ids seeded in this lab) instead of brute-forcing");
  lines.push("the whole id space. Every request below was still chosen and sent by the model, and");
  lines.push("every finding is backed by a response it actually received.");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  if (summary) {
    lines.push(summary);
  } else {
    // A free model usually spends every decision on requests and never calls
    // finish, so say that plainly and give the counts instead of leaving the
    // section empty. This text is generated by the harness, not the model.
    const confirmed = detected.length || findings.length;
    lines.push(`_The model used all ${MAX_STEPS} decisions on testing and did not call \`finish\`, so it wrote no summary of its own._`);
    lines.push("");
    lines.push(`Harness summary: ${observations.length} authenticated requests were sent, and ${confirmed} issue${confirmed === 1 ? " was" : "s were"} confirmed from the responses. The full request log is below.`);
  }
  lines.push("");
  lines.push(`**Requests the agent chose to make:** ${observations.length}`);
  lines.push("");
  lines.push(`**Findings reported by the agent itself:** ${findings.length}`);
  lines.push("");
  lines.push(`**Findings confirmed from the agent's own requests:** ${detected.length}`);
  lines.push("");
  lines.push("## Findings");
  lines.push("");

  if (!findings.length && !detected.length) {
    lines.push("_No findings were recorded or confirmed._");
    lines.push("");
  }

  findings.forEach((finding, index) => {
    lines.push(`### ${index + 1}. ${finding.title}`);
    lines.push("");
    lines.push(`- **Severity:** ${finding.severity}`);
    lines.push(`- **Endpoint:** \`${finding.endpoint}\``);
    lines.push("");
    lines.push("**Evidence (as returned to the agent)**");
    lines.push("");
    lines.push("```");
    lines.push(String(finding.evidence).slice(0, 1500));
    lines.push("```");
    lines.push("");
    lines.push(`**Impact:** ${finding.impact}`);
    lines.push("");
  });

  if (detected.length) {
    lines.push("## Confirmed from the agent's requests");
    lines.push("");
    lines.push("The agent decided which requests to send. The responses it received were then");
    lines.push("assessed deterministically, so each finding below is reproducible from the request");
    lines.push("log in the next section.");
    lines.push("");

    detected.forEach((finding, index) => {
      lines.push(`### ${index + 1}. ${finding.title}`);
      lines.push("");
      lines.push(`- **Severity:** ${finding.severity}`);
      lines.push(`- **Endpoint:** \`${finding.endpoint}\``);
      lines.push("");
      lines.push("**Evidence (responses the agent received)**");
      lines.push("");
      lines.push("```");
      lines.push(String(finding.evidence).slice(0, 1500));
      lines.push("```");
      lines.push("");
      lines.push(`**Impact:** ${finding.impact}`);
      lines.push("");
    });
  }

  lines.push("## Every request the agent made");
  lines.push("");
  lines.push("| Step | Request | Status |");
  lines.push("| --- | --- | --- |");

  for (const item of trace) {
    if (item.tool === "http_request") {
      lines.push(`| ${item.step} | \`${item.request}\` | ${item.status} |`);
    }
  }

  lines.push("");
  lines.push("## Notes");
  lines.push("");
  lines.push("The model is free and hosted, so it is slower than a frontier model and may");
  lines.push("miss subtler issues. Findings above are limited to what it actually observed.");
  lines.push("");

  const reportPath = join(OUT_DIR, "AI-AGENT-REPORT.md");
  const jsonPath = join(OUT_DIR, "AI-AGENT-FINDINGS.json");

  writeFileSync(reportPath, lines.join("\n"));
  writeFileSync(
    jsonPath,
    JSON.stringify(
      { target: BASE, model: activeModel, summary, findings, detected, trace },
      null,
      2
    )
  );

  const executed = trace.filter((t) => t.tool === "http_request").length;

  console.log("");
  console.log("=".repeat(64));
  console.log(`Requests executed : ${executed}`);
  console.log(`Agent findings    : ${findings.length}`);
  console.log(`Detected          : ${detected.length}`);
  console.log(`Report            : ${reportPath}`);
  console.log("=".repeat(64));

  process.exitCode = findings.length > 0 ? 0 : 0;
}

main().catch((error) => {
  console.error(`\n[!] Agent crashed: ${error.stack || error.message}`);
  process.exitCode = 1;
});

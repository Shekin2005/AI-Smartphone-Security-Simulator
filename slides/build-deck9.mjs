#!/usr/bin/env node
// ==================================================
// BUILDS THE 9-SLIDE TECHNICAL DECK
// ==================================================
//   cd slides && node build-deck9.mjs && node verify-deck9.mjs
//
// Writes ../AI-Security-9-Slides.pptx (9 slides, 16:9).
//
// Structure:
//   1  Title and scope
//   2  System under test - architecture and trust boundaries
//   3  Methodology - four engines and how each was measured
//   4  Findings F-01, F-02 - the two Medium-severity auth flaws
//   5  Findings F-03, F-04, F-05 and the controls that held
//   6  AI versus manual, measured, and why the oracle decides it
//   7  Industry evidence - what AI achieved in real companies
//   8  The six pentest reports
//   9  The 22-page academic report
//
// Every figure is one that was measured against the running deployment or read
// from a named source; nothing here is illustrative.
// ==================================================

import pptxgen from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "AI-Security-9-Slides.pptx");

// ---- design tokens -------------------------------------------------------

const BG = "0B1220";
const PANEL = "111C2E";
const PANEL2 = "16243A";
const INK = "060B14";
const LINE = "1E3050";
const TEXT = "E8EEF7";
const MUTED = "93A4BF";
const CYAN = "38BDF8";
const GREEN = "34D399";
const AMBER = "FBBF24";
const RED = "F87171";
const PURPLE = "A78BFA";

const FONT = "Segoe UI";
const MONO = "Consolas";

const pptx = new pptxgen();
pptx.layout = "LAYOUT_16x9";
pptx.author = "Shekin";
pptx.title = "AI and Manual Penetration Testing";
pptx.subject = "A measured comparison on a live web application";

// ---- helpers -------------------------------------------------------------

function slide(title, kicker) {
  const s = pptx.addSlide();
  s.background = { color: BG };

  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.055,
    fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });

  s.addText(title, {
    x: 0.45, y: 0.14, w: 9.1, h: 0.42,
    fontSize: 21, bold: true, color: TEXT, fontFace: FONT, valign: "middle"
  });

  if (kicker) {
    s.addText(kicker, {
      x: 0.45, y: 0.55, w: 9.1, h: 0.26,
      fontSize: 10.5, color: MUTED, fontFace: FONT, italic: true
    });
  }

  return s;
}

const notes = (s, text) => s.addNotes(text);

function panel(s, x, y, w, h, fill = PANEL) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: fill },
    line: { color: LINE, width: 1 },
    rectRadius: 0.06
  });
}

function label(s, text, x, y, w, color = CYAN, size = 9) {
  s.addText(text.toUpperCase(), {
    x, y, w, h: 0.2,
    fontSize: size, bold: true, color, fontFace: FONT, charSpacing: 1
  });
}

function code(s, text, x, y, w, h, size = 8) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: INK },
    line: { color: LINE, width: 1 },
    rectRadius: 0.05
  });
  s.addText(text, {
    x: x + 0.1, y: y + 0.06, w: w - 0.2, h: h - 0.12,
    fontSize: size, color: "C9D6E8", fontFace: MONO,
    lineSpacingMultiple: 1.0, valign: "top"
  });
}

function body(s, text, x, y, w, h, size = 9.5, color = TEXT) {
  s.addText(text, {
    x, y, w, h,
    fontSize: size, color, fontFace: FONT,
    lineSpacingMultiple: 1.15, valign: "top"
  });
}

function chip(s, text, x, y, w, color = AMBER) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h: 0.24,
    fill: { color: color, transparency: 82 },
    line: { color, width: 1 },
    rectRadius: 0.12
  });
  s.addText(text, {
    x, y, w, h: 0.24,
    fontSize: 8, bold: true, color, fontFace: FONT,
    align: "center", valign: "middle"
  });
}

function stat(s, x, y, w, value, caption, color = CYAN, vsize = 24) {
  s.addText(value, {
    x, y, w, h: 0.42,
    fontSize: vsize, bold: true, color, fontFace: FONT, align: "center"
  });
  s.addText(caption, {
    x, y: y + 0.4, w, h: 0.44,
    fontSize: 8, color: MUTED, fontFace: FONT, align: "center",
    lineSpacingMultiple: 0.95
  });
}

const H = c => ({ text: c, options: { bold: true, color: CYAN, fill: { color: PANEL2 }, fontSize: 8 } });
const C = (t, color = TEXT, bold = false) => ({ text: t, options: { color, bold, fontSize: 8 } });

function table(s, rows, { x, y, w, colW, rowH = 0.3 }) {
  s.addTable(rows, {
    x, y, w, h: rows.length * rowH, colW, rowH,
    fontFace: FONT, color: TEXT,
    fill: { color: PANEL },
    border: { type: "solid", color: LINE, pt: 0.75 },
    valign: "middle", margin: 3
  });
}

// =========================================================================
// SLIDE 1 - title
// =========================================================================

{
  const s = pptx.addSlide();
  s.background = { color: BG };

  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.09, h: 5.625, fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });

  s.addText("AI AND MANUAL", {
    x: 0.75, y: 0.62, w: 8.6, h: 0.62,
    fontSize: 34, bold: true, color: TEXT, fontFace: FONT, charSpacing: 1
  });
  s.addText("PENETRATION TESTING", {
    x: 0.75, y: 1.2, w: 8.6, h: 0.62,
    fontSize: 34, bold: true, color: CYAN, fontFace: FONT, charSpacing: 1
  });

  s.addShape(pptx.ShapeType.rect, {
    x: 0.78, y: 1.92, w: 1.5, h: 0.035, fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });

  s.addText(
    "A measured comparison on a live web application: five findings, three of them ground truth, scored across four engines. Then set against what AI testing has actually achieved in production.",
    { x: 0.75, y: 2.05, w: 8.4, h: 0.78, fontSize: 12.5, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.25 }
  );

  const stats = [
    ["12", "deterministic\nchecks in 41 s", CYAN],
    ["3 / 5", "ground-truth\nfindings", AMBER],
    ["0 of 3", "reported by the\nAI agent", RED],
    ["22", "page academic\nreport, 15 refs", GREEN]
  ];

  stats.forEach(([v, c, col], i) => {
    const x = 0.75 + i * 2.15;
    panel(s, x, 3.0, 1.95, 1.12);
    s.addText(v, {
      x, y: 3.08, w: 1.95, h: 0.44,
      fontSize: 25, bold: true, color: col, fontFace: FONT, align: "center"
    });
    s.addText(c, {
      x, y: 3.54, w: 1.95, h: 0.5,
      fontSize: 8.5, color: MUTED, fontFace: FONT, align: "center", lineSpacingMultiple: 0.95
    });
  });

  s.addText("https://shekin.tail97139a.ts.net", {
    x: 0.75, y: 4.4, w: 5.2, h: 0.26,
    fontSize: 9.5, color: CYAN, fontFace: MONO
  });
  s.addText("Node 22 / Express 5  ·  PostgreSQL 18.3  ·  Caddy 2  ·  Tailscale Funnel", {
    x: 0.75, y: 4.66, w: 8.4, h: 0.26,
    fontSize: 8.5, color: MUTED, fontFace: FONT
  });
  s.addText("[Student name]  ·  [Student ID]  ·  [Module code]  ·  24 November 2026", {
    x: 0.75, y: 5.05, w: 8.4, h: 0.26,
    fontSize: 8.5, color: MUTED, fontFace: FONT
  });

  notes(s, `Open with the question, not the technology.

"This is a working web application that is deliberately vulnerable in three places. I tested it four different ways - by reading the code, with a scripted suite, with an LLM agent, and with a commercial multi-agent pipeline - and scored all four against the same ground truth. Then I compared my result with what AI testing has actually achieved at Google, Microsoft, Anthropic and DARPA."

The four numbers across the bottom are the whole talk in miniature:
- 12 checks running in 41 seconds found all three real flaws
- there are 3 ground-truth findings among 5 total
- the AI agent reported none of them
- and that negative result is explained by the industry evidence on slide 7

Do not apologise for the negative AI result. It is the most interesting finding.`);
}

// =========================================================================
// SLIDE 2 - system under test
// =========================================================================

{
  const s = slide("The system under test", "One Windows host, three containers, two applications, one database");

  // Request chain
  const chain = [
    ["Browser", "phone UI", CYAN],
    ["Tailscale", "TLS, :443", PURPLE],
    ["Caddy 2", "port 80", CYAN],
    ["sim-app", "Express 5", GREEN],
    ["Postgres", "18.3, :5432", AMBER]
  ];
  chain.forEach(([name, sub, col], i) => {
    const x = 0.45 + i * 1.79;
    panel(s, x, 0.92, 1.68, 0.72, PANEL2);
    s.addText(name, {
      x, y: 0.98, w: 1.68, h: 0.26,
      fontSize: 10, bold: true, color: col, fontFace: FONT, align: "center"
    });
    s.addText(sub, {
      x, y: 1.24, w: 1.68, h: 0.22,
      fontSize: 8, color: MUTED, fontFace: MONO, align: "center"
    });
    if (i < 4) {
      s.addText("\u203A", {
        x: x + 1.68, y: 1.06, w: 0.11, h: 0.3,
        fontSize: 14, color: LINE, fontFace: FONT, align: "center"
      });
    }
  });

  // Two consequence notes
  panel(s, 0.45, 1.75, 4.42, 0.92);
  label(s, "Consequence 1", 0.58, 1.8, 4.2, AMBER);
  body(s, "All traffic arrives from the Caddy container, so the app sees ONE source IP. A limiter keyed on address throttles the whole deployment, not one client.",
    0.58, 2.0, 4.2, 0.62, 8.5);

  panel(s, 5.13, 1.75, 4.42, 0.92);
  label(s, "Consequence 2", 5.26, 1.8, 4.2, AMBER);
  body(s, "TLS terminates at Tailscale, so the app speaks plain HTTP. Port 80 serves without a redirect while the public URL is correctly TLS.",
    5.26, 2.0, 4.2, 0.62, 8.5);

  // Deliberate vs held
  label(s, "Deliberately vulnerable", 0.45, 2.82, 4.4, RED);
  panel(s, 0.45, 3.02, 4.42, 1.28);
  body(s,
    "F-01  tuition lookup - path id bound to $1, no entitlement check\n" +
    "F-02  lockout - counter resets at its own threshold\n" +
    "F-03  lab SQLi - one query concatenated, one parameterised\n" +
    "F-04  no HTTPS redirect   F-05  no Cache-Control on /api/auth",
    0.58, 3.08, 4.2, 1.16, 8.2);

  label(s, "Verified to hold", 5.13, 2.82, 4.4, GREEN);
  panel(s, 5.13, 3.02, 4.42, 1.28);
  body(s,
    "Argon2id hashing + TOTP (AES-256-GCM at rest)\n" +
    "Session regenerate() on privilege change\n" +
    "HttpOnly / SameSite=strict cookies, Helmet CSP, HSTS\n" +
    "All Acadia, transfer and school queries parameterised\n" +
    "Terminal: allowlist + shell:false + metachar rejection",
    5.26, 3.08, 4.2, 1.16, 8.2);

  // Bottom highlight
  panel(s, 0.45, 4.45, 9.1, 0.78, PANEL2);
  body(s,
    "The pattern that matters: injection defences are uniformly sound, and authorisation fails in exactly one place. " +
    "That is what makes F-01 credible rather than a lab artefact - one ordinary mistake in otherwise careful code.",
    0.6, 4.52, 8.8, 0.66, 9, TEXT);

  notes(s, `Walk the chain left to right - it is one request.

"The browser hits Tailscale, which terminates TLS and owns 443. Tailscale forwards to Caddy on port 80. Caddy proxies into the Express app. Express talks to PostgreSQL, which is a native Windows service, not in Docker."

Then the two consequences, because they cause real bugs later:
1. Single source IP. Every request looks like it comes from Caddy. So a rate limiter keyed on IP is a global limiter. That is a defect I found and fixed - slide 3.
2. Plain HTTP inside. That is why the suite flags a missing redirect at port 80 while the public URL is fine.

Then the contrast at the bottom. This is the honest framing: most of this app is well built. Injection defences are correct everywhere. Authorisation fails once. A single mistake in careful code is much more realistic than an app where everything is broken.`);

}

// =========================================================================
// SLIDE 3 - methodology
// =========================================================================

{
  const s = slide("Four engines, one ground truth", "How each was measured, and the rules that made the comparison fair");

  const engines = [
    ["Manual", "source review +\ntargeted runtime", "3 of 3", GREEN],
    ["Suite", "12 checks,\n41 s, no deps", "3 of 3", GREEN],
    ["LLM agent", "3 tools,\nself-chosen calls", "0 of 3", RED],
    ["Pipeline", "6 agents,\nTemporal", "0 of 3", RED]
  ];

  engines.forEach(([name, sub, score, col], i) => {
    const x = 0.45 + i * 2.28;
    panel(s, x, 0.92, 2.16, 1.02, PANEL2);
    s.addText(name, {
      x: x + 0.1, y: 0.96, w: 1.96, h: 0.24,
      fontSize: 10, bold: true, color: TEXT, fontFace: FONT
    });
    s.addText(sub, {
      x: x + 0.1, y: 1.2, w: 1.96, h: 0.34,
      fontSize: 7.5, color: MUTED, fontFace: MONO, lineSpacingMultiple: 0.95
    });
    s.addText(score, {
      x: x + 0.1, y: 1.54, w: 1.96, h: 0.26,
      fontSize: 11, bold: true, color: col, fontFace: FONT
    });
  });

  // Two-count
  panel(s, 0.45, 2.08, 4.42, 1.5);
  label(s, "The two-count measurement", 0.58, 2.13, 4.2, CYAN);
  body(s,
    "Claimed = findings the model asserts in its final message.\n" +
    "Detected = findings the harness can prove from responses the model actually received.",
    0.58, 2.34, 4.2, 0.5, 8.5);
  body(s,
    "A single number cannot tell an agent that looked and found nothing from one that found something and talked itself out of it. Here the counts diverged: 0 claimed, 1 detected.",
    0.58, 2.86, 4.2, 0.66, 8.2, MUTED);

  // Scoring
  panel(s, 5.13, 2.08, 4.42, 1.5);
  label(s, "Scoring rules, fixed in advance", 5.26, 2.13, 4.2, CYAN);
  body(s,
    "Ground truth = 2 of 3 agree: source review, runtime proof, a second engine.\n" +
    "Recall, false positives, wall-clock, human interventions, cost.\n" +
    "F-04 and F-05 excluded: no engine was asked to look for them.",
    5.26, 2.34, 4.2, 1.14, 8.2);

  // The twelve checks
  label(s, "The twelve deterministic checks", 0.45, 3.7, 6.0, CYAN);
  panel(s, 0.45, 3.9, 9.1, 0.62);
  body(s,
    "1-3 headers, cookie flags, anonymous access   4-5 cross-app and vertical privilege   6 tuition object ownership   " +
    "7-8 MFA brute force, enumeration   9-10 session rotation, role control   11-12 rate limiting, HTTPS",
    0.58, 3.95, 8.85, 0.52, 7.8);

  panel(s, 0.45, 4.62, 9.1, 0.62, PANEL2);
  body(s,
    "Three-state verdict: PASSED / VULNERABLE / INCONCLUSIVE. The third state exists so a check that cannot reach a verdict never counts as a pass.",
    0.58, 4.67, 8.85, 0.52, 8.5, TEXT);

  notes(s, `This slide is the answer to "how do you know the comparison is fair".

Four engines:
- Manual: I read the source and confirmed by hand. This is the baseline.
- Suite: 12 fixed checks, no dependencies, 41 seconds, every verdict carries its request and response.
- LLM agent: given exactly three tools and the base URL, chooses its own requests. Every call is logged.
- Pipeline: Shannon, six specialised agents on Temporal.

The two-count measurement is the methodological contribution. If you only report "the agent found N", you cannot distinguish an agent that searched and found nothing from one that found something and incorrectly dismissed it. Here the model claimed 0 and the harness proved 1. That gap is the finding.

Ground truth rule: two of three must agree. Source review, runtime proof, or a second engine. That is why F-04 and F-05 are reported but excluded from scoring - nobody was asked to find them.

The three-state verdict is a design decision worth defending. Most scanners have pass/fail. If a check errors out it silently passes. Mine has INCONCLUSIVE so it cannot.`);
}

// =========================================================================
// SLIDE 4 - F-01 and F-02
// =========================================================================

{
  const s = slide("F-01 and F-02: two authorisation and authentication flaws",
    "Both Medium 6.5, both confirmed twice, both fixed by a small change");

  // F-01
  label(s, "F-01  broken object-level authorisation  CWE-639", 0.45, 0.9, 4.4, RED, 8.5);
  code(s,
    "GET /api/bank/tuition/student/:id\n" +
    "\n" +
    "WHERE sp.user_id = $1\n" +
    "  [Number(match[1])]  <- from URL\n" +
    "\n" +
    "session = scan-bank (own: ...063)\n" +
    "GET .../AC00000036  ->  200\n" +
    "{\"name\":\"jass\",\"tuitionCents\":\"125000\"}",
    0.45, 1.12, 4.42, 1.5, 7.8);

  body(s,
    "Parameterised, so NOT injectable - but $1 came from the path, not the session. Walking the range leaked 15 records.",
    0.45, 2.68, 4.42, 0.44, 8.2, MUTED);

  chip(s, "C:L / I:N / A:N   AV:N AC:L PR:L UI:N", 0.45, 3.16, 2.9, AMBER);
  chip(s, "verified: Acadia binds to session", 3.45, 3.16, 1.4, GREEN);

  // F-02
  label(s, "F-02  lockout counter resets at threshold  CWE-307", 5.13, 0.9, 4.4, RED, 8.5);
  code(s,
    "SET failed_attempts =\n" +
    "  CASE WHEN failed_attempts >= 2\n" +
    "       THEN 0                  -- resets\n" +
    "       ELSE failed_attempts+1 END,\n" +
    "    locked_until =\n" +
    "  CASE WHEN failed_attempts >= 2\n" +
    "       THEN now() + '30 s' END",
    5.13, 1.12, 4.42, 1.5, 7.8);

  body(s,
    "Both CASEs read the same pre-update value. Two guesses, lock, counter back to zero - forever. ~240 guesses/hour.",
    5.13, 2.68, 4.42, 0.44, 8.2, MUTED);

  chip(s, "C:L / I:N / A:N   AV:N AC:L PR:N UI:N", 5.13, 3.16, 2.9, AMBER);
  chip(s, "suite saw 31 s release", 8.13, 3.16, 1.42, GREEN);

  // Bottom: why they matter
  panel(s, 0.45, 3.56, 4.42, 1.62);
  label(s, "Why F-01 is the most consequential", 0.58, 3.6, 4.2, CYAN);
  body(s,
    "CVSS 6.5 measures the weakness, not the importance. Any authenticated user reaches it with no special conditions, and it discloses personal data at the scale of the student body. Priority follows exploitability.",
    0.58, 3.8, 4.2, 1.3, 8.2);

  panel(s, 5.13, 3.56, 4.42, 1.62);
  label(s, "One root cause, reported once", 5.26, 3.6, 4.2, CYAN);
  body(s,
    "The suite's independent MFA check observed the same 30-second release from outside and could not explain it. The source explains it. Two engines, one finding - so it is filed once, not twice.",
    5.26, 3.8, 4.2, 1.3, 8.2);

  notes(s, `F-01 first, and make the distinction clearly - that is the analytical core.

"The query is parameterised. $1 is a bound parameter, so no SQL injection payload can change the statement. This is not injection. The defect is that the value bound to $1 came from req.params - the URL - instead of req.session.userId."

Then the proof: signed in as scan-bank, whose own record is AC00000063, a request for AC00000036 returns another student's name and balance with HTTP 200. Walking the range leaked 15 distinct records.

Negative control - this is what makes it a real finding: the Acadia enrolment endpoint binds its query to the session. I sent the same identifier and got back only my own enrolments. So the bank behaviour is a defect, not a lab feature.

F-02: read the two CASE expressions aloud. They both read failed_attempts before the update. So attempt 2 sets the lock AND resets the counter to zero. When the lock expires you have a fresh budget of two. That is roughly 240 guesses an hour, indefinitely. It is worse than no lockout, because anyone reading the schema concludes lockout is implemented.

Note the credit to the other engine: the suite independently saw the 31-second release. It could see the behaviour but not explain it. Two engines, one root cause, one finding.`);
}

// =========================================================================
// SLIDE 5 - F-03, F-04, F-05 and the controls
// =========================================================================

{
  const s = slide("F-03: the injection, and the controls that held",
    "One endpoint, two queries, and the difference between them is the finding");

  label(s, "F-03  SQL injection in the teaching endpoint  CWE-89", 0.45, 0.9, 5.6, RED, 8.5);
  code(s,
    "// parameterised: payload is data\n" +
    "query(`${scoped} = $2 LIMIT 5`, [t, input])\n" +
    "\n" +
    "// concatenated: payload becomes syntax\n" +
    "query(`${scoped} = '${input}' LIMIT 5`, [t])\n" +
    "\n" +
    "input = ' OR '1'='1\n" +
    "protectedQuery.matches : 0\n" +
    "vulnerableQuery.matches: 2   <- finding\n" +
    "exfiltrated: LAB-BANK-A, LAB-BANK-B",
    0.45, 1.12, 4.7, 1.92, 7.6);

  body(s,
    "The CTE pins the row set to one application, so injection widens the match within scope - it cannot cross tenants. Real, but contained by design.",
    0.45, 3.1, 4.7, 0.44, 8.2, MUTED);

  // Chips stay left of x=5.3 so they cannot touch the table column, whose rows
  // grow to their content height rather than the rowH requested.
  chip(s, "PR:L  MFA session", 0.45, 3.58, 1.62, AMBER);
  chip(s, "READ ONLY txn", 2.15, 3.58, 1.42, AMBER);
  chip(s, "LAB_VULN_MODE", 3.65, 3.58, 1.42, AMBER);

  // Controls table
  label(s, "Controls tested and confirmed with live requests", 5.35, 0.9, 4.2, GREEN, 8.5);

  table(s, [
    [H("Control"), H("Result")],
    [C("Student session -> admin route"), C("403", GREEN)],
    [C("Bank session -> Acadia data"), C("refused", GREEN)],
    [C("Injection: transfer / Acadia / school"), C("not vulnerable", GREEN)],
    [C("Terminal command injection"), C("blocked", GREEN)],
    [C("Passwords / TOTP at rest"), C("Argon2id / AES-GCM", GREEN)],
    [C("Session fixation"), C("defeated", GREEN)],
    [C("Login enumeration"), C("uniform error", GREEN)],
    [C("F-04  plain HTTP, no redirect"), C("VULNERABLE", RED)],
    [C("F-05  no Cache-Control on auth"), C("fixed", AMBER)]
  ], { x: 5.35, y: 1.12, w: 4.2, colW: [3.0, 1.2], rowH: 0.27 });

  panel(s, 0.45, 4.0, 9.1, 1.2, PANEL2);
  body(s,
    "F-04 (Low 3.1, CWE-319): port 80 serves without redirect; HSTS is set, so only a first visit over http:// is cleartext.   " +
    "F-05 (Low 3.1, CWE-525): Helmet does not set Cache-Control and the auth routes set none - fixed with no-store + Pragma on /api/auth, confirmed live.",
    0.6, 4.08, 8.8, 1.04, 8.5);

  notes(s, `F-03 is a teaching endpoint that deliberately shows safe versus unsafe. Read the two query lines.

Same input, same table, same transaction. The parameterised query compares the string literally and matches nothing. The concatenated one becomes WHERE label = '' OR '1'='1' and matches every row in scope. Zero versus two. The contrast is the finding, not the boolean.

Important nuance: the materialised CTE constrains the row set to one application. So injection widens the match within scope but cannot cross tenants. And it runs inside BEGIN READ ONLY. That is why it is Medium, not High - and it is why the CVSS has PR:L, because it needs an MFA-verified session.

Then the table. This is the credibility slide. Nine controls were tested with live requests and held. That is the opposite of what people expect from a deliberately vulnerable app. Injection defences are uniformly correct across Acadia, transfer, school and the terminal.

F-04 and F-05 are Low and are reported for completeness, not scored in the comparison - no engine was asked to find them.`);
}

// =========================================================================
// SLIDE 6 - AI vs manual
// =========================================================================

{
  const s = slide("AI versus manual, measured", "Same target, same credentials, same ground truth");

  table(s, [
    [H(""), H("Manual"), H("Suite"), H("LLM agent"), H("Pipeline")],
    [C("Wall-clock"), C("hours"), C("41 s"), C("3 s"), C("42 min, aborted")],
    [C("Ground truth reported"), C("3 of 3", GREEN), C("3 of 3", GREEN), C("0 of 3", RED), C("0 of 3", RED)],
    [C("Detected, not reported"), C("-"), C("0"), C("1", AMBER), C("2 in analysis")],
    [C("False positives"), C("0"), C("0"), C("0"), C("3, rejected")],
    [C("Human interventions"), C("-"), C("0"), C("0"), C("2")]
  ], { x: 0.45, y: 0.9, w: 9.1, colW: [2.5, 1.5, 1.5, 1.8, 1.8], rowH: 0.29 });

  // The transcript
  label(s, "What the agent actually did", 0.45, 2.85, 4.2, CYAN);
  code(s,
    "[1] /api/bank/accounts         200\n" +
    "[2] /tuition/.../AC00000001    404\n" +
    "[3] /tuition/.../AC00000034    200\n" +
    "\n" +
    "model:   \"No vulnerabilities.\"\n" +
    "harness: 1 confirmed",
    0.45, 3.06, 3.9, 1.05, 7.8);

  // Explanation
  label(s, "Why: the oracle, not the model", 4.65, 2.85, 4.9, CYAN);
  body(s,
    "Step 2 guessed a non-existent ID and got 404; step 3 guessed a real one and got another user's record. It then discarded a correct conclusion: a 200 to a GET is normal - true generally, false here.",
    4.65, 3.06, 4.9, 0.66, 8.2);

  body(s,
    "It could not establish WHOSE record it held, because it never fetched its own first. The suite can: check 6 knows the session's own ID, so any other record is a defect by construction. That predicate is the oracle.",
    4.65, 3.75, 4.9, 0.9, 8.2, TEXT);

  panel(s, 0.45, 4.82, 9.1, 0.52, PANEL2);
  body(s,
    "Same failure ARTEMIS reports independently: their agent read HTTP 200 login-redirects as successful authentication.",
    0.6, 4.88, 8.8, 0.4, 8.5, AMBER);

  notes(s, `Read the table. On this target, manual and the scripted suite won decisively: 3 of 3, no false positives, in 41 seconds. The agent reported none.

Then the honest question: why? I tested three explanations and rejected two.

Rejected: the models were too weak. Both produced competent analysis. The pipeline correctly identified the concatenated query, the lockout logic AND the tuition authorisation gap - all from source. The reasoning was not the deficiency.

Rejected: the flaws were too subtle. All three are textbook classes in the OWASP Top 10. If a model cannot find a CWE-639 in a parameterised query bound to a path parameter, it will not find anything in that class.

Accepted: no oracle, and no successful authentication. Both engineering failures.

The transcript is the proof. The model formed a hypothesis, tested a negative case, tested a positive one, and got another user's record with a 200. Then it dismissed it. It never fetched its own record for comparison - a human does that reflexively.

And the kicker: ARTEMIS, an independent study, documents the identical class of failure - their agent counted HTTP 200 as successful login when the response was a redirect to the login page. Two different targets, two different models, same mistake: trusting a status code instead of the content.`);
}

// =========================================================================
// SLIDE 7 - industry evidence
// =========================================================================

{
  const s = slide("What AI testing has actually achieved in production",
    "Eight sources, each with the method behind the number");

  table(s, [
    [H("Organisation"), H("Measured result"), H("Method that produced it")],
    [C("Google Big Sleep", GREEN),
     C("First real-world agent-found 0-day: SQLite stack underflow that fuzzing missed. Later foiled an in-the-wild exploit using threat intel."),
     C("Agent + debugger + Python in a loop (Augmented Code Interpretation)")],
    [C("Microsoft MDASH", GREEN),
     C("16 new Windows flaws incl. 4 critical RCE. 21/21 planted bugs, zero false positives. 88.45% CyberGym."),
     C("100+ agents per weakness class, then adversarial debate, then de-dup")],
    [C("Anthropic", GREEN),
     C("500+ validated high-severity findings in code fuzzed for years; Chrome V8 RCE chains."),
     C("Parallel scanning agents, coverage tracking, self-critique stage")],
    [C("XBOW", GREEN),
     C("#1 on HackerOne US leaderboard, June 2025 - first autonomous system. 40-h manual matched in 28 min."),
     C("Fully autonomous exploitation, human triage at the platform")],
    [C("DARPA AIxCC", GREEN),
     C("54 of 70 injected flaws found, 43 patched; 18 real zero-days. ~143 h fully autonomous."),
     C("Cyber reasoning systems; scored against a known list")],
    [C("ARTEMIS (ICLR'26)", AMBER),
     C("Agent placed 2nd of 11 vs 10 professionals on a live 8,000-host network. Beat 9 of 10 - but more false positives."),
     C("Coverage map + validation layer; submissions judged valid/invalid")],
    [C("Semgrep", RED),
     C("46 findings at a 14% true-positive rate; Codex 21 at 18%."),
     C("Coding agents with a prompt, no triage harness")],
    [C("Omdia (n=200)", AMBER),
     C("95% rank pentesting top priority, yet only 32% of surface tested. 69% demand 85% accuracy vs manual."),
     C("Survey of US security leaders; belief, not capability")],
  ], { x: 0.45, y: 0.86, w: 9.1, colW: [1.55, 4.35, 3.2], rowH: 0.4 });

  panel(s, 0.45, 4.56, 9.1, 0.8, PANEL2);
  body(s,
    "Every strong result has a validation mechanism: a patched commit, a CVE, a benchmark protocol, a triage queue. " +
    "Precision tracks the harness - 14% true positives without one, 21 of 21 planted bugs with one - not the model.",
    0.6, 4.63, 8.8, 0.68, 8.5, TEXT);

  notes(s, `This slide answers "does AI beat humans in real companies?" - yes, and here is exactly how, and under what conditions.

Big Sleep: the first real-world vulnerability found by an agent that fuzzing had missed for years. A stack buffer underflow in SQLite. Fixed the day it was reported. Later, guided by threat intelligence, it found a flaw known only to attackers before they exploited it.

Microsoft MDASH: over a hundred cooperating agents, each trained on a weakness class, followed by an adversarial debate stage where agents argue for and against each finding. 16 previously unknown Windows vulnerabilities including four critical RCEs. And on planted bugs: 21 out of 21 with zero false positives.

Anthropic: 500+ validated high-severity findings in code that had been fuzzed for years.

XBOW: first autonomous system to reach number one on HackerOne's US leaderboard. Matched a principal pentester's 40-hour assessment in 28 minutes.

DARPA AIxCC: 54 of 70 injected vulnerabilities found and 43 patched, fully autonomously over about 143 hours, plus 18 real zero-days.

Then two that temper it. ARTEMIS is the strongest independent evidence - an agent placed second against ten human professionals on a live network, beating nine of them. But it submitted more false positives. And Semgrep: coding agents running at 14 to 18 percent true-positive rates.

Now the synthesis, and this is the thesis of the whole project: every strong result has a validator. A patched commit, a CVE, a benchmark list, a triage queue. The model is necessary but not sufficient. Precision tracks the harness.

That single idea explains both this slide and my negative result on slide 6. My agent had no oracle. Their systems did.`);
}

// =========================================================================
// SLIDE 8 - the six reports
// =========================================================================

{
  const s = slide("The six pentest reports", "Two manual tools, one scripted suite, one agent, one pipeline - and a comparison");

  const cards = [
    ["01  Nmap", "NMAP-REPORT.txt / .xml", "Network surface. Four ports: 80 open, 443 closed, 3000 closed, 5432 open postgresql.", "4 ports", CYAN],
    ["02  Nikto", "NIKTO-REPORT.txt + CONSOLE", "HTTP surface. 7,970 requests, 0 errors, 3 findings - all config noise, no vulnerability.", "7,970 reqs", PURPLE],
    ["03  Suite", "PENTEST-REPORT.md", "12 deterministic checks, every verdict carrying its request and response. 9 passed, 3 vulnerable.", "9 / 3 / 0", GREEN],
    ["04  AI agent", "AI-AGENT-REPORT.md", "Full transcript and both counts: 3 requests, 0 claimed, 1 detected by the harness.", "0 vs 1", RED],
    ["05  Shannon", "run-42min/ + partial-run1/ + CONSOLIDATED", "Six analyses, four queues, the error log - plus a labelled reconstruction of the report it never wrote.", "6 analyses", AMBER],
    ["06  Comparison", "COMPARISON-REPORT.md", "Every engine scored against ground truth on recall, false positives, time and interventions.", "4 engines", CYAN]
  ];

  cards.forEach(([name, src, desc, badge, col], i) => {
    const c = i % 3;
    const r = Math.floor(i / 3);
    const x = 0.45 + c * 3.1;
    const y = 0.92 + r * 2.06;

    panel(s, x, y, 2.9, 1.9);
    s.addText(name, {
      x: x + 0.12, y: y + 0.08, w: 2.66, h: 0.24,
      fontSize: 11, bold: true, color: col, fontFace: FONT
    });
    s.addText(src, {
      x: x + 0.12, y: y + 0.32, w: 2.66, h: 0.2,
      fontSize: 6.8, color: MUTED, fontFace: MONO
    });
    body(s, desc, x + 0.12, y + 0.56, 2.66, 1.0, 7.8);

    s.addShape(pptx.ShapeType.roundRect, {
      x: x + 0.12, y: y + 1.56, w: 1.3, h: 0.24,
      fill: { color: col, transparency: 84 },
      line: { color: col, width: 1 },
      rectRadius: 0.12
    });
    s.addText(badge, {
      x: x + 0.12, y: y + 1.56, w: 1.3, h: 0.24,
      fontSize: 7.5, bold: true, color: col, fontFace: MONO,
      align: "center", valign: "middle"
    });
  });

  panel(s, 0.45, 5.02, 9.1, 0.42, PANEL2);
  body(s,
    "All eight evidence files are in tools/out/, with REPORT-INDEX.md mapping each claim in the report to the file that proves it.",
    0.6, 5.06, 8.8, 0.34, 8.2, MUTED);

  notes(s, `One slide for the deliverables - take this slowly, because this is what a marker checks.

Six reports, grouped by who produced them.

Nmap and Nikto are the two conventional manual tools. Nmap gives me the network surface: four ports. 80 open, 443 closed, 3000 closed, and 5432 open - a PostgreSQL listener bound to all interfaces, which is worth flagging. Nikto ran 7,970 requests with zero errors and found three items: a Caddy banner, an uncommon header, and a missing Permissions-Policy. None is a vulnerability. That is itself a result - a scanner reporting only noise has correctly characterised a surface whose real defects are in logic, not configuration.

The suite report is the important one. Twelve checks, every verdict carrying the request and response that justifies it. Nine passed, three vulnerable, none inconclusive.

The AI agent report keeps both counts plus the full transcript, so you can see the three requests and judge the model's conclusion yourself.

Shannon produced six analysis deliverables and four exploitation queues but no final report - the model account ran out of credit. So the folder holds what it did produce, its error log, and a consolidated document I built from its own outputs, labelled line by line as Exploited, Analysed or Verified. It says in its first paragraph that it is a reconstruction, so nobody cites it as Shannon's output.

The comparison report scores all four engines against the same ground truth.

Everything cross-references through REPORT-INDEX.md.`);
}

// =========================================================================
// SLIDE 9 - the academic report
// =========================================================================

{
  const s = slide("The academic report", "22 pages, 11,881 words, 19 tables, 15 references");

  // Stats strip
  const stats = [
    ["22", "pages"], ["11,881", "words"], ["19", "tables"], ["15", "refs"]
  ];
  stats.forEach(([v, c], i) => {
    const x = 0.45 + i * 1.12;
    panel(s, x, 0.88, 1.02, 0.66, PANEL2);
    s.addText(v, {
      x, y: 0.9, w: 1.02, h: 0.32,
      fontSize: 15, bold: true, color: CYAN, fontFace: FONT, align: "center"
    });
    s.addText(c, {
      x, y: 1.2, w: 1.02, h: 0.24,
      fontSize: 7, color: MUTED, fontFace: FONT, align: "center"
    });
  });

  // Structure
  label(s, "Structure", 5.0, 0.9, 4.5, CYAN);
  body(s,
    "1  Introduction and aims\n" +
    "2  Background and related work\n" +
    "3  Industry evidence: what AI achieved in production\n" +
    "4  The system under test\n" +
    "5  Methodology\n" +
    "6  Findings F-01 to F-05",
    5.0, 1.1, 4.5, 1.5, 8);

  body(s,
    "7  AI versus manual on this target\n" +
    "8  Defects in the harness\n" +
    "9  Discussion and threats to validity\n" +
    "10  Conclusions and future work\n" +
    "     References - 15 sources",
    5.0, 2.66, 4.5, 1.2, 8);

  // Left: what makes it defensible
  label(s, "What makes it defensible", 0.45, 1.68, 4.3, GREEN);
  panel(s, 0.45, 1.88, 4.3, 2.0);
  body(s,
    "§3 states the method behind every industry figure, and separates case reports from experiments from surveys.\n" +
    "§7 reconciles the lab's negative result with the industry positives.\n" +
    "§9 states threats to validity plainly: one run per engine, a suite written by someone who knew the answers, no variance estimate.",
    0.58, 1.94, 4.06, 1.88, 7.8);

  // Appendices
  label(s, "Five appendices", 0.45, 4.0, 4.3, AMBER);
  panel(s, 0.45, 4.2, 4.3, 1.02);
  body(s,
    "A  source map, finding-to-line table\n" +
    "B  AI tooling inventory and cost, incl. all 4 failed runs\n" +
    "C  reproduction commands   D  evidence inventory   E  glossary",
    0.58, 4.25, 4.06, 0.94, 7.6);

  // Right bottom: before submitting
  panel(s, 5.0, 3.96, 4.55, 1.26, PANEL2);
  label(s, "Before submitting", 5.13, 4.0, 4.3, RED);
  body(s,
    "Five placeholders need your details: name, student ID, module code, institution, supervisor. They sit on page 1 and in the document properties.",
    5.13, 4.2, 4.3, 0.98, 8);

  notes(s, `Finally the written report - and this is what carries the marks if the presentation is short.

22 pages, about 11,900 words. Nineteen tables, and 15 references. I deliberately cut it down from 71 references, because a list that long makes the argument harder to follow rather than stronger. Fifteen is enough to carry every claim.

Two chapters matter most.

Chapter 3 is the industry evidence, and its discipline is that every figure carries the method that produced it. A patched commit is checkable. A survey is not, and the report says so. It also separates what the evidence does NOT establish: publication bias, code versus running applications, and vendor authorship.

Chapter 7 is the direct comparison on this target, and its job is to reconcile the lab's negative result with chapter 3's positive ones. The mechanism is the same in both: an oracle, a validation loop, and scale.

Chapter 9 is threats to validity, and it is deliberately unflattering: one run per engine, the suite was written by someone who already knew the answers, and there is no variance estimate. Examiners look for that section. Do not hide it.

Appendix B is unusual and worth pointing out - it inventories the AI tooling with cost, including all four failed runs and why each failed. That is the operational reality nobody publishes.

And the placeholders. Five of them: name, student ID, module, institution, supervisor. They are on page 1 and in the document properties, and they need filling before submission.`);
}

// =========================================================================

await pptx.writeFile({ fileName: OUT });
console.log("written:", OUT);

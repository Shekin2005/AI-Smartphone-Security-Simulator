#!/usr/bin/env node
// ==================================================
// BUILDS THE PRESENTATION
// ==================================================
//   cd slides && npm i pptxgenjs && node build-deck.mjs
//
// Writes ../AI-Smartphone-Security-Simulator.pptx (10 slides, 16:9).
//
// Every number on the slides is one that was measured against the running
// deployment; see PROJECT-REFERENCE.md for where each figure came from.
//
// Run verify-deck.mjs afterwards - it checks that nothing sits outside the
// canvas and that tables do not collide with the content beneath them.
// ==================================================

import pptxgen from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "AI-Smartphone-Security-Simulator.pptx");

// ---- design tokens -------------------------------------------------------
const BG = "0B1220";
const PANEL = "111C2E";
const PANEL2 = "16243A";
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
pptx.title = "AI Smartphone Security Simulator";
pptx.subject = "A lab that attacks itself";

// ---- helpers -------------------------------------------------------------

function slide(title, kicker) {
  const s = pptx.addSlide();
  s.background = { color: BG };

  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 10, h: 0.055,
    fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });

  s.addText(title, {
    x: 0.45, y: 0.16, w: 9.1, h: 0.42,
    fontSize: 22, bold: true, color: TEXT, fontFace: FONT, valign: "middle"
  });

  if (kicker) {
    s.addText(kicker, {
      x: 0.45, y: 0.57, w: 9.1, h: 0.26,
      fontSize: 11, color: MUTED, fontFace: FONT, italic: true
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

function label(s, text, x, y, w, color = CYAN, size = 10) {
  s.addText(text.toUpperCase(), {
    x, y, w, h: 0.22,
    fontSize: size, bold: true, color, fontFace: FONT, charSpacing: 1
  });
}

function code(s, text, x, y, w, h, size = 9.5) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: "060B14" },
    line: { color: LINE, width: 1 },
    rectRadius: 0.05
  });
  s.addText(text, {
    x: x + 0.12, y: y + 0.08, w: w - 0.24, h: h - 0.16,
    fontSize: size, color: "C9D6E8", fontFace: MONO,
    lineSpacingMultiple: 1.05, valign: "top"
  });
}

function stat(s, x, y, w, value, caption, color = CYAN) {
  s.addText(value, {
    x, y, w, h: 0.5,
    fontSize: 30, bold: true, color, fontFace: FONT, align: "center"
  });
  s.addText(caption, {
    x, y: y + 0.5, w, h: 0.42,
    fontSize: 9, color: MUTED, fontFace: FONT, align: "center",
    lineSpacingMultiple: 0.95
  });
}

const H = c => ({ text: c, options: { bold: true, color: CYAN, fill: { color: PANEL2 } } });
const C = (t, color = TEXT, bold = false) => ({ text: t, options: { color, bold } });

function table(s, rows, { x, y, w, colW, fontSize = 9.5, rowH = 0.28 }) {
  // Set the frame height to the sum of the rows. Without this pptxgenjs emits a
  // default 1" frame, and a viewer that clips to the frame truncates the table.
  const h = rows.length * rowH;

  s.addTable(rows, {
    x, y, w, h, colW, rowH,
    fontSize,
    fontFace: FONT,
    color: TEXT,
    fill: { color: PANEL },
    border: { type: "solid", color: LINE, pt: 0.75 },
    valign: "middle",
    margin: 4
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

  s.addText("AI SMARTPHONE", {
    x: 0.75, y: 0.85, w: 8.6, h: 0.74,
    fontSize: 40, bold: true, color: TEXT, fontFace: FONT, charSpacing: 1
  });
  s.addText("SECURITY SIMULATOR", {
    x: 0.75, y: 1.57, w: 8.6, h: 0.74,
    fontSize: 40, bold: true, color: CYAN, fontFace: FONT, charSpacing: 1
  });

  s.addShape(pptx.ShapeType.rect, {
    x: 0.78, y: 2.38, w: 1.5, h: 0.035, fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });

  s.addText(
    "A deliberately vulnerable lab that attacks itself.\nTwo web applications, three pentest engines, every result measured.",
    { x: 0.75, y: 2.5, w: 8.4, h: 0.82, fontSize: 14, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.25 }
  );

  const stats = [
    ["12", "deterministic\nsecurity checks"],
    ["3", "pentest engines\ncompared"],
    ["40", "API routes in\none Express app"],
    ["7,970", "nikto requests,\n0 errors"]
  ];

  stats.forEach(([v, c], i) => {
    const x = 0.75 + i * 2.15;
    panel(s, x, 3.5, 1.95, 1.1);
    s.addText(v, {
      x, y: 3.6, w: 1.95, h: 0.46,
      fontSize: 26, bold: true, color: CYAN, fontFace: FONT, align: "center"
    });
    s.addText(c, {
      x, y: 4.04, w: 1.95, h: 0.46,
      fontSize: 8.5, color: MUTED, fontFace: FONT, align: "center",
      lineSpacingMultiple: 0.95
    });
  });

  s.addText("Live at https://shekin.tail97139a.ts.net", {
    x: 0.75, y: 4.95, w: 8.4, h: 0.3,
    fontSize: 10, color: MUTED, fontFace: MONO
  });

  notes(s, `Open: "This is a working security lab. It contains two web applications that are deliberately vulnerable, and three different tools that try to break them. The question the project answers is: do a scripted test and an AI agent actually find the same things?"

Keep it short - 20 seconds. The numbers in the strip are all real measurements you will show later.`);
}

// =========================================================================
// SLIDE 2 - architecture
// =========================================================================

{
  const s = slide("How a request reaches the application", "The whole stack runs on one Windows host");

  const chain = [
    ["Browser", "phone UI, 8 app screens", CYAN],
    ["Tailscale Funnel", "terminates TLS, owns :443", PURPLE],
    ["Caddy 2", "container, published port 80", CYAN],
    ["sim-app", "Node 22 / Express, 40 routes", GREEN],
    ["PostgreSQL 18.3", "native Windows service, not in Docker", AMBER]
  ];

  let y = 1.02;
  for (const [name, note, color] of chain) {
    panel(s, 0.45, y, 3.55, 0.62);
    s.addText(name, {
      x: 0.58, y: y + 0.06, w: 3.3, h: 0.26,
      fontSize: 12, bold: true, color, fontFace: FONT
    });
    s.addText(note, {
      x: 0.58, y: y + 0.3, w: 3.3, h: 0.24,
      fontSize: 8.5, color: MUTED, fontFace: FONT
    });
    y += 0.78;
  }

  s.addText("HTTPS", {
    x: 2.02, y: 1.68, w: 0.5, h: 0.14, fontSize: 7, color: MUTED, fontFace: MONO
  });

  label(s, "Why this shape", 4.35, 1.0, 5.2);
  const points = [
    ["One published port.", "Only Caddy exposes a port; the app container has none. There is no direct path to Express from the internet."],
    ["TLS is not the app's job.", "Funnel terminates HTTPS. That is also why port 443 is not published - Docker holding it would block the tunnel."],
    ["The database is not containerised.", "Postgres runs as a Windows service and the app reaches it over host.docker.internal:5432."],
    ["Three streams, one transport.", "The manual suite, the AI agent and the terminal all stream over Server-Sent Events, so the phone and the CLI read the same bytes."]
  ];

  let py = 1.3;
  for (const [head, body] of points) {
    s.addText(head, {
      x: 4.35, y: py, w: 5.2, h: 0.22,
      fontSize: 10.5, bold: true, color: TEXT, fontFace: FONT
    });
    s.addText(body, {
      x: 4.35, y: py + 0.21, w: 5.2, h: 0.5,
      fontSize: 8.8, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.0
    });
    py += 0.78;
  }

  code(s,
    "shekin.tail97139a.ts.net  ->  127.0.0.1:80  ->  app:3000  ->  :5432\n" +
    "cookie: HttpOnly   headers: Helmet CSP, COOP, CORP, HSTS 1y",
    4.35, 4.42, 5.2, 0.55, 8
  );

  notes(s, `"Everything runs on one machine. The public URL is a Tailscale Funnel, which terminates TLS and forwards to Caddy on port 80, which proxies to the Node app, which talks to a Postgres service running natively on Windows.

Two design decisions worth calling out: the app container publishes no port at all, so there is no direct path from the internet to Express; and the database is deliberately not in Docker, so docker ps does not tell you whether the site is healthy - I learned that the hard way."`);
}

// =========================================================================
// SLIDE 3 - the two target applications
// =========================================================================

{
  const s = slide("Two applications, one deliberately defended", "The difference between them is the point of the lab");

  panel(s, 0.45, 1.02, 4.35, 2.05);
  label(s, "Banking - vulnerable", 0.62, 1.12, 4.0, RED);
  s.addText(
    "Any authenticated bank user can read a tuition record by changing the account identifier.",
    { x: 0.62, y: 1.38, w: 4.0, h: 0.44, fontSize: 9.5, color: TEXT, fontFace: FONT, lineSpacingMultiple: 1.0 }
  );
  code(s, "WHERE sp.user_id = $1", 0.62, 1.86, 4.0, 0.34, 9);
  s.addText(
    "The identifier comes straight from the path, so a valid session for one account reads another.",
    { x: 0.62, y: 2.24, w: 4.0, h: 0.5, fontSize: 8.5, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.0 }
  );
  s.addText("IDOR  CWE-639", { x: 0.62, y: 2.75, w: 4.0, h: 0.22, fontSize: 8, bold: true, color: RED, fontFace: MONO });

  panel(s, 5.2, 1.02, 4.35, 2.05);
  label(s, "Acadia - defended", 5.37, 1.12, 4.0, GREEN);
  s.addText(
    "The same class of endpoint here is bound to the session, so passing another student's id changes nothing.",
    { x: 5.37, y: 1.38, w: 4.0, h: 0.44, fontSize: 9.5, color: TEXT, fontFace: FONT, lineSpacingMultiple: 1.0 }
  );
  code(s, "WHERE e.student_user_id = $1\n  -- $1 is always the session user", 5.37, 1.86, 4.0, 0.42, 9);
  s.addText(
    "Measured: ?student_id=1 returns the caller's own enrolments, never the requested student's.",
    { x: 5.37, y: 2.34, w: 4.0, h: 0.4, fontSize: 8.5, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.0 }
  );
  s.addText("parameter bound  no finding", { x: 5.37, y: 2.75, w: 4.0, h: 0.22, fontSize: 8, bold: true, color: GREEN, fontFace: MONO });

  panel(s, 0.45, 3.24, 9.1, 1.68, PANEL2);
  label(s, "Why this matters for the evaluation", 0.65, 3.34, 8.6, AMBER);

  s.addText(
    "A scanner that reports \"IDOR\" on every identifier endpoint would be wrong here.",
    { x: 0.65, y: 3.6, w: 8.7, h: 0.26, fontSize: 11, bold: true, color: TEXT, fontFace: FONT }
  );

  s.addText(
    "Acadia was used as the control. Both the scripted suite and the AI agent had to reach the correct answer on both applications: find the flaw in the bank, and leave the defended endpoint alone. A test that \"finds\" a vulnerability in Acadia is a false positive, and the evaluation counts it as one.",
    { x: 0.65, y: 3.88, w: 8.7, h: 0.9, fontSize: 9.5, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.1 }
  );

  notes(s, `"There are two apps. The bank has a real IDOR: the tuition lookup filters on an identifier that comes from the URL, so any signed-in user can read another user's record.

Acadia has the same shape of endpoint but the query is bound to the session, so passing a different student id does nothing.

I made that difference deliberately, because it gives me a control. A tool that flags every endpoint with an id in it will be wrong on Acadia - and that is how I catch false positives."`);
}

// =========================================================================
// SLIDE 4 - manual suite
// =========================================================================

{
  const s = slide("Engine 1 - the deterministic suite", "12 checks, written in advance, identical on every run");

  const rows = [
    [H("Check"), H("Weight if it fails"), H("What it proves")],
    [C("unauth-access", TEXT, true), C("High"), C("Protected endpoints reject an anonymous caller")],
    [C("cross-app", TEXT, true), C("High"), C("A bank session cannot read the school app")],
    [C("vertical-escalation", TEXT, true), C("Critical", RED), C("A student cannot reach admin functions")],
    [C("register-role", TEXT, true), C("Critical", RED), C("Registration cannot mint an administrator")],
    [C("bola-tuition", TEXT, true), C("Medium", AMBER), C("Another user's tuition record is not readable")],
    [C("mfa-brute-force", TEXT, true), C("Medium", AMBER), C("MFA lockout holds and resists guessing")],
    [C("session-fixation", TEXT, true), C("Medium", AMBER), C("The session id rotates on authentication")],
    [C("auth-ratelimit", TEXT, true), C("Medium", AMBER), C("Login is rate limited")],
    [C("user-enumeration", TEXT, true), C("Low"), C("Login does not reveal whether an account exists")],
    [C("https-enforcement", TEXT, true), C("Low"), C("Plain HTTP redirects to HTTPS")],
    [C("headers", TEXT, true), C("Info"), C("Records the security-header set")],
    [C("cookie-flags", TEXT, true), C("Info"), C("Records HttpOnly, Secure, SameSite")]
  ];

  // 13 rows at 0.24" ends at 4.12, clear of the verdict panel at 4.28
  table(s, rows, { x: 0.45, y: 1.0, w: 6.35, colW: [1.7, 1.4, 3.25], fontSize: 8, rowH: 0.24 });

  panel(s, 7.0, 1.0, 2.55, 1.45, PANEL2);
  stat(s, 7.05, 1.06, 1.2, "9", "passed", GREEN);
  stat(s, 8.3, 1.06, 1.2, "3", "vulnerable", RED);
  s.addText("0 inconclusive", {
    x: 7.0, y: 2.1, w: 2.55, h: 0.24,
    fontSize: 10, bold: true, color: CYAN, fontFace: FONT, align: "center"
  });

  panel(s, 7.0, 2.58, 2.55, 0.95, PANEL2);
  s.addText("63 s", {
    x: 7.0, y: 2.64, w: 2.55, h: 0.42,
    fontSize: 26, bold: true, color: CYAN, fontFace: FONT, align: "center"
  });
  s.addText("total runtime", {
    x: 7.0, y: 3.06, w: 2.55, h: 0.24,
    fontSize: 8.5, color: MUTED, fontFace: FONT, align: "center"
  });

  s.addText("≈31 s of that is one check waiting out a lockout.", {
    x: 7.0, y: 3.62, w: 2.55, h: 0.5,
    fontSize: 8, color: MUTED, fontFace: FONT, align: "center", lineSpacingMultiple: 1.0
  });

  panel(s, 0.45, 4.28, 9.1, 0.95);
  label(s, "Every check returns one of three verdicts", 0.65, 4.36, 8.6);
  s.addText(
    "PASSED   an attack was attempted and refused              VULNERABLE   the attack succeeded, with a captured response              INCONCLUSIVE   undecided - never counted as safe",
    { x: 0.65, y: 4.62, w: 8.7, h: 0.5, fontSize: 8.8, color: MUTED, fontFace: MONO, lineSpacingMultiple: 1.1 }
  );

  notes(s, `"The first engine is a script I wrote. Twelve checks, each one attacks the application in a specific way and compares the answer to what it should be.

The weights are the severity if that check fails. Two are critical: a student must not reach admin routes, and registration must not be able to create an administrator.

Three results: nine passed, three vulnerable, zero inconclusive. Zero inconclusive matters - it means nothing was left undecided.

It takes 63 seconds, and a third of that is one check deliberately waiting out an MFA lockout, because you cannot prove a lockout releases without waiting."`);
}

// =========================================================================
// SLIDE 5 - AI agent
// =========================================================================

{
  const s = slide("Engine 2 - the AI agent", "An LLM chooses its own requests. The harness decides what to believe.");

  label(s, "Exactly three tools", 0.45, 1.0, 4.0);
  const tools = [
    ["http_request", "send a request, get the response"],
    ["record_finding", "claim a vulnerability with evidence"],
    ["finish", "end the run with a summary"]
  ];

  let ty = 1.28;
  for (const [name, note] of tools) {
    panel(s, 0.45, ty, 4.05, 0.56);
    s.addText(name, {
      x: 0.58, y: ty + 0.06, w: 3.8, h: 0.24, fontSize: 10.5, bold: true, color: CYAN, fontFace: MONO
    });
    s.addText(note, {
      x: 0.58, y: ty + 0.29, w: 3.8, h: 0.22, fontSize: 8.3, color: MUTED, fontFace: FONT
    });
    ty += 0.66;
  }

  s.addText(
    "Three is deliberate. Measured: given ~44 tools, free models spent every turn on planning calls and never touched the target. At three, they call correctly.",
    { x: 0.45, y: 3.26, w: 4.05, h: 0.75, fontSize: 8.5, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.08, italic: true }
  );

  label(s, "A real run - 3 seconds", 4.75, 1.0, 4.8, GREEN);
  code(s,
    "Model : nvidia/nemotron-3.5-lightning-30b-a3b\n" +
    "\n" +
    "[1] GET /api/bank/accounts                        -> 200\n" +
    "[2] GET /api/bank/tuition/student/AC00000001      -> 404\n" +
    "[3] GET /api/bank/tuition/student/AC00000034      -> 200\n" +
    "\n" +
    "Agent findings : 0\n" +
    "Detected       : 1",
    4.75, 1.28, 4.8, 1.62, 8.5
  );

  s.addText(
    "Step 2 guessed a non-existent identifier, got a 404, and corrected itself on step 3. The model chose every path; nothing is templated.",
    { x: 4.75, y: 2.98, w: 4.8, h: 0.5, fontSize: 8.8, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.05 }
  );

  panel(s, 4.75, 3.56, 4.8, 1.55, PANEL2);
  label(s, "Two counts, on purpose", 4.92, 3.64, 4.5, AMBER);

  s.addText("0", {
    x: 4.92, y: 3.9, w: 0.5, h: 0.4, fontSize: 22, bold: true, color: MUTED, fontFace: FONT
  });
  s.addText("what the model claimed", {
    x: 5.42, y: 3.98, w: 3.9, h: 0.28, fontSize: 9.5, color: MUTED, fontFace: FONT
  });

  s.addText("1", {
    x: 4.92, y: 4.32, w: 0.5, h: 0.4, fontSize: 22, bold: true, color: GREEN, fontFace: FONT
  });
  s.addText("what the harness confirmed from the response", {
    x: 5.42, y: 4.4, w: 3.9, h: 0.28, fontSize: 9.5, color: TEXT, fontFace: FONT
  });

  s.addText(
    "A finding is credible because the response proves it - not because the model asserted it.",
    { x: 4.92, y: 4.72, w: 4.5, h: 0.26, fontSize: 8.5, italic: true, color: MUTED, fontFace: FONT }
  );

  notes(s, `"The second engine is an AI agent. It gets three tools and nothing else: send a request, record a finding, finish.

Three tools is not laziness. When I gave it a general-purpose tool set of about forty-four tools, the free models spent every single turn planning and never attacked anything. At three tools they behave.

This is a real three-second run. Step one lists the accounts. Step two guesses a tuition identifier that does not exist and gets a 404. Step three tries a different one and gets a 200.

And here is the part I care about most: the model recorded zero findings, but the harness detected one from the response it actually received. Two counts, shown separately, so you can tell the difference between what the AI claimed and what happened."`);
}

// =========================================================================
// SLIDE 6 - Shannon
// =========================================================================

{
  const s = slide("Engine 3 - Shannon, an autonomous pentester", "It reads the source, then executes real exploits. No exploit, no report.");

  panel(s, 0.45, 1.0, 4.3, 1.35);
  label(s, "The constraint", 0.62, 1.08, 4.0, RED);
  s.addText(
    "Shannon needs Docker for its worker container. The app has no Docker binary and no socket - deliberately, because mounting one into a publicly reachable app is root-equivalent host access.",
    { x: 0.62, y: 1.34, w: 3.95, h: 0.95, fontSize: 8.8, color: TEXT, fontFace: FONT, lineSpacingMultiple: 1.08 }
  );

  label(s, "So it runs beside the app, not inside it", 0.45, 2.5, 4.3, GREEN);
  code(s,
    "phone UI\n" +
    "  -> /api/shannon/*      (session required)\n" +
    "  -> sim-app\n" +
    "  -> host.docker.internal:7071\n" +
    "  -> bridge (loopback + token)\n" +
    "  -> wsl.exe\n" +
    "  -> Shannon in WSL2\n" +
    "  -> worker container",
    0.45, 2.76, 4.3, 1.55, 8.2
  );

  s.addText(
    "Loopback alone is not enough: Docker forwards host.docker.internal to the host's loopback, so the bridge also requires a shared token.",
    { x: 0.45, y: 4.38, w: 4.3, h: 0.5, fontSize: 8.2, italic: true, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.05 }
  );

  label(s, "Measured, through the app, signed in", 5.0, 1.0, 4.55, CYAN);
  code(s,
    "GET /api/shannon/health   -> 200\n" +
    "  wsl    true\n" +
    "  node   v22.14.0\n" +
    "  docker 29.9.3\n" +
    "  key    configured",
    5.0, 1.28, 4.55, 0.95, 8.5
  );

  code(s,
    "Validation COMPLETED\n" +
    "Duration:    2.2s\n" +
    "Total Cost:  $0.0000\n" +
    "Checks:\n" +
    "  Preflight (credentials, target)      OK\n" +
    "  Cyber access verification            not required",
    5.0, 2.32, 4.55, 1.2, 8.5
  );

  panel(s, 5.0, 3.66, 4.55, 1.25, PANEL2);
  label(s, "A real scan, stopped at 165 s", 5.17, 3.74, 4.2, AMBER);
  s.addText(
    "pre-recon  ->  recon  ->  vulnerability analysis  ->  exploitation (running)\n\n" +
    "Full run: 1-1.5 hours. Three profiles exist for that reason: validate (~20 s), pipeline (fast), full.",
    { x: 5.17, y: 4.0, w: 4.2, h: 0.82, fontSize: 8.2, color: MUTED, fontFace: MONO, lineSpacingMultiple: 1.05 }
  );

  notes(s, `"The third engine is Shannon, an open-source autonomous pentester. It reads the source code, maps attack paths, and then actually executes exploits - its rule is no exploit, no report.

It cannot run in the app container, because it needs Docker to launch its worker, and I refuse to mount the Docker socket into a publicly reachable web app. That would be root on the host for anyone who registers.

So it runs in WSL2 behind a small bridge on the host, and the app proxies to it. The bridge is loopback-only and token-authenticated, because loopback by itself is not a boundary - Docker forwards host.docker.internal to it.

Validated through the app: WSL, Node 22, Docker 29.9.3, and the model check passed at zero cost. A real scan reached exploitation in under three minutes; a full one is about an hour. That is why the UI offers a validate profile."`);
}

// =========================================================================
// SLIDE 7 - terminal
// =========================================================================

{
  const s = slide("The Attack Lab is a real terminal", "Actual tools in the container - and hard limits on what they may touch");

  const rows = [
    [H("Command"), H("Time"), H("Result")],
    [C("nmap -sT -p 80 host.docker.internal", CYAN, true), C("1 s"), C("80/tcp open http")],
    [C("curl -i .../api/health", CYAN, true), C("<1 s"), C("200 OK + Helmet header set")],
    [C("whatweb -a 1 ...", CYAN, true), C("4 s"), C("Caddy, title, header fingerprint")],
    [C("openssl s_client -connect ...:443", CYAN, true), C("<1 s"), C("TLS 1.3, Verification OK")],
    [C("nikto -h host.docker.internal -p 80", CYAN, true), C("~50 s"), C("7,970 requests, 0 errors, 3 findings")]
  ];

  // 6 rows at 0.30" ends at 2.80, clear of the transcript block at 2.85
  table(s, rows, { x: 0.45, y: 1.0, w: 5.75, colW: [2.85, 0.7, 2.2], fontSize: 8.5, rowH: 0.30 });

  code(s,
    "- Nikto v2.6.1\n" +
    "+ Target IP:    192.168.65.254\n" +
    "+ [000287] /: Retrieved via header: 1.1 Caddy.\n" +
    "+ [999100] /: Uncommon header 'origin-agent-cluster'\n" +
    "+ [013587] /: Missing security header: permissions-policy\n" +
    "+ 7970 requests: 0 errors and 3 items reported",
    0.45, 2.85, 5.75, 1.35, 8
  );

  s.addText("The tool's own output, unmodified.", {
    x: 0.45, y: 4.25, w: 5.75, h: 0.24, fontSize: 8.5, italic: true, color: MUTED, fontFace: FONT
  });

  panel(s, 6.45, 1.0, 3.1, 3.6);
  label(s, "Why this is not a shell", 6.62, 1.08, 2.8, AMBER);

  const rails = [
    ["argv, shell:false", "the line is split and spawned, never passed to a shell"],
    ["metacharacters", "  ;  |  &  $  `  >  <  \\  are rejected"],
    ["binary allowlist", "bash, sh, env, python are refused"],
    ["target pinned", "every host must be this lab"],
    ["unprivileged", "runs as node, no DB URL, no session secret"],
    ["capped", "4,000 lines / 512 KB / 3 minutes"]
  ];

  let ry = 1.36;
  for (const [head, body] of rails) {
    s.addText(head, {
      x: 6.62, y: ry, w: 2.8, h: 0.2, fontSize: 8.8, bold: true, color: TEXT, fontFace: MONO
    });
    s.addText(body, {
      x: 6.62, y: ry + 0.19, w: 2.8, h: 0.3, fontSize: 7.8, color: MUTED, fontFace: FONT, lineSpacingMultiple: 0.95
    });
    ry += 0.53;
  }

  s.addText(
    "Open registration + an unrestricted shell = remote code execution for anyone who signs up.",
    { x: 6.45, y: 4.68, w: 3.1, h: 0.42, fontSize: 8, italic: true, color: AMBER, fontFace: FONT, lineSpacingMultiple: 1.0 }
  );

  notes(s, `"The Attack Lab is a prompt you can type into, backed by real tools installed in the container - nikto 2.6.1, nmap 7.93, whatweb, dig, openssl.

That nikto output is unmodified. Seven thousand nine hundred and seventy requests, zero errors, and three genuine findings: a version banner, an uncommon header, and a missing permissions-policy header.

But it is deliberately not a shell. The command is split into arguments and run without a shell, the binary must be on an allowlist, shell metacharacters are rejected, and every host argument has to name this lab.

That matters because the site is public and registration is open. An unrestricted shell behind a login would be remote code execution for anyone who signed up."`);
}

// =========================================================================
// SLIDE 8 - the comparison (the key slide)
// =========================================================================

{
  const s = slide("The actual question: do they agree?", "Scored against ground truth established independently of both engines");

  const rows = [
    [H("Item"), H("Expected"), H("Manual"), H("AI")],
    [C("Tuition lookup IDOR", TEXT, true), C("finding"), C("detected", GREEN, true), C("detected", GREEN, true)],
    [C("MFA lockout releases after ~31 s", TEXT, true), C("finding"), C("detected", GREEN, true), C("missed", RED, true)],
    [C("Plain HTTP not redirected to HTTPS", TEXT, true), C("finding"), C("detected", GREEN, true), C("missed", RED, true)],
    [C("Admin routes reject a student", TEXT, true), C("control"), C("held", GREEN, true), C("held", GREEN, true)],
    [C("Bank session cannot read Acadia", TEXT, true), C("control"), C("held", GREEN, true), C("not assessed", MUTED)],
    [C("Login does not reveal an account", TEXT, true), C("control"), C("held", GREEN, true), C("not assessed", MUTED)],
    [C("Registration cannot mint an admin", TEXT, true), C("control"), C("held", GREEN, true), C("not assessed", MUTED)]
  ];

  table(s, rows, { x: 0.45, y: 1.0, w: 6.1, colW: [2.75, 0.85, 1.25, 1.25], fontSize: 8.3, rowH: 0.3 });

  panel(s, 6.8, 1.0, 2.75, 2.2, PANEL2);
  label(s, "Recall on real vulnerabilities", 6.95, 1.08, 2.5);

  s.addText("Manual", { x: 6.95, y: 1.36, w: 1.2, h: 0.22, fontSize: 9, color: MUTED, fontFace: FONT });
  s.addText("3 / 3", { x: 8.05, y: 1.32, w: 1.4, h: 0.3, fontSize: 18, bold: true, color: GREEN, fontFace: FONT, align: "right" });

  s.addText("AI", { x: 6.95, y: 1.72, w: 1.2, h: 0.22, fontSize: 9, color: MUTED, fontFace: FONT });
  s.addText("1 / 3", { x: 8.05, y: 1.68, w: 1.4, h: 0.3, fontSize: 18, bold: true, color: RED, fontFace: FONT, align: "right" });

  s.addShape(pptx.ShapeType.line, {
    x: 6.95, y: 2.1, w: 2.45, h: 0,
    line: { color: LINE, width: 1 }
  });

  s.addText("False positives", { x: 6.95, y: 2.18, w: 1.5, h: 0.22, fontSize: 9, color: MUTED, fontFace: FONT });
  s.addText("0 · 0", { x: 8.05, y: 2.16, w: 1.4, h: 0.28, fontSize: 14, bold: true, color: CYAN, fontFace: FONT, align: "right" });

  s.addText("Neither engine invented a vulnerability.", {
    x: 6.95, y: 2.5, w: 2.5, h: 0.4, fontSize: 8, italic: true, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.0
  });

  s.addText("AI column: moonshotai/kimi-k3.1-pro, 7 requests", {
    x: 6.8, y: 3.24, w: 2.75, h: 0.28, fontSize: 7, color: MUTED, fontFace: MONO
  });

  panel(s, 0.45, 3.6, 9.1, 1.6, PANEL2);
  label(s, "What the difference actually is", 0.65, 3.68, 8.6, CYAN);

  s.addText(
    "Not knowledge - both engines were given the same endpoint list. It is patience.",
    { x: 0.65, y: 3.94, w: 8.7, h: 0.26, fontSize: 10.5, bold: true, color: TEXT, fontFace: FONT }
  );

  s.addText(
    "The two findings the AI missed both require waiting: a lockout that only releases after 31 seconds, and a redirect that only appears on a second HTTP request. A model optimising for \"finish the run\" skips both. The scripted suite cannot skip them, because the wait is written into the check.",
    { x: 0.65, y: 4.2, w: 8.7, h: 0.85, fontSize: 9, color: MUTED, fontFace: FONT, lineSpacingMultiple: 1.1 }
  );

  notes(s, `"This is the slide the project exists for.

I did not score either engine against its own output. Every item in that table was settled independently first - by reading the source, or by measuring the live system. That is the 'Expected' column.

Then both engines ran against the same endpoints.

Both found the bank IDOR. Both correctly left the admin routes alone. But the AI missed two real findings, and what those two have in common is that they both need waiting - a lockout that only releases after thirty-one seconds, and a redirect that only shows up on a second request.

Neither engine produced a false positive, which is worth saying: the AI was incomplete, not wrong.

So the honest conclusion is that the difference is not knowledge, because I gave both the same endpoint list. It is patience."`);
}

// =========================================================================
// SLIDE 9 - measured numbers
// =========================================================================

{
  const s = slide("Every claim has a measurement", "Taken from the running deployment, not estimated");

  const rows = [
    [H("What"), H("Measured"), H("How")],
    [C("Manual suite", GREEN, true), C("9 passed / 3 vulnerable / 0 inconclusive in 63 s"), C("live run, streaming transcript")],
    [C("AI agent", GREEN, true), C("3 requests in 3 s, agent 0 / detected 1"), C("live run, SSE transcript")],
    [C("Shannon validate", GREEN, true), C("completed in ~20 s, $0.0000, Node v22.14.0, Docker 29.9.3"), C("bridge health + run log")],
    [C("nikto", GREEN, true), C("7,970 requests, 0 errors, 3 findings, ~50 s"), C("container, port 80")],
    [C("Report formats", GREEN, true), C("md 200, json 200, pdf 415"), C("authenticated requests")],
    [C("Auth surface", GREEN, true), C("401 on every tool route without a session"), C("unauthenticated requests")],
    [C("Rate limiter", AMBER, true), C("failed attempts per account -> 429"), C("measured, then redesigned")],
    [C("Route count", GREEN, true), C("40 routes in server.js"), C("source")],
    [C("Database", GREEN, true), C("Postgres 18.3 native, reachable at host.docker.internal:5432"), C("service + query")],
    [C("TLS", GREEN, true), C("Let's Encrypt, valid to 21 Feb 2027, HSTS 1y"), C("certificate chain")],
    [C("Shannon in container", RED, true), C("not possible - no docker binary, no socket"), C("checked inside sim-app")]
  ];

  // 12 rows at 0.27" ends at 4.24, clear of the correction note at 4.6
  table(s, rows, { x: 0.45, y: 1.0, w: 9.1, colW: [1.85, 4.5, 2.75], fontSize: 8.2, rowH: 0.27 });

  s.addText(
    "Two numbers I corrected rather than shipped: an earlier build returned Markdown with a 200 for any ?format value, so PDF appeared to work. It did not.",
    { x: 0.45, y: 4.6, w: 9.1, h: 0.42, fontSize: 8.2, italic: true, color: AMBER, fontFace: FONT, lineSpacingMultiple: 1.0 }
  );

  notes(s, `"Every number in this deck came from a run. This is where they came from.

The row I want to point at is the red one: I checked whether Shannon could run inside the container, and the answer was no - no Docker binary, no socket. That is a measurement, not an assumption, and it is what drove the whole bridge design.

The note at the bottom is a mistake I made and fixed. An earlier build accepted any format parameter and always returned Markdown, so asking for a PDF appeared to succeed. It now refuses with a 415 instead of substituting something else."`);
}

// =========================================================================
// SLIDE 10 - posture and limits
// =========================================================================

{
  const s = slide("A lab that teaches vulnerabilities must not be one", "Posture of the platform, and what is still unfinished");

  panel(s, 0.45, 1.0, 4.45, 3.15);
  label(s, "Controls on the platform itself", 0.62, 1.08, 4.1, GREEN);

  const controls = [
    ["TLS", "Funnel, Let's Encrypt, HSTS 1 year"],
    ["Headers", "CSP, COOP, CORP, HSTS, no X-Powered-By"],
    ["Sessions", "Postgres-backed, HttpOnly, rotates on auth"],
    ["TOTP secrets", "AES-256-GCM at rest"],
    ["Passwords", "Argon2 hashing"],
    ["Command execution", "allowlist, shell:false, pinned target"],
    ["Docker socket", "not exposed - deliberate"],
    ["Shannon bridge", "loopback + token, sanitised source"],
    ["Secrets in git", ".env* ignored, only the example tracked"]
  ];

  let cy = 1.36;
  for (const [name, body] of controls) {
    s.addText(name, { x: 0.62, y: cy, w: 1.35, h: 0.22, fontSize: 8.5, bold: true, color: CYAN, fontFace: FONT });
    s.addText(body, { x: 2.0, y: cy, w: 2.75, h: 0.22, fontSize: 8.2, color: MUTED, fontFace: FONT });
    cy += 0.305;
  }

  panel(s, 5.1, 1.0, 4.45, 3.15);
  label(s, "What is still unfinished", 5.27, 1.08, 4.1, AMBER);

  const limits = [
    ["Model ceiling", "free models stop at 5-8 decisions; a paid key removes the limit without code changes"],
    ["Shannon runtime", "1-1.5 h for a full scan, against a demo window of minutes"],
    ["Limiter keys on account", "per-IP alone throttled every user behind one proxy"],
    ["HTTPS not scannable", "Tailscale terminates TLS; only port 80 is published"],
    ["Probe accounts", "each suite run adds one, so the IDOR count drifts"]
  ];

  let ly = 1.36;
  for (const [name, body] of limits) {
    s.addText(name, { x: 5.27, y: ly, w: 1.5, h: 0.22, fontSize: 8.5, bold: true, color: AMBER, fontFace: FONT });
    s.addText(body, {
      x: 6.85, y: ly, w: 2.55, h: 0.5, fontSize: 8, color: MUTED, fontFace: FONT, lineSpacingMultiple: 0.98
    });
    ly += 0.56;
  }

  panel(s, 0.45, 4.3, 9.1, 0.9, PANEL2);
  s.addText(
    "The lesson is not \"AI replaces the tester\". It is that a deterministic check proves what it was written to prove, an agent finds what nobody scripted, and running both against ground truth tells you which one you can trust for what.",
    {
      x: 0.65, y: 4.4, w: 8.7, h: 0.72,
      fontSize: 10, color: TEXT, fontFace: FONT, lineSpacingMultiple: 1.15, italic: true
    }
  );

  notes(s, `Close: "A lab that teaches security mistakes has to hold itself to a higher standard, so this one does: TLS, Helmet headers, Argon2, TOTP secrets encrypted at rest, and no Docker socket in the app.

The right column is what I did not finish, stated plainly rather than hidden. The model ceiling is the real one - the free tier caps the agent at five to eight decisions.

The conclusion is not that AI replaces a tester. It is that a script proves what it was written to prove, an agent finds what nobody scripted, and running both against ground truth is what tells you which to trust for what."`);
}

// ---- write ---------------------------------------------------------------

await pptx.writeFile({ fileName: OUT });
console.log("written:", OUT);
console.log("slides :", pptx.slides.length);

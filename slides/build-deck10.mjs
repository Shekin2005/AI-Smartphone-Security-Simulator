#!/usr/bin/env node
// ==================================================
// BUILDS THE 10-SLIDE PRESENTATION DECK
// ==================================================
//   cd slides && node build-deck10.mjs
//
// Writes ../AI-vs-Manual-Pentesting-10-Slides.pptx (13.333 x 7.5 in).
//
// Outline (target 8:20 of a 10-minute slot):
//    1 Title                                      0:20
//    2 Introduction and motivation                0:45
//    3 Manual vs AI penetration testing           0:50
//    4 Real-world industry adoption               1:00
//    5 Research aim and approach                  0:45
//    6 The smartphone security simulator          1:00
//    7 Vulnerabilities and technical investigation 1:00
//    8 Experimental results and comparison        1:30
//    9 Discussion and conclusion                  1:00
//   10 References                                 0:10
//
// Every figure is measured on the running deployment or taken from a named
// source. Where a value was not recorded (the agent's wall-clock), it is
// reported as not recorded rather than estimated.
// ==================================================

import pptxgen from "pptxgenjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, "..", "AI-vs-Manual-Pentesting-10-Slides.pptx");

// ---- tokens --------------------------------------------------------------

const BG = "0B1220";
const PANEL = "111C2E";
const PANEL2 = "16243A";
const LINE = "22405F";
const TEXT = "E8EEF7";
const MUTED = "93A4BF";
const CYAN = "38BDF8";
const EMERALD = "34D399";
const AMBER = "FBBF24";
const RED = "F87171";

const FONT = "Segoe UI";
const MONO = "Consolas";

const W = 13.333;
const H = 7.5;

const pptx = new pptxgen();
pptx.defineLayout({ name: "DECK_16x9", width: W, height: H });
pptx.layout = "DECK_16x9";
pptx.author = "Shekin David Raj";
pptx.title = "AI vs. Manual Penetration Testing";

// ---- helpers -------------------------------------------------------------

function slide(title, kicker) {
  const s = pptx.addSlide();
  s.background = { color: BG };

  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 0.07,
    fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });

  s.addText(title, {
    x: 0.6, y: 0.22, w: 12.1, h: 0.5,
    fontSize: 23, bold: true, color: TEXT, fontFace: FONT, valign: "middle"
  });

  if (kicker) {
    s.addText(kicker, {
      x: 0.6, y: 0.72, w: 12.1, h: 0.3,
      fontSize: 11, color: MUTED, fontFace: FONT, italic: true
    });
  }
  return s;
}

const notes = (s, t) => s.addNotes(t);

function panel(s, x, y, w, h, fill = PANEL, lineColor = LINE) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: fill },
    line: { color: lineColor, width: 1 },
    rectRadius: 0.05
  });
}

function text(s, str, x, y, w, h, size = 10.5, color = TEXT, opts = {}) {
  s.addText(str, {
    x, y, w, h,
    fontSize: size, color, fontFace: opts.mono ? MONO : FONT,
    bold: opts.bold || false, italic: opts.italic || false,
    align: opts.align || "left", valign: opts.valign || "top",
    lineSpacingMultiple: opts.ls || 1.12
  });
}

function label(s, str, x, y, w, color = CYAN, size = 9) {
  s.addText(str.toUpperCase(), {
    x, y, w, h: 0.22,
    fontSize: size, bold: true, color, fontFace: FONT, charSpacing: 1.2
  });
}

function chip(s, head, sub, x, y, w, color = CYAN) {
  panel(s, x, y, w, 0.52, PANEL2);
  s.addShape(pptx.ShapeType.rect, {
    x, y, w: 0.05, h: 0.52, fill: { color }, line: { color, width: 0 }
  });
  s.addText(head, {
    x: x + 0.14, y: y + 0.05, w: w - 0.2, h: 0.22,
    fontSize: 8.6, bold: true, color: TEXT, fontFace: FONT
  });
  s.addText(sub, {
    x: x + 0.14, y: y + 0.25, w: w - 0.2, h: 0.22,
    fontSize: 7.8, color: color, fontFace: MONO
  });
}

function statCard(s, x, y, w, big, cap, color = CYAN) {
  panel(s, x, y, w, 0.92, PANEL2);
  s.addText(big, {
    x: x + 0.08, y: y + 0.08, w: w - 0.16, h: 0.42,
    fontSize: 22, bold: true, color, fontFace: FONT, align: "center"
  });
  s.addText(cap, {
    x: x + 0.08, y: y + 0.5, w: w - 0.16, h: 0.38,
    fontSize: 8, color: MUTED, fontFace: FONT, align: "center", ls: 0.95
  });
}

const HDR = c => ({ text: c, options: { bold: true, color: "0B1220", fill: { color: CYAN }, fontSize: 8.6 } });
const CELL = (t, color = TEXT, bold = false) => ({ text: t, options: { color, bold, fontSize: 8.4 } });

function table(s, rows, { x, y, w, colW, rowH = 0.33, border = LINE }) {
  s.addTable(rows, {
    x, y, w, colW, rowH,
    fontFace: FONT, color: TEXT,
    fill: { color: PANEL },
    border: { type: "solid", color: border, pt: 0.75 },
    valign: "middle", margin: 4
  });
}

// =========================================================================
// 1. TITLE
// =========================================================================

{
  const s = pptx.addSlide();
  s.background = { color: BG };

  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: 0.12, h: H, fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });

  text(s, "COMP 3123   |   COMPUTER SECURITY", 0.95, 1.05, 8.5, 0.3, 12, CYAN, { bold: true });

  text(s, "AI vs. Manual", 0.95, 1.55, 11.0, 0.95, 46, TEXT, { bold: true });
  text(s, "Penetration Testing", 0.95, 2.42, 11.0, 0.95, 46, CYAN, { bold: true });

  s.addShape(pptx.ShapeType.rect, {
    x: 1.0, y: 3.48, w: 1.8, h: 0.045, fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });

  text(s, "A Comparative Study Using a Smartphone Security Simulator", 0.95, 3.7, 10.5, 0.42, 17, TEXT);

  text(s,
    "Four testing engines, one target, three known vulnerabilities, and the industry evidence that explains the result.",
    0.95, 4.18, 10.2, 0.6, 11.5, MUTED, { ls: 1.25 });

  // credentials
  text(s, "Shekin David Raj", 0.95, 5.5, 5.0, 0.3, 13, TEXT, { bold: true });
  text(s, "Acadia University   |   Fall 2026", 0.95, 5.8, 5.0, 0.3, 11, MUTED);

  // four figures
  const figs = [
    ["4", "engines tested", CYAN],
    ["12", "scripted checks", EMERALD],
    ["5", "findings confirmed", AMBER],
    ["12", "sources cited", TEXT]
  ];
  figs.forEach(([n, c, col], i) => {
    const x = 7.55 + (i % 2) * 2.9;
    const y = 5.35 + Math.floor(i / 2) * 0.85;
    s.addText(n, {
      x, y, w: 0.85, h: 0.4, fontSize: 22, bold: true, color: col, fontFace: FONT, align: "left"
    });
    s.addText(c, {
      x: x + 0.85, y: y + 0.05, w: 1.85, h: 0.35, fontSize: 9, color: MUTED, fontFace: FONT, valign: "middle"
    });
  });

  notes(s, `[0:20] Good morning. I'm Shekin David Raj, and this is a comparative study of AI versus manual penetration testing, using a smartphone security simulator I built.

The question is simple: AI is being sold as faster, cheaper and scalable security testing. Does it actually find what a human finds?

I tested four engines against one target where I knew every vulnerability in advance. The short answer: AI was dramatically faster, and on this target it reported none of the three real flaws. The interesting part is why - and that turns out to be the same reason AI has succeeded elsewhere.`);
}

// =========================================================================
// 2. INTRODUCTION
// =========================================================================

{
  const s = slide("Introduction and motivation", "Why this comparison matters now");

  const items = [
    ["AI is entering security practice", "Agentic systems are being sold to security teams as coverage that scales where headcount cannot."],
    ["Threats outpace manual capacity", "Only 32% of the attack surface is tested, while 95% of leaders rank pentesting a top priority [12]."],
    ["Manual testing is expensive and slow", "Skilled testers, sequential phases, and engagements measured in days rather than minutes."],
    ["AI promises speed, scale and lower cost", "Thousands of requests in minutes, 24/7, at $18/hour against roughly $60/hour for a professional [4]."],
    ["But can it be trusted?", "Ungoverned AI scanning has produced true-positive rates of 14-18% [11]. Buyers now demand 85% of manual accuracy."]
  ];

  items.forEach(([head, body], i) => {
    const y = 1.32 + i * 1.06;
    s.addShape(pptx.ShapeType.ellipse, {
      x: 0.65, y: y + 0.12, w: 0.34, h: 0.34,
      fill: { color: PANEL2 }, line: { color: CYAN, width: 1.25 }
    });
    s.addText(String(i + 1), {
      x: 0.65, y: y + 0.12, w: 0.34, h: 0.34,
      fontSize: 10, bold: true, color: CYAN, fontFace: FONT, align: "center", valign: "middle"
    });
    text(s, head, 1.15, y + 0.05, 7.1, 0.3, 12, TEXT, { bold: true });
    text(s, body, 1.15, y + 0.34, 7.1, 0.55, 9.5, MUTED, { ls: 1.18 });
  });

  // Right: the question
  panel(s, 8.65, 1.32, 4.05, 2.15, PANEL2, CYAN);
  label(s, "The question", 8.85, 1.45, 3.6, CYAN);
  text(s, "Can AI perform penetration testing as effectively as a human tester?",
    8.85, 1.75, 3.65, 1.1, 15, TEXT, { bold: true, ls: 1.15 });
  text(s, "And where it cannot, what exactly is missing?",
    8.85, 2.95, 3.65, 0.4, 10, MUTED, { italic: true });

  // Right: three numbers
  const nums = [
    ["95% / 32%", "rank pentesting a top priority / of surface actually tested", AMBER],
    ["14-18%", "true-positive rate, AI agents without a triage harness", RED],
    ["69%", "require 85% of manual accuracy before adopting", EMERALD]
  ];
  nums.forEach(([n, c, col], i) => {
    const y = 3.62 + i * 0.82;
    panel(s, 8.65, y, 4.05, 0.72);
    s.addText(n, {
      x: 8.75, y: y + 0.08, w: 1.35, h: 0.55,
      fontSize: 13.5, bold: true, color: col, fontFace: FONT, valign: "middle"
    });
    s.addText(c, {
      x: 10.12, y: y + 0.06, w: 2.5, h: 0.6,
      fontSize: 7.8, color: MUTED, fontFace: FONT, valign: "middle", ls: 1.05
    });
  });

  text(s, "Sources: [12] Omdia; [11] Semgrep; [4] Lin et al.", 8.65, 6.15, 4.05, 0.25, 7.2, MUTED, { italic: true });

  notes(s, `[0:45] Four things motivate this study.

First, AI is being sold into security teams as scale. Second, demand already exceeds supply: Omdia's survey of 200 US security leaders found 95% rank pentesting a top priority, but they estimate they test only 32% of their attack surface. Third, manual testing is expensive and sequential.

Fourth, AI looks like the obvious answer - it is fast, it is cheap per host, and it never gets tired.

But the trust question is the real one. Semgrep pointed coding agents at eleven open-source web apps and got true-positive rates of 14% and 18%. That is not a capacity gain, it is imported work. And 69% of buyers say they will not call it effective until it reaches 85% of manual accuracy.

So the research question is not "can AI find something". It is "can it be trusted with what it reports".`);
}

// =========================================================================
// 3. MANUAL VS AI
// =========================================================================

{
  const s = slide("Manual vs. AI penetration testing", "Different engines, different strengths, different failure modes");

  // Manual
  panel(s, 0.6, 1.35, 5.85, 3.45);
  s.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: 1.35, w: 5.85, h: 0.06, fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });
  label(s, "Manual penetration testing", 0.85, 1.55, 5.3, CYAN, 10);

  const manual = [
    ["Human-led investigation", "A tester chooses each step from what the last response revealed."],
    ["Contextual understanding", "Knows what the business means by a payment, and why a check exists."],
    ["Manual verification", "Every finding is confirmed before it is written up."],
    ["Exploit chaining", "Combines minor weaknesses into a working attack path."],
    ["Time and labour intensive", "One hypothesis at a time; a week is a sample, not a census."]
  ];
  manual.forEach(([h, b], i) => {
    const y = 1.95 + i * 0.56;
    text(s, "\u25AA  " + h, 0.85, y, 5.3, 0.26, 10, TEXT, { bold: true });
    text(s, b, 1.02, y + 0.24, 5.15, 0.3, 8.3, MUTED);
  });

  // AI
  panel(s, 6.88, 1.35, 5.85, 3.45);
  s.addShape(pptx.ShapeType.rect, {
    x: 6.88, y: 1.35, w: 5.85, h: 0.06, fill: { color: EMERALD }, line: { color: EMERALD, width: 0 }
  });
  label(s, "AI penetration testing", 7.13, 1.55, 5.3, EMERALD, 10);

  const ai = [
    ["Automated investigation", "The model plans and issues its own requests, turn by turn."],
    ["Parallel and tireless", "Thousands of requests, no fatigue, no working hours."],
    ["Scalable assessments", "Repeatable across many hosts and frequent release cycles."],
    ["Potentially lower cost", "$18/hour vs ~$60/hour for a professional tester [4]."],
    ["Requires result verification", "Status codes and bodies must be adjudicated, or findings are noise."]
  ];
  ai.forEach(([h, b], i) => {
    const y = 1.95 + i * 0.56;
    text(s, "\u25AA  " + h, 7.13, y, 5.3, 0.26, 10, TEXT, { bold: true });
    text(s, b, 7.30, y + 0.24, 5.15, 0.3, 8.3, MUTED);
  });

  // Bottom strip
  panel(s, 0.6, 5.05, 12.13, 1.15, PANEL2, AMBER);
  text(s,
    "The strengths are complementary, and so are the failure modes: humans miss coverage, AI misses judgement. " +
    "The question is therefore not replacement, but where each earns its place - and what has to surround an AI system before its output can be trusted.",
    0.85, 5.18, 11.6, 0.9, 11, TEXT, { ls: 1.2 });

  notes(s, `[0:50] Put the two side by side and the difference is not quality, it is kind.

A human brings intent. They know why an authorisation check exists, and they can chain three minor issues into an account takeover. What they cannot do is enumerate a large surface exhaustively, and they are expensive: about $60 an hour.

An AI brings coverage. It will issue thousands of requests, at any hour, for about $18 an hour. What it does not bring is judgement about what the response means.

Notice the last line on each side. On the human side: manual verification. On the AI side: requires verification. Both methods produce observations; neither produces trust for free.

So the useful question is not which one wins. It is where each earns its place - and what has to surround the AI before we can act on what it says.`);
}

// =========================================================================
// 4. INDUSTRY ADOPTION
// =========================================================================

{
  const s = slide("Real-world industry adoption", "What AI security testing has actually achieved in production");

  const cards = [
    ["Google - Big Sleep", "SQLite",
      "Found an exploitable stack buffer underflow that years of fuzzing had missed. Fixed by the developers the day it was reported.",
      "[5]", CYAN],
    ["Microsoft - MDASH", "Windows",
      "16 previously unknown Windows vulnerabilities, including 4 critical RCE flaws. Also 21 of 21 planted bugs with zero false positives.",
      "[6]", EMERALD],
    ["Anthropic - Claude", "Open source",
      "More than 500 validated high-severity vulnerabilities in code that had already been fuzzed for years.",
      "[7]", AMBER],
    ["XBOW - autonomous pentester", "Live web targets",
      "First autonomous system to reach #1 on HackerOne's US leaderboard. Matched a 40-hour manual assessment in 28 minutes.",
      "[8]", RED]
  ];

  cards.forEach(([name, scope, body, ref, col], i) => {
    const x = 0.6 + i * 3.08;
    panel(s, x, 1.35, 2.92, 3.55);
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.35, w: 2.92, h: 0.05, fill: { color: col }, line: { color: col, width: 0 }
    });

    text(s, name, x + 0.18, 1.5, 2.6, 0.52, 10.5, TEXT, { bold: true, ls: 1.05 });
    text(s, scope, x + 0.18, 2.05, 2.6, 0.24, 8, col, { mono: true });

    text(s, body, x + 0.18, 2.4, 2.58, 1.9, 9, MUTED, { ls: 1.2 });

    text(s, ref, x + 0.18, 4.55, 2.6, 0.24, 8.5, col, { bold: true });
  });

  // Caveat strip
  panel(s, 0.6, 5.1, 12.13, 0.72, PANEL2, AMBER);
  s.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: 5.1, w: 0.06, h: 0.72, fill: { color: AMBER }, line: { color: AMBER, width: 0 }
  });
  text(s,
    "Read this carefully: different targets, different methods, different denominators. These are existence proofs, not a controlled comparison - and every one of them ran inside a validation harness.",
    0.85, 5.22, 11.7, 0.5, 10, TEXT, { ls: 1.15 });

  text(s,
    "Also reported: OpenAI's staged pipeline validated 948 local privilege-escalation flaws in the Linux kernel [9]; DARPA's AIxCC finalists found 54 of 63 injected bugs and 18 real zero-days [10].",
    0.6, 6.05, 12.13, 0.5, 8.5, MUTED, { italic: true, ls: 1.15 });

  notes(s, `[1:00] This is not theoretical - four documented deployments.

Google's Big Sleep found a real SQLite vulnerability that years of fuzzing had missed, and it was patched the same day. Microsoft's MDASH found sixteen previously unknown Windows vulnerabilities, four of them critical remote code execution, and on planted bugs it went 21 out of 21 with zero false positives. Anthropic reported over five hundred validated high-severity findings in code that had already been fuzzed for years. XBOW became the first autonomous system to reach number one on HackerOne's US leaderboard.

Two more for scale: OpenAI's pipeline validated 948 privilege-escalation flaws in the Linux kernel, and DARPA's AIxCC finalists found 54 of 63 injected vulnerabilities and 18 real zero-days, fully autonomously.

But be careful with these numbers, and say so out loud. They are different targets, different methods and different denominators. They prove that AI can do this. They do not prove it will do it on your application.

And notice the pattern, because it matters in six slides' time: every one of these ran inside a validation harness.`);
}

// =========================================================================
// 5. AIM AND APPROACH
// =========================================================================

{
  const s = slide("Research aim and proposed approach", "A controlled comparison with a known answer key");

  panel(s, 0.6, 1.35, 12.13, 1.15, PANEL2, CYAN);
  label(s, "Research question", 0.85, 1.45, 5.0, CYAN);
  text(s, "Can AI-powered penetration testing improve vulnerability detection, testing speed and cost-effectiveness compared with manual testing - and where does it fail?",
    0.85, 1.72, 11.6, 0.7, 13.5, TEXT, { bold: true, ls: 1.15 });

  // Method steps
  const steps = [
    ["1", "Known ground truth", "Source review plus runtime proof. Two engines must agree before an item counts as a finding."],
    ["2", "Four engines, one target", "Manual, a deterministic suite, a single LLM agent, and a multi-agent pipeline (Shannon)."],
    ["3", "Same conditions", "Same credentials, same base URL, same scope for every engine. Differences cannot come from access."],
    ["4", "Scored, then interpreted", "Recall, precision, time, cost, human intervention - read against the industry evidence."]
  ];

  steps.forEach(([n, head, body], i) => {
    const x = 0.6 + i * 3.08;
    panel(s, x, 2.72, 2.92, 1.95);
    text(s, n, x + 0.18, 2.84, 0.5, 0.35, 17, CYAN, { bold: true });
    text(s, head, x + 0.18, 3.22, 2.6, 0.3, 10, TEXT, { bold: true });
    text(s, body, x + 0.18, 3.55, 2.6, 1.0, 8.2, MUTED, { ls: 1.15 });
  });

  // Two-count innovation
  panel(s, 0.6, 4.85, 5.85, 1.55, PANEL2, AMBER);
  label(s, "The measurement that mattered", 0.85, 4.95, 5.3, AMBER);
  text(s,
    "Claimed = what the model says it found.\nDetected = what its own traffic proves it saw.",
    0.85, 5.22, 5.3, 0.6, 10, TEXT, { ls: 1.2, mono: true });
  text(s, "A single number cannot tell an agent that found nothing from one that found something and talked itself out of it.",
    0.85, 5.86, 5.35, 0.45, 8.4, MUTED, { ls: 1.1 });

  panel(s, 6.88, 4.85, 5.85, 1.55);
  label(s, "Why a simulator", 7.13, 4.95, 5.3, CYAN);
  text(s,
    "Production studies cannot measure recall: nobody knows the vulnerabilities that were never reported. Building the target means the answer key is complete, and the comparison becomes measurable rather than anecdotal.",
    7.13, 5.22, 5.35, 1.1, 9, MUTED, { ls: 1.18 });

  notes(s, `[0:45] The research question has two halves: can AI improve detection, speed and cost - and where does it fail?

To answer that you need something production studies never have: a complete answer key. If I point four engines at a live network, I can count true and false positives, but I cannot know what they missed, because nobody knows the full list.

So I built the target. That gives me ground truth, and it lets me hold everything else constant: same credentials, same URL, same scope. Any difference in outcome is a difference in method, not in access.

The measurement I want to highlight is the two counts. "Claimed" is what the model says it found. "Detected" is what its own traffic proves it saw. They are not the same number, and the gap between them is the most interesting result of the project.`);
}

// =========================================================================
// 6. SIMULATOR
// =========================================================================

{
  const s = slide("The smartphone security simulator", "A phone interface, two applications, an attack lab - and a production-shaped stack");

  const shots = [
    ["docs/screens/01-banking-dashboard.png", "Banking app", "Accounts, transfers, tuition"],
    ["docs/screens/03-acadia-dashboard.png", "University app", "Courses, grades, finance"],
    ["docs/screens/04-attack-lab.png", "Attack lab", "Live exploit console"]
  ];

  shots.forEach(([img, cap, sub], i) => {
    const x = 0.6 + i * 4.18;
    const w = 3.85;
    const h = w * (1880 / 2200);

    s.addImage({ path: path.join(here, "..", img), x, y: 1.32, w, h });
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.32, w, h, fill: { color: BG, transparency: 100 }, line: { color: LINE, width: 1 }
    });

    text(s, cap, x, 1.32 + h + 0.06, w, 0.24, 10, TEXT, { bold: true, align: "center" });
    text(s, sub, x, 1.32 + h + 0.3, w, 0.24, 8, MUTED, { align: "center" });
  });

  // Tech chips
  const chips = [
    ["Frontend", "HTML · CSS · JS", CYAN],
    ["Backend", "Node 22 · Express 5", EMERALD],
    ["Database", "PostgreSQL 18.3", AMBER],
    ["Infrastructure", "Docker · Caddy · Tailscale", CYAN],
    ["Auth", "Password + TOTP (RFC 6238)", EMERALD],
    ["Conventional", "Nmap · Nikto · manual", AMBER],
    ["AI engines", "LLM agent · Shannon", RED]
  ];

  chips.forEach(([h, sub, col], i) => {
    const x = 0.6 + i * 1.74;
    chip(s, h, sub, x, 5.55, 1.62, col);
  });

  panel(s, 0.6, 6.25, 12.13, 0.55, PANEL2);
  text(s,
    "82 HTTP route handlers across three modules. Passwords hashed with Argon2id, sessions regenerated on login, HSTS, CSP and SameSite cookies in place.",
    0.85, 6.36, 11.6, 0.35, 9, MUTED);

  notes(s, `[1:00] This is the target, and it is a real application, not a mock-up.

It presents as a phone. Unlock it with a passcode and you get two applications: a retail bank with accounts, transfers and tuition payment, and a university portal with courses, grades and finance. There is also an attack lab with a live exploit console, which is what the third screenshot shows.

Underneath it is a production-shaped stack: Node 22 and Express 5, PostgreSQL 18.3, Docker, Caddy and a Tailscale funnel for public TLS. Passwords are Argon2id, MFA is TOTP, and the usual headers are set - because a teaching app that skips the controls cannot tell you anything about how engines behave against a defended target.

Eighty-two route handlers. Small enough to review completely, large enough that no engine can enumerate it by accident.

The middle screenshot is the student portal; the left is the banking app. On the next slide I'll show what happened when I asked the bank app for a record that did not belong to me.`);
}

// =========================================================================
// 7. VULNERABILITIES
// =========================================================================

{
  const s = slide("Vulnerabilities and technical investigation", "Five confirmed findings, each reproduced and explained at source level");

  table(s, [
    [HDR("ID"), HDR("Vulnerability"), HDR("CWE"), HDR("CVSS"), HDR("Security impact")],
    [CELL("F-01"), CELL("Broken object-level authorisation", TEXT, true), CELL("CWE-639"), CELL("6.5", AMBER, true),
      CELL("Any bank user reads a student's name and outstanding tuition by walking a sequential ID")],
    [CELL("F-02"), CELL("Account lockout resets at threshold", TEXT, true), CELL("CWE-307"), CELL("6.5", AMBER, true),
      CELL("Counter returns to zero when it locks: roughly 240 password guesses per hour, indefinitely")],
    [CELL("F-03"), CELL("SQL injection in the teaching endpoint", TEXT, true), CELL("CWE-89"), CELL("6.5", AMBER, true),
      CELL("Concatenated query widens the match inside a read-only, row-pinned demonstration table")],
    [CELL("F-04"), CELL("No HTTPS redirect on the HTTP port", TEXT, true), CELL("CWE-319"), CELL("3.1", EMERALD, true),
      CELL("Cleartext on a first visit over http://; HSTS protects subsequent visits only")],
    [CELL("F-05"), CELL("No Cache-Control on auth responses", TEXT, true), CELL("CWE-525"), CELL("3.1", EMERALD, true),
      CELL("Responses describing session and MFA state were cacheable by intermediaries")]
  ], { x: 0.6, y: 1.3, w: 7.75, colW: [0.6, 2.15, 0.95, 0.6, 3.45], rowH: 0.42 });

  // Evidence box: the IDOR live
  panel(s, 8.6, 1.3, 4.13, 2.72, PANEL2, RED);
  label(s, "F-01, observed live", 8.8, 1.4, 3.7, RED);
  text(s,
    "Signed in as demo.bank, whose own record is not this one:\n\n" +
    "GET /api/bank/tuition/student/AC00000036\n\n" +
    "200  {\"name\":\"jass\",\n      \"tuitionCents\":125000}",
    8.8, 1.68, 3.75, 1.35, 8.2, "C9D6E8", { mono: true, ls: 1.2 });
  text(s,
    "Parameterised, so not injectable - but the ID came from the URL, not the session. The screenshot on the previous slide shows the panel returning \"jass - $1,250.00 owing\".",
    8.8, 3.12, 3.75, 0.8, 8, MUTED, { ls: 1.12 });

  // Countermeasures
  label(s, "Countermeasures implemented and tested", 0.6, 4.28, 7.7, EMERALD);
  const cm = [
    ["Parameterised queries", "every Acadia, transfer and school statement"],
    ["Role-based access control", "student session against admin routes returns 403"],
    ["Argon2id password hashing", "TOTP secrets encrypted with AES-256-GCM"],
    ["MFA and session handling", "regenerate() on login, HttpOnly + SameSite cookies"],
    ["Security headers", "CSP, HSTS, X-Frame-Options, Referrer-Policy"]
  ];
  cm.forEach(([h, b], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.6 + col * 4.05;
    const y = 4.58 + row * 0.62;
    s.addText("\u2713", {
      x, y, w: 0.25, h: 0.3, fontSize: 10, bold: true, color: EMERALD, fontFace: FONT
    });
    text(s, h, x + 0.28, y, 3.6, 0.25, 9.5, TEXT, { bold: true });
    text(s, b, x + 0.28, y + 0.23, 3.6, 0.3, 7.8, MUTED);
  });

  panel(s, 8.6, 4.28, 4.13, 1.62, PANEL2);
  text(s,
    "The pattern worth noticing: injection defences are uniformly sound, and authorisation fails in exactly one place. That is what makes F-01 credible rather than a lab artefact.",
    8.8, 4.38, 3.75, 1.4, 8.6, TEXT, { ls: 1.18 });

  notes(s, `[1:00] Five findings, all confirmed with live requests and all explained at source level.

F-01 is the important one. The endpoint takes a student ID from the URL and binds it as a parameter. It is parameterised - so it is not injectable - but the value comes from the request, not from the session. Any signed-in bank user can walk the ID space and read every student's name and tuition balance. The screenshot showed it: signed in as demo.bank, asking for AC00000036, and the panel returned "jass, one thousand two hundred and fifty dollars owing".

F-02 is a lockout that resets itself. Both CASE expressions read the same pre-update value, so two wrong passwords set a thirty-second lock and zero the counter. When the lock expires you have a fresh budget of two. That is roughly 240 guesses an hour, forever.

F-03 is SQL injection in a teaching endpoint: one query parameterised, one concatenated, same input. Zero rows versus two. It is contained by a read-only transaction and a row-pinned CTE, which is why it scores 6.5 rather than higher.

F-04 and F-05 are low-severity configuration issues, reported for completeness.

On the right: the controls that held. This is the honest picture - most of this application is well built.`);

  // second notes paragraph intentionally omitted
}

// =========================================================================
// 8. RESULTS
// =========================================================================

{
  const s = slide("Experimental results and comparison", "Same target, same credentials, same ground truth");

  statCard(s, 0.6, 1.28, 2.9, "12 checks", "9 passed · 3 vulnerable\n0 inconclusive", EMERALD);
  statCard(s, 3.65, 1.28, 2.9, "0 of 3", "reported by the\nAI agent", RED);
  statCard(s, 6.7, 1.28, 2.9, "1 of 3", "detected by the harness\nfrom its own traffic", AMBER);
  statCard(s, 9.75, 1.28, 2.98, "42 min", "Shannon run, aborted\nbefore reporting", AMBER);

  table(s, [
    [HDR("Metric"), HDR("Manual"), HDR("Suite"), HDR("AI agent"), HDR("Shannon")],
    [CELL("Execution time"), CELL("hours"), CELL("41 s *"), CELL("not recorded"), CELL("42 min")],
    [CELL("Ground truth reported"), CELL("3 of 3", EMERALD, true), CELL("3 of 3", EMERALD, true), CELL("0 of 3", RED, true), CELL("0 of 3", RED, true)],
    [CELL("Seen but not reported"), CELL("-"), CELL("0"), CELL("1", AMBER, true), CELL("3", AMBER, true)],
    [CELL("False positives"), CELL("0"), CELL("0"), CELL("0"), CELL("2 unverified")],
    [CELL("Completion"), CELL("complete"), CELL("complete"), CELL("complete"), CELL("aborted")]
  ], { x: 0.6, y: 2.42, w: 6.55, colW: [1.75, 1.0, 1.05, 1.15, 1.6], rowH: 0.4 });

  text(s, "* 41 s in the recorded run; a measured re-run took 33 s. The agent's wall-clock was not captured by the harness.",
    0.6, 4.95, 6.55, 0.3, 7.4, MUTED, { italic: true });

  s.addImage({
    path: path.join(here, "fig-results.png"),
    x: 7.4, y: 2.3, w: 5.35, h: 5.35 * (1080 / 1890)
  });

  panel(s, 0.6, 5.42, 6.55, 1.35, PANEL2, RED);
  label(s, "Why the AI agent reported nothing", 0.8, 5.52, 6.2, RED);
  text(s,
    "It tested a non-existent ID (404), then a real one, and received another user's record. It then discarded a correct conclusion: \"a 200 to a GET is normal\" - true in general, false here. It never fetched its own record first, so it had no baseline.",
    0.8, 5.78, 6.15, 0.95, 8.6, TEXT, { ls: 1.15 });

  text(s, "6 of 12 checks saw the flaw the agent dismissed - the difference is a deterministic predicate, not a better model.",
    0.6, 6.85, 12.13, 0.3, 8.6, CYAN, { italic: true });

  notes(s, `[1:30] This is the result slide, and it needs to be read honestly.

Twelve scripted checks, nine passed, three found a weakness, none inconclusive. Manual review found the same three. The single AI agent made eighteen requests and reported zero. Shannon ran for forty-two minutes, produced analysis on all three, and then the provider cut the key before the reporting agent ran, so no consolidated report exists.

The row that matters is "seen but not reported". The agent's own traffic contained another user's tuition record. My harness counted it. The model did not.

Why? Look at what it did. It guessed a non-existent ID, got a 404. It guessed a real one, got a 200 with someone else's data. Then it reasoned: a 200 to a GET is normal - and dismissed it. That reasoning is correct in general and wrong here. It never fetched its own record, so it never had a baseline to compare against.

Check six of my suite does exactly that: it knows the session's own identifier, so any other record is a defect by construction. That predicate - not a stronger model - is the difference.

One note on timing: I did not record the agent's wall-clock, so I am not quoting one. The suite took 41 seconds in the recorded run and 33 in a re-run.`);
}

// =========================================================================
// 9. DISCUSSION
// =========================================================================

{
  const s = slide("Discussion and conclusion", "Where AI earns its place, and what it still cannot do alone");

  label(s, "Why industries are moving toward AI", 0.6, 1.3, 5.9, CYAN);
  const why = [
    ["Faster testing", "Minutes instead of days for a first pass"],
    ["Potential cost reduction", "$18/hour against ~$60/hour"],
    ["Scalability", "Many hosts, many releases"],
    ["Continuous testing", "Runs on every deploy, not once a year"]
  ];
  why.forEach(([h, b], i) => {
    const y = 1.6 + i * 0.62;
    panel(s, 0.6, y, 5.9, 0.54, PANEL2);
    text(s, h, 0.75, y + 0.06, 2.4, 0.24, 9.5, TEXT, { bold: true });
    text(s, b, 3.15, y + 0.08, 3.2, 0.4, 8.2, MUTED, { valign: "middle" });
  });

  label(s, "Limitations", 6.83, 1.3, 5.9, AMBER);
  const limits = [
    ["Misses and false positives", "0 of 3 reported here; 14-18% precision unharnessed"],
    ["Model access and cost", "A revoked key aborted a 42-minute run"],
    ["Human validation still required", "Every result needs an oracle"],
    ["No proven cost saving", "One target cannot establish economics"]
  ];
  limits.forEach(([h, b], i) => {
    const y = 1.6 + i * 0.62;
    panel(s, 6.83, y, 5.9, 0.54);
    text(s, h, 6.98, y + 0.06, 2.6, 0.24, 9.5, TEXT, { bold: true });
    text(s, b, 9.6, y + 0.08, 3.05, 0.4, 8.2, MUTED, { valign: "middle" });
  });

  // Conclusion
  panel(s, 0.6, 4.3, 12.13, 1.62, PANEL2, EMERALD);
  s.addShape(pptx.ShapeType.rect, {
    x: 0.6, y: 4.3, w: 0.07, h: 1.62, fill: { color: EMERALD }, line: { color: EMERALD, width: 0 }
  });
  label(s, "Conclusion", 0.9, 4.42, 5.0, EMERALD);
  text(s,
    "AI penetration testing has real potential to improve efficiency, scalability and cost. But on a target with a known answer key it reported none of the three real flaws that its own traffic exposed. " +
    "The evidence from Google, Microsoft and XBOW points the same way: the capability is real, and it depends on a validation harness and human judgement around it.",
    0.9, 4.7, 11.6, 1.1, 10.5, TEXT, { ls: 1.2 });

  panel(s, 0.6, 6.08, 12.13, 0.7, PANEL2);
  text(s,
    "Recommendation: use AI for coverage and speed, keep deterministic verification for trust, and reserve human judgement for what the findings mean.",
    0.85, 6.22, 11.6, 0.45, 10, CYAN, { bold: true });

  notes(s, `[1:00] Bring it together.

Industries are moving toward AI for four reasons: speed, cost per host, scale, and the ability to run continuously rather than once a year. Those are real advantages and my results do not contradict them - eighteen requests in seconds against hours of manual work is a genuine difference.

But the limitations are equally real. It missed two of three findings and reported none of them. Model access is a single point of failure: a revoked key ended a forty-two-minute run. Human validation is still required, because something has to decide whether a response means anything. And my experiment cannot prove a cost saving - one target is not an economics study.

So the conclusion is deliberately modest. AI has real potential to improve efficiency, scalability and cost. But on a target where I knew the answer, it reported none of the three real flaws that its own traffic exposed.

The lesson from Google, Microsoft and XBOW is the same: the capability is real, and it lives inside a validation harness with humans around it. Combine the two, and you get something better than either.`);
}

// =========================================================================
// 10. REFERENCES
// =========================================================================

{
  const s = pptx.addSlide();
  s.background = { color: BG };
  s.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: W, h: 0.07, fill: { color: CYAN }, line: { color: CYAN, width: 0 }
  });

  text(s, "References", 0.6, 0.25, 12.1, 0.45, 22, TEXT, { bold: true });
  text(s, "Harvard style. Numbers match the citations used in this deck.", 0.6, 0.7, 12.1, 0.26, 9.5, MUTED, { italic: true });

  const refs = [
    "[1]  Scarfone, K., Souppaya, M., Cody, A. and Orebaugh, A. (2008) Technical Guide to Information Security Testing and Assessment. NIST Special Publication 800-115. Gaithersburg, MD: NIST.",
    "[2]  OWASP Foundation (2021) OWASP Top 10:2021. Available at: https://owasp.org/Top10/ (Accessed: 24 November 2026).",
    "[3]  MITRE (2026) CWE-639: Authorization Bypass Through User-Controlled Key; CWE-307: Improper Restriction of Excessive Authentication Attempts; CWE-89: SQL Injection. Available at: https://cwe.mitre.org/ (Accessed: 24 November 2026).",
    "[4]  Lin, J.W., Jones, E.K., Jasper, D.J., Ho, E.J., Wu, A., Yang, A.T., Perry, N., Zou, A., Fredrikson, M., Kolter, J.Z., Liang, P., Boneh, D. and Ho, D.E. (2026) 'Comparing AI agents to cybersecurity professionals in real-world penetration testing', International Conference on Learning Representations (ICLR 2026). Preprint: arXiv:2512.09882.",
    "[5]  Google Project Zero (2024) 'From Naptime to Big Sleep: using large language models to catch vulnerabilities in real-world code'. Available at: https://projectzero.google/2024/10/from-naptime-to-big-sleep.html (Accessed: 24 November 2026).",
    "[6]  Microsoft Security (2026) 'Defense at AI speed: Microsoft's new multi-model agentic security system tops leading industry benchmark'. Available at: https://www.microsoft.com/en-us/security/blog/ (Accessed: 24 November 2026).",
    "[7]  Anthropic (2026) 'Evaluating and mitigating the growing risk of LLM-discovered 0-days'. Available at: https://www.anthropic.com/research/zero-days (Accessed: 24 November 2026).",
    "[8]  XBOW (2025) 'The road to top 1: how XBOW did it'. Available at: https://xbow.com/blog/top-1-how-xbow-did-it (Accessed: 24 November 2026).",
    "[9]  OpenAI (2026) 'A five-stage pipeline for finding privilege-escalation vulnerabilities in the Linux kernel'. Available at: https://openai.com/ (Accessed: 24 November 2026).",
    "[10] DARPA (2025) 'AI Cyber Challenge marks pivotal inflection point for cyber defense'. Available at: https://www.darpa.mil/news/2025/aixcc-results (Accessed: 24 November 2026).",
    "[11] Semgrep (2025) 'Finding vulnerabilities in modern web apps using Claude Code and OpenAI Codex'. Available at: https://semgrep.dev/blog/ (Accessed: 24 November 2026).",
    "[12] Omdia (2026) The 2026 State of Agentic AI in Pentesting. Commissioned by Synack. Survey of 200 US security leaders, fielded 11-22 December 2025."
  ];

  const half = Math.ceil(refs.length / 2);
  const colW = 5.92;

  refs.forEach((r, i) => {
    const col = i < half ? 0 : 1;
    const row = i % half;
    const x = 0.6 + col * 6.21;
    const y = 1.12 + row * 1.0;
    text(s, r, x, y, colW, 0.95, 6.9, MUTED, { ls: 1.08 });
  });

  text(s,
    "Target system: https://shekin.tail97139a.ts.net  ·  Assessment conducted with authorisation on a purpose-built simulator; all records synthetic.",
    0.6, 7.08, 12.13, 0.26, 7.5, MUTED, { italic: true });

  notes(s, `[0:10] Twelve sources, Harvard style. The four that matter most for the argument are Lin et al. for the human comparison, Microsoft and Google for what a harness achieves, and Semgrep for what happens without one.

The target was a simulator I built and own; all records are synthetic. Happy to take questions.`);
}

await pptx.writeFile({ fileName: OUT });
console.log("written:", OUT);

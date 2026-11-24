#!/usr/bin/env python3
"""
Builds the full academic report (target 20–25 pages).

    python docs/build-project-docx-full.py

Output: docs/AI-Smartphone-Security-Simulator-Full-Report.docx

This edition adds the material the shorter ones omit: a chapter of industry
evidence on what AI security testing has actually achieved in production, the
head-to-head literature that measures it against human testers, a chapter
comparing AI and manual testing on this specific target, and an appendix
inventorying the AI tooling and its costs.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from docx_framework import (  # noqa: E402
    ACCENT, GREY, REFS as BASE_REFS, add_runs, caption, code_block,
    footer_page_numbers, new_document, page_break, table, toc,
)
from references_full import EXTRA  # noqa: E402
from docx.enum.text import WD_ALIGN_PARAGRAPH  # noqa: E402
from docx.shared import Cm, Pt  # noqa: E402

OUT = Path(__file__).parent / "AI-Smartphone-Security-Simulator-Full-Report.docx"

ALL_REFS = BASE_REFS + EXTRA
NUM = {key: i + 1 for i, (key, _) in enumerate(ALL_REFS)}


def c(*keys):
    return "[" + ", ".join(str(NUM[k]) for k in keys) + "]"


BODY = 10.2
SMALL = 7.8
CODE = 7.2

doc = new_document()
for s in doc.sections:
    s.top_margin = Cm(1.9)
    s.bottom_margin = Cm(1.6)
    s.left_margin = Cm(2.1)
    s.right_margin = Cm(1.9)

doc.styles["Normal"].font.size = Pt(BODY)
doc.styles["Normal"].paragraph_format.space_after = Pt(5)

footer_page_numbers(doc, "AI and Manual Penetration Testing — Full Report")


def h1(text):
    p = doc.add_heading(level=1)
    r = p.add_run(text)
    r.font.size = Pt(14)
    r.font.name = "Calibri"
    r.font.color.rgb = ACCENT
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    return p


def h2(text):
    p = doc.add_heading(level=2)
    r = p.add_run(text)
    r.font.size = Pt(11)
    r.font.name = "Calibri"
    r.font.color.rgb = ACCENT
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    return p


def p(text, size=BODY, space=4, italic=False, align=None):
    para = doc.add_paragraph()
    para.paragraph_format.space_after = Pt(space)
    para.paragraph_format.line_spacing = 1.04
    add_runs(para, text, size=size, italic=italic)
    if align:
        para.alignment = align
    return para


def bl(text, size=BODY):
    para = doc.add_paragraph(style="List Bullet")
    para.paragraph_format.space_after = Pt(1.5)
    para.paragraph_format.line_spacing = 1.03
    add_runs(para, text, size=size)
    return para


def num(text, size=BODY):
    para = doc.add_paragraph(style="List Number")
    para.paragraph_format.space_after = Pt(1.5)
    para.paragraph_format.line_spacing = 1.03
    add_runs(para, text, size=size)
    return para


def code(text, cap=None):
    return code_block(doc, text, size=CODE, caption=cap)


def tbl(headers, rows, widths):
    return table(doc, headers, rows, widths=widths, size=SMALL, keep_together=True)


# ======================================================================
# TITLE PAGE
# ======================================================================

for _ in range(2):
    doc.add_paragraph()

p1 = doc.add_paragraph()
r = p1.add_run("AI and Manual Penetration Testing:\nA Measured Comparison on a Live Web Application, "
               "Set Against Industry Evidence")
r.bold = True
r.font.size = Pt(21)
r.font.color.rgb = ACCENT
p1.paragraph_format.space_after = Pt(10)
p1.paragraph_format.line_spacing = 1.12

p2 = doc.add_paragraph()
r = p2.add_run("A case study of the AI Smartphone Security Simulator, with a review of "
               "what agentic security testing has achieved in production environments")
r.font.size = Pt(12)
r.italic = True
r.font.color.rgb = GREY
p2.paragraph_format.space_after = Pt(26)

meta = [
    ("Author", "[Student name]"),
    ("Student ID", "[Student ID]"),
    ("Module", "[Module code and title]"),
    ("Institution", "[University / Department]"),
    ("Supervisor", "[Supervisor]"),
    ("Report date", "24 November 2026"),
    ("Version", "3.0 (full edition)"),
    ("Length", "Full report — supersedes the 8-page and 32-page editions"),
]
t = doc.add_table(rows=0, cols=2)
for k, v in meta:
    cells = t.add_row().cells
    r1 = cells[0].paragraphs[0].add_run(k)
    r1.bold = True
    r1.font.size = Pt(10)
    r1.font.color.rgb = ACCENT
    r2 = cells[1].paragraphs[0].add_run(v)
    r2.font.size = Pt(10)
    cells[0].width = Cm(3.6)
    cells[1].width = Cm(12.0)

doc.add_paragraph()
p3 = doc.add_paragraph()
r = p3.add_run("Target system: https://shekin.tail97139a.ts.net  ·  Node.js 22 / Express 5  ·  "
               "PostgreSQL 18  ·  Caddy 2  ·  Tailscale Funnel")
r.font.size = Pt(9)
r.font.color.rgb = GREY

p4 = doc.add_paragraph()
r = p4.add_run("Engines compared: deterministic scripted suite (12 checks) · in-container LLM agent "
               "(two-count measurement) · Shannon 3.6.1 multi-agent pipeline · manual source review")
r.font.size = Pt(9)
r.font.color.rgb = GREY

page_break(doc)


# ======================================================================
# ABSTRACT
# ======================================================================

h1("Abstract")

p("This report measures how well automated and AI-driven security testing performs against manual "
  "testing, on a web application built and controlled for the purpose, and then places that result "
  "against the published evidence of what the same techniques have achieved in production systems at "
  "Google, Microsoft, Anthropic, OpenAI and DARPA's AI Cyber Challenge. The target is a Node.js/Express "
  "system exposing two deliberately vulnerable applications behind password and TOTP authentication, "
  "published through a Tailscale Funnel. Twelve scripted checks established ground truth in 41 "
  "seconds: nine controls held and three weaknesses were confirmed — a broken object-level "
  "authorisation flaw disclosing fifteen students' tuition records, an account lockout whose failure "
  "counter resets at its own threshold, and a SQL injection in a teaching endpoint.")

p("On this target the manual and deterministic approaches outperformed the AI agent decisively. The "
  "scripted suite reported 3 of 3 ground-truth findings with no false positives; the LLM agent "
  "detected 1 and reported 0; the multi-agent pipeline analysed 2 but produced no consolidated report. "
  "The agent's failure was not one of reasoning power: it retrieved another user's record, tested a "
  "negative case and then a positive one, and discarded its own correct conclusion for want of a "
  "baseline against which to compare. The pipeline reached exploitation but could not complete it, "
  "first because five defects in the test harness blocked authentication, and finally because the model "
  "account held no credit.")

p("That negative result is not in tension with the industry evidence; it is explained by it. Where AI "
  "has beaten human testers in production, three conditions were present: a harness that converts "
  "observations into verdicts, a validation loop that suppresses false positives, and scale that "
  "humans cannot match. An agent placed against ten professional pentesters on a live 8,000-host "
  "university network placed second and beat nine of them, but submitted more false positives "
  f"{c('artemis')}. Microsoft's MDASH harness found sixteen previously unknown Windows "
  "vulnerabilities including four critical remote code execution flaws, and scored 21 of 21 on planted "
  f"bugs with zero false positives {c('ms_mdash')}. XBOW matched a principal pentester's 40-hour "
  f"assessment in 28 minutes and reached first place on HackerOne's US leaderboard {c('xbow_top1')}. "
  "In each case the capability came from the system around the model, not the model alone.")

p("The report argues that the decisive variable is the presence of an oracle — a deterministic "
  "predicate that converts an observation into a verdict — and that the correct reading of the "
  "evidence is complementarity rather than replacement. Manual testing supplies judgement and intent; "
  "AI supplies coverage, speed and tireless repetition; the harness supplies the trust that makes "
  "either usable as evidence.")

pe = doc.add_paragraph()
r = pe.add_run("Keywords: ")
r.bold = True
r.font.size = Pt(9.5)
r = pe.add_run("penetration testing; AI agents; large language models; broken object-level "
               "authorisation; SQL injection; authentication; CVSS; empirical comparison; "
               "agentic security testing.")
r.italic = True
r.font.size = Pt(9.5)

page_break(doc)

h1("Contents")
toc(doc)
p("Tables and code listings are numbered sequentially within the document.", size=8.5, italic=True)

page_break(doc)


# ======================================================================
# 1. INTRODUCTION
# ======================================================================

h1("1. Introduction")

h2("1.1 Context")

p(f"Penetration testing is the most direct way to establish whether a system resists attack, but it is "
  f"expensive, expert-dependent and irreducibly non-deterministic: two testers given the same target "
  f"produce different reports. The standard process models acknowledge this. NIST SP 800-115 divides "
  f"the work into planning, discovery, attack and reporting {c('nist115')}, and the Penetration Testing "
  f"Execution Standard adds pre-engagement and post-exploitation {c('ptes')}. Surveys of the field "
  f"consistently identify the same open problems — coverage, repeatability, and the difficulty of "
  f"comparing one engagement with another {c('bertoglio', 'felderer')}.")

p("Into that gap has arrived a wave of agentic security tooling making strong claims. Google's Big "
  "Sleep agent found a real exploit in SQLite that years of fuzzing had missed, and later acted on "
  f"threat intelligence to pre-empt exploitation in the wild {c('pz_bigsleep', 'google_ciso')}. "
  "Microsoft reports sixteen previously unknown Windows vulnerabilities found by a harness of more "
  f"than a hundred cooperating agents {c('ms_mdash')}. Anthropic reports more than five hundred "
  f"high-severity vulnerabilities in production open-source code, some undetected for decades "
  f"{c('anthropic_0day')}. XBOW reached first place on HackerOne's United States leaderboard, the first "
  f"autonomous system to do so {c('xbow_top1')}.")

p("Those claims are credible and documented, and they are also narrow. Each was produced by a "
  "specialist team, against a specific class of target, with a substantial engineering scaffold around "
  "the model. The question a practitioner actually faces is different: given my application, my "
  "budget and my existing process, what will AI testing find that a human would not, and what will it "
  "miss that a human would catch? That question cannot be answered from vendor case studies, because "
  "none of them reports the misses.")

h2("1.2 Aims and objectives")

p("This project answers that question in two halves. The first half is an original measurement: a lab "
  "is built whose vulnerabilities are known by construction, instrumented so every request is "
  "observable, and three engines are run against it and scored against that ground truth. The second "
  "half is a structured review of what the same techniques have achieved in real companies, with the "
  "method by which each result was obtained, so the laboratory result can be interpreted rather than "
  "generalised naively.")

p("The objectives were:")
num("**O1.** Build a deliberately vulnerable two-application system with known defects, instrumented "
    "for observation.")
num("**O2.** Implement a deterministic suite whose every verdict is backed by a captured request and "
    "response.")
num("**O3.** Run an LLM agent with tool access and record both what it claimed and what its traffic "
    "proved.")
num("**O4.** Run a multi-agent pipeline to completion, or preserve its deliverables and diagnose why "
    "it stopped.")
num("**O5.** Score all engines against ground truth on recall, false positives, time and human "
    "intervention.")
num("**O6.** Assemble the industry evidence on AI security testing, distinguishing measured results "
    "from vendor claims and from survey sentiment.")

h2("1.3 Contributions")

bl("A **reproducible comparison** of manual, deterministic and agentic testing against a target whose "
   "defects are known by construction, with the scoring rules stated rather than implied.")
bl("A **two-count measurement** for LLM agents that separates what the model asserted from what its "
   "own traffic demonstrated — a distinction invisible in single-number reporting.")
bl("A **reconciling explanation**: the laboratory negative result and the industry positive results "
   "differ by the presence of a harness, a validation loop and scale, not by model quality.")
bl("A **complete source-level analysis** of each finding, with vulnerable code, captured traffic, "
   "CVSS 3.1 vector and fix.")
bl("A **catalogue of harness defects** as a first-class result. Five faults in the test "
   "infrastructure, not the target, accounted for most engine failures observed.")
bl("An **evidence table of production deployments**, with the method and measured result for each, so "
   "claims can be checked rather than repeated.")

h2("1.4 Structure")

p("Section 2 establishes the background. Section 3 is the industry evidence chapter: what AI security "
  "testing has achieved in production, how each result was obtained, and what the head-to-head studies "
  "and market surveys show. Section 4 describes the system under test, Section 5 the methodology, and "
  "Section 6 the findings. Section 7 is the direct comparison of AI and manual testing on this target. "
  "Section 8 records the harness defects, Section 9 discusses and states threats to validity, and "
  "Section 10 concludes. Appendices carry the source-code map, the AI tooling inventory with costs, the "
  "reproduction commands and the evidence inventory.")


# ======================================================================
# 2. BACKGROUND
# ======================================================================

h1("2. Background and Related Work")

h2("2.1 Penetration testing as a process")

p(f"NIST SP 800-115 structures an assessment into planning, discovery, attack and reporting "
  f"{c('nist115')}; PTES refines this with pre-engagement and post-exploitation {c('ptes')}. Both share "
  f"a property that matters for automation: the phases are sequential and each depends on the previous "
  f"one's output. An engine that cannot authenticate never reaches the attack phase, however capable "
  f"its reasoning. This is not a theoretical concern — it is precisely how two of the three engines "
  f"failed in this study (Sections 7 and 8).")

p(f"Methodologically this report follows the discovery–attack–report spine, with planning represented "
  f"by a written scope and an in-application consent record, and reporting represented by this "
  f"document. The relevant professional standard for verification criteria is OWASP ASVS "
  f"{c('asvs')}, and for test procedure OWASP WSTG {c('wstg')}.")

h2("2.2 Broken access control")

p(f"Access control rests on two principles stated by Saltzer and Schroeder in 1975 and still cited in "
  f"every serious treatment: least privilege, and complete mediation — every access to every object "
  f"must be checked {c('saltzer')}. Broken access control has ranked first in the OWASP Top 10 since "
  f"the 2021 revision {c('owasp2021')}, and its API form, broken object-level authorisation, ranks "
  f"first in the API Security Top 10 {c('owaspapi')}. MITRE catalogues the pattern as CWE-639 "
  f"{c('cwe639')}.")

p("The pattern is frequently confused with injection and the confusion is worth naming, because it "
  "is the analytical core of this report's principal finding. An endpoint receives an object "
  "identifier from the client and uses it to look the object up. If the query is parameterised, the "
  "identifier cannot alter the SQL statement, so there is no injection. But if the query does not "
  "also constrain the object to those the caller is entitled to, the lookup succeeds for objects "
  "belonging to anyone. The vulnerability is the missing constraint, not the identifier. "
  "Parameterisation and authorisation are orthogonal controls, and the presence of the first is "
  f"routinely mistaken for the presence of the second {c('wstg')}.")

h2("2.3 Authentication, lockout and rate limiting")

p(f"NIST SP 800-63B sets out current expectations for authentication: memory-hard password hashing, "
  f"rate limiting of failed attempts, and phishing-resistant multi-factor authentication where risk "
  f"warrants it {c('nist63b')}. Hashing has moved from fast digests through bcrypt {c('provos')} to "
  f"Argon2, standardised as RFC 9106, with Argon2id recommended for resistance to both GPU and "
  f"side-channel attack {c('rfc9106')}. TOTP is specified in RFC 6238 {c('rfc6238')}.")

p(f"Online guessing is bounded by three independent mechanisms: a request rate limiter, a per-account "
  f"lockout, and a second factor. Pinkas and Sander showed that naive lockout trades brute-force "
  f"resistance for a denial-of-service vector, since an attacker can lock arbitrary accounts at will "
  f"{c('pinkas')}. The modern compromise is to slow and cap rather than to lock absolutely. The "
  f"correctness of the counter therefore matters as much as its presence: a lockout that resets its "
  f"own counter at the threshold provides a fixed budget of guesses per unit time in perpetuity, which "
  f"is materially weaker than a counter that accumulates {c('cwe307')}. This distinction is finding "
  f"F-02 in Section 6.")

p(f"Sessions are carried in cookies governed by RFC 6265 {c('rfc6265')}. Two controls matter here: "
  f"rotation of the session identifier on privilege change, which defeats fixation, and `SameSite` "
  f"scoping together with origin checking, which mitigates cross-site request forgery {c('barth2008')}.")

h2("2.4 Injection")

p(f"SQL injection arises when data crosses into the syntactic structure of a query. Halfond, Viegas "
  f"and Orso classify the attack by the mechanism used to alter the parse tree — tautologies, unions, "
  f"stacked queries, and inference over timing or error behaviour {c('halfond')}; MITRE catalogues the "
  f"weakness as CWE-89 {c('cwe89')}. The only sound defence is to keep data out of the syntax. "
  f"Escaping and blocklists attempt to enumerate dangerous characters rather than remove the "
  f"capability, and are unreliable for that reason.")

h2("2.5 The manual baseline and its limits")

p("Manual testing is the reference against which everything here is measured, so its limits deserve "
  "statement. A human tester brings intent: an understanding of what the business means by a "
  "\"payment\", why one authorisation check exists and another does not, and which of ten thousand "
  "findings would actually matter. That is not a soft skill. It is the mechanism by which false "
  "positives are suppressed and by which chains of individually minor weaknesses are recognised as a "
  "single exploitable path.")

p(f"The limits are equally real. Manual testing is expensive per unit of coverage, so it is applied "
  f"selectively: the Omdia survey finds organisations testing on average 32 per cent of their attack "
  f"surface {c('omdia')}. It is also non-reproducible — a different tester finds a different set — and "
  f"it is time-bounded, so a one-week engagement is a sample rather than a census. Horizon3's "
  f"comparison of a manual pentest against an autonomous one illustrates the coverage gap concretely: "
  f"the manual test evaluated about six hundred hosts while the autonomous assessment covered "
  f"thirty-six hundred in under three days {c('h3_trad')}.")

p("Those two paragraphs describe the trade-off that the rest of this report is about. The human "
  "supplies judgement and pays for it in coverage, repeatability and cost. Automation supplies "
  "coverage and repeatability and lacks judgement. The question is whether AI closes that gap, and if "
  "so, on which side.")

h2("2.6 AI and LLM-driven security testing: the research literature")

p(f"PentestGPT decomposes the task into reasoning, generation and parsing modules and reports "
  f"substantial improvements over unaided model use on CTF-style targets {c('pentestgpt')}. Happe and "
  f"Cito evaluate an LLM assistant inside a structured penetration-testing workflow, finding it useful "
  f"for command generation and planning while remaining unreliable for the judgement step "
  f"{c('happe')}. Cybench provides a framework for measuring these capabilities across models and "
  f"finds wide variance and sensitivity to task framing {c('cybench')}.")

p(f"Benchmarks have begun to measure exploitation specifically. CVE-Bench places agents against real "
  f"web-application vulnerabilities in realistic conditions and finds that the strongest agent "
  f"framework exploits up to 13 per cent of them, with hierarchical multi-agent designs performing "
  f"better than single agents {c('cvebench')}. That is a low absolute number and a useful corrective "
  f"to headline claims: recognising a vulnerability and exploiting it end to end remain different "
  f"tasks.")

p(f"The most directly relevant study is the ARTEMIS evaluation, the first comprehensive comparison of "
  f"AI agents against human professionals in a live enterprise environment {c('artemis')}. Ten "
  f"cybersecurity professionals were evaluated alongside six existing agents and a purpose-built "
  f"scaffold on a university network of roughly eight thousand hosts across twelve subnets. ARTEMIS "
  f"placed second overall, discovering nine valid vulnerabilities with an 82 per cent valid submission "
  f"rate, outperforming nine of the ten humans. It was also more prone to false positives, and it "
  f"struggled with GUI-based tasks. Both halves of that sentence matter, and Section 3.3 returns to "
  f"them.")

p(f"A recent harness study on Active Directory exploitation adds the mechanism behind those numbers. "
  f"Direct prompting of nine frontier models produced false-positive rates of 28–47 per cent, "
  f"primarily from hallucinated tool output and unvalidated claims; the same models inside a "
  f"three-layer validation harness achieved 90–97 per cent precision {c('ad_harness')}. The model did "
  f"not change. The scaffold did.")

h2("2.7 Why a laboratory measurement is still necessary")

p("Every study above shares a limitation from the perspective of a practitioner: the target is either "
  "synthetic, or a CTF, or a production system whose full defect list is unknown even to its owners. "
  "That last point is not pedantry. If an AI system reports nine vulnerabilities in a production "
  "network, the finding is real but the recall is unknowable — nobody can enumerate the vulnerabilities "
  "that were not reported. The ARTEMIS authors are explicit about this, which is why they measure "
  "valid submission rate rather than recall.")

p("A laboratory with known defects inverts that. It cannot measure whether an engine would find the "
  "unknown, but it can measure precisely whether an engine finds the known, with no ambiguity about "
  "the denominator. That is a narrower question and a more honest one. The two designs are "
  "complementary: industry evidence establishes what is possible at scale, laboratory measurement "
  "establishes what happened here, and this report uses the first to interpret the second.")


# ======================================================================
# 3. INDUSTRY EVIDENCE
# ======================================================================

h1("3. What AI Security Testing Has Achieved in Production")

p("This chapter addresses the question directly: in real companies, with real targets, has AI testing "
  "performed better than manual testing, and if so by what method? The evidence is organised by type, "
  "because the types carry very different weight. Production deployments are case reports; head-to-head "
  "studies are experiments; surveys measure belief and adoption. A report that blends them is telling "
  "you more about marketing than about capability.")

h2("3.1 What \u201cbetter\u201d has to mean")

p("The claim 'AI performs better' is meaningless until decomposed, because the dimensions trade "
  "against one another and different tools optimise different ones. Six dimensions recur in the "
  "literature and in this study:")

tbl(["Dimension", "Definition", "Who has the advantage, per the evidence"],
    [["Breadth of coverage", "Proportion of the attack surface actually exercised",
      "AI, decisively, where the surface is large or the cadence is frequent"],
     ["Speed to result", "Wall-clock time from start to finding",
      "AI, by orders of magnitude"],
     ["Cost per finding", "Total spend divided by validated findings",
      "Mixed: AI is cheaper per host, dearer per false positive"],
     ["Precision", "Proportion of reported findings that are real",
      "Manual, unless the AI system includes a validation harness"],
     ["Recall on known defects", "Proportion of ground-truth defects found",
      "Mixed; harness-dependent, not model-dependent"],
     ["Depth and chaining", "Ability to combine minor weaknesses into an exploit path",
      "Manual today, with AI approaching it in purpose-built harnesses"]],
    widths=[3.4, 6.0, 6.2])
caption(doc, "Table 1. Six dimensions on which AI and manual security testing differ. Section 3.3 "
             "supports each entry.")

p("The purpose of the table is to make a simple point that recurs throughout the evidence: almost "
  "every claim that AI 'outperforms' humans is a claim about the first two rows, and almost every "
  "reported weakness is in the fourth and sixth. The two sets of claims are not in conflict. They "
  "describe different things.")

h2("3.2 Production deployments and what each one did")

p("The deployments below are the strongest evidence available, because each produced artefacts that "
  "the rest of the industry could inspect: a patched commit, a CVE, a public report, or a benchmark "
  "result under an agreed protocol.")

tbl(["Organisation", "System", "Target", "Measured result", "Method, stated"],
    [["Google Project Zero / DeepMind",
      "Big Sleep (formerly Naptime)",
      "SQLite source, recent commits",
      "First real-world vulnerability found by an agent: an exploitable stack buffer underflow. "
      "Fuzzing had not found it. Fixed the day it was reported, before release.",
      f"Agent reviews recent commits with a known patched bug as a starting hint; uses a debugger "
      f"and Python interpreter in a loop (Augmented Code Interpretation) {c('pz_bigsleep', 'secweek_sqlite')}"],
     ["Google",
      "Big Sleep + threat intelligence",
      "Unnamed SQLite flaw",
      "A vulnerability known only to threat actors, about to be exploited, detected and reported for "
      "patching first — described by Google as the first time an agent directly foiled an in-the-wild "
      "exploitation attempt.",
      f"Threat intelligence from GTIG guided the agent to the vulnerable code path {c('google_ciso')}"],
     ["Microsoft Security",
      "MDASH (100+ cooperating agents)",
      "Windows networking and authentication stack; 1,507-vulnerability CyberGym benchmark",
      "16 previously unknown vulnerabilities including 4 critical RCE (e.g. CVE-2026-33827 in the "
      "Windows IPv4 stack). 21 of 21 planted bugs found with zero false positives; 96% and 100% recall "
      "on five years of MSRC cases in clfs.sys and tcpip.sys; 88.45% on CyberGym, top of the "
      "leaderboard.",
      f"Specialised agents per weakness class, then an adversarial debate stage where agents argue for "
      f"and against each finding, then de-duplication {c('ms_mdash', 'ms_learn', 'cso_ms', 'secweek_ms')}"],
     ["Microsoft + GitHub",
      "MDASH on open source",
      "Six widely used open-source projects",
      "Thousands of raw AI findings reduced to 99 checked, privately reported issues with suggested "
      "fixes; maintainers fixed 55, of which 14 were in a release.",
      f"Filtering and human checking before disclosure — the noise problem handled upstream "
      f"{c('github_oss')}"],
     ["Anthropic",
      "Claude (Opus-class research builds)",
      "Production open-source codebases; browsers and operating systems",
      "More than 500 validated high-severity vulnerabilities in code that had been fuzzed for years; "
      "attack chains for Chrome V8 RCE and sandbox escape; local privilege escalation on OpenBSD, "
      "FreeBSD and Linux.",
      f"Parallel scanning agents with coverage tracking; memory-safety bugs verified with Address "
      f"Sanitizer, and a self-critique stage to filter false positives {c('anthropic_0day', 'anthropic_disc', 'anthropic_mythos')}"],
     ["OpenAI",
      "Aardvark (private beta)",
      "Internal and alpha-partner codebases",
      "92% of known and synthetically introduced vulnerabilities identified on prepared "
      "(\u201cgolden\u201d) repositories; also logic flaws, incomplete fixes and privacy issues.",
      f"Hypothesis, sandboxed validation and patching loop; continuous operation rather than "
      f"point-in-time review {c('openai_aardvark')}"],
     ["XBOW",
      "Autonomous pentester",
      "Live production bug-bounty programmes on HackerOne; 104 web-security benchmarks",
      "First autonomous system to reach #1 on HackerOne's US leaderboard (June 2025), ~1,060 "
      "vulnerability reports submitted, 6th worldwide. Matched a principal pentester's 40-hour "
      "assessment in 28 minutes on the benchmark set; broke an AES-128-CBC padding oracle in 17.5 "
      "minutes.",
      f"Fully autonomous exploitation against in-scope production targets, with human triage "
      f"upstream at the platform {c('xbow_top1', 'xbow_1060')}"],
     ["DARPA / ARPA-H",
      "AIxCC finalist cyber reasoning systems",
      "54 million lines of real critical-infrastructure code, 70 injected vulnerabilities",
      "Teams found 54 of 70 synthetic vulnerabilities and patched 43; 86% of scored synthetic "
      "vulnerabilities identified (up from 37% at the semifinal) and 68% of those patched (up from "
      "25%); 18 real, previously unknown vulnerabilities found, 11 patches supplied. Team Atlanta won "
      "with 392.76 points.",
      f"Fully autonomous operation across ~143 hours; systems had to find, prove and patch without "
      f"human help {c('darpa_results', 'aixcc_sok', 'kaist')}"],
     ["Horizon3.ai",
      "NodeZero",
      "A media company's network; a UK district council",
      "3,600 hosts assessed in under three days at 98% coverage, against ~600 hosts in the manual "
      "test; 14 file shares with over two million files including SSH and AWS keys, missed by the "
      "manual test; 75% reduction in mean time to remediation at a second customer.",
      f"Continuous autonomous exploitation with attack-path chaining; the vendor's own comparative "
      f"white paper, so treat as a case report rather than an independent trial {c('h3_trad', 'h3_jerome', 'h3_devon')}"]],
    widths=[2.6, 2.5, 2.8, 4.0, 3.7])
caption(doc, "Table 2. Production deployments, with the method by which each result was obtained. "
             "Note that every entry has a validation mechanism — a patched commit, a CVE, a benchmark "
             "protocol, or a triage queue.")

p("Three observations follow from the table. First, every strong result has an external validator. "
  "Big Sleep's SQLite bug became a commit; MDASH's sixteen became CVEs; AIxCC's results were scored "
  "against a known list. The validators are what make the claims checkable, and their absence is what "
  "makes most vendor assertions uncheckable.")

p("Second, the best results come from systems of many specialised components rather than one general "
  "agent. MDASH orchestrates more than a hundred agents, each trained on a weakness class, followed by "
  "an adversarial debate stage. Anthropic reports that running many scanning agents in parallel, and "
  "measuring each by how many *additional* vulnerabilities it contributes, substantially increases "
  f"yield {c('anthropic_disc')}. The architecture is doing the work.")

p("Third, the targets are overwhelmingly *code* rather than running applications. Big Sleep, MDASH, "
  "Aardvark and the Anthropic work all analyse source; AIxCC compiles and runs its targets but the "
  "defects are injected. This report's target is a live web application exercised over HTTP, which is "
  "the setting in which most organisations actually buy penetration testing. That difference matters "
  "and Section 3.6 returns to it.")

h2("3.3 Head-to-head measurements against human testers")

p("Case reports show what is possible. Controlled comparisons show what is typical, and the most "
  "important of these was published in 2026.")

p(f"**ARTEMIS at ICLR 2026** is the first comprehensive evaluation of AI agents against human "
  f"professionals in a live enterprise environment {c('artemis')}. The design is worth stating because "
  f"it is the thing most comparisons lack: ten cybersecurity professionals and seven AI systems — six "
  f"existing agents plus the authors' ARTEMIS scaffold — all tested the same large university network "
  f"of roughly 8,000 hosts across 12 subnets. Results were submissions, judged as valid or invalid. "
  f"ARTEMIS placed second overall, discovered nine valid vulnerabilities, achieved an 82 per cent "
  f"valid submission rate, and outperformed nine of the ten humans. Two findings temper the headline: "
  f"agents submitted more false positives than humans, and agents struggled with GUI-based tasks. The "
  f"paper gives a concrete example of the first — ARTEMIS reported default-credential success after "
  f"receiving HTTP 200 responses that were in fact redirects to the login page.")

p("That example is the most instructive sentence in the literature for present purposes, because it is "
  "exactly the failure observed in this study. An agent treated a status code as evidence of success "
  "without checking what the response actually contained. The synthetic benchmark in Section 7.2 "
  "reproduces the same mistake independently, on a different target, with a different model.")

p(f"**Semgrep's evaluation of coding agents** measured precision rather than recall, and the numbers "
  f"are sobering. Tasked against eleven popular open-source Python web applications, Claude Code "
  f"produced 46 findings at a 14 per cent true-positive rate — an 86 per cent false-positive rate — "
  f"and OpenAI Codex produced 21 findings at 18 per cent {c('semgrep')}. Around twenty of the combined "
  f"findings were high severity. Both tools found real vulnerabilities and both were extremely noisy. "
  f"Any organisation deploying them without a triage stage would drown.")

p(f"**Horizon3's prior comparison** makes the complementary point about the human baseline. Comparing "
  f"a third party's manual report against NodeZero on the same network, 22 of the 28 critical findings "
  f"in the manual report were found to have no available exploit, an assumed exploitability, or "
  f"implausible preconditions; the manual team found one host vulnerable to BlueKeep where the "
  f"automated assessment found twelve {c('h3_prior')}. Vendor-authored, and therefore to be read with "
  f"care, but consistent with the broader pattern: humans over-report plausibility, machines "
  f"over-report possibility.")

p(f"**CVE-Bench** measures the end-to-end task rather than the detection task, and finds that the "
  f"strongest agent framework exploits up to 13 per cent of real web-application vulnerabilities "
  f"{c('cvebench')}. This is the most conservative number in the literature and arguably the most "
  f"honest: recognising a vulnerability, and turning it into a working exploit against a live "
  f"application, are different achievements, and the second is much harder.")

p(f"**The Active Directory harness study** isolates the variable that explains the spread between "
  f"these results. Nine frontier models were run twice against the same targets: once with direct "
  f"prompting, once inside a three-layer validation pipeline with a belief gate, CWE-specific "
  f"validators and cross-model voting. Direct prompting produced 28–47 per cent false-positive rates, "
  f"largely from hallucinated tool output; the harness achieved 90–97 per cent precision "
  f"{c('ad_harness')}. The models were identical. Only the scaffolding differed.")

tbl(["Study", "Design", "Result", "Lesson"],
    [["ARTEMIS (ICLR 2026)", "10 professionals vs 7 agents, live 8,000-host network",
      "Agent placed 2nd, 9 valid findings, 82% valid submissions, beat 9 of 10 humans; more false "
      "positives; poor on GUI tasks", "Agents are competitive on breadth, weaker on validation"],
     ["Semgrep (2025)", "Claude Code and Codex vs 11 OSS Python web apps",
      "46 findings at 14% TPR; 21 findings at 18% TPR", "Detection without validation is unusable"],
     ["CVE-Bench (2025)", "Agents vs real web-app CVEs, zero-day and one-day",
      "Up to 13% exploitation success", "End-to-end exploitation remains hard"],
     ["AD harness (2026)", "9 frontier models, direct vs validated harness",
      "28–47% FP direct; 90–97% precision with harness", "The scaffold, not the model, sets precision"],
     ["Horizon3 (2022)", "Manual report vs autonomous, same network",
      "22 of 28 manual \u201ccritical\u201d findings had no exploit; 1 vs 12 BlueKeep hosts",
      "Humans over-report plausibility"]],
    widths=[3.2, 4.6, 5.0, 3.2])
caption(doc, "Table 3. Head-to-head and comparative measurements. Together these explain the spread "
             "in headline claims: precision is set by the validation design.")

h2("3.4 What practitioners and buyers report")

p(f"Survey evidence measures belief and adoption rather than capability, and should be read as such. "
  f"It is nonetheless the best available signal of what organisations actually experience, and it is "
  f"unusually consistent.")

tbl(["Source", "Sample", "Finding"],
    [["Omdia for Synack (2026)", "200 US security leaders",
      "95% rank pentesting a top or high priority, yet test on average only 32% of attack surface. "
      "87% have moved beyond evaluating agentic AI. Among 83 deployed adopters, 87% say it enabled "
      "testing more of the surface and 91% say more frequent testing. 69% require at least 85% "
      "accuracy against manual testing before calling it effective."],
     ["Intruder (2026)", "Security practitioners",
      "55% already use AI pentesting, 36% have tried it without scaling; largest organisations adopt "
      "most (71% at 5,000–10,000 employees). Trust turns on being able to check the work: nearly half "
      "name not seeing what was tested, or lacking proof a finding is real, as most damaging to trust."],
     ["Cobalt (2026)", "455 security leaders and practitioners",
      "Willingness to rely on full automation for all testing fell from 29% to 9% year over year; 78% "
      "report catching automated scanning tools missing critical vulnerabilities."],
     ["Cobalt Core survey (2026)", "500+ security experts",
      "98% of pentesters now use AI, and frequent use rose from 32% to 61% in a year. But only 2% "
      "trust current models to chain a known exploit into a multi-step attack unsupervised; 37% say "
      "human involvement is needed to validate scan results, up from 16%. 49% still rank human-led "
      "testing most effective for complex, high-impact vulnerabilities."],
     ["SANS (2026)", "536 practitioners, 57 leaders",
      "78% actively use AI in security strategy, up from 50%; 61% use it in red-team work, up from "
      "33% — the steepest single-year jump. Yet 63% report significant AI shortcomings in detection "
      "and response, up from 45%."],
     ["Pentest-Tools (2026)", "158 practitioners",
      "88% encounter results needing significant manual validation; 63% rank false-positive rate above "
      "cost when evaluating tools; ~30% name false positives, hallucinated exploits or fabricated "
      "findings as their biggest frustration."]],
    widths=[3.4, 3.2, 9.4])
caption(doc, "Table 4. Practitioner and buyer surveys. Adoption is high and rising; trust in "
             "unsupervised autonomy is very low.")

p("The pattern across these six surveys is consistent enough to state as a finding. Use of AI in "
  "security testing is now near-universal among practitioners — 98 per cent in Cobalt's community, 61 "
  "per cent of red teams in SANS. Willingness to *trust it unsupervised* has moved in the opposite "
  "direction, and the stated reason is always the same: the inability to verify. Cobalt's figure is "
  "the sharpest: full-automation appetite fell from 29 to 9 per cent while usage rose.")

p("That combination is not incoherent, and it is not Luddism. It is the behaviour of professionals who "
  "have discovered that these tools generate work as well as findings. Pentest-Tools quantifies the "
  "work: 88 per cent of practitioners hit findings that need significant manual validation. Semgrep "
  "quantifies the reason: a 14 per cent true-positive rate.")

h2("3.5 Synthesis: where AI genuinely wins, and where it does not")

p("Combining the deployments, the head-to-head studies and the surveys allows a defensible statement "
  "of the current division of labour.")

tbl(["Task", "Better performer", "Evidence"],
    [["Exercising a large or unfamiliar attack surface", "AI",
      "3,600 vs 600 hosts at 98% coverage; 8,000-host network explored competitively; continuous "
      f"cadence {c('h3_trad', 'artemis', 'omdia')}"],
     ["Reviewing large codebases for a specific weakness class", "AI",
      f"500+ validated high-severity findings; 16 Windows CVEs; 92% on golden repositories "
      f"{c('anthropic_0day', 'ms_mdash', 'openai_aardvark')}"],
     ["Speed and cost per host", "AI",
      f"40 hours vs 28 minutes on matched benchmarks {c('xbow_1060')}"],
     ["Finding a defect years of fuzzing missed", "AI",
      f"SQLite underflow that fuzzing did not find {c('pz_bigsleep', 'secweek_sqlite')}"],
     ["Suppressing false positives", "Human, unless harnessed",
      f"86% FPR for unharnessed agents; 90–97% precision with a validation harness "
      f"{c('semgrep', 'ad_harness')}"],
     ["Judging business impact and exploitability", "Human",
      f"22 of 28 manual \u201ccritical\u201d findings unexploitable; agents confused login redirects "
      f"with authentication success {c('h3_prior', 'artemis')}"],
     ["Chaining minor weaknesses into a real attack path", "Human, for now",
      f"Only 2% trust models to chain exploits unsupervised; 13% end-to-end exploitation on CVE-Bench "
      f"{c('cobalt_survey', 'cvebench')}"],
     ["GUI-based and multi-step interactive tasks", "Human",
      f"Agents explicitly reported as struggling with GUI tasks {c('artemis')}"]],
    widths=[5.2, 3.4, 7.4])
caption(doc, "Table 5. Current division of labour. The AI advantage is concentrated in breadth, speed "
             "and code review; the human advantage in judgement and verification.")

p("The single most important qualifier on the AI column is that every strong result came from a system "
  "with a validation mechanism. Big Sleep's output became a patch; MDASH's became CVEs after an "
  "adversarial debate stage; AIxCC's was scored against a known list; XBOW's went through a bug-bounty "
  "triage queue where a human decided validity; Semgrep's 400 findings were reviewed by a research "
  "team. There is no well-documented case of an unvalidated agent producing a trustworthy result at "
  "scale. That is the finding that this report's own experiment reproduces at laboratory scale.")

h2("3.6 What the industry evidence does not establish")

p("Three cautions are necessary, and stating them is part of using this evidence honestly.")

p("**Publication bias.** Nobody publishes the run where the agent found nothing. The deployments in "
  "Table 2 are selected from an unknown denominator, and the surveys in Table 4 are self-reported. This "
  "is precisely why the laboratory measurement in Sections 5 to 7 has value: the denominator is known.")

p("**Code versus running applications.** Big Sleep, MDASH, Aardvark and the Anthropic results are "
  "predominantly source-code analysis. Most organisations buy penetration testing of *running* "
  "applications, where authentication, session state, rate limiting and network topology intervene. "
  "This report's target is of that second kind, and the difference is not cosmetic: two of three "
  "engines here were stopped by authentication and rate limiting rather than by any weakness in "
  "reasoning.")

p("**Vendor authorship.** Several strong entries in Table 2 and Table 3 are published by the "
  "organisation whose product is being evaluated. That does not make them false — CVEs and commits can "
  "be checked — but it does mean the framing is chosen by an interested party. The independent "
  "evidence, ARTEMIS and Semgrep and CVE-Bench, is uniformly more modest than the vendor evidence.")


# ======================================================================
# 4. SYSTEM UNDER TEST
# ======================================================================

h1("4. The System Under Test")

h2("4.1 Deployment topology")

p("The lab is a single Windows host running Docker Desktop with three containers, a host-installed "
  "PostgreSQL instance, and a Tailscale Funnel publishing the application over HTTPS "
  f"{c('docker')}. Two applications share one Express process and one database, separated by an "
  "`app` column and route middleware.")

tbl(["Layer", "Component", "Version", "Exposure"],
    [["Client", "Browser or command-line HTTP client", "—", "Internet"],
     ["Edge", "Tailscale Funnel (TLS termination)", "1.x", "Public hostname, 443"],
     ["Proxy", "Caddy (`sim-caddy`)", "2-alpine", "Host port 80"],
     ["Application", "Node.js / Express (`sim-app`)", "Node 22, Express 5", "Internal 3000"],
     ["Data", "PostgreSQL", "18.3", "Host 5432"],
     ["Orchestration", "Temporal (`shannon-temporal`)", "1.7.0", "Internal"]],
    widths=[2.8, 6.4, 3.4, 3.0])
caption(doc, "Table 6. Deployment layers. The application publishes no port directly; all inbound "
             "traffic traverses Caddy.")

p("Two consequences shaped the assessment. Because every request arrives from the Caddy container, the "
  "application sees one source address for all clients, so a rate limiter keyed on address alone "
  "applies to the whole deployment rather than one client. And because TLS terminates at Tailscale, the "
  "application speaks plain HTTP — which is why the suite reports a missing redirect at the published "
  "port while the public URL is correctly served over TLS.")

h2("4.2 Applications and source inventory")

p("The **bank** application provides balances, transfers and tuition payment (`bank_user` role); the "
  "**Acadia** application provides enrolment, grades and service requests (`student` or `admin`); and "
  "a third surface, the **Attack Lab**, exposes deliberately vulnerable endpoints to authenticated "
  "users for teaching.")

tbl(["File", "Lines", "Bytes", "Role"],
    [["`server.js`", "2,880", "82,801", "Express application: auth, bank, Acadia, lab, report routes"],
     ["`school-routes.js`", "142", "21,964", "Acadia student routes"],
     ["`school-services-routes.js`", "124", "15,175", "Acadia service requests"],
     ["`schema.sql`", "154", "5,494", "Schema and seed data, including the lab table"],
     ["`tools/pentest-suite.mjs`", "1,286", "43,848", "Deterministic 12-check suite"],
     ["`tools/ai-agent.mjs`", "885", "29,986", "In-container LLM agent and harness"],
     ["`tools/shannon-bridge.mjs`", "674", "20,436", "Bridge between the app and Shannon"]],
    widths=[5.2, 2.0, 2.2, 6.6])
caption(doc, "Table 7. Source inventory. The container image was verified to contain the same "
             "82,801-byte `server.js`; an earlier build had silently copied a 73,728-byte truncated "
             "copy and crash-looped.")

h2("4.3 Controls present, and deliberate vulnerabilities")

p(f"The lab is vulnerable in specific documented places and implements expected controls elsewhere. "
  f"Those controls were tested rather than assumed: Argon2id hashing {c('provos', 'rfc9106')}, TOTP "
  f"with secrets encrypted at rest using AES-256-GCM {c('rfc6238')}, session regeneration after "
  f"authentication, `HttpOnly` and `SameSite=strict` cookies {c('rfc6265')}, Helmet headers including "
  f"CSP {c('stamm')}, and HSTS {c('rfc6797')}.")

p("Three design decisions bound the deliberate vulnerabilities. The SQL injection endpoint is gated "
  "behind `LAB_VULNERABLE_MODE` and an MFA-verified session. Its query pins the row set to one "
  "application through a materialised common table expression and runs inside a read-only transaction, "
  "so injection is real but contained. By contrast, the tuition lookup is not gated at all: it is "
  "ordinary application code and would be exploitable in any deployment, which is why it carries the "
  "highest practical significance here.")


# ======================================================================
# 5. METHODOLOGY
# ======================================================================

h1("5. Methodology")

h2("5.1 Scope, authorisation and rules of engagement")

p("The target is a training lab owned and operated by the author, so authorisation is inherent. The "
  "assessment was an authenticated black-box test supplemented by source review. In scope: the "
  "hostname, the Express source and the PostgreSQL schema. Out of scope: the host operating system, "
  "the Tailscale network itself, and third-party services.")

p("Three rules constrained the work. Requests were paced so the authentication limiter was never "
  "exhausted deliberately — the point was to measure whether the limiter works, not to weaponise it. "
  "Each finding required two independent confirmations: a runtime observation plus either a "
  "source-level explanation or a second engine's agreement. And every engine was given the same "
  "credentials, so differences in outcome could not be attributed to differences in access.")

h2("5.2 The manual baseline")

p("The manual approach in this study means source review by the author, augmented by targeted runtime "
  "confirmation — the ordinary work of a human tester on a codebase they can read. It produced the "
  "first identification of every defect reported in Section 6, and it is the baseline against which "
  "the automated engines are measured. Its cost is recorded honestly: it took several hours spread "
  "across the build of the lab, and every automated finding was ultimately confirmed by a manual "
  "request.")

h2("5.3 The deterministic suite")

p("`tools/pentest-suite.mjs` is a dependency-free Node script of 1,286 lines implementing twelve "
  "checks. Its design principle is that every verdict must be backed by a captured request and "
  "response, so the generated report quotes traffic rather than asserting a conclusion. Each check "
  "returns **passed**, **vulnerable** or **inconclusive**; the third state exists so a check that "
  "cannot reach a verdict does not silently count as a pass — a distinction many scanners collapse.")

tbl(["#", "Check", "Establishes"],
    [["1–3", "Security headers, cookie flags, anonymous access",
      "Helmet active; `HttpOnly`/`SameSite`/`Secure`; unauthenticated callers rejected"],
     ["4–5", "Cross-application access; vertical privilege", "Tenant and role separation holds"],
     ["6", "Tuition object authorisation", "Another user's tuition record is not readable"],
     ["7–8", "MFA brute-force resistance; login enumeration", "Lockout persists; no account oracle"],
     ["9–10", "Session rotation; registration role control", "Identifier changes; no privilege escalation"],
     ["11–12", "Authentication rate limiting; HTTPS enforcement", "Throttled; plain HTTP redirected"]],
    widths=[1.4, 5.6, 8.6])
caption(doc, "Table 8. The twelve deterministic checks, grouped. Checks 6, 7 and 12 returned "
             "vulnerable on the recorded run.")

p("Checks 4, 5 and 6 form a deliberate triad: 4 and 5 are vertical and cross-tenant controls that "
  "hold, while 6 is a horizontal control within one tenant that does not. Reporting them together "
  "shows that authorisation is not uniformly broken, which is more accurate and more useful than "
  "'authorisation is vulnerable'.")

h2("5.4 The LLM agent and the two-count measurement")

p("`tools/ai-agent.mjs` gives an LLM exactly three tools: `http_request` to perform a GET or POST, "
  "`record_finding` to assert a vulnerability, and `finish` to end the run. The model receives the "
  "base URL and credentials, chooses its own requests, and every tool call is logged. The narrow "
  "surface makes the measurement possible: every action is an auditable call rather than arbitrary "
  "code.")

p("The harness implements a **two-count measurement**. *Claimed* is the number of findings the model "
  "asserts in its final message. *Detected* is the number the harness can confirm from responses the "
  "model actually received. The distinction matters because a model's final message is a summary of "
  "its own reasoning, and reasoning can discard correct conclusions. A single-number report — 'the "
  "agent found N vulnerabilities' — cannot distinguish an agent that looked and found nothing from one "
  "that found something and talked itself out of it. The recorded run exhibited the latter.")

h2("5.5 The multi-agent pipeline")

p(f"Shannon is an autonomous pipeline of specialised agents for pre-reconnaissance, reconnaissance and "
  f"per-class analysis and exploitation {c('shannon')}. It runs as a Temporal workflow and emits a "
  f"deliverable per phase. It cannot run inside the application container — there is no Docker binary "
  f"and no socket, a deliberate choice, since mounting `/var/run/docker.sock` into a public-facing "
  f"container grants effective root on the host. It therefore runs under WSL2 behind a small HTTP "
  f"bridge.")

p("Its phases were preserved whether or not the run completed, on the principle that a failed run's "
  "intermediate deliverables are evidence of what the engine understood before it failed.")

h2("5.6 Ground truth and scoring")

p("Ground truth required agreement between at least two of: source review identifying the defect, a "
  "runtime request demonstrating it, and a second engine's independent agreement. Three application "
  "vulnerabilities met that bar — F-01, F-02 and F-03. Two configuration weaknesses (F-04, F-05) are "
  "reported but excluded from the engine comparison, since no engine was asked to look for them.")

tbl(["Metric", "Definition", "Why it is reported"],
    [["Recall", "Reported findings ÷ ground-truth findings", "Measures coverage"],
     ["False positives", "Reported items that could not be reproduced", "Measures trustworthiness"],
     ["Precision", "True positives ÷ all reported", "Penalises speculative reporting"],
     ["Wall-clock time", "Start to final report", "The unit a tester actually pays"],
     ["Human interventions", "Manual steps needed to keep the run alive", "Measures real autonomy"],
     ["Cost", "Provider spend for the run", "Separates capability from affordability"]],
    widths=[3.4, 6.2, 5.6])
caption(doc, "Table 9. Scoring metrics. Human interventions and cost were added after the first run, "
             "because both proved decisive.")

h2("5.7 Controls against measurement error")

p("**Negative controls.** Every positive result was paired with a request that should fail. The Acadia "
  "enrolment endpoint binds its query to `req.session.userId`; tested with the same identifier used "
  "against the bank endpoint, it returned only the caller's own enrolments. Without that control, a "
  "200 from the bank endpoint could be explained by the record being public.")

p("**Provider independence.** The agent's column used a different provider from the pipeline's, so a "
  "single outage could not explain both results. **Preserved failure:** failed runs were archived with "
  "their logs. **Re-execution:** the host rebooted mid-assessment; the suite was re-run and reproduced "
  "its result, and findings were re-verified with a fresh session.")


# ======================================================================
# 6. FINDINGS
# ======================================================================

h1("6. Findings")

tbl(["ID", "Finding", "Severity", "Score", "Basis"],
    [["F-01", "Broken object-level authorisation, bank tuition lookup", "Medium", "6.5",
      "Runtime, reproduced"],
     ["F-02", "Account lockout counter resets at its own threshold", "Medium", "6.5",
      "Source, corroborated at runtime"],
     ["F-03", "SQL injection in `/api/lab/exploit/sqli`", "Medium", "6.5", "Runtime, reproduced"],
     ["F-04", "Plain HTTP served without redirect to HTTPS", "Low", "3.1", "Runtime, suite check"],
     ["F-05", "Authentication responses lacked `Cache-Control`", "Low", "3.1", "Source, remediated"]],
    widths=[1.3, 7.8, 1.9, 1.2, 4.4])
caption(doc, "Table 10. Confirmed findings with CVSS 3.1 base scores. Both 6.5 findings sit in the "
             "Medium band (4.0–6.9).")

p("CVSS measures the severity of a technical weakness, not its importance to the organisation. F-01 "
  "scores 6.5 because its impact is confined to confidentiality of one record class. It is nonetheless "
  "the most consequential finding, because any authenticated user can reach it with no special "
  "conditions and it discloses personal data at the scale of the student body. Priority is therefore "
  "ordered by exploitability, not by score.")

h2("6.1 F-01 — Broken object-level authorisation (Medium 6.5, CWE-639)")

p(f"The endpoint takes a student identifier from the path and binds it as the query parameter. It "
  f"validates the identifier's format but never asks whether the caller may see the record it names "
  f"{c('cwe639')}.")

code("app.get(\"/api/bank/tuition/student/:studentId\", requireApp(\"bank\"), async (req,res) => {\n"
     "  const match = /^AC([0-9]{8})$/.exec(req.params.studentId.toUpperCase());\n"
     "  if(!match) return res.status(400).json({error:\"Use a simulator student ID\"});\n"
     "  const result = await pool.query(\n"
     "    `SELECT sp.display_name, sp.tuition_cents, sp.user_id\n"
     "       FROM student_profiles sp JOIN users u ON u.id=sp.user_id\n"
     "      WHERE sp.user_id=$1 AND u.app='acadia' AND u.role='student'`,\n"
     "    [Number(match[1])]        // <- from the URL, not from the session\n"
     "  );",
     cap="Listing 1. `server.js:1449`. The query is parameterised, so it is immune to injection; it is "
         "unauthorised, because `$1` is attacker-chosen.")

p("This is the analytical core of the report. `$1` is a bound parameter, so no payload can alter the "
  "statement — this is not injection. The defect is that the value bound to `$1` came from "
  "`req.params`, which the client controls, rather than `req.session.userId`. Parameterisation and "
  f"authorisation are orthogonal controls {c('saltzer', 'owaspapi')}.")

p("**Observation.** Signed in as `scan-bank`, whose own record is `AC00000063`:")

code("GET /api/bank/tuition/student/AC00000036\n"
     "Cookie: sim.sid=<scan-bank, MFA-verified session>\n"
     "\n"
     "HTTP/1.1 200 OK\n"
     "{\"student\":{\"studentId\":\"AC00000036\",\"name\":\"jass\",\"tuitionCents\":\"125000\"}}",
     cap="Listing 2. The session belongs to `scan-bank`; the record does not.")

p("A single leaked record could be dismissed as a slip. The identifier is sequential and "
  "range-checked only for format, so the suite walked the range. Fifteen distinct records were "
  "disclosed, each with a name and outstanding balance — for example `AC00000048` (`0207602`, 405000 "
  "cents) and `AC00000050` (`0306776`, 125000 cents). One leaked record reads as a coding error; "
  "fifteen reads as the whole student body.")

p("**Remediation.** Constrain the query to rows the caller may see and return 404 for both not-found "
  "and not-yours: add `AND EXISTS (SELECT 1 FROM tuition_links tl WHERE tl.bank_user_id = $2 AND "
  "tl.student_user_id = sp.user_id)` with `$2` bound to `req.session.userId`. Replace the sequential "
  "identifier with an unguessable reference, and rate-limit the endpoint per session.")

h2("6.2 F-02 — Account lockout that never accumulates (Medium 6.5, CWE-307)")

p(f"The failure handler resets the counter at the same moment it sets the lock, so the counter can "
  f"never exceed two {c('cwe307')}.")

code("UPDATE users\n"
     "   SET failed_attempts = CASE WHEN failed_attempts >= 2 THEN 0        -- resets at the threshold\n"
     "                             ELSE failed_attempts + 1 END,\n"
     "       locked_until   = CASE WHEN failed_attempts >= 2\n"
     "                             THEN now() + interval '30 seconds' ELSE NULL END\n"
     " WHERE id=$1;",
     cap="Listing 3. `server.js:631`. Both CASE expressions read the same pre-update value, so the "
         "counter and the lock are set from one state and the counter is discarded.")

p(f"Two wrong passwords set a 30-second lock and reset the counter to zero. When the lock expires the "
  f"account has a fresh budget of two attempts, and the cycle repeats indefinitely: roughly 240 guesses "
  f"per hour, with no escalation and no durable lockout {c('pinkas')}. For a weak or reused password "
  f"this converts an infeasible search into a matter of patience, and it is worse than no lockout at "
  f"all, because an operator reading the schema would conclude lockout is implemented.")

p("The suite's `mfa-brute-force` check independently observed the lock releasing after about 31 "
  "seconds across repeated cycles. That check sees the behaviour from outside and cannot explain it; "
  "the source explains it. One root cause, reported once. The fix is to increment unconditionally and "
  "let the lock duration grow, clearing both fields only on success.")

h2("6.3 F-03 — SQL injection in the teaching endpoint (Medium 6.5, CWE-89)")

p(f"The endpoint demonstrates the difference between a parameterised and a concatenated query, running "
  f"both against the same input in one read-only transaction {c('halfond', 'cwe89')}.")

code("// The correctly written query: the payload is data, never syntax.\n"
     "const safe   = await client.query(`${scoped} = $2 LIMIT 5`, [target, input]);\n"
     "\n"
     "// The vulnerable query: the payload becomes part of the SQL statement.\n"
     "const unsafe = await client.query(`${scoped} = '${input}' LIMIT 5`, [target]);",
     cap="Listing 4. `server.js:1706`. `$2` is bound; `${input}` is interpolated into the statement.")

p("A tautology widens the `label` predicate: the parameterised branch compares the string literally "
  "and matches nothing, while the concatenated branch becomes `WHERE label = '' OR '1'='1'` and "
  "matches every row in scope.")

code("POST /api/lab/exploit/sqli   {\"target\":\"bank\",\"input\":\"' OR '1'='1\"}\n"
     "\n"
     "{\"protectedQuery\":{\"matches\":0}, \"vulnerableQuery\":{\"matches\":2}, \"exploited\":true,\n"
     " \"exfiltrated\":[{\"id\":\"103\",\"secret\":\"LAB-BANK-A\"},\n"
     "                {\"id\":\"104\",\"secret\":\"LAB-BANK-B\"}]}",
     cap="Listing 5. The contrast between 0 and 2 matches is the finding, not the boolean. The "
         "`school` target returns `LAB-GRADE-A` and `LAB-GRADE-B`.")

p("**Why Medium rather than High.** Four constraints bound impact, each deliberate: an MFA-verified "
  "session is required (`PR:L`), the CTE pins the row set to one application, the transaction is "
  "`BEGIN READ ONLY`, and the endpoint is gated behind `LAB_VULNERABLE_MODE`. Integrity and "
  "availability impact are None; confidentiality is High only with respect to the demonstration table.")

p("**Provenance.** The pipeline first flagged this and recorded it *validation blocked*, with the log "
  "line 'Rate limiting on /api/auth prevents obtaining MFA-verified session'. That blocker was a "
  "harness defect (Section 8), repaired, after which the injection was verified directly. The finding "
  "is real; the engine's inability to reach it was not a property of the endpoint.")

h2("6.4 F-04 and F-05, and the controls that held")

p(f"**F-04 (Low 3.1, CWE-319).** Port 80 serves the application with no redirect. HSTS is sent "
  f"(`max-age=31536000; includeSubDomains`) {c('rfc6797')}, so a browser that has seen the HTTPS "
  f"response will not fall back, but a first visit over `http://` is cleartext {c('cwe319')}. Because "
  f"TLS terminates at Tailscale this affects the container's port, not the public hostname.")

p(f"**F-05 (Low 3.1, CWE-525).** Helmet does not set `Cache-Control` and the auth routes set none of "
  f"their own, so responses describing session and MFA state were cacheable {c('express', 'cwe525')}. "
  f"Remediated with `no-store` and `Pragma: no-cache` on the whole `/api/auth` prefix, confirmed live "
  f"and again after reboot.")

tbl(["Control tested", "Result", "Mechanism"],
    [["Student session against admin routes", "403", "Role check in route middleware"],
     ["Bank session reading Acadia data", "Refused", "`requireApp` plus `app` column scoping"],
     ["Injection in transfer, Acadia and school routes", "Not vulnerable", "Parameterised statements"],
     ["Terminal command injection", "Blocked", "Allowlist, `shell:false`, metacharacter rejection"],
     ["Password storage / TOTP at rest", "Argon2id / AES-256-GCM", "`argon2.verify`, external key"],
     ["Session fixation / cookie flags", "Defeated / correct", "`regenerate()`; HttpOnly, SameSite, Secure"],
     ["Login enumeration / registration escalation", "Resisted / blocked", "Uniform error; server-side role check"]],
    widths=[6.4, 3.4, 5.4])
caption(doc, "Table 11. Controls tested and confirmed with live requests, not assumed.")

p("The pattern is informative. The application's injection defences are uniformly sound, while its "
  "authorisation defences fail in exactly one place. That is the opposite of what one might expect "
  "from a teaching application, and it is what makes F-01 credible rather than a laboratory artefact: "
  "a single ordinary mistake in otherwise careful code.")


# ======================================================================
# 7. AI vs MANUAL
# ======================================================================

h1("7. AI versus Manual Testing on This Target")

h2("7.1 The measured result")

tbl(["", "Manual review", "Deterministic suite", "LLM agent", "Multi-agent pipeline"],
    [["Wall-clock", "Several hours", "41 s", "3 s", "42 min (aborted)"],
     ["Ground truth reported", "3 of 3", "3 of 3", "0 of 3", "0 of 3"],
     ["Detected but unreported", "—", "0", "1", "2 (in analysis files)"],
     ["False positives", "0", "0", "0", "3 (in one run's queue)"],
     ["Recall", "100%", "100%", "0% (33% detected)", "0% (67% analysed)"],
     ["Human interventions", "n/a", "0", "0", "2 (credential repair, restart)"],
     ["Cost", "Excluded (author's time)", "£0", "≈£0.01", "≈£0.06 in failed runs"]],
    widths=[3.4, 2.6, 2.8, 2.6, 3.4])
caption(doc, "Table 12. Measured comparison on the same target, same credentials, same ground truth.")

p("On this target the manual and deterministic approaches won decisively, and the honest question is "
  "why. Three explanations were tested and two were rejected.")

p("**Rejected: the models were too weak.** The agent used for the recorded column was a current "
  "frontier-class model, and the pipeline used another. Both produced competent analysis: the pipeline "
  "correctly identified the concatenated query in F-03, the lockout logic in F-02 and the tuition "
  "authorisation gap in F-01, all from source. The reasoning was not the deficiency.")

p("**Rejected: the vulnerabilities were too subtle.** All three are textbook classes that appear in "
  "the OWASP Top 10 and in every training corpus. If a model cannot find a CWE-639 by inspection of a "
  "parameterised query bound to a path parameter, it will not find anything in that class.")

p("**Accepted: there was no oracle, and no successful authentication.** These two explain the result "
  "completely, and both are engineering failures rather than model failures.")

h2("7.2 The oracle problem, demonstrated")

p("The LLM agent's complete trajectory was three requests:")

code("[1] GET /api/bank/accounts                    -> 200\n"
     "[2] GET /api/bank/tuition/student/AC00000001  -> 404\n"
     "[3] GET /api/bank/tuition/student/AC00000034  -> 200\n"
     "\n"
     "model's final message:  \"No vulnerabilities were confirmed.\"\n"
     "harness verdict:        1 vulnerability confirmed from the responses received.",
     cap="Listing 6. Recorded agent run. Step 2 guessed an identifier that does not exist and received "
         "404; step 3 guessed one that does and received a record belonging to another user.")

p("The model did the hard part. It formed a hypothesis about object identifiers, tested a negative "
  "case, tested a positive one, and obtained a response proving an unrelated record was readable. It "
  "then discarded that conclusion, applying the heuristic that a 200 response to a GET is normal — "
  "true in general, false here.")

p("The mechanism is context, not reasoning power. The model could not establish **whose** record it had "
  "received, because it never fetched its own record for comparison. A human tester does that "
  "reflexively: you learn your own identifiers before testing anyone else's. The agent had the tool it "
  "needed and did not know it needed it.")

p(f"This is the same failure ARTEMIS reports, in a different guise: their agent treated HTTP 200 as "
  f"proof of successful default-credential authentication when the response was a redirect to the "
  f"login page {c('artemis')}. Both are failures to check what a response *means* rather than what "
  f"status it *carries*. The suite does not make this error because check 6 knows the session's own "
  f"identifier, so a record returned for a different one is a defect by construction. That is an "
  f"oracle: a deterministic predicate converting observation into verdict.")

h2("7.3 Coverage, cost and the asymmetry of prior knowledge")

p("The suite found three findings in 41 seconds; the agent found none in three requests; the pipeline "
  "found none in 42 minutes. Read naively that ordering says deterministic testing wins outright. That "
  "reading would be wrong, and the reason matters.")

p("**The suite was written by someone who already knew the answers.** Its twelve checks encode expert "
  "knowledge of this application: where the tuition endpoint is, which identifier to use, what a "
  "correct response looks like. It is not an independent tester; it is a regression test for "
  "hypotheses a human already formed. Comparing it with an agent that must discover those hypotheses "
  "compares a solution with a search.")

p("What the comparison does establish is complementarity, and the industry evidence in Section 3 "
  "confirms it at scale. The suite's advantage is cost and repeatability. The agent's advantage is "
  "that it needed no prior knowledge of the application and still reached the right endpoint in three "
  "requests. A realistic workflow uses both: the agent to generate hypotheses against unfamiliar "
  "surface, the deterministic harness to adjudicate and to guard against regression. This matches the "
  f"division of labour reported for LLM assistants in structured testing workflows {c('happe', 'pentestgpt')} "
  f"and the harness-precision findings in the Active Directory study {c('ad_harness')}.")

h2("7.4 Why the pipeline produced no report")

p("The pipeline reached exploitation — further than any previous attempt — and stopped for reasons "
  "entirely outside the target. Two causes were diagnosed in sequence. First, five defects in the test "
  "harness (Section 8) prevented its agents from authenticating; once repaired, it authenticated and "
  "completed six analysis agents. Second, the model account ran out of credit mid-run. The provider's "
  "response, captured only by interposing a logging proxy, was explicit:")

code("HTTP 402\n"
     "{\"error\":{\"message\":\"This request requires more credits, or fewer max_tokens. \"\n"
     "  \"You requested up to 65536 tokens, but can only afford 16126.\"}}\n"
     "\n"
     "HTTP 429\n"
     "{\"error\":{\"message\":\"Rate limit exceeded: free-models-per-day. \"\n"
     "  \"Add 10 credits to unlock 1000 free model requests per day\"}}",
     cap="Listing 7. The two ceilings that ended the run. Shannon records only the length of provider "
         "errors, not their text, which is why a proxy was needed to see these.")

p("Two lessons follow, and both are general. An agentic system that discards upstream error detail is "
  "undebuggable — the first two failures here produced only `errorMessageLength: 521`, and the actual "
  "cause took a proxy to find. And the economics of agentic testing are not incidental: an agent that "
  "fans out dozens of parallel calls consumes quota in a way a single-shot scanner does not, so "
  "provisioning is part of the engineering, not an afterthought.")


# ======================================================================
# 8. HARNESS DEFECTS
# ======================================================================

h1("8. Defects in the Harness")

p("Five defects were found in the test infrastructure rather than the target. They are reported as a "
  "result because each silently prevented an automated client from working, and a report omitting them "
  "would attribute engine failures to the engines.")

tbl(["Defect", "Observed effect", "Fix"],
    [["Origin guard rejected any POST without an `Origin` header",
      "Every command-line client got `403 Invalid request origin`; the pipeline's authentication agent "
      "retried for most of an hour", "Absent `Origin` allowed; mismatched still `403`"],
     ["Limiter counted successful logins and keyed on address alone",
      "All traffic arrives via Caddy, so the deployment shared one bucket; a scan exhausted it in "
      "minutes and an agent slept 910 s", "`skipSuccessfulRequests`; key is address + account"],
     ["`/api/auth/verify` has no username to key on",
      "Every user shared one MFA bucket; 30 wrong codes by anyone blocked MFA for everyone",
      "Key falls back to `req.session.pendingId`"],
     ["Lab table absent from the schema, seeded for one target",
      "The second target's variant returned nothing; a fresh deployment had no table",
      "Added to `schema.sql` with rows for both targets"],
     ["Report route accepted any `?format`",
      "`?format=pdf` appeared to succeed while serving Markdown",
      "`md` and `json` served; anything else `415`"]],
    widths=[4.4, 6.4, 4.6])
caption(doc, "Table 13. Harness defects and repairs, each verified fixed with a live request.")

p(f"The first is the most consequential. Requests without an `Origin` header are not a CSRF risk — a "
  f"browser always sends `Origin` on a cross-origin state-changing request, and `SameSite=strict` "
  f"provides a second layer {c('barth2008', 'rfc6265')}. Rejecting them blocked every legitimate "
  f"non-browser client while adding no protection a browser could not already be given. The corrected "
  f"rule keeps the check that matters: a request that **does** carry an `Origin`, and carries the wrong "
  f"one, is still refused.")

p("The second and third are the same mistake in two places: keying a limiter on a value that is not "
  "unique per client behind a reverse proxy. Both were repaired with a per-account component, which is "
  "the correct key for an authentication limiter regardless of topology — the address identifies a "
  "network path, not an account.")

p("This distribution is worth comparing with Section 3.4. The surveys report that practitioners' "
  "biggest obstacle is validation effort; here it was interoperability. Both are engineering costs "
  "that vendor capability claims omit, and both are invisible in a report that only lists findings.")


# ======================================================================
# 9. DISCUSSION
# ======================================================================

h1("9. Discussion")

h2("9.1 The reconciling hypothesis")

p("This report contains an apparent contradiction. The industry evidence shows AI systems finding "
  "vulnerabilities that human review and years of fuzzing missed, topping bug-bounty leaderboards and "
  "scoring 88 per cent on CyberGym. The laboratory evidence shows an AI agent finding nothing where a "
  "script found three things. Both are accurate.")

p("The hypothesis that reconciles them is that capability in agentic security testing is "
  "**system-level, not model-level**, and that three components carry it: an oracle that converts "
  "observation into verdict, a validation loop that suppresses false positives, and the scale at which "
  "the system can be applied. Every strong result in Section 3 has all three. Big Sleep had an oracle "
  "(does the debugger trip?), validation (a real exploit, then a patch) and scale (unlimited "
  "repetition across commits). MDASH has an oracle (does the proof-of-concept crash the build?), "
  "validation (an adversarial debate stage) and scale (a hundred agents). The ARTEMIS agent had an "
  "oracle for some tasks and not others, which is exactly why it placed second rather than first and "
  "why it produced login-redirect false positives.")

p("The laboratory agent had observations but no oracle, and the deterministic suite had an oracle for "
  "every check. That single difference predicts the entire result. It also predicts the survey "
  "findings: practitioners report high adoption and low trust because the tools generate observations "
  "faster than the organisation can adjudicate them. Pentest-Tools' figure — 88 per cent of "
  f"practitioners hitting findings that need significant manual validation {c('pentesttools')} — is the "
  "oracle shortage expressed as a workload statistic.")

h2("9.2 What this implies for the manual-versus-AI question")

p("The question 'is AI better than manual testing' has no single answer, and the evidence supports a "
  "more useful formulation: *for which task, under which conditions, with which validation?* The "
  "answer that the combined evidence supports is:")

bl("**For breadth, speed and code review at scale, AI is already better** — measurably, repeatedly, "
   f"and in production {c('h3_trad', 'ms_mdash', 'anthropic_0day', 'xbow_top1')}.")
bl("**For judgement, impact assessment and exploit chaining, humans remain better** — and the gap is "
   f"largest exactly where business context matters {c('h3_prior', 'cobalt_survey')}.")
bl("**For precision, neither is better without a harness.** Unharnessed agents run at 14–18 per cent "
   f"true-positive rates {c('semgrep')}; harnessed, 90–97 per cent {c('ad_harness')}. The harness is "
   f"the variable.")
bl("**For trust, what buyers want is the ability to check the work**, and 69 per cent set an explicit "
   f"bar of at least 85 per cent agreement with manual testing before treating agentic AI as effective "
   f"{c('omdia', 'intruder')}.")

p("The practical recommendation that follows is not 'use AI instead of manual testing'. It is to run "
  "AI where coverage is the constraint and humans where judgement is, and to invest in the harness "
  "that lets the second check the first. That is also the arrangement the most successful deployments "
  "describe: XBOW's findings go through a triage queue; Microsoft filters thousands of raw findings "
  f"down to 99 checked reports before disclosing them to maintainers {c('github_oss')}; Anthropic runs "
  f"a self-critique stage before a finding reaches an analyst {c('anthropic_ccs')}.")

h2("9.3 Threats to validity")

p(f"This is a single-case study and its conclusions should be read with the limitations that design "
  f"implies, classified following standard guidance for empirical software engineering "
  f"{c('wohlin', 'runeson')}.")

p("**Construct validity.** Recall is measured against three ground-truth findings, a narrow construct: "
  "an engine could miss every defect outside those three and still score 100 per cent. The ground "
  "truth was constructed by the author and inherits his blind spots, so a defect nobody noticed is "
  "absent from the denominator. CVSS metrics are argued in the text rather than derived mechanically.")

p("**Internal validity.** The suite was written with knowledge of the application, so its advantage "
  "over the agent is partly an artefact of prior knowledge rather than determinism. Each engine ran "
  "once per configuration, so no variance estimate exists and reliability cannot be separated from "
  "luck. The host rebooted mid-assessment; the suite was re-run and reproduced its result, but the "
  "agent and pipeline columns were not re-measured under identical conditions.")

p("**External validity.** One application, one stack, one scale. The findings do not generalise to "
  "large codebases or other frameworks. The harness defects are artefacts of this deployment's "
  "topology — a reverse proxy in front of a rate limiter — although that topology is extremely common, "
  "which is why they are reported. The credit exhaustion is specific to this account and would not "
  "affect a funded deployment.")

p("**Conclusion validity.** With one observation per engine no statistical claim is made; the "
  "comparison is descriptive. The deterministic column is supported by re-execution; the other two "
  "have no such support.")

p("**A note on the industry evidence.** Section 3 draws on vendor publications, peer-reviewed papers "
  "and surveys of unequal quality. Vendor case reports were included because CVEs and commits are "
  "independently checkable; surveys were included because adoption and trust are only measurable by "
  "self-report. Where a claim's provenance is weaker, the text says so, and Section 3.6 states what "
  "the evidence does not establish.")

h2("9.4 Implications for practice")

num("**Keep a deterministic regression suite.** It is cheap, fast, and the only approach whose result "
    "can be trusted without re-testing. Every human-confirmed finding should become a check.")
num("**Give agents a baseline before a target.** Instruct the agent to establish what normal looks "
    "like for the authenticated principal. Most authorisation defects become visible through a single "
    "comparison, and an agent that does not make it will under-report systematically.")
num("**Invest in the harness, not the model.** Precision follows validation, not parameter count: "
    "14–18 per cent true positives unharnessed, 90–97 per cent harnessed.")
num("**Treat keying as a design decision.** Behind a reverse proxy, address-based keys collapse every "
    "client into one bucket. Authentication limiters should key on the account.")
num("**Preserve failed runs and upstream errors.** A run that fails is evidence; a provider error that "
    "is logged only by length is undebuggable.")


# ======================================================================
# 10. CONCLUSIONS
# ======================================================================

h1("10. Conclusions and Future Work")

p("Five weaknesses were confirmed in the target, five defects found and repaired in the harness, and "
  "four engines — manual, deterministic, single-agent and multi-agent — measured against one ground "
  "truth. Three conclusions are supported.")

p("**First, on this target manual review and the deterministic suite beat the AI systems decisively — "
  "3 of 3 findings against 0 reported — and the reason was the absence of an oracle, not a deficiency "
  "of reasoning.** The agent obtained proof of an authorisation flaw and discarded it because it had "
  "no baseline against which to judge. A single additional instruction, to establish the caller's own "
  "identifiers first, would have converted one detected finding into one reported finding.")

p("**Second, the industry evidence shows AI performing better than human testers in production, and "
  "the same variable explains it.** An agent placed second against ten professionals on an 8,000-host "
  f"network {c('artemis')}; a harness of a hundred agents found sixteen Windows vulnerabilities "
  f"including four critical RCEs with zero false positives on planted bugs {c('ms_mdash')}; an "
  f"autonomous tester matched a principal pentester's 40 hours in 28 minutes and reached first place "
  f"on HackerOne's US leaderboard {c('xbow_top1', 'xbow_1060')}; and DARPA's finalists found 54 of 70 "
  f"injected vulnerabilities and 18 real zero-days in fully autonomous operation {c('darpa_results')}. "
  f"Every one of those systems carries an oracle, a validation loop and scale. The models are "
  f"necessary but not sufficient.")

p("**Third, the binding constraint in practice is verification, not detection.** Detection has become "
  "cheap: 88 per cent of practitioners now encounter findings that need significant manual validation, "
  f"and willingness to trust full automation fell from 29 to 9 per cent in a year {c('pentesttools', 'cobalt')}. "
  "The scarce resource is the deterministic predicate — the check, test or positive control that says "
  "whether a finding is real. That is what this project's suite provides, what MDASH's debate stage "
  "provides, and what the agent in this study lacked.")

p("Four extensions would strengthen the work: repeated trials to separate reliability from luck; a "
  "knowledge-matched comparison giving the agent the endpoint inventory the suite's author had, which "
  "would test the explanation in Section 7.3 directly; extension of ground truth to XSS and SSRF, "
  "neither of which any engine assessed here; and completion of the multi-agent pipeline on a funded "
  "model account to establish whether exploitation, once reachable, changes the reported recall. A "
  "further line of work concerns the harness defects themselves — a systematic study of how commonly "
  "automated testers are blocked by origin checks, proxy-collapsed limiters and expiring credentials "
  "would establish whether this study's distribution is typical.")

p("The overall conclusion is neither triumphalist nor sceptical. AI security testing is genuinely "
  "transformative for coverage and speed, and it is genuinely unreliable as an unsupervised judge. "
  "Organisations that treat it as a colleague to be checked will get most of the benefit; those that "
  "treat it as an oracle will get false confidence at scale. The evidence for both halves of that "
  "statement is now substantial, and the second half is the one that costs money.")

page_break(doc)


# ======================================================================
# REFERENCES
# ======================================================================

h1("References")

pr = doc.add_paragraph()
r = pr.add_run(f"{len(ALL_REFS)} sources, numbered in order of first citation. Web resources accessed "
               f"24 November 2026. Industry figures are attributed to their publisher; peer-reviewed "
               f"sources are identified by venue.")
r.font.size = Pt(8)
r.italic = True
r.font.color.rgb = GREY


def ref_entry(number, text):
    para = doc.add_paragraph()
    para.paragraph_format.left_indent = Cm(0.85)
    para.paragraph_format.first_line_indent = Cm(-0.85)
    para.paragraph_format.space_after = Pt(1.5)
    para.paragraph_format.line_spacing = 1.0
    r = para.add_run(f"[{number}]  ")
    r.font.size = Pt(7.8)
    for part in re.split(r"(\*[^*]+\*)", text):
        if not part:
            continue
        if part.startswith("*") and part.endswith("*") and len(part) > 2:
            rr = para.add_run(part[1:-1])
            rr.italic = True
        else:
            rr = para.add_run(part)
        rr.font.size = Pt(7.8)


for _i, (_key, _text) in enumerate(ALL_REFS, start=1):
    ref_entry(_i, _text)


page_break(doc)


# ======================================================================
# APPENDIX A — SOURCE CODE
# ======================================================================

h1("Appendix A. Source Code Information")

p("Line numbers refer to the committed files listed in Table 7. Finding-to-line mapping is given so a "
  "reviewer can go directly from a finding to the code.")

tbl(["File", "Responsibility", "Security-relevant contents"],
    [["`server.js`", "Middleware chain, authentication, bank routes, Acadia mounts, Attack Lab, reporting",
      "Limiter (`:213`), cache middleware (`:236`), login handler (`:545`), lockout SQL (`:631`), "
      "session rotation (`:672`), tuition lookup (`:1449`), lab SQLi (`:1669`)"],
     ["`school-routes.js`", "Acadia student routes", "All queries parameterised; scoped to the session"],
     ["`school-services-routes.js`", "Acadia service requests", "Parameterised; role checks on admin actions"],
     ["`schema.sql`", "Schema and seed data", "`lab_sqli_demo` (`:135`), users, roles, payments"],
     ["`tools/pentest-suite.mjs`", "Deterministic 12-check suite", "One function per check; three-state verdict"],
     ["`tools/ai-agent.mjs`", "LLM agent and harness", "Tools at `:266`, `:295`, `:320`; model list at `:49`"],
     ["`tools/shannon-bridge.mjs`", "HTTP bridge to the pipeline", "Workspace creation, config, polling"]],
    widths=[4.0, 5.6, 6.0])
caption(doc, "Table A1. Module map. Middleware order in `server.js` is significant: Helmet, origin guard, "
             "body parsing, session, then route middleware.")

tbl(["Finding", "Location", "Divergence"],
    [["F-01", "`server.js:1449–1464`", "Parameterised, but the parameter comes from the path; no entitlement check"],
     ["F-02", "`server.js:631–647`", "Lockout implemented, but the counter resets at the threshold"],
     ["F-03", "`server.js:1706–1717`", "One branch parameterised, one interpolated — by design, for teaching"],
     ["F-05", "`server.js:236–240`", "Now fixed: `no-store` and `no-cache` on `/api/auth`"]],
    widths=[2.2, 5.2, 8.2])
caption(doc, "Table A2. Finding-to-source map.")


# ======================================================================
# APPENDIX B — AI TOOLING INVENTORY
# ======================================================================

h1("Appendix B. AI Testing Resources Used, and Their Cost")

p("Agentic testing has an operational profile that scanners do not: it consumes provider quota in "
  "proportion to the number of tool calls, so cost and provisioning are engineering parameters rather "
  "than footnotes. This appendix records what was used, what it cost, and what failed.")

tbl(["Resource", "Role", "Detail"],
    [["Shannon 3.6.1 (Keygraph)", "Multi-agent pipeline",
      "Temporal workflow under WSL2, driven by an HTTP bridge on the host; no Docker socket in the "
      "application container by design"],
     ["Temporal 1.7.0", "Workflow engine", "Container `shannon-temporal`, port 7233, health-checked"],
     ["In-container agent (`tools/ai-agent.mjs`)", "Single-agent measurement",
      "Three tools: `http_request`, `record_finding`, `finish`; logs every call for the two-count measure"],
     ["OpenRouter", "Aggregator",
      "OpenAI-compatible endpoint; `/v1/models` is public, so its 200 response proves nothing about a "
      "credential"],
     ["`z-ai/glm-5.3-flash`", "First attempt", "1M context, tool calling verified, $0.15/$0.50 per M tokens"],
     ["`openai/gpt-oss-120b`", "Second attempt", "Reliable tool calls, $0.05/$0.25 per M tokens"],
     ["`nvidia/nemotron-3.5-lightning:free`", "Third attempt",
      "Reached the exploitation phase; free-tier cap is 50 requests/day"],
     ["Logging proxy (`C:/temp/shannon-proxy.mjs`)", "Diagnostics",
      "Caps concurrency, retries 429/5xx with backoff, logs every upstream status and error body"]],
    widths=[4.6, 3.2, 7.8])
caption(doc, "Table B1. AI tooling inventory. The proxy must run on the host, not in WSL: agents execute "
             "in worker containers where 127.0.0.1 is the container itself.")

tbl(["Attempt", "Model", "Profile", "Outcome", "Cost"],
    [["1", "`z-ai/glm-5.3-flash`", "full", "pre-recon failed after 2 m 0 s, 5 turns", "$0.0579"],
     ["2", "`openai/gpt-oss-120b`", "full", "pre-recon failed after 9 m 22 s, 19 turns", "$0.0567"],
     ["3", "`openai/gpt-oss-120b`", "full, WSL proxy", "failed at start; proxy unreachable from container", "$0.0000"],
     ["4", "`nvidia/nemotron-3.5-lightning:free`", "pipeline",
      "reached exploitation, then free daily quota", "$0.0000"]],
    widths=[1.4, 5.6, 3.4, 5.2, 2.0])
caption(doc, "Table B2. Recorded attempts. Attempts 1 and 2 failed on the provider's token-reservation "
             "check against an empty balance, not on any fault in the target.")

p("The diagnostic lesson is worth recording because it generalises. Shannon persists only the length of "
  "a provider error, not its text, so the first two failures were opaque — `errorMessageLength: 521` "
  "and then `1153`. Interposing a proxy that logged the response bodies revealed the actual causes in "
  "minutes. Any organisation running agentic testers should log upstream error bodies, or it will "
  "misattribute infrastructure failures to tool capability.")


# ======================================================================
# APPENDIX C — REPRODUCTION
# ======================================================================

h1("Appendix C. Reproduction Commands")

code("# Health, and proof the image is the build you think it is\n"
     "curl -sS -o /dev/null -w \"status=%{http_code} ttfb=%{time_starttransfer}s\\n\" \\\n"
     "  https://shekin.tail97139a.ts.net/\n"
     "docker exec sim-app wc -c /app/server.js         # expect 82801\n"
     "docker exec sim-app node --check /app/server.js  # expect no output\n"
     "\n"
     "# Deterministic suite: 12 checks, ~41 s\n"
     "node tools/pentest-suite.mjs\n"
     "\n"
     "# In-container LLM agent (key from the environment, never the repo)\n"
     "export AI_API_KEY=<provider key>\n"
     "node tools/ai-agent.mjs",
     cap="Listing C1. Suite and agent.")

code("# Sign in and complete MFA, then confirm F-01 by hand\n"
     "curl -s -c cookie.txt -X POST $BASE/api/auth/login -H 'Content-Type: application/json' \\\n"
     "  -d '{\"app\":\"bank\",\"username\":\"scan-bank\",\"password\":\"<password>\"}'\n"
     "CODE=$(node tools/totp-code.mjs <BASE32_SECRET> | grep -oE '[0-9]{6}')\n"
     "curl -s -b cookie.txt -c cookie.txt -X POST $BASE/api/auth/verify \\\n"
     "  -H 'Content-Type: application/json' -d \"{\\\"code\\\":\\\"$CODE\\\"}\"\n"
     "\n"
     "curl -s -b cookie.txt -w ' status=%{http_code}\\n' $BASE/api/bank/tuition/student/AC00000063  # own\n"
     "curl -s -b cookie.txt -w ' status=%{http_code}\\n' $BASE/api/bank/tuition/student/AC00000036  # other\n"
     "# Both return 200. That is the finding.",
     cap="Listing C2. Manual confirmation of F-01. Negative control: the same identifier against the "
         "Acadia enrolment endpoint returns only the caller's own rows.")


# ======================================================================
# APPENDIX D — EVIDENCE INVENTORY
# ======================================================================

h1("Appendix D. Evidence Inventory")

tbl(["Path", "Contents", "Supports"],
    [["`tools/out/PENTEST-REPORT.md`", "Suite report with request and response per check", "Tables 8, 11, 12"],
     ["`tools/out/findings.json`", "Machine-readable results", "Table 12"],
     ["`tools/out/AI-AGENT-REPORT.md`", "Agent transcript, claimed and detected counts", "Listing 6"],
     ["`tools/out/COMPARISON-REPORT.md`", "Engines scored against ground truth", "Table 12"],
     ["`tools/out/NMAP-REPORT.txt` / `.xml`", "Port and service scan", "Section 4.1"],
     ["`tools/out/NIKTO-REPORT.txt`, `NIKTO-CONSOLE.txt`", "7,970 requests, 0 errors, 3 findings", "Section 3.6"],
     ["`tools/out/shannon/run-42min/`", "Six analyses, four queues, `error.log`", "Section 7.4"],
     ["`tools/out/shannon/partial-run1/`", "Earlier exploitation evidence, incl. SH-06", "Section 7.4"],
     ["`tools/out/shannon/SHANNON-CONSOLIDATED-REPORT.md`", "Reconstruction of the report never produced", "Section 7.4"],
     ["`tools/out/shannon/CREDITS-BLOCKER.md`", "Provider errors, attempts, remedies", "Appendix B"]],
    widths=[6.2, 6.0, 3.4])
caption(doc, "Table D1. Evidence inventory. Every claim in Section 6 traces to one of these files.")


# ======================================================================
# APPENDIX E — GLOSSARY
# ======================================================================

h1("Appendix E. Abbreviations")

tbl(["Term", "Expansion", "Term", "Expansion"],
    [["ACI", "Augmented Code Interpretation", "LLM", "Large language model"],
     ["AIxCC", "AI Cyber Challenge (DARPA)", "MFA", "Multi-factor authentication"],
     ["ASVS", "Application Security Verification Standard", "NIST", "National Institute of Standards and Technology"],
     ["BOLA / IDOR", "Broken object-level authorisation / insecure direct object reference",
      "OWASP", "Open Worldwide Application Security Project"],
     ["CRS", "Cyber reasoning system", "PTES", "Penetration Testing Execution Standard"],
     ["CSP", "Content Security Policy", "RCE", "Remote code execution"],
     ["CSRF", "Cross-site request forgery", "SARIF", "Static Analysis Results Interchange Format"],
     ["CTF", "Capture the flag", "SQLi", "SQL injection"],
     ["CVSS", "Common Vulnerability Scoring System", "SSRF", "Server-side request forgery"],
     ["CWE", "Common Weakness Enumeration", "TOTP", "Time-based one-time password"],
     ["FPR / TPR", "False positive rate / true positive rate", "WSTG", "Web Security Testing Guide"],
     ["HSTS", "HTTP Strict Transport Security", "XSS", "Cross-site scripting"]],
    widths=[2.6, 5.4, 2.0, 5.8])
caption(doc, "Table E1. Abbreviations used in this report.")


# ======================================================================
# SAVE
# ======================================================================

doc.core_properties.title = (
    "AI and Manual Penetration Testing: A Measured Comparison on a Live Web "
    "Application, Set Against Industry Evidence"
)
doc.core_properties.subject = "Full project report — AI Smartphone Security Simulator"
doc.core_properties.author = "[Student name]"
doc.core_properties.keywords = (
    "penetration testing; AI agents; LLM; BOLA; SQL injection; CVSS; agentic security testing"
)
doc.core_properties.comments = (
    "Full edition. All measurements trace to the evidence files in Appendix D; "
    "all industry figures are attributed in the reference list."
)

doc.save(OUT)
print(f"written: {OUT}")
print(f"size:    {OUT.stat().st_size} bytes")
print(f"refs:    {len(ALL_REFS)}")

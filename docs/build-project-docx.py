#!/usr/bin/env python3
"""
Builds the Word version of the project report.

    python docs/build-project-docx.py

Output: docs/AI-Smartphone-Security-Simulator-Project-Report.docx

Every figure in this document comes from a run recorded on 24 November 2026
against the live deployment; nothing here is estimated. Where a claim rests on
source review rather than a reproduced request, the text says so.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from docx_framework import (  # noqa: E402
    ACCENT, GREY, REFS, body, bullet, c, caption, code_block, footer_page_numbers,
    heading, new_document, numbered, page_break, quote, table, toc,
)
from docx.enum.text import WD_ALIGN_PARAGRAPH  # noqa: E402
from docx.shared import Cm, Pt, RGBColor  # noqa: E402

OUT = Path(__file__).parent / "AI-Smartphone-Security-Simulator-Project-Report.docx"

doc = new_document()
footer_page_numbers(doc, "AI Smartphone Security Simulator — Penetration Test Report")


# ======================================================================
# TITLE PAGE
# ======================================================================

for _ in range(3):
    doc.add_paragraph()

p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.LEFT
r = p.add_run("An Empirical Comparison of Deterministic, LLM-Agentic and\n"
              "Multi-Agent Penetration Testing on a Deliberately\n"
              "Vulnerable Web Application")
r.bold = True
r.font.size = Pt(22)
r.font.color.rgb = ACCENT
p.paragraph_format.line_spacing = 1.15
p.paragraph_format.space_after = Pt(14)

p = doc.add_paragraph()
r = p.add_run("A case study of the AI Smartphone Security Simulator")
r.font.size = Pt(13)
r.font.color.rgb = GREY
r.italic = True
p.paragraph_format.space_after = Pt(40)

meta = [
    ("Author", "[Student name]"),
    ("Student ID", "[Student ID]"),
    ("Module", "[Module code and title]"),
    ("Institution", "[University / Department]"),
    ("Supervisor", "[Supervisor]"),
    ("Report date", "24 November 2026"),
    ("Document version", "1.0 (final)"),
    ("Classification", "Academic submission — public"),
]
t = doc.add_table(rows=0, cols=2)
for k, v in meta:
    cells = t.add_row().cells
    cells[0].text = ""
    cells[1].text = ""
    r1 = cells[0].paragraphs[0].add_run(k)
    r1.bold = True
    r1.font.size = Pt(10)
    r1.font.color.rgb = ACCENT
    r2 = cells[1].paragraphs[0].add_run(v)
    r2.font.size = Pt(10)
    cells[0].width = Cm(4.2)
    cells[1].width = Cm(11.0)

doc.add_paragraph()
p = doc.add_paragraph()
r = p.add_run(
    "Target system: https://shekin.tail97139a.ts.net  ·  Node.js 22 / Express 5  ·  "
    "PostgreSQL 18  ·  Caddy 2  ·  Tailscale Funnel"
)
r.font.size = Pt(9)
r.font.color.rgb = GREY

page_break(doc)


# ======================================================================
# ABSTRACT
# ======================================================================

heading(doc, "Abstract", 1)

body(doc,
     "This report documents an authenticated penetration test of a self-hosted training "
     "application, the AI Smartphone Security Simulator, and uses the exercise to compare "
     "three assessment approaches: a deterministic scripted suite, a large-language-model "
     "(LLM) agent operating inside the container, and a multi-agent commercial pipeline. "
     "The system under test is a Node.js/Express application exposing two deliberately "
     "vulnerable web applications — a retail bank and a student information system — behind "
     "password and time-based one-time password (TOTP) authentication, fronted by Caddy and "
     "published through a Tailscale Funnel.")

body(doc,
     "Twelve scripted checks established ground truth in 41 seconds: nine controls held and "
     "three weaknesses were confirmed — a broken object-level authorisation flaw that "
     "disclosed fifteen students' tuition records to an unrelated bank account, an account "
     "lockout whose failure counter resets at its own threshold, and a SQL injection in a "
     "teaching endpoint. The scripted suite achieved full recall (3 of 3) with no false "
     "positives. The LLM agent detected 1 of 3 and reported none: it collected conclusive "
     "evidence and then classified it as inconclusive. The multi-agent pipeline completed "
     "four analysis phases but failed during exploitation when its model provider revoked "
     "access, producing no consolidated report at all.")

body(doc,
     "A second, unplanned result is reported. Five defects in the test harness itself were "
     "identified and repaired, each of which had been silently preventing automated clients "
     "from authenticating — an origin check that rejected requests with no Origin header, a "
     "rate limiter that counted successful logins and keyed on a proxy address shared by the "
     "whole deployment, an MFA limiter with no account to key on, a demonstration table "
     "absent from the schema, and a report route that returned Markdown when asked for PDF. "
     "These failures, rather than model capability, explain most of the divergence between "
     "engines. The report argues that what separates a usable automated result from an "
     "unusable one is the presence of an oracle — a deterministic predicate that converts an "
     "observation into a verdict — and that reproducibility, not autonomy, is the property "
     "that makes a finding usable as evidence.")

p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(6)
r = p.add_run("Keywords: ")
r.bold = True
r.font.size = Pt(10)
r = p.add_run("penetration testing; broken object-level authorisation; SQL injection; "
              "authentication; large language models; security automation; CVSS; "
              "reproducibility.")
r.font.size = Pt(10)
r.italic = True

page_break(doc)


# ======================================================================
# TABLE OF CONTENTS
# ======================================================================

heading(doc, "Contents", 1)
toc(doc)
p = doc.add_paragraph()
r = p.add_run("Tables and figures are numbered sequentially and listed in place.")
r.font.size = Pt(8.5)
r.italic = True
r.font.color.rgb = GREY

page_break(doc)


# ======================================================================
# 1. INTRODUCTION
# ======================================================================

heading(doc, "1. Introduction", 1)

heading(doc, "1.1 Context and motivation", 2)

body(doc,
     f"Penetration testing remains the most direct way to establish whether a system resists "
     f"attack, but it is expensive, expert-dependent and irreducibly non-deterministic: two "
     f"testers given the same target will produce different reports. The standard process "
     f"models acknowledge this. NIST SP 800-115 divides the work into planning, discovery, "
     f"attack and reporting phases {c('nist115')}, and the Penetration Testing Execution "
     f"Standard adds pre-engagement and post-exploitation {c('ptes')}. Surveys of the field "
     f"consistently find the same open problems — coverage, repeatability and the difficulty "
     f"of comparing one engagement with another {c('bertoglio', 'felderer')}.")

body(doc,
     "Automation has long covered the discovery phase: port scanners and web scanners are "
     "mature, cheap and loud. What automation has not covered well is the judgement step — "
     "deciding whether a response constitutes a vulnerability, and what its impact is. That "
     "step is where human testers spend most of their time, and it is precisely the step that "
     "recent LLM-based agents claim to automate "
     f"{c('pentestgpt', 'happe')}.")

body(doc,
     "Claims of that kind are hard to evaluate, because evaluation requires ground truth. If "
     "an agent reports a vulnerability, the tester must independently confirm it; if the agent "
     "reports nothing, the tester cannot distinguish a secure system from a failed agent. "
     "Benchmarks built from capture-the-flag tasks address part of this "
     f"{c('cybench')}, but CTF tasks differ from production systems in an important respect: "
     "they have a flag, so success is unambiguous. Real applications have no flag.")

body(doc,
     "This project takes the complementary approach. A lab was built in which the "
     "vulnerabilities are known by construction, instrumented so that every request is "
     "logged, and then three engines were run against it and scored against that ground "
     "truth. The lab is small enough to reason about completely and realistic enough to "
     "exhibit the classes of defect that dominate real breach data "
     f"{c('owasp2021', 'owaspapi')}.")

heading(doc, "1.2 Aims and objectives", 2)

body(doc, "The aim was to determine empirically which classes of vulnerability each engine "
          "finds, at what cost, and with what reliability. The objectives were:")

numbered(doc, "**O1.** Build a deliberately vulnerable two-application system with known "
              "defects, instrumented for observation.")
numbered(doc, "**O2.** Implement a deterministic, dependency-free test suite whose every "
              "verdict is backed by a captured request and response.")
numbered(doc, "**O3.** Run an LLM agent with tool access against the same target and record "
              "both what it claimed and what its traffic proved.")
numbered(doc, "**O4.** Run a multi-agent penetration-testing pipeline against the same "
              "target and preserve its intermediate deliverables even if it fails.")
numbered(doc, "**O5.** Score all three against ground truth using recall and false-positive "
              "counts, and explain any divergence.")

heading(doc, "1.3 Contributions", 2)

body(doc, "The report makes five contributions:")

bullet(doc, "A **reproducible comparison** of three testing approaches against a system "
            "whose defects are known by construction, with the scoring method stated "
            "explicitly rather than implied.")
bullet(doc, "A **two-count measurement** for LLM agents that separates what the model "
            "asserted from what its own tool traffic demonstrated. The gap between the two "
            "is the finding, and it is invisible in single-number reporting.")
bullet(doc, "An **account of harness defects** as a first-class result. Five defects in the "
            "test infrastructure, not the target, accounted for the majority of engine "
            "failures observed. The literature rarely reports these, which biases published "
            "success rates upward.")
bullet(doc, "A **complete source-level analysis** of each confirmed finding, with the "
            "vulnerable code, the fix, and the CVSS 3.1 vector "
            f"{c('cvss')} justified metric by metric.")
bullet(doc, "A **teaching artefact**: the lab, the suite, the agent and the reports are all "
            "included, so the exercise can be repeated or marked without reconstruction.")

heading(doc, "1.4 Structure of the report", 2)

body(doc,
     "Section 2 establishes the background: penetration-testing process models, access "
     "control theory, authentication and injection defences, and prior work on LLM-driven "
     "security testing. Section 3 describes the system under test, including its source "
     "layout and trust boundaries. Section 4 sets out the methodology and the scoring rules. "
     "Section 5 presents the results, finding by finding, with code and captures. Section 6 "
     "discusses why the engines diverged and states the threats to validity. Section 7 "
     "concludes. Four appendices carry the source extracts, the reproduction commands, the "
     "evidence inventory and a glossary.")


# ======================================================================
# 2. BACKGROUND AND RELATED WORK
# ======================================================================

heading(doc, "2. Background and Related Work", 1)

heading(doc, "2.1 Penetration testing as a process", 2)

body(doc,
     f"NIST SP 800-115 structures an assessment into four phases: planning, discovery, "
     f"attack and reporting {c('nist115')}. The planning phase fixes scope and rules of "
     f"engagement; discovery enumerates hosts, services and application surface; attack "
     f"exploits what discovery found; reporting communicates result and remediation. The "
     f"PTES refines this with pre-engagement interaction and post-exploitation "
     f"{c('ptes')}. Both models share a property that matters for automation: the phases are "
     f"sequential and each depends on the previous one's output. An agent that cannot "
     f"authenticate never reaches the attack phase, no matter how capable its reasoning.")

body(doc,
     "Methodologically this project follows the discovery–attack–report spine, with the "
     "planning phase represented by a written scope and an explicit consent record in the "
     "application itself. The reporting phase is the artefact this document forms part of.")

heading(doc, "2.2 Broken access control", 2)

body(doc,
     f"Access control rests on two principles stated by Saltzer and Schroeder in 1975 and "
     f"still cited in every serious treatment: least privilege, and complete mediation — "
     f"every access to every object must be checked {c('saltzer')}. Broken access control "
     f"has ranked first in the OWASP Top 10 since the 2021 revision {c('owasp2021')}, and "
     f"its API-specific form, broken object-level authorisation (BOLA), ranks first in the "
     f"API Security Top 10 {c('owaspapi')}. MITRE catalogues the underlying pattern as "
     f"CWE-639, authorisation bypass through a user-controlled key {c('cwe639')}.")

body(doc,
     "The pattern is worth stating precisely, because it is frequently confused with "
     "injection. An endpoint receives an object identifier from the client — a path segment, "
     "a query parameter, a JSON field. It uses that identifier to look the object up. If the "
     "query is parameterised, the identifier cannot alter the SQL statement, so there is no "
     "injection. But if the query does not also constrain the object to those the caller is "
     "entitled to, the lookup succeeds for objects belonging to anyone. The vulnerability is "
     "the missing constraint, not the identifier.")

body(doc,
     "This distinction is central to finding F-01 in Section 5. The vulnerable query is "
     "fully parameterised — `WHERE sp.user_id = $1` — and is therefore immune to SQL "
     "injection. It is nonetheless vulnerable, because `$1` is bound to a value taken from "
     "the URL rather than from the session. Parameterisation and authorisation are orthogonal "
     "controls, and the presence of the first is often mistaken for the presence of the "
     f"second. The OWASP Web Security Testing Guide treats the two as separate test "
     f"categories for exactly this reason {c('wstg')}.")

heading(doc, "2.3 Authentication, lockout and rate limiting", 2)

body(doc,
     f"Authentication establishes identity; it is a precondition for authorisation, not a "
     f"substitute for it. NIST SP 800-63B sets out the current expectations: passwords hashed "
     f"with a memory-hard function, rate limiting of failed attempts, and phishing-resistant "
     f"multi-factor authentication where the risk warrants it {c('nist63b')}. Password "
     f"hashing has moved from fast general-purpose digests through bcrypt {c('provos')} to "
     f"Argon2, standardised as RFC 9106 {c('rfc9106')}. Argon2id is the recommended variant "
     f"because it resists both GPU and side-channel attacks.")

body(doc,
     f"Online guessing is bounded by three independent mechanisms: a per-request rate "
     f"limiter, a per-account lockout, and — where present — a second factor. Pinkas and "
     f"Sander showed that naive lockout trades brute-force resistance for a denial-of-service "
     f"vector, since an attacker can lock arbitrary accounts at will {c('pinkas')}; the "
     f"modern compromise is to slow and cap attempts rather than to lock absolutely. The "
     f"correctness of the counter therefore matters as much as its presence. A lockout that "
     f"resets its own counter at the threshold provides a fixed budget of guesses per unit "
     f"time in perpetuity, which is materially weaker than a counter that accumulates "
     f"{c('cwe307')}.")

body(doc,
     f"TOTP is specified in RFC 6238 {c('rfc6238')} and derives a six-digit code from a "
     f"shared secret and the current time step. It defends against password replay but not "
     f"against real-time relay, and it inherits the rate-limiting requirements of the primary "
     f"factor: a six-digit code has only one million possible values, so an unthrottled "
     f"verification endpoint is a search problem with a small search space.")

body(doc,
     f"Sessions are carried in cookies governed by RFC 6265 {c('rfc6265')}. Two controls "
     f"matter for this assessment: rotation of the session identifier on privilege change, "
     f"which defeats session fixation, and `SameSite` scoping together with origin checking, "
     f"which mitigates cross-site request forgery {c('barth2008')}.")

heading(doc, "2.4 Injection", 2)

body(doc,
     f"SQL injection arises when data crosses into the syntactic structure of a query. "
     f"Halfond, Viegas and Orso classify the attack by the mechanism used to alter the "
     f"parse tree — tautologies, union queries, stacked queries, and inference over timing or "
     f"error behaviour {c('halfond')}; MITRE catalogues the weakness as CWE-89 {c('cwe89')}. "
     f"The only sound defence is to keep data out of the syntax: parameterised statements, "
     f"where the payload is transmitted separately from the statement text and can never be "
     f"parsed as SQL. Escaping and blocklists are unreliable because they attempt to "
     f"enumerate dangerous characters rather than to remove the capability.")

body(doc,
     "Defence in depth supplements parameterisation with least privilege: a database role "
     "that can read only what the endpoint needs, and read-only transactions where the "
     "endpoint has no business writing. This project's lab endpoint uses both, which is why "
     "its injection is real but contained — a deliberate design decision discussed in "
     "Section 3.6.")

heading(doc, "2.5 Automated and LLM-driven security testing", 2)

body(doc,
     f"Recent work has applied LLMs to penetration testing with encouraging but qualified "
     f"results. PentestGPT decomposes the task into reasoning, generation and parsing "
     f"modules and reports substantial improvements over unaided model use on CTF-style "
     f"targets {c('pentestgpt')}. Happe and Cito evaluate an LLM assistant inside a "
     f"structured penetration-testing workflow and find it useful for command generation "
     f"while remaining unreliable for the judgement step {c('happe')}. Cybench provides a "
     f"framework for measuring these capabilities across models and finds wide variance and "
     f"sensitivity to task framing {c('cybench')}.")

body(doc,
     "Three gaps motivate the present study. First, most evaluations use CTF targets, where "
     "success is defined by retrieving a flag; production applications require the tester to "
     "recognise that an ordinary-looking 200 response is a vulnerability. Second, published "
     "results rarely report the operational failures — expired credentials, rate limiting, "
     "unreachable services — that dominate real engagements. Third, single-number reporting "
     "conflates what a model claimed with what it demonstrated, and the two can diverge "
     "completely, as Section 5.7 shows.")


# ======================================================================
# 3. SYSTEM UNDER TEST
# ======================================================================

heading(doc, "3. The System Under Test", 1)

heading(doc, "3.1 Deployment topology", 2)

body(doc,
     "The lab is a single Windows host running Docker Desktop with three containers, a "
     "host-installed PostgreSQL instance, and a Tailscale Funnel publishing the application "
     f"to a public HTTPS hostname {c('docker')}. Table 1 sets out the layers.")

table(doc,
      ["Layer", "Component", "Version", "Exposure"],
      [
          ["Client", "Browser or command-line HTTP client", "—", "Internet"],
          ["Edge", "Tailscale Funnel (TLS termination)", "1.x", "Public hostname, 443"],
          ["Reverse proxy", "Caddy (`sim-caddy`)", "2-alpine", "Host port 80"],
          ["Application", "Node.js / Express (`sim-app`)", "Node 22, Express 5", "Internal 3000"],
          ["Data", "PostgreSQL (`postgresql-x64-18`)", "18.3", "Host 5432"],
          ["Orchestration", "Temporal (`shannon-temporal`)", "1.7.0", "Internal"],
      ],
      widths=[3.0, 6.2, 3.4, 3.4])
caption(doc, "Table 1. Deployment layers. The application container publishes no port "
             "directly; all inbound traffic traverses Caddy.")

body(doc,
     "The topology has two consequences that shaped the assessment. Because every request "
     "arrives from the Caddy container, the application sees a single source address for all "
     "clients; any rate limiter keyed on address alone therefore applies to the entire "
     "deployment rather than to one client. And because TLS terminates at Tailscale, the "
     "application itself speaks plain HTTP, which is why the suite reports a missing "
     "HTTP-to-HTTPS redirect at the container's published port while the public URL is "
     "correctly served over TLS.")

heading(doc, "3.2 Application structure", 2)

body(doc,
     "Two applications share one Express process and one database, separated by an `app` "
     "column on the user table and by route-level middleware. The **bank** application "
     "provides account balances, transfers and tuition payment, and its users hold the "
     "`bank_user` role. The **Acadia** application provides a student portal with enrolment, "
     "grades and service requests, and its users hold the `student` or `admin` role. A third "
     "surface, the **Attack Lab**, exposes deliberately vulnerable endpoints to authenticated "
     "users for teaching purposes.")

body(doc,
     "The separation is enforced by middleware rather than by separate deployments, which "
     "makes cross-application access a meaningful test: a bank session presented to an Acadia "
     "route must be refused. That control held (Section 5.6).")

heading(doc, "3.3 Source inventory", 2)

body(doc,
     "Table 2 lists the files that constitute the system and its test tooling, with the size "
     "of each as committed. Line counts are included because they bound the source review: "
     "the manual audit covered the authentication, authorisation and lab paths, not all 2,880 "
     "lines of the server.")

table(doc,
      ["File", "Lines", "Bytes", "Role"],
      [
          ["`server.js`", "2,880", "82,801", "Express application: auth, bank, Acadia, lab, report routes"],
          ["`school-routes.js`", "142", "21,964", "Acadia student routes (enrolment, grades)"],
          ["`school-services-routes.js`", "124", "15,175", "Acadia service requests"],
          ["`schema.sql`", "154", "5,494", "Schema and seed data, including the lab table"],
          ["`tools/pentest-suite.mjs`", "1,286", "43,848", "Deterministic 12-check suite"],
          ["`tools/ai-agent.mjs`", "885", "29,986", "In-container LLM agent and harness"],
          ["`tools/shannon-bridge.mjs`", "674", "20,436", "Bridge between the app and Shannon"],
      ],
      widths=[5.4, 2.0, 2.2, 6.4])
caption(doc, "Table 2. Source inventory. Sizes are those of the committed files; the "
             "container image was verified to contain the same 82,801-byte `server.js`.")

body(doc,
     "That last point is not pedantry. During development an image build copied a truncated "
     "`server.js` — 73,728 bytes, exactly 72 KiB, cut at a buffer boundary — into the "
     "container while the host file was intact. The container entered a restart loop and the "
     "site returned 502. Every subsequent build in this project verifies the in-image file "
     "size and runs `node --check` before the container is trusted, and Section 6.4 records "
     "this as a threat to validity rather than a footnote.")

heading(doc, "3.4 Trust boundaries and request lifecycle", 2)

body(doc, "A single authenticated request traverses the following path:")

numbered(doc, "The client resolves the Funnel hostname and connects over TLS to Tailscale.")
numbered(doc, "Tailscale terminates TLS and forwards plain HTTP to Caddy on host port 80.")
numbered(doc, "Caddy applies its configuration and proxies to the application container.")
numbered(doc, "Express applies Helmet, the origin guard, body parsing and the session "
              "middleware, in that order.")
numbered(doc, "Route-level middleware checks the application (`requireApp`) and, where "
              "required, defender status.")
numbered(doc, "The handler issues one or more parameterised queries over the pool.")
numbered(doc, "The response passes back through the same chain.")

body(doc,
     "Two boundaries carry the security weight. Between steps 3 and 5, the application must "
     "not trust anything the client supplied — origin, role, application or object "
     "identifier. Between steps 5 and 6, the query must constrain rows to what the "
     "authenticated principal may see. Almost every finding in this report is a failure at "
     "one of those two points.")

heading(doc, "3.5 Security controls present in source", 2)

body(doc,
     "The lab is deliberately vulnerable in specific, documented places. Elsewhere it "
     "implements controls that a marker would expect, and those controls were tested rather "
     "than assumed. Table 3 maps each control to its mechanism and, where the line was "
     "inspected, its location.")

table(doc,
      ["Control", "Mechanism", "Location"],
      [
          ["Password storage", "Argon2id via `argon2.verify`", "`server.js:615`"],
          ["Second factor", "TOTP, RFC 6238, secret encrypted at rest with AES-256-GCM",
           "`/api/auth/verify`"],
          ["Session fixation", "`req.session.regenerate()` after password verification",
           "`server.js:672`"],
          ["Session cookie", "`HttpOnly`, `SameSite=strict`, `Secure` in production",
           "session config"],
          ["Auth rate limiting", "30 requests / 15 min, successful requests not counted",
           "`server.js:213`"],
          ["Cache handling", "`no-store` and `no-cache` on `/api/auth`", "`server.js:236`"],
          ["Transport", "HSTS `max-age=31536000; includeSubDomains`", "Helmet config"],
          ["Headers", "CSP, COOP, CORP, Referrer-Policy, no `X-Powered-By`", "Helmet config"],
          ["Command execution", "Binary allowlist, `shell:false`, metacharacter rejection",
           "terminal module"],
          ["Vulnerable-mode gate", "`LAB_VULNERABLE_MODE` must be `true`",
           "`server.js:1670`"],
      ],
      widths=[3.8, 8.0, 3.8])
caption(doc, "Table 3. Controls implemented in the target. Line numbers refer to the "
             "committed `server.js`.")

heading(doc, "3.6 Deliberate vulnerability design", 2)

body(doc,
     "Three design decisions distinguish this lab from a production system that happens to be "
     "insecure, and each is relevant to interpreting the results.")

body(doc,
     "**The vulnerabilities are gated.** The SQL injection endpoint returns 403 unless "
     "`LAB_VULNERABLE_MODE` is exactly `\"true\"`, and it requires an MFA-verified session. "
     "This means the injection cannot be reached by an unauthenticated attacker, which "
     "lowers its CVSS privileges-required metric and is stated explicitly in Section 5.4.")

body(doc,
     "**The blast radius is bounded by construction.** The lab endpoint's query pins its row "
     "set to one application through a materialised common table expression, and executes "
     "inside a `BEGIN READ ONLY` transaction. An injected `OR` can widen the match within "
     "that set but cannot escape it, and cannot write. The injection is therefore real — it "
     "returns rows a parameterised query does not — while remaining safe to run in front of "
     "a class.")

body(doc,
     "**The IDOR is not gated at all.** This is the honest weakness in the design: the "
     "tuition lookup is a genuine authorisation defect in ordinary application code, not a "
     "teaching endpoint, and it would be exploitable by any authenticated bank user in any "
     "deployment. That is why it carries the highest practical significance in the report "
     "even though its CVSS score is mid-band.")


# ======================================================================
# 4. METHODOLOGY
# ======================================================================

heading(doc, "4. Methodology", 1)

heading(doc, "4.1 Scope, authorisation and rules of engagement", 2)

body(doc,
     "The target is a training lab owned and operated by the author. Authorisation is "
     "therefore inherent, and the assessment was conducted as an authenticated black-box test "
     "supplemented by source review. In scope: the hostname "
     "`https://shekin.tail97139a.ts.net`, the Express source, and the PostgreSQL schema. Out "
     "of scope: the host operating system, the Tailscale network itself, and any third-party "
     "service.")

body(doc,
     "Two rules constrained the testing. Requests were paced so that the authentication "
     "limiter was never exhausted deliberately — the point was to measure whether the limiter "
     "works, not to weaponise it. And each finding required two independent confirmations "
     "before it entered the report: a runtime observation, and either a source-level "
     "explanation or a second engine's agreement. Findings that met only the first criterion "
     "are recorded as observations, not findings.")

heading(doc, "4.2 Authenticated session acquisition", 2)

body(doc,
     "Every interesting endpoint requires an MFA-verified session, so the first task for any "
     "engine is to authenticate. The flow is two-step: a password post returns "
     "`{\"next\":\"verify\"}` and sets a session cookie carrying a pending identity; a second "
     "post with a TOTP code promotes the session. Because the lab accounts use real TOTP, a "
     "helper prints the current code from the base32 secret so that a scripted run is not "
     "blocked waiting for a phone.")

code_block(doc,
           "curl -s -c cookie.txt -X POST https://shekin.tail97139a.ts.net/api/auth/login \\\n"
           "  -H 'Content-Type: application/json' \\\n"
           "  -d '{\"app\":\"bank\",\"username\":\"scan-bank\",\"password\":\"ScanLab!2026pass\"}'\n"
           "\n"
           "CODE=$(node tools/totp-code.mjs OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI | grep -oE '[0-9]{6}')\n"
           "\n"
           "curl -s -b cookie.txt -c cookie.txt -X POST https://shekin.tail97139a.ts.net/api/auth/verify \\\n"
           "  -H 'Content-Type: application/json' -d \"{\\\"code\\\":\\\"$CODE\\\"}\"\n"
           "# -> {\"message\":\"Authenticated\",\"app\":\"bank\",\"role\":\"bank_user\"}",
           caption="Listing 1. Acquiring an MFA-verified session from the command line.")

body(doc,
     "This sequence is also the first place the harness's own defects became visible. An "
     "early version of the origin guard rejected any POST without an `Origin` header, so "
     "every command-line client — including the multi-agent pipeline — received `403 Invalid "
     "request origin` and could never proceed past login. The defect and its fix are "
     "recorded in Section 5.8.")

heading(doc, "4.3 The deterministic suite", 2)

body(doc,
     "`tools/pentest-suite.mjs` is a dependency-free Node script of 1,286 lines implementing "
     "twelve checks. Its design principle is that every verdict must be backed by a captured "
     "request and response, so the generated report quotes the traffic rather than asserting "
     "a conclusion. Each check returns exactly one of three states: **passed**, "
     "**vulnerable**, or **inconclusive**. The third state exists so that a check which "
     "cannot reach a verdict does not silently count as a pass — a distinction that many "
     "scanners collapse, to the detriment of their users.")

body(doc, "The twelve checks are:")

table(doc,
      ["#", "Check", "What it establishes"],
      [
          ["1", "HTTP security headers", "Helmet is active and the expected headers are present"],
          ["2", "Session cookie flags", "`HttpOnly`, `SameSite`, `Secure` where applicable"],
          ["3", "Anonymous access", "Protected endpoints reject unauthenticated callers"],
          ["4", "Cross-application access", "A bank session cannot read Acadia data, and vice versa"],
          ["5", "Vertical privilege", "A student session cannot reach administrator routes"],
          ["6", "Tuition object authorisation", "Another user's tuition record is not readable"],
          ["7", "MFA brute-force resistance", "Lockout persists and resists guessing"],
          ["8", "Login enumeration", "The response does not reveal whether an account exists"],
          ["9", "Session rotation", "The session identifier changes on authentication"],
          ["10", "Registration role control", "Public registration cannot create an administrator"],
          ["11", "Authentication rate limiting", "Login attempts are throttled"],
          ["12", "HTTPS enforcement", "Plain HTTP redirects to HTTPS"],
      ],
      widths=[1.0, 5.0, 9.6])
caption(doc, "Table 4. The twelve deterministic checks. Checks 6, 7 and 12 returned "
             "vulnerable on the recorded run.")

body(doc,
     "Checks 4, 5 and 6 form a deliberate triad. Check 4 and check 5 are *vertical and "
     "cross-tenant* controls that hold; check 6 is a *horizontal* control within a single "
     "tenant that does not. Reporting them together shows that the application's "
     "authorisation is not uniformly broken, which is a more accurate and more useful "
     "statement than 'authorisation is vulnerable'.")

heading(doc, "4.4 The in-container LLM agent", 2)

body(doc,
     "`tools/ai-agent.mjs` gives an LLM exactly three tools against the live application: "
     "`http_request` (perform a GET or POST), `record_finding` (assert a vulnerability), and "
     "`finish` (end the run with a summary). The model receives the base URL and the "
     "credentials, chooses its own requests, and the harness logs every call. The recorded "
     "column in Section 5.7 was produced with `moonshotai/kimi-k3.1-pro`, selected through "
     "the `AI_MODEL` environment variable.")

body(doc,
     "The harness around the model implements a **two-count measurement**, which is the "
     "methodological contribution of this section. Two quantities are recorded separately:")

bullet(doc, "**Claimed** — the number of findings the model asserted in its final message.")
bullet(doc, "**Detected** — the number of vulnerabilities the harness can confirm from the "
            "responses the model actually received.")

body(doc,
     "The distinction matters because a model's final message is a summary of its own "
     "reasoning, and reasoning can discard correct conclusions. A single-number report — "
     "'the agent found N vulnerabilities' — cannot distinguish an agent that looked and "
     "found nothing from an agent that found something and talked itself out of it. The "
     "recorded run exhibited exactly the latter, and the two counts diverge by one.")

heading(doc, "4.5 The multi-agent pipeline", 2)

body(doc,
     f"Shannon is an autonomous penetration-testing pipeline composed of specialised agents "
     f"for pre-reconnaissance, reconnaissance, and per-vulnerability-class analysis and "
     f"exploitation {c('shannon')}. It runs as a Temporal workflow and emits a deliverable "
     f"per phase. It cannot run inside the application container — there is no Docker binary "
     f"and no socket, a deliberate design choice discussed below — so it runs under WSL2 "
     f"behind a small HTTP bridge.")

body(doc,
     "The deliberate absence of a Docker socket deserves comment, because it is a security "
     "decision rather than an oversight. Mounting `/var/run/docker.sock` into a container "
     "grants effective root on the host: the socket can be used to start a privileged "
     "container and mount the host filesystem. A public-facing web application must never "
     "have it. The consequence is that Shannon cannot containerise its own tooling from "
     "inside the app, which is why the bridge exists.")

body(doc,
     "Shannon's phases were preserved as artefacts whether or not the run completed, on the "
     "principle that a failed run's intermediate deliverables are evidence of what the engine "
     "understood before it failed. Section 5.7 reports what those artefacts contain.")

heading(doc, "4.6 Supporting manual tooling", 2)

body(doc,
     "Two conventional scanners were run to characterise the network and HTTP surface rather "
     "than the application logic. `nmap` enumerated published ports; `nikto` exercised the "
     "HTTP surface with its standard plugin set. Neither was expected to find the application "
     "defects in Section 5, and neither did — which is itself a result, since it demonstrates "
     "that conventional scanning and logic testing address disjoint parts of the surface.")

heading(doc, "4.7 Ground truth and scoring", 2)

body(doc,
     "Ground truth was constructed from three sources and required agreement between at "
     "least two: source review identifying the defect, a runtime request demonstrating it, "
     "and — where available — a second engine's independent agreement. Three application "
     "vulnerabilities met this bar: F-01, F-02 and F-03. Two further weaknesses (F-04, F-05) "
     "are reported but excluded from the engine comparison because they are configuration "
     "and header observations rather than logic defects, and neither the agent nor the "
     "pipeline was asked to look for them.")

body(doc,
     "Engines were scored on **recall** — the proportion of ground-truth findings each "
     "engine reported — and on **false positives**, the number of reported items that could "
     "not be reproduced. Precision is reported alongside because a single false positive in a "
     "small sample moves it sharply, and stating that is more honest than quoting a "
     "percentage with one significant figure.")

table(doc,
      ["Metric", "Definition", "Why it is reported"],
      [
          ["Recall", "Reported findings ÷ ground-truth findings", "Measures coverage"],
          ["False positives", "Reported items that could not be reproduced", "Measures trustworthiness"],
          ["Precision", "True positives ÷ all reported", "Penalises speculative reporting"],
          ["Wall-clock time", "Start to final report", "Measures cost in the unit a tester pays"],
          ["Human interventions", "Manual steps required to keep the run alive", "Measures real autonomy"],
      ],
      widths=[3.4, 6.4, 5.8])
caption(doc, "Table 5. Scoring metrics. Human interventions was added after the first run, "
             "because two of the three engines needed manual repair to continue.")

heading(doc, "4.8 Controls against measurement error", 2)

body(doc,
     "Four practices were adopted to avoid the common failure modes of this kind of "
     "comparison.")

body(doc,
     "**Negative controls.** Every positive result was paired with a request that should "
     "fail. The Acadia enrolment endpoint binds its query to `req.session.userId` and ignores "
     "a supplied `student_id`; it was tested with the same identifier used against the bank "
     "endpoint and correctly returned only the caller's own enrolments. Without that control, "
     "a 200 response from the bank endpoint could be explained by the record being public.")

body(doc,
     "**Provider independence.** The agent's column was measured with a model from a "
     "different provider than the one the pipeline used, so a single provider's outage could "
     "not explain both results.")

body(doc,
     "**Preserved failure.** Failed runs were archived rather than deleted, including error "
     "logs. A run that fails at 11:00 after succeeding at 10:58 is evidence about the "
     "environment, and discarding it would have hidden the cause of the pipeline's failure.")

body(doc,
     "**Re-execution after environment change.** The host rebooted during the assessment, "
     "taking the container runtime and the tunnel down. Rather than reporting the pre-reboot "
     "numbers, the suite was re-run afterwards and reproduced 9 passed, 3 vulnerable, 0 "
     "inconclusive — the same result in 41 seconds — and the individual findings were "
     "re-verified with a fresh session. The numbers in Section 5 are from the post-reboot "
     "run.")


# ======================================================================
# 5. RESULTS
# ======================================================================

heading(doc, "5. Results", 1)

heading(doc, "5.1 Summary", 2)

body(doc,
     "Five weaknesses were confirmed in the target and five defects were found and repaired "
     "in the harness. Table 6 summarises the target findings with their CVSS 3.1 base scores "
     f"{c('cvss')}; each is discussed in the subsections that follow.")

table(doc,
      ["ID", "Finding", "Severity", "Score", "Basis"],
      [
          ["F-01", "Broken object-level authorisation, bank tuition lookup", "Medium", "6.5",
           "Runtime, reproduced"],
          ["F-02", "Account lockout counter resets at its own threshold", "Medium", "6.5",
           "Source, corroborated at runtime"],
          ["F-03", "SQL injection in `/api/lab/exploit/sqli`", "Medium", "6.5",
           "Runtime, reproduced"],
          ["F-04", "Plain HTTP served without redirect to HTTPS", "Low", "3.1",
           "Runtime, suite check"],
          ["F-05", "Authentication responses lacked `Cache-Control`", "Low", "3.1",
           "Source, remediated"],
      ],
      widths=[1.4, 7.4, 2.0, 1.4, 3.4])
caption(doc, "Table 6. Confirmed findings. The two 6.5 findings sit in the Medium band "
             "(4.0–6.9); the score reflects one application's data, not the whole system.")

body(doc,
     "A note on severity is warranted, because it is a common source of confusion in "
     "academic reports. CVSS measures the severity of a technical weakness, not its "
     "importance to the organisation. F-01 scores 6.5 because its impact is confined to "
     "confidentiality of one class of record with no integrity or availability effect. It is "
     "nonetheless the most consequential finding here, because it is reachable by any "
     "authenticated user, requires no special conditions, and discloses personal data at the "
     "scale of the entire student body. Priority in Section 5.9 is therefore ordered by "
     "exploitability and blast radius rather than by score.")

heading(doc, "5.2 F-01 — Broken object-level authorisation in the tuition lookup", 2)

body(doc,
     f"**Medium · CVSS 3.1 `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N` (6.5) · CWE-639 "
     f"{c('cwe639')}**")

body(doc,
     "The endpoint accepts a student identifier in the path and uses it, unmodified, as the "
     "query parameter. It validates the identifier's *format* — eight digits prefixed with "
     "`AC` — but never asks whether the caller is entitled to the record that identifier "
     "names. Listing 2 reproduces the handler.")

code_block(doc,
           "app.get(\"/api/bank/tuition/student/:studentId\", requireApp(\"bank\"), async (req,res) => {\n"
           "  const match = /^AC([0-9]{8})$/.exec(req.params.studentId.toUpperCase());\n"
           "  if(!match) return res.status(400).json({error:\"Use a simulator student ID such as AC00000001\"});\n"
           "  try {\n"
           "    const result = await pool.query(\n"
           "      `SELECT sp.display_name, sp.tuition_cents, sp.user_id\n"
           "       FROM student_profiles sp JOIN users u ON u.id=sp.user_id\n"
           "       WHERE sp.user_id=$1 AND u.app='acadia' AND u.role='student'`,\n"
           "      [Number(match[1])]          // <- from the URL, not from the session\n"
           "    );\n"
           "    if(!result.rowCount) return res.status(404).json({error:\"Student ID not found\"});\n"
           "    const student=result.rows[0];\n"
           "    res.json({student:{studentId:'AC'+String(student.user_id).padStart(8,'0'),\n"
           "      name:student.display_name, tuitionCents:student.tuition_cents}});\n"
           "  } catch(error) {fail(res,error);}\n"
           "});",
           caption="Listing 2. `server.js:1449–1464`. The query is parameterised, so it is "
                   "immune to injection; it is unauthorised, because `$1` is attacker-chosen.")

body(doc,
     "The distinction is worth restating because it is the analytical core of this finding. "
     "`$1` is a bound parameter: no payload can alter the statement. The defect is not "
     "injection. It is that the value bound to `$1` came from `req.params`, which the client "
     "controls, instead of from `req.session.userId`, which it does not. Complete mediation "
     f"requires the check; parameterisation provides none {c('saltzer')}.")

body(doc, "**Observation.** Signed in as `scan-bank`, whose own record is `AC00000063`:")

code_block(doc,
           "GET /api/bank/tuition/student/AC00000036\n"
           "Cookie: sim.sid=<scan-bank, MFA-verified session>\n"
           "\n"
           "HTTP/1.1 200 OK\n"
           "{\"student\":{\"studentId\":\"AC00000036\",\"name\":\"jass\",\"tuitionCents\":\"125000\"}}",
           caption="Listing 3. The session belongs to `scan-bank`; the record does not.")

body(doc,
     "A single leaked record could be dismissed as a coding slip. The identifier is "
     "sequential and range-checked only for format, so the suite walked the range and counted "
     "what came back. Fifteen distinct records were disclosed, each with a name and an "
     "outstanding balance:")

code_block(doc,
           "> GET /api/bank/tuition/student/AC00000001..AC00000090   (bank session, 4 at a time)\n"
           "  15 student record(s) disclosed\n"
           "\n"
           "  AC00000034  \"0306446\"   200000\n"
           "  AC00000035  \"shekin\"    125000\n"
           "  AC00000036  \"jass\"      125000\n"
           "  AC00000048  \"0207602\"   405000\n"
           "  AC00000050  \"0306776\"   125000\n"
           "  AC00000074  \"pentest_probe_mwtt44m1\"  125000\n"
           "  ... 9 further records",
           caption="Listing 4. Enumeration result from the recorded run. Values are cents; "
                   "names are simulator data.")

body(doc,
     "Two details in that output deserve comment. The identifiers are not dense — many in "
     "the range do not resolve, which is why 90 requests yield 15 records rather than 90 — "
     "so the enumeration is cheap but not exhaustive. And records created by earlier test "
     "runs appear in the results, which shows the disclosure tracks the live user table "
     "rather than a static seed.")

body(doc,
     "**Negative control.** The Acadia enrolment endpoint takes an analogous identifier but "
     "binds its query to the session. Supplying the same `AC00000036` as a query parameter "
     "returned only the caller's own enrolments, confirming that the bank endpoint's "
     "behaviour is a defect rather than an intended feature of the lab.")

body(doc,
     "**Remediation.** Constrain the query to rows the caller may see, and distinguish "
     "not-found from not-yours only in the negative:")

code_block(doc,
           "-- Bind to the session, not the path, and require a legitimate relationship.\n"
           "SELECT sp.display_name, sp.tuition_cents, sp.user_id\n"
           "  FROM student_profiles sp\n"
           "  JOIN users u ON u.id = sp.user_id\n"
           " WHERE sp.user_id = $1                    -- still the path value\n"
           "   AND u.app = 'acadia' AND u.role = 'student'\n"
           "   AND EXISTS (SELECT 1 FROM tuition_links tl\n"
           "                WHERE tl.bank_user_id = $2   -- req.session.userId\n"
           "                  AND tl.student_user_id = sp.user_id);",
           caption="Listing 5. Requiring a payer–student link, with `$2` bound to the "
                   "session. Returning 404 for both cases avoids confirming that an "
                   "identifier exists.")

body(doc,
     "Two further hardening measures are worth adopting alongside: replace the sequential "
     "identifier with an unguessable reference so enumeration is not free, and rate-limit the "
     "endpoint per session so that bulk retrieval is detectable.")

heading(doc, "5.3 F-02 — Account lockout that never accumulates", 2)

body(doc,
     f"**Medium · CVSS 3.1 `AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N` (6.5) · CWE-307 "
     f"{c('cwe307')}**")

body(doc,
     "The password-failure handler is intended to lock an account for 30 seconds after "
     "repeated wrong passwords. It resets the counter at the same moment it sets the lock, so "
     "the counter can never exceed two. Listing 6 reproduces the statement.")

code_block(doc,
           "if (!user || !valid || !roleMatches) {\n"
           "  if (user) {\n"
           "    await pool.query(\n"
           "      `UPDATE users\n"
           "       SET failed_attempts =\n"
           "         CASE\n"
           "           WHEN failed_attempts >= 2\n"
           "           THEN 0                        -- resets at the threshold\n"
           "           ELSE failed_attempts + 1\n"
           "         END,\n"
           "       locked_until =\n"
           "         CASE\n"
           "           WHEN failed_attempts >= 2\n"
           "           THEN now() + interval '30 seconds'\n"
           "           ELSE NULL\n"
           "         END\n"
           "       WHERE id=$1`,\n"
           "      [user.id]\n"
           "    );",
           caption="Listing 6. `server.js:631–647`. The two CASE expressions read the same "
                   "pre-update value, so the counter and the lock are set from one state and "
                   "the counter is then discarded.")

body(doc,
     "The behaviour follows directly. Two wrong passwords set `locked_until` to 30 seconds "
     "ahead and `failed_attempts` to zero. Login is refused with 429 while the lock holds. "
     "When it expires the account has a fresh budget of two attempts. The cycle repeats "
     "indefinitely, giving a persistent allowance of roughly two guesses per 30 seconds, or "
     "about 240 per hour, with no escalation and no durable lockout.")

body(doc,
     "For a password with meaningful entropy this is not decisive — 240 guesses per hour "
     "against even a modest search space is slow. For a weak or reused password, or a "
     "targeted guess against a known individual, it converts an infeasible search into a "
     "matter of patience. It also means the control provides none of the protection its "
     "presence implies, which is worse than its absence: an operator reading the schema would "
     "reasonably conclude that lockout is implemented.")

body(doc,
     "**Confirmation.** The deterministic suite's `mfa-brute-force` check independently "
     "observed the lock releasing after about 31 seconds across repeated cycles. That check "
     "sees the behaviour from outside and cannot explain it; the source explains it. The two "
     "observations are of one root cause and are reported as one finding rather than two.")

body(doc,
     "**Remediation.** Never decrement or reset at the threshold. Increment unconditionally "
     "and let the lock duration grow:")

code_block(doc,
           "UPDATE users\n"
           "   SET failed_attempts = failed_attempts + 1,\n"
           "       locked_until = CASE\n"
           "         WHEN failed_attempts + 1 >= 5\n"
           "         THEN now() + (interval '1 minute' * LEAST(failed_attempts, 60))\n"
           "         ELSE NULL\n"
           "       END\n"
           " WHERE id = $1;",
           caption="Listing 7. Escalating lock: five failures trigger a one-minute lock that "
                   "doubles with each further failure, capped at an hour.")

body(doc,
     "The existing successful-login path already clears both fields, and should continue to. "
     "The per-account rate limiter remains as an independent control, so a defect in either "
     "mechanism does not leave the account unprotected by both — the principle of not "
     "depending on a single control for a single property.")

heading(doc, "5.4 F-03 — SQL injection in the teaching endpoint", 2)

body(doc,
     f"**Medium · CVSS 3.1 `AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N` (6.5) · CWE-89 "
     f"{c('cwe89')}**")

body(doc,
     "The endpoint exists to demonstrate the difference between a parameterised query and a "
     "concatenated one, and it runs both against the same input in the same read-only "
     "transaction. Listing 8 reproduces the core.")

code_block(doc,
           "const scoped = `WITH scoped AS MATERIALIZED (\n"
           "  SELECT id, label, secret FROM lab_sqli_demo WHERE target = $1\n"
           ") SELECT id, label, secret FROM scoped WHERE label`;\n"
           "\n"
           "// The correctly written query: the payload is data, never syntax.\n"
           "const safe = await client.query(`${scoped} = $2 LIMIT 5`, [target, input]);\n"
           "\n"
           "// The vulnerable query: the payload becomes part of the SQL statement.\n"
           "const unsafe = await client.query(\n"
           "  `${scoped} = '${input}' LIMIT 5`,\n"
           "  [target]\n"
           ");",
           caption="Listing 8. `server.js:1706–1717`. `$2` is bound; `${input}` is "
                   "interpolated into the statement text.")

body(doc,
     "A tautology in the input widens the `label` predicate. In the parameterised branch the "
     "string is compared literally and matches nothing; in the concatenated branch it becomes "
     "`WHERE label = '' OR '1'='1'`, which matches every row in scope.")

code_block(doc,
           "POST /api/lab/exploit/sqli\n"
           "{\"target\":\"bank\",\"input\":\"' OR '1'='1\"}\n"
           "\n"
           "{\"exploit\":\"sql_injection\",\"target\":\"bank\",\"payload\":\"' OR '1'='1\",\n"
           " \"protectedQuery\":{\"matches\":0},\n"
           " \"vulnerableQuery\":{\"matches\":2},\n"
           " \"exploited\":true,\n"
           " \"exfiltrated\":[{\"id\":\"103\",\"label\":\"Training account A\",\"secret\":\"LAB-BANK-A\"},\n"
           "                {\"id\":\"104\",\"label\":\"Training account B\",\"secret\":\"LAB-BANK-B\"}],\n"
           " \"verdict\":\"Injection succeeded: 2 row(s) leaked where a parameterised query returned 0.\"}",
           caption="Listing 9. The contrast between 0 and 2 matches is the finding, not the "
                   "boolean.")

body(doc,
     "The same request with `\"target\":\"school\"` returns `LAB-GRADE-A` and `LAB-GRADE-B`, "
     "so both applications exhibit the pattern.")

body(doc,
     "**Why the severity is Medium rather than High.** Four constraints bound the impact, "
     "and each is a deliberate design decision rather than an accident. The endpoint requires "
     "an MFA-verified session, so `PR:L` rather than `PR:N`. The materialised CTE pins the "
     "row set to one application, so an injected predicate cannot read other tables. The "
     "transaction is `BEGIN READ ONLY`, so no write is possible. And the endpoint is gated "
     "behind `LAB_VULNERABLE_MODE`, so it is absent from any deployment that has not opted "
     "in. Integrity and availability impact are therefore None; confidentiality is High only "
     "with respect to the demonstration table.")

body(doc,
     "**Provenance note.** This finding was first flagged by the multi-agent pipeline, which "
     "rated it `Confidence: MEDIUM` and recorded it as *validation blocked*, with the log "
     "line 'Rate limiting on /api/auth prevents obtaining MFA-verified session'. The "
     "rate-limit defect behind that is described in Section 5.8 and was repaired; the "
     "injection was then verified directly. The finding is real and the engine's inability to "
     "reach it was a harness fault, which is precisely the pattern this report argues is "
     "under-reported in the literature.")

body(doc,
     "**Remediation.** The concatenated branch should be removed from production builds "
     "entirely rather than gated, since a gate protects only as well as the environment "
     "variable that controls it. If the demonstration must remain available for teaching, "
     "keep it in a separate deployment with its own database role restricted to "
     "`lab_sqli_demo`, and never in the same process as the teaching application's real data.")

heading(doc, "5.5 F-04 and F-05 — Low-severity observations", 2)

body(doc,
     f"**F-04 — Plain HTTP without redirect. Low · CVSS 3.1 `AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N` "
     f"(3.1) · CWE-319 {c('cwe319')}.** The container's published port 80 serves the "
     f"application directly and issues no redirect. HSTS is sent "
     f"(`max-age=31536000; includeSubDomains`) {c('rfc6797')}, so a browser that has already "
     f"seen the HTTPS response will not fall back to cleartext, but a first visit over "
     f"`http://` is served unencrypted. Because the public entry point terminates TLS at "
     f"Tailscale, this affects the container's port rather than the public hostname. The fix "
     f"is a redirect at the edge, and it is cheap:")

code_block(doc,
           ":80 {\n"
           "    redir https://{host}{uri} permanent\n"
           "}",
           caption="Listing 10. Caddy redirect. Note that this must not be applied to the "
                   "container's own listener if Tailscale forwards plain HTTP to it — the "
                   "redirect belongs at the public edge.")

body(doc,
     f"**F-05 — Authentication responses lacked `Cache-Control`. Low · CVSS 3.1 "
     f"`AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N` (3.1) · CWE-525 {c('cwe525')}.** Helmet does "
     f"not set `Cache-Control` {c('express')}, and the authentication routes set none of "
     f"their own, so responses describing session and MFA state were cacheable by an "
     f"intermediary or by the browser. This was identified by source review and remediated "
     f"during the assessment:")

code_block(doc,
           "app.use(\"/api/auth\", (req, res, next) => {\n"
           "  res.setHeader(\"Cache-Control\", \"no-store\");\n"
           "  res.setHeader(\"Pragma\", \"no-cache\");\n"
           "  next();\n"
           "});",
           caption="Listing 11. `server.js:236–240`, applied to the whole `/api/auth` prefix "
                   "so that future routes inherit it.")

body(doc,
     "The live response now carries both headers, which was confirmed after the fix and "
     "again after the host reboot:")

code_block(doc,
           "HTTP/1.1 200 OK\n"
           "Cache-Control: no-store\n"
           "Pragma: no-cache",
           caption="Listing 12. Observed headers on `POST /api/auth/login` after remediation.")

heading(doc, "5.6 Controls verified to hold", 2)

body(doc,
     "An assessment that reports only failures is incomplete, because it gives no basis for "
     "trusting the parts of the system that were not found wanting. Table 7 lists the "
     "controls that were tested and held, with the mechanism that makes them hold.")

table(doc,
      ["Control tested", "Result", "Mechanism"],
      [
          ["Student session against admin routes", "403", "Role check in route middleware"],
          ["Bank session reading Acadia data", "Refused", "`requireApp` plus `app` column scoping"],
          ["SQL injection in `/api/bank/transfer`", "Not vulnerable", "Parameterised statements"],
          ["SQL injection in `/api/acadia/*`", "Not vulnerable", "Parameterised statements"],
          ["SQL injection in `/api/school/*`", "Not vulnerable", "Parameterised statements"],
          ["Terminal command injection", "Blocked", "Allowlist, `shell:false`, metacharacter rejection"],
          ["Password storage", "Argon2id", "`argon2.verify`"],
          ["TOTP secrets at rest", "Encrypted", "AES-256-GCM with an external key"],
          ["Session fixation", "Defeated", "`regenerate()` before privilege change"],
          ["Session cookie flags", "Correct", "`HttpOnly`, `SameSite=strict`, `Secure`"],
          ["Login enumeration", "Resisted", "Uniform `Invalid credentials` response"],
          ["Registration privilege escalation", "Blocked", "Role validated server-side"],
      ],
      widths=[6.4, 3.0, 6.2])
caption(doc, "Table 7. Controls tested and confirmed. These are results, not assumptions: "
             "each was exercised with a live request during the recorded run.")

body(doc,
     "The pattern in Table 7 is informative. The application's *injection* defences are "
     "uniformly sound — every parameterised query held, across both applications — while its "
     "authorisation defences fail in exactly one place. This is the opposite of the "
     "distribution one might expect from a teaching application, and it is what makes F-01 a "
     "credible finding rather than a laboratory artefact: it is a single ordinary mistake in "
     "otherwise careful code.")

heading(doc, "5.7 Comparison of the three engines", 2)

body(doc, "Table 8 summarises what each engine produced.")

table(doc,
      ["", "Deterministic suite", "LLM agent", "Multi-agent pipeline"],
      [
          ["Wall-clock time", "41 s", "3 s", "42 min (aborted)"],
          ["Work performed", "12 fixed checks", "3 self-chosen requests", "6 analysis agents"],
          ["Ground-truth findings reported", "3 of 3", "0 of 3", "0 of 3 (none consolidated)"],
          ["Detected but not reported", "0", "1", "2 (in analysis deliverables)"],
          ["False positives", "0", "0", "0"],
          ["Recall", "100%", "0% (33% detected)", "0% (67% analysed)"],
          ["Human interventions", "0", "0", "2 (credential repair, run restart)"],
      ],
      widths=[4.6, 3.7, 3.6, 3.7])
caption(doc, "Table 8. Engine comparison against the three ground-truth findings. "
             "'Detected' counts findings the engine's own traffic proved; 'reported' counts "
             "what it asserted in its final output.")

body(doc,
     "**The suite.** Twelve checks in 41 seconds, three vulnerable, nine passed, none "
     "inconclusive. Full recall, no false positives. It is fast because it issues a bounded, "
     "known set of requests, and it is trustworthy because every verdict carries the traffic "
     "that produced it.")

body(doc,
     "**The LLM agent.** Three requests in 3 seconds. Its trajectory is worth reproducing in "
     "full, because it shows a correct investigation followed by an incorrect conclusion:")

code_block(doc,
           "[1] GET /api/bank/accounts                      -> 200\n"
           "[2] GET /api/bank/tuition/student/AC00000001    -> 404\n"
           "[3] GET /api/bank/tuition/student/AC00000034    -> 200\n"
           "\n"
           "model's final message:  \"No vulnerabilities were confirmed.\"\n"
           "harness verdict:        1 vulnerability confirmed from the responses received.",
           caption="Listing 13. Recorded agent run. Step 2 guessed an identifier that does "
                   "not exist and received 404; step 3 guessed one that does and received a "
                   "record belonging to another user.")

body(doc,
     "The model did the hard part. It formed a hypothesis about object identifiers, tested it "
     "with a negative case, tested it again with a positive case, and obtained a response "
     "proving that an unrelated record was readable. It then discarded that conclusion, "
     "presumably reasoning that a 200 response to a GET is not by itself evidence of a "
     "vulnerability — which is true in general and false here, because the harness knew the "
     "session's own identifier and the model did not compare against it.")

body(doc,
     "That last clause is the mechanism. The model had no way to establish **whose** record it "
     "had received, because it never fetched its own record for comparison. A human tester "
     "would have done so reflexively. The failure is therefore not one of reasoning power but "
     "of missing context: the agent needed one more fact, had the tools to obtain it, and did "
     "not know it needed it.")

body(doc,
     "**The multi-agent pipeline.** Six agents completed their analysis phases before the "
     "run aborted: pre-reconnaissance (7 m 14 s), reconnaissance (6 m 23 s), SSRF analysis "
     "(3 m 58 s), injection analysis (2 m 57 s), authorisation analysis (3 m 23 s) and "
     "authentication analysis (4 m 10 s). Their deliverables were preserved and contain real "
     "analysis — the injection analysis correctly identifies the concatenated query, and the "
     "authentication analysis identifies the lockout defect and the shared MFA bucket.")

body(doc,
     "What the pipeline did not produce is a consolidated report. Its exploitation phase "
     "failed when the model provider began rejecting the API key, and the run was aborted "
     "after 42 minutes. The provider's response was decisive rather than ambiguous:")

code_block(doc,
           "HTTP 403\n"
           "{\"status\":403,\"title\":\"Forbidden\",\"detail\":\"Authorization failed\"}\n"
           "\n"
           "response time: 0.229 s\n"
           "error.log:  retryable: true   (10:58)\n"
           "error.log:  retryable: false  (11:00)",
           caption="Listing 14. Provider response and the pipeline's own classification of "
                   "it. A 403 in 229 ms is an authentication rejection, not a rate limit or a "
                   "transient fault.")

body(doc,
     "The pipeline's report file exists but contains 97 bytes: a heading reading 'SSRF "
     "Exploitation Evidence' and the sentence 'No vulnerabilities were available in the "
     "queue.' It is included in the deliverables unaltered, because a placeholder that "
     "asserts no vulnerabilities is materially different from a report that found none, and "
     "a reader is entitled to see which one they have.")

body(doc,
     "Its cross-checks are nonetheless useful. The injection analysis independently confirmed "
     "the parameterised queries in `/api/acadia/*`, `/api/bank/transfer`, `/api/school/*` and "
     "the terminal's allowlist as safe, which agrees with the suite's checks 4 and 5 and "
     "narrows the injection surface to the one lab endpoint. Independent agreement on the "
     "negatives is as valuable as agreement on the positives.")

heading(doc, "5.8 Defects in the harness, and their effect on the results", 2)

body(doc,
     "Five defects were found in the test infrastructure rather than the target. They are "
     "reported because each one silently prevented an automated client from working, and "
     "because a report that omitted them would attribute engine failures to the engines.")

table(doc,
      ["Defect", "Observed effect", "Fix"],
      [
          ["Origin guard rejected any POST without an `Origin` header",
           "Every command-line client received `403 Invalid request origin`; the pipeline's "
           "authentication agent retried for most of an hour",
           "Absent `Origin` allowed; mismatched `Origin` still `403`"],
          ["Auth limiter counted successful logins and keyed on address alone",
           "All traffic arrives via Caddy, so the deployment shared one bucket; a scan "
           "exhausted it in minutes and an agent slept 910 s",
           "`skipSuccessfulRequests: true`; key is address + account"],
          ["`/api/auth/verify` has no username to key on",
           "Every user shared one MFA bucket; 30 wrong codes by anyone blocked MFA for everyone",
           "Key falls back to `req.session.pendingId`"],
          ["`lab_sqli_demo` existed only in the running database, seeded for one target",
           "The second target's variant returned nothing; a fresh deployment had no table",
           "Added to `schema.sql` with rows for both targets"],
          ["Report route accepted any `?format` and returned Markdown",
           "`?format=pdf` appeared to succeed while serving Markdown",
           "`md` and `json` served; anything else `415`"],
      ],
      widths=[4.6, 6.4, 4.6])
caption(doc, "Table 9. Harness defects, their measured effect, and the repair. Each was "
             "verified fixed with a live request.")

body(doc,
     "The first defect is the most consequential for the comparison. Requests without an "
     "`Origin` header are not a cross-site request forgery risk — a browser always sends "
     "`Origin` on a cross-origin state-changing request, and `SameSite=strict` provides a "
     "second layer "
     f"{c('barth2008', 'rfc6265')}. Rejecting them blocked every legitimate "
     "non-browser client while adding no protection a browser could not already be given. "
     "The corrected rule keeps the check that matters: a request that **does** carry an "
     "`Origin`, and carries the wrong one, is still refused.")

body(doc,
     "The second and third are the same mistake in two places: keying a limiter on a value "
     "that is not unique per client behind a reverse proxy. Both were repaired by adding a "
     "per-account component, which is the correct key for an authentication limiter "
     "regardless of topology — the address identifies a network path, not an account.")

heading(doc, "5.9 Network and HTTP scanning", 2)

body(doc,
     "Two conventional tools characterised the network surface. Neither found an application "
     "defect, which is the expected result and worth stating explicitly rather than omitting.")

body(doc, "**nmap** reported four states of interest:")

code_block(doc,
           "80/tcp    open   http?\n"
           "443/tcp   closed\n"
           "3000/tcp  closed\n"
           "5432/tcp  open   postgresql",
           caption="Listing 15. Port scan of the host. Port 3000 is not published; 443 is "
                   "not bound on the host because TLS terminates at Tailscale.")

body(doc,
     "The PostgreSQL listener on 5432 is an observation worth flagging even though it lies "
     "outside the application scope. It was later confirmed to be bound to all interfaces "
     "rather than to loopback. On a host reachable over a private overlay network this is a "
     "real exposure: the database accepts connections from any peer that can route to it, "
     "subject only to its own authentication. The recommendation is to bind it to `127.0.0.1` "
     "or to the container bridge address, since the application reaches it via "
     "`host.docker.internal` and does not need a public listener.")

body(doc,
     "**nikto** completed 7,970 requests with no errors and reported three items, all "
     "informational or low:")

code_block(doc,
           "+ [000287] Caddy banner discloses the server product\n"
           "+ [999100] Uncommon header 'origin-agent-cluster' present\n"
           "+ [013587] Missing 'Permissions-Policy' header",
           caption="Listing 16. Nikto findings against the HTTP surface.")

body(doc,
     "None of these is a vulnerability in any meaningful sense; the banner is a deliberate "
     "trade-off, and `Permissions-Policy` is a defence-in-depth header for features this "
     "application does not use. Their value here is as a control on the tooling: a scanner "
     "that reports **only** noise has correctly characterised a surface whose real defects are "
     "in application logic rather than configuration. An earlier attempt to scan the public "
     "HTTPS hostname from inside the container aborted at 160 requests with 20 `ssl connect "
     "failed` errors, because the hostname resolves to the Tailscale address from inside the "
     "container and the tunnel is not reachable from there — a reminder that scanner failure "
     "is usually a network fact, not a security finding.")


# ======================================================================
# 6. DISCUSSION
# ======================================================================

heading(doc, "6. Discussion", 1)

heading(doc, "6.1 The oracle problem", 2)

body(doc,
     "The three engines did not differ chiefly in reasoning power. They differed in whether "
     "they possessed an oracle: a deterministic predicate that converts an observation into a "
     "verdict.")

body(doc,
     "The suite has one for every check. Check 6 knows the session's own identifier, so a "
     "record returned for a different identifier is a defect by definition. Check 12 knows "
     "that a 200 response to a plain-HTTP request is a failure of redirect enforcement. The "
     "predicate is written by a human in advance and evaluated by a machine, which is why the "
     "check is reproducible and why its verdict carries weight.")

body(doc,
     "The LLM agent had the observations but not the predicate. It retrieved a record "
     "belonging to another user and had no baseline against which to compare it. In the "
     "absence of a predicate it applied a heuristic — 'a 200 response to a GET is normal' — "
     "which is correct in general and wrong here. The failure was one of missing context, not "
     "of insufficient capability: the agent had the tool it needed, and did not know it needed "
     "it.")

body(doc,
     "The pipeline was designed with an exploitation phase that is exactly such an oracle, and "
     "that phase never ran. Its analysis agents produced correct hypotheses; without "
     "exploitation, hypotheses have no verdict, and the pipeline therefore produced no report. "
     "This is the clearest illustration in the study of why the oracle, not the model, is the "
     "load-bearing component.")

body(doc,
     "The practical implication is direct. An agentic tester should be instructed to establish "
     "its own baseline before testing: fetch the caller's own record, note the identifier, and "
     "compare. That single instruction would have converted one detected finding into one "
     "reported finding in this study. More generally, the value of an agent lies in "
     "hypothesis generation, and the value of a deterministic harness lies in adjudication; "
     "systems that combine the two outperform either alone.")

heading(doc, "6.2 Determinism, cost and the asymmetry of prior knowledge", 2)

body(doc,
     "The suite found three findings in 41 seconds; the agent found none in three; the "
     "pipeline found none in 42 minutes. Read naively, that ordering says deterministic "
     "testing wins by a wide margin. That reading would be wrong, and the reason is important "
     "enough to state plainly.")

body(doc,
     "**The suite was written by someone who already knew the answers.** Its twelve checks "
     "encode expert knowledge of this specific application: where the tuition endpoint is, "
     "which identifier to use, what a correct response looks like. It is not an independent "
     "tester; it is a regression test for hypotheses a human already formed. Comparing it with "
     "an agent that must discover those hypotheses is comparing a solution with a search.")

body(doc,
     "What the comparison does establish is complementary value. The suite's advantage is "
     "cost and repeatability: 41 seconds, zero interventions, identical results across runs. "
     "The agent's advantage is that it needed no prior knowledge of the application and still "
     "reached the right endpoint in three requests. Neither property substitutes for the "
     "other, and a realistic workflow uses both — the agent to generate hypotheses against "
     "unfamiliar surface, the deterministic harness to adjudicate and to guard against "
     "regression. This is consistent with the division of labour reported for LLM assistants "
     f"in structured testing workflows {c('happe', 'pentestgpt')}.")

body(doc,
     "A fairer benchmark would give the agent the same prior knowledge — the endpoint list, "
     "the credential, a description of the data model — and measure whether it reaches the "
     "same conclusions. That experiment is left to future work (Section 7.2).")

heading(doc, "6.3 Operational failure is the dominant mode", 2)

body(doc,
     "Five of the failures observed in this study had nothing to do with vulnerability "
     "detection. A request was rejected for lacking a header; a limiter counted the wrong "
     "requests; a limiter keyed on the wrong value; a table was missing from the schema; a "
     "route returned the wrong content type. Each was repaired in a few lines, and each had "
     "silently prevented an automated client from working.")

body(doc,
     "This distribution is worth reporting because published evaluations rarely mention it. A "
     "paper that reports 'the agent found 4 of 6 vulnerabilities' almost never reports how "
     "many runs were discarded because the agent could not authenticate, how often a rate "
     "limiter interrupted the run, or whether the provider's key expired mid-run. Those "
     "events are not incidental; in this study they accounted for the majority of engine "
     "failures. Reporting detection rates without reporting operational reliability inflates "
     "the apparent capability of the systems being measured.")

body(doc,
     "The recommendation for practitioners is to instrument the harness, not only the target. "
     "Every request an engine makes, every refusal it receives and every retry it performs is "
     "data about whether the engine works. The suite's own report format — every verdict "
     "accompanied by the traffic that produced it — is a small example of the practice.")

heading(doc, "6.4 Threats to validity", 2)

body(doc,
     f"The study is a single-case design, and its conclusions should be read with the "
     f"limitations that design implies. The categories below follow the standard "
     f"classification for empirical software engineering {c('wohlin', 'runeson')}.")

body(doc,
     "**Construct validity.** Recall is measured against three ground-truth findings, which is "
     "a narrow construct: an engine could miss every defect outside those three and still "
     "score 100 per cent. The ground truth was itself constructed by the author, so it "
     "inherits the author's blind spots — a defect nobody noticed is absent from the "
     "denominator. CVSS scoring is likewise a judgement, and the metrics chosen here are "
     "argued in the text rather than derived mechanically.")

body(doc,
     "**Internal validity.** The suite was written with knowledge of the application, so its "
     "advantage over the agent is partly an artefact of prior knowledge rather than of "
     "determinism (Section 6.2). Each engine was run once per configuration, so no variance "
     "estimate is available; a single run cannot distinguish a reliable engine from a lucky "
     "one. The host rebooted mid-assessment, which changed the environment between the first "
     "and second halves of the work; the suite was re-run afterwards and reproduced its "
     "result, but the agent and pipeline columns were not re-measured under identical "
     "conditions.")

body(doc,
     "**External validity.** One application, one technology stack, one scale. The findings do "
     "not generalise to large codebases, to other frameworks, or to organisations with "
     "different threat models. The harness defects in particular are artefacts of this "
     "deployment's topology — a reverse proxy in front of a rate limiter — although that "
     "topology is extremely common in practice, which is why they are reported.")

body(doc,
     "**Conclusion validity.** With one observation per engine, no statistical claim is made. "
     "The comparison is descriptive: it reports what happened and explains why, without "
     "asserting that the pattern would recur. The reliability of the deterministic column is "
     "supported by re-execution; the other two columns have no such support.")

body(doc,
     "**A note on the provider failure.** The pipeline's abort is treated in this report as an "
     "operational fact, not as evidence about the pipeline's detection ability. A reader "
     "should not conclude that the pipeline would have found nothing had it completed: its "
     "analysis phase had already identified two of the three ground-truth findings, and its "
     "exploitation phase — the part that never ran — is where those would have been confirmed.")

heading(doc, "6.5 Implications for practice", 2)

body(doc, "Four implications follow from the results, in descending order of confidence.")

numbered(doc, "**Keep a deterministic regression suite.** It is cheap, fast, and it is the only "
              "one of the three approaches whose result can be trusted without re-testing. "
              "Every finding a human confirms should become a check.")
numbered(doc, "**Give agents a baseline before giving them a target.** Instruct the agent to "
              "establish what normal looks like for the authenticated principal. Most "
              "authorisation defects become visible through a single comparison, and an agent "
              "that does not make that comparison will under-report systematically.")
numbered(doc, "**Treat keying as a design decision, not a default.** Behind a reverse proxy, "
              "address-based keys collapse every client into one bucket. Authentication "
              "limiters should key on the account; transport limiters may key on the address; "
              "conflating the two produces either a bypass or a denial of service.")
numbered(doc, "**Preserve failed runs.** A run that fails is evidence. Deleting it destroys "
              "the only record of why the engine could not proceed, and leaves a success rate "
              "that is impossible to interpret.")


# ======================================================================
# 7. CONCLUSIONS
# ======================================================================

heading(doc, "7. Conclusions and Future Work", 1)

heading(doc, "7.1 Conclusions", 2)

body(doc,
     "This report set out to compare three approaches to penetration testing against a system "
     "whose defects were known by construction. Five weaknesses were confirmed in the target "
     "and five defects were found and repaired in the test harness. Three conclusions are "
     "supported by the evidence.")

body(doc,
     "**First, the application's defects are ordinary and its controls are not.** A single "
     "authorisation mistake in an otherwise careful codebase disclosed fifteen students' "
     "tuition records to any authenticated bank user. Every injection defence held; every "
     "role check held; the password hashing, session rotation and transport controls held. "
     "The defect that mattered was one missing `WHERE` clause constraint in a query that was "
     "already parameterised — a reminder that injection and authorisation are orthogonal, and "
     "that the presence of one is routinely mistaken for the presence of the other.")

body(doc,
     "**Second, the oracle determines the outcome.** The deterministic suite reported 3 of 3 "
     "with no false positives, the LLM agent detected 1 and reported 0, and the multi-agent "
     "pipeline analysed 2 and consolidated none. In each case the difference is explained by "
     "whether a deterministic predicate was available to convert an observation into a "
     "verdict, not by the sophistication of the reasoning. The agent's failure in particular "
     "was a missing baseline, one fact away from a correct report.")

body(doc,
     "**Third, operational reliability dominates and is under-reported.** The majority of "
     "engine failures in this study were caused by the harness rather than the target: an "
     "origin check that rejected non-browser clients, limiters keyed on values that are not "
     "unique per client, a missing table, an incorrect content type, and finally a revoked API "
     "key. Any evaluation that reports detection rates without reporting these events "
     "overstates what the systems can do in practice.")

heading(doc, "7.2 Future work", 2)

body(doc, "Five extensions would strengthen the results:")

bullet(doc, "**Repeated trials.** Ten runs per engine per configuration, reporting mean and "
            "variance rather than a single observation. This is the single most important "
            "addition, because it would separate reliability from luck.")
bullet(doc, "**A knowledge-matched comparison.** Give the agent the endpoint inventory and "
            "data model that the suite's author had, and measure whether the gap in recall "
            "closes. This would test the explanation offered in Section 6.2 directly.")
bullet(doc, "**Full vulnerability-class coverage.** XSS and SSRF were not assessed: the "
            "pipeline's XSS agent failed output validation, and no engine was tasked with "
            "SSRF against the bridge. A four-class ground truth would make the recall "
            "comparison meaningful rather than illustrative.")
bullet(doc, "**Machine-readable output.** Emit SARIF so that results integrate with CI and "
            "with code scanning dashboards, converting the suite from a demonstration into a "
            "regression gate that runs on every commit.")
bullet(doc, "**Cost accounting.** Record token consumption and provider spend per finding "
            "alongside wall-clock time, so that the economics of each approach can be "
            "compared rather than inferred.")

body(doc,
     "A further line of work concerns the harness defects themselves. They are presented here "
     "as a case series; a systematic study of how commonly automated testers are blocked by "
     "origin checks, proxy-collapsed rate limiters and expiring credentials would establish "
     "whether this study's distribution is typical, and would give tool authors a concrete "
     "list of interoperability requirements to satisfy.")

page_break(doc)


# ======================================================================
# REFERENCES
# ======================================================================

heading(doc, "References", 1)

body(doc,
     "Numbered in order of first citation. Web resources were accessed on 24 November 2026.",
     size=9.5, italic=True)

import re  # noqa: E402


def ref_entry(number, text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(1.1)
    p.paragraph_format.first_line_indent = Cm(-1.1)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.0
    r = p.add_run(f"[{number}]  ")
    r.font.size = Pt(9.5)
    for part in re.split(r"(\*[^*]+\*)", text):
        if not part:
            continue
        if part.startswith("*") and part.endswith("*") and len(part) > 2:
            rr = p.add_run(part[1:-1])
            rr.italic = True
        else:
            rr = p.add_run(part)
        rr.font.size = Pt(9.5)


for _i, (_key, _text) in enumerate(REFS, start=1):
    ref_entry(_i, _text)

page_break(doc)


# ======================================================================
# APPENDIX A — SOURCE CODE
# ======================================================================

heading(doc, "Appendix A. Source Code Information", 1)

body(doc,
     "This appendix records how the system is organised in source, so that the findings in "
     "Section 5 can be located and re-examined without reading the whole application. Line "
     "numbers refer to the committed files listed in Table 2.")

heading(doc, "A.1 Module responsibilities", 2)

table(doc,
      ["File", "Responsibility", "Security-relevant contents"],
      [
          ["`server.js`",
           "Single Express application: middleware chain, authentication, bank routes, Acadia "
           "mount points, Attack Lab routes, report delivery",
           "Limiter (`:213`), cache middleware (`:236`), login handler (`:545`), lockout SQL "
           "(`:631`), session rotation (`:672`), tuition lookup (`:1449`), lab SQLi (`:1669`) "],
          ["`school-routes.js`",
           "Acadia student routes: enrolment, grades, profile",
           "All queries parameterised; scoped to `req.session.userId`"],
          ["`school-services-routes.js`",
           "Acadia service requests (transcripts, letters)",
           "Parameterised; role checks on administrative actions"],
          ["`schema.sql`",
           "Schema, constraints and seed data",
           "`lab_sqli_demo` (`:135`), user and role tables, payment tables"],
          ["`tools/pentest-suite.mjs`",
           "Deterministic 12-check suite",
           "One function per check; each returns passed / vulnerable / inconclusive"],
          ["`tools/ai-agent.mjs`",
           "LLM agent and harness",
           "Tool definitions (`:266`, `:295`, `:320`), model fallback list (`:49`)"],
          ["`tools/shannon-bridge.mjs`",
           "HTTP bridge to the Shannon pipeline",
           "Workspace creation, config passing, run polling"],
      ],
      widths=[4.0, 6.2, 5.4])
caption(doc, "Table A1. Module map. The middleware order in `server.js` is significant: "
             "Helmet, then the origin guard, then body parsing, then the session, then route "
             "middleware.")

heading(doc, "A.2 The demonstration table", 2)

body(doc,
     "The lab injection operates on a dedicated table with fixed identifiers, so that repeated "
     "runs never duplicate rows and the expected output is stable. Listing A1 reproduces the "
     "definition from `schema.sql:135–154`.")

code_block(doc,
           "CREATE TABLE IF NOT EXISTS lab_sqli_demo (\n"
           "  id      BIGSERIAL PRIMARY KEY,\n"
           "  target  TEXT NOT NULL CHECK (target IN ('bank', 'school')),\n"
           "  label   TEXT NOT NULL,\n"
           "  secret  TEXT NOT NULL\n"
           ");\n"
           "\n"
           "-- Fixed ids so re-running this file never duplicates the training rows.\n"
           "INSERT INTO lab_sqli_demo (id, target, label, secret) VALUES\n"
           "  (101, 'school', 'Training student A', 'LAB-GRADE-A'),\n"
           "  (102, 'school', 'Training student B', 'LAB-GRADE-B'),\n"
           "  (103, 'bank',   'Training account A', 'LAB-BANK-A'),\n"
           "  (104, 'bank',   'Training account B', 'LAB-BANK-B')\n"
           "ON CONFLICT (id) DO NOTHING;\n"
           "\n"
           "-- Keep the sequence ahead of the fixed ids so real inserts do not collide.\n"
           "SELECT setval(\n"
           "  pg_get_serial_sequence('lab_sqli_demo', 'id'),\n"
           "  GREATEST((SELECT MAX(id) FROM lab_sqli_demo), 1)\n"
           ");",
           caption="Listing A1. `schema.sql:135–154`. The `CHECK` constraint limits the "
                   "target column, and the fixed ids make the expected leak deterministic: "
                   "exactly two rows for `bank`, two for `school`.")

heading(doc, "A.3 Defence patterns used in the codebase", 2)

body(doc,
     "Four patterns recur across the application. Table A2 names each, gives a representative "
     "instance, and states where it was verified to hold.")

table(doc,
      ["Pattern", "Implementation", "Verified in"],
      [
          ["Parameterised queries",
           "`pool.query(text, [values])` with `$n` placeholders throughout",
           "`/api/bank/transfer`, `/api/acadia/*`, `/api/school/*`, `/api/bank/payments`"],
          ["Session-bound scoping",
           "`WHERE ... = req.session.userId` rather than a client-supplied identifier",
           "`/api/bank/payments`, Acadia enrolment, profile routes"],
          ["Format validation before use",
           "Regular-expression check on identifiers, e.g. `/^AC([0-9]{8})$/`",
           "`server.js:1450` — validates shape, not entitlement"],
          ["Capability gating",
           "`LAB_VULNERABLE_MODE === \"true\"` and `requireDefenderSession`",
           "`server.js:1670` — 403 when the gate is closed"],
      ],
      widths=[3.8, 6.2, 5.6])
caption(doc, "Table A2. Defence patterns. Note the third row: format validation is often "
             "mistaken for authorisation, and F-01 is the consequence of that confusion.")

heading(doc, "A.4 The agent's tool surface", 2)

body(doc,
     "The LLM agent is given three tools and nothing else. The restriction is deliberate: a "
     "narrow, auditable surface makes the two-count measurement possible, because every action "
     "the model takes is a logged tool call rather than arbitrary code.")

table(doc,
      ["Tool", "Purpose", "Why it is bounded"],
      [
          ["`http_request`", "Perform a GET or POST against the target with the agent's session "
                             "cookie", "No arbitrary shell; no access outside the target origin"],
          ["`record_finding`", "Assert a vulnerability, with endpoint, severity and evidence",
           "Separates the assertion from the observation, which is what the two counts measure"],
          ["`finish`", "End the run with a summary", "Bounds the run so it cannot loop indefinitely"],
      ],
      widths=[3.4, 6.4, 5.8])
caption(doc, "Table A3. Tool surface of the in-container agent (`tools/ai-agent.mjs:266–330`).")

heading(doc, "A.5 Where the patterns were not applied", 2)

body(doc,
     "Three locations diverge from the patterns above, and each corresponds to a finding. "
     "Table A4 maps them, so that a reviewer can go directly from finding to line.")

table(doc,
      ["Finding", "Location", "Divergence"],
      [
          ["F-01", "`server.js:1449–1464`",
           "Parameterised query, but the parameter comes from the path rather than the session; "
           "no entitlement check"],
          ["F-02", "`server.js:631–647`",
           "Lockout implemented, but the counter resets at the threshold instead of accumulating"],
          ["F-03", "`server.js:1706–1717`",
           "One branch parameterised, one branch interpolated — by design, for teaching"],
          ["F-05", "`server.js:236–240`",
           "Now fixed: `no-store` and `no-cache` applied to `/api/auth`"],
      ],
      widths=[2.2, 5.4, 8.0])
caption(doc, "Table A4. Finding-to-source map.")


# ======================================================================
# APPENDIX B — REPRODUCTION
# ======================================================================

heading(doc, "Appendix B. Reproduction Commands", 1)

body(doc,
     "The commands below reproduce the results in Section 5. They assume the repository root "
     "as the working directory and a running deployment; substitute `PENTEST_BASE` to point at "
     "a different instance. Credentials are the lab accounts described in Section 4.2.")

heading(doc, "B.1 Health checks", 2)

code_block(doc,
           "# Is the site up, and how fast?\n"
           "curl -sS -o /dev/null -w \"status=%{http_code} ttfb=%{time_starttransfer}s\\n\" \\\n"
           "  https://shekin.tail97139a.ts.net/\n"
           "\n"
           "# Is the container healthy, and is the image the build we think it is?\n"
           "docker ps --format \"table {{.Names}}\\t{{.Status}}\"\n"
           "docker exec sim-app wc -c /app/server.js        # expect 82801\n"
           "docker exec sim-app node --check /app/server.js # expect no output\n"
           "docker inspect sim-app --format '{{.RestartCount}}'",
           caption="Listing B1. The in-image size and syntax check exists because a truncated "
                   "copy of `server.js` once reached the image and crash-looped the container.")

heading(doc, "B.2 The deterministic suite", 2)

code_block(doc,
           "# Default target is the public hostname; override for another instance.\n"
           "node tools/pentest-suite.mjs\n"
           "\n"
           "PENTEST_BASE=http://localhost node tools/pentest-suite.mjs\n"
           "\n"
           "# Outputs:\n"
           "#   tools/out/PENTEST-REPORT.md    human-readable report\n"
           "#   tools/out/findings.json        machine-readable results",
           caption="Listing B2. Twelve checks, roughly 41 seconds. Exit is 0 regardless of "
                   "findings; the report is the product, not the exit code.")

heading(doc, "B.3 The LLM agent", 2)

code_block(doc,
           "# The agent takes its key from the environment, never from the repository.\n"
           "export AI_API_KEY=<provider key>\n"
           "export AI_MODEL=moonshotai/kimi-k3.1-pro      # optional override\n"
           "\n"
           "node tools/ai-agent.mjs\n"
           "\n"
           "# Outputs the claimed count, the detected count, and the full request trace.",
           caption="Listing B3. The two counts are reported separately by design.")

heading(doc, "B.4 The multi-agent pipeline", 2)

code_block(doc,
           "# The bridge runs on the host and drives the pipeline under WSL2, because the\n"
           "# application container deliberately has no Docker socket.\n"
           "export SHANNON_BRIDGE_TOKEN=$(cat /c/temp/bridge-token.txt)\n"
           "export SHANNON_BRIDGE_PORT=7071\n"
           "export SHANNON_AI_API_KEY=<provider key>\n"
           "node tools/shannon-bridge.mjs\n"
           "\n"
           "# The bridge passes configs/shannon-lab.yaml, which carries the lab credentials\n"
           "# and the login flow, and polls the workspace until the run terminates.",
           caption="Listing B4. The bridge exists so that a pipeline requiring Docker does not "
                   "force a Docker socket into a public web application.")

heading(doc, "B.5 Manual tooling", 2)

code_block(doc,
           "# Network surface. Published ports only; 3000 is internal.\n"
           "nmap -sV -Pn -p 80,443,3000,5432 100.111.105.54\n"
           "\n"
           "# HTTP surface, scanned from inside the container network against the Caddy port.\n"
           "docker exec sim-app sh -c \"nikto -h host.docker.internal -p 80\"\n"
           "\n"
           "# Scanning the public HTTPS hostname from inside the container does not work:\n"
           "# the name resolves to the Tailscale address, which the container cannot reach.",
           caption="Listing B5. The nmap invocation is the form used to produce Listing 15; the "
                   "nikto invocation is the one recorded, at 7,970 requests and three findings.")

heading(doc, "B.6 Verifying a single finding by hand", 2)

code_block(doc,
           "# 1. Sign in and complete MFA (Listing 1), then:\n"
           "curl -s -b cookie.txt -w ' status=%{http_code}\\n' \\\n"
           "  https://shekin.tail97139a.ts.net/api/bank/tuition/student/AC00000063   # own record\n"
           "\n"
           "curl -s -b cookie.txt -w ' status=%{http_code}\\n' \\\n"
           "  https://shekin.tail97139a.ts.net/api/bank/tuition/student/AC00000036   # another user's\n"
           "\n"
           "# Both return 200. That is the finding: the second should not.\n"
           "\n"
           "# 2. The injection, with the gate open:\n"
           "curl -s -b cookie.txt -X POST https://shekin.tail97139a.ts.net/api/lab/exploit/sqli \\\n"
           "  -H 'Content-Type: application/json' \\\n"
           "  -d '{\"target\":\"bank\",\"input\":\"'\"'\"' OR '\"'\"'1'\"'\"'='\"'\"'1\"}'",
           caption="Listing B6. Manual confirmation of F-01 and F-03. The quoting in the last "
                   "command is shell-specific; a JSON file passed with `-d @file` avoids it.")


# ======================================================================
# APPENDIX C — EVIDENCE INVENTORY
# ======================================================================

heading(doc, "Appendix C. Evidence Inventory", 1)

body(doc,
     "Every claim in Section 5 traces to one of the files below. They are committed with the "
     "project so that a marker can verify a finding without re-running anything.")

table(doc,
      ["Path", "Contents", "Supports"],
      [
          ["`tools/out/PENTEST-REPORT.md`", "Suite report: 12 checks with request and response",
           "Tables 4, 7, 8"],
          ["`tools/out/findings.json`", "Machine-readable results", "Table 8"],
          ["`tools/out/AI-AGENT-REPORT.md`", "Agent transcript, claimed and detected counts",
           "Section 5.7"],
          ["`tools/out/COMPARISON-REPORT.md`", "Both engines scored against ground truth",
           "Table 8"],
          ["`tools/out/NMAP-REPORT.txt` / `.xml`", "Port and service scan", "Listing 15"],
          ["`tools/out/NIKTO-REPORT.txt`", "Scanner output", "Listing 16"],
          ["`tools/out/NIKTO-CONSOLE.txt`", "Raw console transcript", "Listing 16"],
          ["`tools/out/shannon/run-42min/`", "Pre-recon, recon and four analyses, exploitation "
                                             "queues, `error.log`", "Section 5.7, Listing 14"],
          ["`tools/out/shannon/partial-run1/`", "Earlier run's exploitation evidence and queues",
           "Section 5.7"],
          ["`tools/out/shannon/README.md`", "Provenance note for the pipeline artefacts",
           "Section 5.7"],
      ],
      widths=[5.4, 6.6, 3.6])
caption(doc, "Table C1. Evidence inventory. The pipeline's own consolidated report is "
             "included unaltered at 97 bytes, as evidence that it never completed.")


# ======================================================================
# APPENDIX D — ABBREVIATIONS
# ======================================================================

heading(doc, "Appendix D. Abbreviations", 1)

table(doc,
      ["Term", "Expansion"],
      [
          ["BOLA / IDOR", "Broken object-level authorisation / insecure direct object reference"],
          ["CSP", "Content Security Policy"],
          ["CSRF", "Cross-site request forgery"],
          ["CTF", "Capture the flag"],
          ["CVSS", "Common Vulnerability Scoring System"],
          ["CWE", "Common Weakness Enumeration"],
          ["HSTS", "HTTP Strict Transport Security"],
          ["LLM", "Large language model"],
          ["MFA", "Multi-factor authentication"],
          ["NIST", "National Institute of Standards and Technology"],
          ["OWASP", "Open Worldwide Application Security Project"],
          ["PTES", "Penetration Testing Execution Standard"],
          ["SARIF", "Static Analysis Results Interchange Format"],
          ["SQLi", "SQL injection"],
          ["SSRF", "Server-side request forgery"],
          ["TOTP", "Time-based one-time password"],
          ["WSTG", "Web Security Testing Guide"],
          ["XSS", "Cross-site scripting"],
      ],
      widths=[4.2, 11.4])
caption(doc, "Table D1. Abbreviations used in this report.")


# ======================================================================
# SAVE
# ======================================================================

doc.core_properties.title = (
    "An Empirical Comparison of Deterministic, LLM-Agentic and Multi-Agent "
    "Penetration Testing on a Deliberately Vulnerable Web Application"
)
doc.core_properties.subject = "Penetration test report — AI Smartphone Security Simulator"
doc.core_properties.author = "[Student name]"
doc.core_properties.keywords = (
    "penetration testing; BOLA; SQL injection; authentication; LLM agents; CVSS"
)
doc.core_properties.comments = (
    "Generated from a recorded assessment run of 24 November 2026. "
    "All figures trace to the evidence files listed in Appendix C."
)

doc.save(OUT)
print(f"written: {OUT}")
print(f"size:    {OUT.stat().st_size} bytes")

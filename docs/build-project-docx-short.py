#!/usr/bin/env python3
"""
Builds the condensed Word edition of the project report.

    python docs/build-project-docx-short.py

Output: docs/AI-Smartphone-Security-Simulator-Report-Short.docx

This edition covers the same assessment as the full report, compressed to about
eight pages. It includes the multi-agent engine's four attempts in detail —
model selection, the provider failures and the infrastructure built to diagnose
them — because that work is part of the result, not preamble to it.

The full edition carries the source-code appendix, the reproduction commands and
the evidence inventory.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from docx_framework import (  # noqa: E402
    ACCENT, GREY, REFS, add_runs, c, caption, code_block,
    footer_page_numbers, new_document, table,
)
from docx.shared import Cm, Pt  # noqa: E402

OUT = Path(__file__).parent / "AI-Smartphone-Security-Simulator-Report-Short.docx"

BODY = 9.8
SMALL = 7.8
CODE = 7.3

doc = new_document()

for s in doc.sections:
    s.top_margin = Cm(1.8)
    s.bottom_margin = Cm(1.6)
    s.left_margin = Cm(2.0)
    s.right_margin = Cm(1.8)

doc.styles["Normal"].font.size = Pt(BODY)
doc.styles["Normal"].paragraph_format.space_after = Pt(3.5)

footer_page_numbers(doc, "AI Smartphone Security Simulator — Penetration Test Report")


def h1(text):
    p = doc.add_heading(level=1)
    r = p.add_run(text)
    r.font.size = Pt(12.5)
    r.font.name = "Calibri"
    r.font.color.rgb = ACCENT
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(2.5)
    p.paragraph_format.keep_with_next = True
    return p


def h2(text):
    p = doc.add_heading(level=2)
    r = p.add_run(text)
    r.font.size = Pt(10)
    r.font.name = "Calibri"
    r.font.color.rgb = ACCENT
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(1.5)
    p.paragraph_format.keep_with_next = True
    return p


def p(text, size=BODY, space=3.5):
    para = doc.add_paragraph()
    para.paragraph_format.space_after = Pt(space)
    para.paragraph_format.line_spacing = 1.03
    add_runs(para, text, size=size)
    return para


def bl(text, size=BODY):
    para = doc.add_paragraph(style="List Bullet")
    para.paragraph_format.space_after = Pt(1)
    para.paragraph_format.line_spacing = 1.03
    add_runs(para, text, size=size)
    return para


def code(text, cap=None):
    return code_block(doc, text, size=CODE, caption=cap)


def tbl(headers, rows, widths):
    return table(doc, headers, rows, widths=widths, size=SMALL, keep_together=True)


# ======================================================================
# TITLE + ABSTRACT
# ======================================================================

p1 = doc.add_paragraph()
r = p1.add_run("An Empirical Comparison of Deterministic, LLM-Agentic and "
               "Multi-Agent Penetration Testing")
r.bold = True
r.font.size = Pt(16)
r.font.color.rgb = ACCENT
p1.paragraph_format.space_after = Pt(2)

p2 = doc.add_paragraph()
r = p2.add_run("A case study of the AI Smartphone Security Simulator")
r.font.size = Pt(10.5)
r.italic = True
r.font.color.rgb = GREY
p2.paragraph_format.space_after = Pt(3)

p3 = doc.add_paragraph()
r = p3.add_run("[Student name]  ·  [Student ID]  ·  [Module code and title]  ·  "
               "[Institution]  ·  Supervisor: [Supervisor]  ·  24 November 2026")
r.font.size = Pt(8)
r.font.color.rgb = GREY
p3.paragraph_format.space_after = Pt(1.5)

p4 = doc.add_paragraph()
r = p4.add_run("Target: https://shekin.tail97139a.ts.net  ·  Node.js 22 / Express 5  ·  "
               "PostgreSQL 18  ·  Caddy 2  ·  Tailscale Funnel  ·  Shannon 3.6.1")
r.font.size = Pt(8)
r.font.color.rgb = GREY
p4.paragraph_format.space_after = Pt(7)

h1("Abstract")

p("This report documents an authenticated penetration test of a self-hosted training "
  "application and uses it to compare three assessment approaches: a deterministic scripted "
  "suite, a large-language-model (LLM) agent inside the container, and a commercial "
  "multi-agent pipeline driven through a custom bridge. The target is a Node.js/Express "
  "system exposing two deliberately vulnerable applications — a retail bank and a student "
  "information system — behind password and TOTP authentication.")

p("Twelve scripted checks established ground truth in 41 seconds: nine controls held and "
  "four weaknesses were confirmed, including a broken object-level authorisation flaw that "
  "disclosed fifteen students' tuition records to an unrelated bank account, an account "
  "lockout whose failure counter resets at its own threshold, a SQL injection in a teaching "
  "endpoint, and a user enumeration oracle in registration that the scripted suite never "
  "tested for. That last finding was discovered by the multi-agent pipeline and confirmed "
  "here — the one case in the study where an automated engine found something the "
  "deterministic suite had not been written to check.")

p("The multi-agent pipeline required four attempts to run. Its model provider failed three "
  "times for reasons it did not surface, so a throttling and logging proxy was built to "
  "capture the upstream responses. That instrumentation produced the finding: the account "
  "held zero credit, and the provider was rejecting requests it could not reserve tokens "
  "for. With the true cause known, the pipeline reached its exploitation phase — further "
  "than any previous attempt — before a free-tier daily quota ended the run.")

p("A third result is methodological. Five defects in the test harness, plus one in the "
  "engine's error handling, explain most of the divergence between engines. The report "
  "argues that what separates a usable automated result from an unusable one is the presence "
  "of an oracle — a deterministic predicate that converts an observation into a verdict — "
  "and that reproducibility, not autonomy, is the property that makes a finding usable as "
  "evidence.")

pe = doc.add_paragraph()
r = pe.add_run("Keywords: ")
r.bold = True
r.font.size = Pt(8.8)
r = pe.add_run("penetration testing; broken object-level authorisation; SQL injection; "
               "user enumeration; large language models; multi-agent systems; CVSS; "
               "reproducibility.")
r.italic = True
r.font.size = Pt(8.8)
pe.paragraph_format.space_after = Pt(1)


# ======================================================================
# 1. INTRODUCTION
# ======================================================================

h1("1. Introduction and Aims")

p(f"Penetration testing is the most direct way to establish whether a system resists attack, "
  f"but it is expensive and irreducibly non-deterministic: two testers given the same target "
  f"produce different reports. Standard process models acknowledge this. NIST SP 800-115 "
  f"divides the work into planning, discovery, attack and reporting {c('nist115')}, and PTES "
  f"adds pre-engagement and post-exploitation {c('ptes')}; surveys find the same open "
  f"problems of coverage and repeatability {c('bertoglio', 'felderer')}.")

p(f"Automation has long covered discovery — scanners are mature, cheap and loud — but not the "
  f"judgement step: deciding whether a response constitutes a vulnerability. That step is "
  f"where testers spend their time, and it is what recent LLM agents claim to automate "
  f"{c('pentestgpt', 'happe')}. Such claims are hard to evaluate without ground truth. If an "
  f"agent reports a vulnerability it must be independently confirmed; if it reports nothing, "
  f"the tester cannot distinguish a secure system from a failed agent.")

p("This project takes the complementary approach: build a lab whose vulnerabilities are known "
  "by construction, instrument it, run three engines against it, and score them against that "
  "ground truth. The objectives were to build the instrumented target (O1), implement a suite "
  "whose every verdict is backed by captured traffic (O2), run an LLM agent and record both "
  "what it claimed and what its traffic proved (O3), run a multi-agent pipeline and preserve "
  "its deliverables even on failure (O4), and score all three on recall and false positives "
  "(O5). A sixth objective emerged during the work: to establish *why* the pipeline failed "
  "rather than accepting its own error message, since its diagnostics proved incomplete.")


# ======================================================================
# 2. SYSTEM UNDER TEST
# ======================================================================

h1("2. System Under Test")

p(f"A single host runs four containers, a host-installed PostgreSQL instance and a Tailscale "
  f"Funnel publishing the application over HTTPS {c('docker')}. Two applications share one "
  f"Express process and one database, separated by an `app` column and route middleware. The "
  f"**bank** application provides balances, transfers and tuition payment (`bank_user`); the "
  f"**Acadia** application provides enrolment, grades and service requests (`student` or "
  f"`admin`). A third surface, the **Attack Lab**, exposes deliberately vulnerable endpoints "
  f"to authenticated users.")

tbl(["Layer", "Component", "Exposure"],
    [["Client", "Browser or command-line HTTP client", "Internet"],
     ["Edge", "Tailscale Funnel, TLS termination", "Public hostname, 443"],
     ["Proxy", "Caddy 2 (`sim-caddy`)", "Host port 80"],
     ["Application", "Node 22 / Express 5 (`sim-app`)", "Internal 3000"],
     ["Data", "PostgreSQL 18.3", "Host 5432"],
     ["Orchestration", "Temporal 1.7.0 (`shannon-temporal`)", "Internal"],
     ["Pipeline workers", "`keygraph/shannon:3.6.1` containers", "Docker network"]],
    widths=[2.6, 7.6, 5.0])
caption(doc, "Table 1. Deployment layers. The application publishes no port directly; all "
             "inbound traffic traverses Caddy.")

p("Two consequences shaped the assessment. Because every request arrives from the Caddy "
  "container, the application sees one source address for all clients — so a rate limiter "
  "keyed on address applies to the whole deployment rather than to one client. And because "
  "the pipeline's agents execute in **worker containers** rather than on the host, `127.0.0.1` "
  "inside them is the container itself; this single fact invalidated an entire diagnostic "
  "attempt (Section 5.5).")

p("The deliberate vulnerability design matters for interpreting results. The lab endpoint is "
  "gated behind `LAB_VULNERABLE_MODE` and an MFA-verified session; its query pins the row set "
  "to one application through a materialised CTE and runs inside `BEGIN READ ONLY`. The "
  "injection is therefore real but contained. By contrast, the tuition lookup and the "
  "registration oracle are not gated at all: they are ordinary application code and would be "
  "exploitable in any deployment, which is why they carry the highest practical significance "
  "here.")

p(f"Controls implemented in source were tested rather than assumed: Argon2id password hashing "
  f"{c('provos', 'rfc9106')}, TOTP as a second factor with secrets encrypted at rest "
  f"{c('rfc6238')}, session regeneration after authentication, `HttpOnly` / `SameSite=strict` "
  f"cookies {c('rfc6265')}, Helmet headers, and HSTS {c('rfc6797')}.")


# ======================================================================
# 3. METHODOLOGY
# ======================================================================

h1("3. Methodology")

p("The target is a lab owned by the author, so authorisation is inherent; the assessment was "
  "an authenticated black-box test supplemented by source review. Two rules constrained it: "
  "requests were paced so the authentication limiter was never exhausted deliberately, and "
  "each finding required two independent confirmations — a runtime observation plus either a "
  "source-level explanation or a second engine's agreement.")

p("Every interesting endpoint requires an MFA-verified session, so authentication is the first "
  "task for any engine. The flow is two-step: a password post returns "
  "`{\"next\":\"verify\"}` and sets a pending session; a second post with a TOTP code "
  "promotes it. A helper prints the current code from the base32 secret so a scripted run is "
  "not blocked waiting for a phone.")

p("`tools/pentest-suite.mjs` (1,286 lines, dependency-free) implements twelve checks. Its "
  "principle is that every verdict is backed by a captured request and response, so the "
  "report quotes traffic rather than asserting a conclusion. Each check returns **passed**, "
  "**vulnerable** or **inconclusive** — the third state exists so a check that cannot reach a "
  "verdict does not silently count as a pass.")

tbl(["#", "Check", "Establishes"],
    [["1", "HTTP security headers", "Helmet active; expected headers present"],
     ["2", "Session cookie flags", "`HttpOnly`, `SameSite`, `Secure`"],
     ["3", "Anonymous access", "Protected endpoints reject unauthenticated callers"],
     ["4", "Cross-application access", "Bank session cannot read Acadia data, and vice versa"],
     ["5", "Vertical privilege", "Student session cannot reach admin routes"],
     ["6", "Tuition object authorisation", "Another user's tuition record is not readable"],
     ["7", "MFA brute-force resistance", "Lockout persists and resists guessing"],
     ["8", "Login enumeration", "The login response does not reveal account existence"],
     ["9", "Session rotation", "Identifier changes on authentication"],
     ["10", "Registration role control", "Registration cannot create an administrator"],
     ["11", "Authentication rate limiting", "Login attempts are throttled"],
     ["12", "HTTPS enforcement", "Plain HTTP redirects to HTTPS"]],
    widths=[0.7, 4.6, 9.9])
caption(doc, "Table 2. The twelve deterministic checks. Checks 6, 7 and 12 returned "
             "vulnerable. Check 8 covers the login endpoint only, which is why the "
             "registration oracle in §4.4 initially escaped it.")

p("Checks 4, 5 and 6 form a deliberate triad. Checks 4 and 5 are vertical and cross-tenant "
  "controls that hold; check 6 is a horizontal control within one tenant that does not. "
  "Reporting them together shows that authorisation is not uniformly broken, which is more "
  "accurate than 'authorisation is vulnerable'.")

p("`tools/ai-agent.mjs` gives an LLM three tools: `http_request`, `record_finding` and "
  "`finish`. The harness implements a **two-count measurement** — *claimed*, the number of "
  "findings the model asserts in its final message, and *detected*, the number the harness can "
  "confirm from responses the model actually received. The distinction matters because a "
  "model's final message summarises its own reasoning, and reasoning can discard correct "
  "conclusions. The recorded run exhibited exactly that, and the counts diverge by one.")

p(f"Shannon 3.6.1 is an autonomous pipeline of specialised agents for pre-reconnaissance, "
  f"reconnaissance, and per-class analysis and exploitation {c('shannon')}. It runs as a "
  f"Temporal workflow and emits a deliverable per phase. It cannot run inside the application "
  f"container — there is no Docker binary and no socket, a deliberate choice, since mounting "
  f"`/var/run/docker.sock` into a public-facing container grants effective root on the host. "
  f"It therefore runs under WSL2, driven by a host bridge that stages the source tree, passes "
  f"the lab's scan credentials and polls the workspace.")

p(f"Two conventional tools characterised the network and HTTP surface. `nmap` enumerated "
  f"published ports; `nikto` exercised the HTTP surface. Neither was expected to find the "
  f"application defects, and neither did — which is itself a result, since it shows that "
  f"conventional scanning and logic testing address disjoint parts of the surface.")

p("Ground truth required agreement between at least two of: source review identifying the "
  "defect, a runtime request demonstrating it, and a second engine's independent agreement. "
  "Four application weaknesses met that bar (F-01 to F-04); two configuration and header "
  "issues (F-05, F-06) are reported but excluded from the comparison, since no engine was "
  "tasked with them. Engines were scored on recall, false positives, wall-clock time and "
  "human interventions — the last added after the first run, because two of the three engines "
  "needed manual repair to continue.")

p(f"Four practices guarded against measurement error. **Negative controls:** every positive "
  f"result was paired with a request that should fail — the Acadia enrolment endpoint, tested "
  f"with the same identifier, correctly returned only the caller's own rows. **Provider "
  f"independence:** the agent's column used a model from a different provider than the "
  f"pipeline's. **Preserved failure:** failed runs were archived with their error logs. "
  f"**Re-execution:** the host rebooted mid-assessment; rather than reporting pre-reboot "
  f"figures, the suite was re-run and reproduced its result, and findings were re-verified "
  f"with a fresh session.")


# ======================================================================
# 4. FINDINGS
# ======================================================================

h1("4. Findings")

tbl(["ID", "Finding", "Severity", "Score", "Basis", "Found by"],
    [["F-01", "Broken object-level authorisation, tuition lookup", "Medium", "6.5",
      "Runtime, reproduced", "Suite, agent, pipeline"],
     ["F-02", "Account lockout counter resets at its own threshold", "Medium", "6.5",
      "Source, corroborated", "Suite, pipeline"],
     ["F-03", "SQL injection in `/api/lab/exploit/sqli`", "Medium", "6.5",
      "Runtime, reproduced", "Suite, pipeline"],
     ["F-04", "User enumeration via registration", "Medium", "5.3",
      "Runtime, reproduced", "**Pipeline only**"],
     ["F-05", "Plain HTTP served without redirect to HTTPS", "Low", "3.1",
      "Runtime, suite check", "Suite"],
     ["F-06", "Authentication responses lacked `Cache-Control`", "Low", "3.1",
      "Source, remediated", "Pipeline"]],
    widths=[1.1, 7.2, 1.6, 1.1, 3.0, 2.4])
caption(doc, "Table 3. Confirmed findings with CVSS 3.1 base scores, and which engine first "
             "reported each. F-04 is the only finding the deterministic suite was not written "
             "to detect.")

p("CVSS measures the severity of a technical weakness, not its importance. F-01 scores 6.5 "
  "because its impact is confined to confidentiality of one record class. It is nonetheless "
  "the most consequential finding, because any authenticated user can reach it with no special "
  "conditions and it discloses personal data at the scale of the student body. Remediation "
  "priority is therefore ordered by exploitability, not by score.")

h2("4.1 F-01 — Broken object-level authorisation  (Medium 6.5, CWE-639)")

p(f"The endpoint takes a student identifier from the path and binds it as the query parameter. "
  f"It validates the identifier's **format** but never asks whether the caller may see the "
  f"record it names {c('cwe639')}.")

code("const match = /^AC([0-9]{8})$/.exec(req.params.studentId.toUpperCase());\n"
     "const result = await pool.query(\n"
     "  `SELECT sp.display_name, sp.tuition_cents, sp.user_id\n"
     "     FROM student_profiles sp JOIN users u ON u.id=sp.user_id\n"
     "    WHERE sp.user_id=$1 AND u.app='acadia' AND u.role='student'`,\n"
     "  [Number(match[1])]        // <- from the URL, not from the session\n"
     ");",
     cap="Listing 1. `server.js:1449–1464`. The query is parameterised, so it is immune to "
         "injection; it is unauthorised, because `$1` is attacker-chosen.")

p("This distinction is the analytical core of the finding. `$1` is a bound parameter, so no "
  "payload can alter the statement — this is not injection. The defect is that the value bound "
  "to `$1` came from `req.params`, which the client controls, rather than "
  f"`req.session.userId`. Parameterisation and authorisation are orthogonal controls, and the "
  f"presence of the first is routinely mistaken for the second {c('saltzer', 'owaspapi')}.")

p("**Observation.** Signed in as `scan-bank`, whose own record is `AC00000063`:")

code("GET /api/bank/tuition/student/AC00000036\n"
     "Cookie: sim.sid=<scan-bank, MFA-verified session>\n"
     "\n"
     "HTTP/1.1 200 OK\n"
     "{\"student\":{\"studentId\":\"AC00000036\",\"name\":\"jass\",\"tuitionCents\":\"125000\"}}",
     cap="Listing 2. The session belongs to `scan-bank`; the record does not.")

p("A single leaked record could be dismissed as a slip. The identifier is sequential and "
  "range-checked only for format, so the suite walked the range. Fifteen distinct records were "
  "disclosed, each with a name and outstanding balance. One leaked record reads as a coding "
  "error; fifteen reads as the whole student body.")

p("**Negative control.** The Acadia enrolment endpoint binds its query to the session; "
  "supplying the same identifier returned only the caller's own enrolments, confirming the "
  "bank behaviour is a defect rather than a lab feature.")

p("**Remediation.** Constrain the query to rows the caller may see and return 404 for both "
  "not-found and not-yours: add `AND EXISTS (SELECT 1 FROM tuition_links tl WHERE "
  "tl.bank_user_id = $2 AND tl.student_user_id = sp.user_id)`, with `$2` bound to "
  "`req.session.userId`. Replace the sequential identifier with an unguessable reference so "
  "enumeration is not free.")

h2("4.2 F-02 — Account lockout that never accumulates  (Medium 6.5, CWE-307)")

p("The failure handler resets the counter at the same moment it sets the lock, so the counter "
  "can never exceed two.")

code("UPDATE users\n"
     "   SET failed_attempts =\n"
     "         CASE WHEN failed_attempts >= 2 THEN 0        -- resets at the threshold\n"
     "              ELSE failed_attempts + 1 END,\n"
     "       locked_until =\n"
     "         CASE WHEN failed_attempts >= 2\n"
     "              THEN now() + interval '30 seconds' ELSE NULL END\n"
     " WHERE id=$1",
     cap="Listing 3. `server.js:631–647`. Both CASE expressions read the same pre-update "
         "value, so the counter and the lock are set from one state and the counter discarded.")

p(f"Two wrong passwords set a 30-second lock and reset the counter to zero. When the lock "
  f"expires the account has a fresh budget of two attempts, and the cycle repeats "
  f"indefinitely: roughly 240 guesses per hour per account, with no escalation and no durable "
  f"lockout {c('cwe307')}. It is worse than having no lockout, because an operator reading the "
  f"schema would conclude lockout is implemented {c('pinkas')}. The suite's `mfa-brute-force` "
  f"check independently observed the lock releasing after about 31 seconds. That check sees "
  f"the behaviour from outside and cannot explain it; the source explains it.")

p("**Remediation.** Increment unconditionally and let the lock duration grow: "
  "`failed_attempts = failed_attempts + 1`, with `locked_until` set to "
  "`now() + (interval '1 minute' * LEAST(failed_attempts, 60))` once the count reaches five. "
  "Clear both fields only on successful authentication.")

h2("4.3 F-03 — SQL injection in the teaching endpoint  (Medium 6.5, CWE-89)")

p(f"The endpoint exists to demonstrate the difference between a parameterised and a "
  f"concatenated query, and runs both against the same input in the same read-only "
  f"transaction {c('cwe89', 'halfond')}.")

code("// correct: the payload is data, never syntax\n"
     "const safe   = await client.query(`${scoped} = $2 LIMIT 5`, [target, input]);\n"
     "// vulnerable: the payload becomes part of the SQL statement\n"
     "const unsafe = await client.query(`${scoped} = '${input}' LIMIT 5`, [target]);",
     cap="Listing 4. `server.js:1706–1717`. `$2` is bound; `${input}` is interpolated.")

p("A tautology widens the `label` predicate: the parameterised branch matches nothing, the "
  "concatenated branch becomes `WHERE label = '' OR '1'='1'` and matches every row in scope.")

code("POST /api/lab/exploit/sqli   {\"target\":\"bank\",\"input\":\"' OR '1'='1\"}\n"
     "\n"
     "{\"protectedQuery\":{\"matches\":0}, \"vulnerableQuery\":{\"matches\":2},\n"
     " \"exploited\":true,\n"
     " \"exfiltrated\":[{\"id\":\"103\",\"secret\":\"LAB-BANK-A\"},\n"
     "                {\"id\":\"104\",\"secret\":\"LAB-BANK-B\"}]}",
     cap="Listing 5. The contrast between 0 and 2 matches is the finding, not the boolean.")

p("**Why Medium rather than High.** Four constraints bound impact, each deliberate: an "
  "MFA-verified session is required (`PR:L`), the CTE pins the row set to one application, the "
  "transaction is `BEGIN READ ONLY`, and the endpoint is gated behind `LAB_VULNERABLE_MODE`. "
  "Integrity and availability impact are None.")

p("**Provenance.** The pipeline first flagged this and rated it `Confidence: MEDIUM`, "
  "recording it *validation blocked* — its log read 'Rate limiting on /api/auth prevents "
  "obtaining MFA-verified session'. That blocker was a harness defect, repaired in Section 6, "
  "after which the injection was verified directly.")

h2("4.4 F-04 — User enumeration through registration  (Medium 5.3, CWE-204)")

p(f"This is the one finding the deterministic suite did not detect, because its enumeration "
  f"check covers the **login** endpoint and registration was never in scope. The pipeline "
  f"found it, exploited it, and recorded proof. It exploits an observable response "
  f"discrepancy {c('cwe204')}: registration answers the question *does this username exist?* "
  f"for any username, without authentication.")

code("POST /api/auth/register   {\"app\":\"bank\",\"username\":\"scan-bank\",...}\n"
     "  -> 409  {\"error\":\"Username already exists\"}\n"
     "\n"
     "POST /api/auth/register   {\"app\":\"bank\",\"username\":\"enum_probe_1795536400\",...}\n"
     "  -> 201  {\"message\":\"Account created. Please sign in.\"}",
     cap="Listing 6. Verified against the live target. The 409 leaks existence; the 201 "
         "leaks absence. The probe account was deleted immediately afterwards.")

p("The mechanism is a unique-constraint violation surfaced directly to the client: the "
  "handler catches PostgreSQL error `23505` and returns `Username already exists` "
  "(`server.js:522`). Every other successful path returns 201, so the two responses are "
  "distinguishable by status code alone.")

p("**Impact.** Enumeration alone does not grant access. It converts a blind credential-stuffing "
  "campaign into a targeted one, and combined with F-02's 240-guesses-per-hour budget it "
  "materially shortens the path from a leaked password list to a valid session. Scored 5.3 as "
  "`AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`: no privileges, no interaction, confidentiality only.")

p("**Why this finding matters beyond itself.** The suite scored 3 of 3 against its own ground "
  "truth and would have been reported as full recall. Extending ground truth by one finding "
  "reveals that its coverage had a hole — and the hole was in exactly the place a scripted "
  "suite is weakest, a second endpoint implementing an already-tested concept. That is the "
  "argument for running engines in combination rather than choosing between them.")

p("**Remediation.** Return a uniform response from registration and send confirmation "
  "out-of-band, or require email verification before revealing that a name is taken. If the "
  "product must report the conflict, do so after a rate-limited, authenticated step.")

h2("4.5 F-05 and F-06 — Low-severity observations")

p(f"**F-05 — Plain HTTP without redirect (Low 3.1, CWE-319).** The published port 80 serves "
  f"the application directly with no redirect {c('cwe319')}. HSTS is sent, so a browser that "
  f"has seen the HTTPS response will not fall back, but a first visit over `http://` is "
  f"cleartext. The fix is a `redir https://{{host}}{{uri}} permanent` at the edge {c('rfc6797')}.")

p(f"**F-06 — Authentication responses lacked `Cache-Control` (Low 3.1, CWE-525).** Helmet does "
  f"not set it and the auth routes set none of their own, so responses describing session and "
  f"MFA state were cacheable {c('cwe525', 'express')}. Remediated with `no-store` and "
  f"`Pragma: no-cache` applied to the whole `/api/auth` prefix, confirmed on the live response.")

h2("4.6 Controls verified to hold")

tbl(["Control tested", "Result", "Mechanism"],
    [["Student session against admin routes", "403", "Role check in route middleware"],
     ["Bank session reading Acadia data", "Refused", "`requireApp` plus `app` column scoping"],
     ["Injection in transfer, Acadia and school routes", "Not vulnerable",
      "Parameterised statements throughout"],
     ["Terminal command injection", "Blocked",
      "Allowlist, `shell:false`, metacharacter rejection"],
     ["Password storage / TOTP at rest", "Argon2id / AES-256-GCM", "`argon2.verify`, external key"],
     ["Session fixation / login enumeration", "Defeated / resisted",
      "`regenerate()`; uniform login error"],
     ["Registration privilege escalation", "Blocked", "Role validated server-side"]],
    widths=[6.6, 3.4, 5.2])
caption(doc, "Table 4. Controls tested and confirmed with live requests, not assumed. Note the "
             "last row: role escalation is blocked while username existence is disclosed — the "
             "same handler is careful about one property and careless about the other.")

p("The application's injection defences are uniformly sound, while its authorisation and "
  "disclosure behaviour fails in two specific places. That is the opposite of what one might "
  "expect from a teaching application, and it is what makes these findings credible rather "
  "than laboratory artefacts: ordinary mistakes in otherwise careful code.")


# ======================================================================
# 5. THE MULTI-AGENT PIPELINE
# ======================================================================

h1("5. Running the Multi-Agent Pipeline")

p("The pipeline required four attempts, and the attempts themselves are a result: three failed "
  "for reasons the tool did not report, and diagnosing them required building instrumentation "
  "that the engine lacks.")

h2("5.1 Model selection")

p(f"A working OpenAI-compatible key was supplied for OpenRouter {c('openrouter')}. Shannon "
  f"needs a model with reliable tool calling, a large context window to hold source files, and "
  f"an output-token ceiling it can actually reserve. Four candidates were screened against a "
  f"reproduced workload — a system prompt, three tool definitions, a multi-turn exchange "
  f"carrying large tool results, and an instruction forcing another call. All four passed, "
  f"each returning a tool call whose arguments parsed as JSON:")

tbl(["Model", "Cost in / out per M", "Context", "Screen result"],
    [["`z-ai/glm-5.3-flash`", "$0.15 / $0.50", "1,048,576", "tool call, valid JSON"],
     ["`qwen/qwen3.7-flash`", "$0.03 / $0.13", "1,000,000", "tool call, valid JSON"],
     ["`openai/gpt-oss-120b`", "$0.05 / $0.25", "131,072", "tool call, valid JSON"],
     ["`deepseek/deepseek-v4-flash`", "$0.05 / $0.30", "1,048,576", "tool call, valid JSON"],
     ["`nvidia/nemotron-3.5-lightning:free`", "$0 / $0", "1,000,000", "tool call, valid JSON"]],
    widths=[5.4, 3.4, 2.6, 3.8])
caption(doc, "Table 5. Model screen. Capability was not the differentiator — every candidate "
             "worked. What separated them was cost and the provider's credit reservation.")

h2("5.2 Attempts and what each revealed")

tbl(["#", "Model", "Outcome", "Cost", "Turns"],
    [["1", "`glm-5.3-flash`", "pre-recon failed at 2 m 0 s", "$0.0579", "5"],
     ["2", "`gpt-oss-120b`", "pre-recon failed at 9 m 22 s", "$0.0567", "19"],
     ["3", "`gpt-oss-120b` via proxy", "0 requests reached the proxy", "$0.0000", "0"],
     ["4", "`nemotron-3.5-lightning:free`", "**reached exploitation**, then daily quota",
      "$0.0000", "—"]],
    widths=[0.8, 5.4, 6.4, 2.0, 1.2])
caption(doc, "Table 6. Pipeline attempts. Attempt 4 is the evidence that the harness itself "
             "works end to end.")

p("Attempts 1 and 2 failed with the same opaque error: `AGENT_EXECUTION_FAILED`, category "
  "`unknown`, and an `error.log` recording only `errorMessageLength: 521` rather than the "
  "message. The sub-agents failed progressively faster — 1 m 35 s, then 12.3 s, 293 ms, "
  "284 ms — which is the signature of a provider rejecting requests rather than of a model "
  "fault. The cause was not recoverable from the engine's own logs.")

h2("5.3 Instrumentation")

p("Because the engine discards the upstream response, a proxy was written to sit between it "
  "and the provider. The proxy caps concurrency, paces requests, retries 429 and 5xx with "
  "exponential backoff, and logs every upstream status and error body. It is thirty lines of "
  "policy and a hundred of plumbing, and it converted an opaque failure into a specific one.")

p("One placement error is worth recording because it consumed an attempt. The proxy was first "
  "run inside WSL on `127.0.0.1`. The pipeline's agents run in worker **containers**, where "
  "`127.0.0.1` is the container itself, so no request ever reached it — the run failed in 2 m "
  "13 s at `$0.0000` with zero requests logged. Moving the proxy to the Windows host and "
  "addressing it as `host.docker.internal` produced 64 successful upstream calls within forty "
  "seconds of starting the scan.")

h2("5.4 What the instrumentation found")

code("HTTP 402\n"
     "{\"error\":{\"message\":\"This request requires more credits, or fewer max_tokens. \"\n"
     "  \"You requested up to 65536 tokens, but can only afford 16126.\"}}\n"
     "\n"
     "HTTP 429\n"
     "{\"error\":{\"message\":\"Rate limit exceeded: free-models-per-day. \"\n"
     "  \"Add 10 credits to unlock 1000 free model requests per day\"}}",
     cap="Listing 7. The two provider responses the engine never surfaced. Both were also "
         "produced by a deliberately invalid key test that isolated the cause.")

p("The account behind the key held zero credit: `total_credits: 0`, "
  "`total_usage: 0.152569`. The `limit: 5` reported by the key endpoint is a spending cap, not "
  "a balance — an easy and expensive misreading. Shannon requests 65,536 output tokens per "
  "call, and against an empty balance the provider's reservation check fails immediately, "
  "which is why runs died in pre-recon with no visible cause.")

p("A secondary boundary appeared at high call volume: 143 retries at 429, 73 successes and 16 "
  "gave-up requests within ten minutes. Free-tier limits are per-minute as well as per-day, so "
  "a fan-out of parallel agents exhausts them even when credit is available. The proxy's "
  "concurrency cap is the mitigation, and it is why the fourth attempt reached exploitation "
  "rather than failing in pre-recon.")

p("**Interpretation.** None of this is a defect in the target, and none of it is a fault of the "
  "pipeline's reasoning. It is the operational layer — credentials, quotas, network topology — "
  "which published evaluations almost never report and which consumed the majority of the "
  "effort in this study.")

h2("5.5 What the pipeline found when it ran")

p("Across its completed analysis phases the pipeline produced six distinct findings, one of "
  "which it **exploited** (F-04). It also reported three items that are not vulnerabilities, "
  "and its own earlier run had correctly marked two of them safe — a precision failure worth "
  "stating rather than omitting:")

tbl(["Reported item", "Verdict", "Reason"],
    [["`POST /api/bank/send-money`", "False positive",
      "Handler contains `br.owner_user_id = $2` bound to the session; the earlier run marked "
      "it SAFE citing that predicate"],
     ["`POST /api/bank/recipients`", "False positive",
      "Adding a payee is ordinary banking behaviour; the transfer is gated by the check above"],
     ["`POST /api/bank/pay-tuition`", "Design, not a flaw",
      "Payer spends their own funds to credit a student's balance — the feature working"]],
    widths=[4.6, 2.6, 8.0])
caption(doc, "Table 7. Items the pipeline reported that do not survive scrutiny. Two are "
             "reconciled by a single missing SQL predicate.")

p("Its negative results are more valuable than its false positives. It validated five SSRF "
  "sinks, nineteen authorisation surfaces and every production query as safe, in each case "
  "naming the guard that makes the surface safe. That is review work a human would otherwise "
  "repeat, and it agrees with the suite's checks 4 and 5 — independent agreement on the "
  "negatives being as useful as on the positives.")


# ======================================================================
# 6. HARNESS DEFECTS
# ======================================================================

h1("6. Defects in the Harness")

p("Six defects were found in the test infrastructure rather than the target. They are reported "
  "because each silently prevented an engine from working, and a report omitting them would "
  "attribute engine failures to the engines.")

tbl(["Defect", "Observed effect", "Fix"],
    [["Origin guard rejected any POST without an `Origin` header",
      "Every command-line client got `403 Invalid request origin`; an agent retried for most "
      "of an hour", "Absent `Origin` allowed; mismatched still `403`"],
     ["Limiter counted successful logins and keyed on address alone",
      "All traffic arrives via Caddy, so the deployment shared one bucket; a scan exhausted it "
      "in minutes", "`skipSuccessfulRequests`; key is address + account"],
     ["`/api/auth/verify` has no username to key on",
      "Every user shared one MFA bucket; 30 wrong codes by anyone blocked MFA for everyone",
      "Key falls back to `req.session.pendingId`"],
     ["Lab table absent from the schema, seeded for one target",
      "The second target's variant returned nothing; a fresh deployment had no table",
      "Added to `schema.sql` with rows for both targets"],
     ["Report route accepted any `?format`",
      "`?format=pdf` appeared to succeed while serving Markdown",
      "`md` and `json` served; anything else `415`"],
     ["**Engine discarded the provider's error body**",
      "Three runs failed with `category: unknown` and an error *length* instead of the message; "
      "the actual cause (zero credit) was invisible",
      "Not fixable in the engine — a logging proxy was interposed"]],
    widths=[4.4, 6.6, 4.2])
caption(doc, "Table 8. Harness defects and repairs. The last row is a defect in the engine "
             "rather than the lab, and it cost more time than the other five combined.")

p("The first is the most consequential of the lab defects. Requests without an `Origin` header "
  f"are not a CSRF risk — a browser always sends `Origin` on a cross-origin state-changing "
  f"request, and `SameSite=strict` provides a second layer {c('barth2008', 'rfc6265')}. "
  f"Rejecting them blocked every legitimate non-browser client while adding no protection. The "
  f"corrected rule keeps the check that matters: a request that **does** carry an `Origin`, "
  f"and carries the wrong one, is still refused. The second and third are the same mistake in "
  f"two places: keying a limiter on a value that is not unique per client behind a proxy.")

h2("6.1 Network and HTTP scanning")

p("`nmap` reported `80/tcp open`, `443/tcp closed`, `3000/tcp closed` and `5432/tcp open "
  "postgresql`. The PostgreSQL listener is worth flagging even though it lies outside "
  "application scope: it was confirmed bound to all interfaces rather than loopback. On an "
  "overlay-reachable host that is a real exposure, since the application reaches it via "
  "`host.docker.internal` and does not need a public listener. `nikto` completed 7,970 requests "
  "with no errors and reported three items — a Caddy banner, an uncommon `origin-agent-cluster` "
  "header and a missing `Permissions-Policy` — none of which is a vulnerability. Their value is "
  "as a control on the tooling: a scanner reporting only noise has correctly characterised a "
  "surface whose real defects are in logic rather than configuration.")


# ======================================================================
# 7. DISCUSSION AND CONCLUSIONS
# ======================================================================

h1("7. Discussion and Conclusions")

p("**The oracle determines the outcome.** The engines did not differ chiefly in reasoning power "
  "but in whether they possessed an oracle: a deterministic predicate converting an observation "
  "into a verdict. The suite has one for every check — check 6 knows the session's own "
  "identifier, so a record returned for a different one is a defect by definition. The agent "
  "had the observation but not the predicate, and fell back on a heuristic ('a 200 to a GET is "
  "normal') that is correct in general and wrong here. The pipeline was designed with an "
  "exploitation phase that is exactly such an oracle, and it is where F-04 was proven rather "
  "than merely suspected.")

p("**Coverage is a property of the questions asked.** The suite reported full recall against "
  "its own ground truth while never testing registration for enumeration. Adding F-04 moved the "
  "suite from 3 of 3 to 3 of 4 without a single line of its code changing. Recall figures are "
  "only interpretable against a ground truth whose construction is disclosed, and that "
  "disclosure is what most comparisons omit.")

p("**Determinism and prior knowledge.** Read naively, 3 findings in 41 seconds against 0 in 42 "
  "minutes says deterministic testing wins outright. That reading would be wrong. The suite was "
  "written by someone who already knew the answers: its twelve checks encode expert knowledge of "
  "this application's endpoints, identifiers and correct responses. It is not an independent "
  f"tester but a regression test for hypotheses a human already formed — comparing it with an "
  f"agent that must discover those hypotheses compares a solution with a search "
  f"{c('happe', 'pentestgpt')}. The comparison establishes complementarity: the suite's "
  f"advantage is cost and repeatability, the pipeline's is that it found something nobody had "
  f"thought to check.")

p("**Operational failure dominates.** Six of the failures observed had nothing to do with "
  "detection: a header rejection, two limiter keying errors, a missing table, an incorrect "
  "content type, and an engine that discards the provider's error message. Published "
  "evaluations rarely report these events, yet here they accounted for the majority of engine "
  "failures and most of the elapsed time. Reporting detection rates without operational "
  "reliability inflates apparent capability — and, as Section 5 shows, an engine that cannot "
  "report *why* it failed cannot be diagnosed without external instrumentation.")

p(f"**Threats to validity.** This is a single-case design {c('wohlin', 'runeson')}. Recall is "
  f"measured against four findings, a narrow construct. The ground truth was constructed by the "
  f"author and inherits his blind spots — a defect nobody noticed is absent from the "
  f"denominator, which is exactly how F-04 escaped for most of the work. Each engine ran once "
  f"per configuration, so no variance estimate exists. One application, one stack, one scale. "
  f"And the pipeline's run never completed: its analysis phases produced findings, but its "
  f"consolidated report was never written, so its output here is reconstructed from "
  f"deliverables rather than delivered by the tool.")

h2("7.1 Conclusions")

p("**First, the application's defects are ordinary and its controls are not.** One missing "
  "constraint in an already-parameterised query disclosed fifteen students' tuition records to "
  "an authenticated stranger; one leaked unique-constraint error disclosed whether any username "
  "exists. Every injection defence held, as did every role check, the password hashing, session "
  "rotation and transport controls. Injection and authorisation are orthogonal, and so are "
  "authorisation and information disclosure.")

p("**Second, the oracle and the question set jointly determine what is found.** The suite "
  "reported 3 of 3 with no false positives because it asked three questions and answered each "
  "deterministically. The agent detected 1 and reported 0 because it lacked a baseline. The "
  "pipeline found 4 including one no one had asked about, and reported 3 false positives "
  "because its exploitation phase — the adjudicator — never completed. Neither coverage nor "
  "precision is a property of the model alone.")

p("**Third, operational reliability dominates and is under-reported.** Most engine failures "
  "here were caused by the harness or the provider, not the target: expired and unfunded "
  "credentials, per-minute and per-day quotas, container network topology, and an engine that "
  "logs the length of an error instead of its text.")

p("Four implications follow: keep a deterministic regression suite, since every "
  "human-confirmed finding should become a check; give agents a baseline before a target, so "
  "they compare a record against their own; treat limiter keying and error surfacing as design "
  "decisions rather than defaults, because a limiter keyed on a proxy address and an error "
  "logged as a length are both silent failures; and preserve failed runs, because a run that "
  "fails is evidence. Future work should repeat each trial to separate reliability from luck, "
  "match prior knowledge between engines, fund a complete pipeline run so its reporting phase "
  "can be assessed rather than reconstructed, and extend ground truth to XSS and SSRF — neither "
  "of which any engine assessed here.")


# ======================================================================
# REFERENCES
# ======================================================================

h1("References")

pref = doc.add_paragraph()
r = pref.add_run("Numbered in order of first citation. Web resources accessed 24 November 2026. "
                 "The full edition carries the source-code appendix, reproduction commands and "
                 "the evidence inventory.")
r.font.size = Pt(7.6)
r.italic = True
r.font.color.rgb = GREY
pref.paragraph_format.space_after = Pt(3)


def ref_entry(number, text):
    para = doc.add_paragraph()
    para.paragraph_format.left_indent = Cm(0.8)
    para.paragraph_format.first_line_indent = Cm(-0.8)
    para.paragraph_format.space_after = Pt(1.2)
    para.paragraph_format.line_spacing = 1.0
    r = para.add_run(f"[{number}]  ")
    r.font.size = Pt(7.5)
    for part in re.split(r"(\*[^*]+\*)", text):
        if not part:
            continue
        if part.startswith("*") and part.endswith("*") and len(part) > 2:
            rr = para.add_run(part[1:-1])
            rr.italic = True
        else:
            rr = para.add_run(part)
        rr.font.size = Pt(7.5)


for _i, (_key, _text) in enumerate(REFS, start=1):
    ref_entry(_i, _text)


# ======================================================================
# SAVE
# ======================================================================

doc.core_properties.title = (
    "An Empirical Comparison of Deterministic, LLM-Agentic and Multi-Agent "
    "Penetration Testing"
)
doc.core_properties.subject = (
    "Penetration test report (condensed edition) — AI Smartphone Security Simulator"
)
doc.core_properties.author = "[Student name]"
doc.core_properties.keywords = (
    "penetration testing; BOLA; SQL injection; user enumeration; LLM agents; "
    "multi-agent systems; CVSS"
)
doc.core_properties.comments = (
    "Condensed edition. The full edition carries the source-code appendix, "
    "reproduction commands and evidence inventory."
)

doc.save(OUT)
print(f"written: {OUT}")
print(f"size:    {OUT.stat().st_size} bytes")

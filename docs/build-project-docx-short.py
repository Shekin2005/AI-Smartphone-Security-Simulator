#!/usr/bin/env python3
"""
Builds the condensed Word edition of the project report.

    python docs/build-project-docx-short.py

Output: docs/AI-Smartphone-Security-Simulator-Report-Short.docx

This is the same assessment as the full report, compressed to a submission
length of about eight pages: every finding, the engine comparison and the full
reference list are retained; the background chapter, the reproduction
appendices and the long code listings are not. The full edition remains the
reference document and carries the appendices.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from docx_framework import (  # noqa: E402
    ACCENT, CODE_FONT, GREY, REFS, add_runs, c, caption, code_block,
    footer_page_numbers, new_document, page_break, table,
)
from docx.enum.text import WD_ALIGN_PARAGRAPH  # noqa: E402
from docx.shared import Cm, Pt, RGBColor  # noqa: E402

OUT = Path(__file__).parent / "AI-Smartphone-Security-Simulator-Report-Short.docx"

BODY = 10.0
SMALL = 8.0
CODE = 7.5

doc = new_document()

# Tighter page for a short document: the full edition's margins waste space.
for s in doc.sections:
    s.top_margin = Cm(1.9)
    s.bottom_margin = Cm(1.7)
    s.left_margin = Cm(2.1)
    s.right_margin = Cm(1.9)

doc.styles["Normal"].font.size = Pt(BODY)
doc.styles["Normal"].paragraph_format.space_after = Pt(4)

footer_page_numbers(doc, "AI Smartphone Security Simulator — Penetration Test Report")


# Compact helpers so the content below stays readable.
def h1(text):
    p = doc.add_heading(level=1)
    r = p.add_run(text)
    r.font.size = Pt(13)
    r.font.name = "Calibri"
    r.font.color.rgb = ACCENT
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    return p


def h2(text):
    p = doc.add_heading(level=2)
    r = p.add_run(text)
    r.font.size = Pt(10.5)
    r.font.name = "Calibri"
    r.font.color.rgb = ACCENT
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    return p


def p(text, size=BODY, space=4, italic=False):
    para = doc.add_paragraph()
    para.paragraph_format.space_after = Pt(space)
    para.paragraph_format.line_spacing = 1.05
    add_runs(para, text, size=size, italic=italic)
    return para


def bl(text, size=BODY):
    para = doc.add_paragraph(style="List Bullet")
    para.paragraph_format.space_after = Pt(1.5)
    para.paragraph_format.line_spacing = 1.05
    add_runs(para, text, size=size)
    return para


def code(text, cap=None):
    return code_block(doc, text, size=CODE, caption=cap)


def tbl(headers, rows, widths):
    return table(doc, headers, rows, widths=widths, size=SMALL, keep_together=True)


# ======================================================================
# TITLE + ABSTRACT  (page 1)
# ======================================================================

p1 = doc.add_paragraph()
r = p1.add_run("An Empirical Comparison of Deterministic, LLM-Agentic and "
               "Multi-Agent Penetration Testing")
r.bold = True
r.font.size = Pt(17)
r.font.color.rgb = ACCENT
p1.paragraph_format.space_after = Pt(2)

p2 = doc.add_paragraph()
r = p2.add_run("A case study of the AI Smartphone Security Simulator")
r.font.size = Pt(11)
r.italic = True
r.font.color.rgb = GREY
p2.paragraph_format.space_after = Pt(3)

p3 = doc.add_paragraph()
r = p3.add_run("[Student name]  ·  [Student ID]  ·  [Module code and title]  ·  "
               "[Institution]  ·  Supervisor: [Supervisor]  ·  24 November 2026")
r.font.size = Pt(8.5)
r.font.color.rgb = GREY
p3.paragraph_format.space_after = Pt(2)

p4 = doc.add_paragraph()
r = p4.add_run("Target: https://shekin.tail97139a.ts.net  ·  Node.js 22 / Express 5  ·  "
               "PostgreSQL 18  ·  Caddy 2  ·  Tailscale Funnel")
r.font.size = Pt(8.5)
r.font.color.rgb = GREY
p4.paragraph_format.space_after = Pt(8)

h1("Abstract")

p("This report documents an authenticated penetration test of a self-hosted training "
  "application and uses it to compare three assessment approaches: a deterministic scripted "
  "suite, a large-language-model (LLM) agent inside the container, and a commercial "
  "multi-agent pipeline. The target is a Node.js/Express system exposing two deliberately "
  "vulnerable applications — a retail bank and a student information system — behind "
  "password and TOTP authentication.")

p("Twelve scripted checks established ground truth in 41 seconds: nine controls held and "
  "three weaknesses were confirmed — a broken object-level authorisation flaw disclosing "
  "fifteen students' tuition records to an unrelated bank account, an account lockout whose "
  "failure counter resets at its own threshold, and a SQL injection in a teaching endpoint. "
  "The suite achieved full recall (3 of 3) with no false positives. The LLM agent detected "
  "1 of 3 and reported none. The pipeline completed four analysis phases and produced no "
  "consolidated report after its model provider revoked access.")

p("A second result is unplanned. Five defects in the test harness — not the target — each "
  "silently prevented automated clients from authenticating, and together explain most of "
  "the divergence between engines. The report argues that what separates a usable automated "
  "result from an unusable one is the presence of an oracle: a deterministic predicate that "
  "converts an observation into a verdict. Reproducibility, not autonomy, is the property "
  "that makes a finding usable as evidence.")

pe = doc.add_paragraph()
r = pe.add_run("Keywords: ")
r.bold = True
r.font.size = Pt(9)
r = pe.add_run("penetration testing; broken object-level authorisation; SQL injection; "
               "authentication; large language models; security automation; CVSS; "
               "reproducibility.")
r.italic = True
r.font.size = Pt(9)
pe.paragraph_format.space_after = Pt(2)


# ======================================================================
# 1. INTRODUCTION AND AIMS
# ======================================================================

h1("1. Introduction and Aims")

p(f"Penetration testing is the most direct way to establish whether a system resists attack, "
  f"but it is expensive and irreducibly non-deterministic: two testers given the same target "
  f"produce different reports. Standard process models acknowledge this. NIST SP 800-115 "
  f"divides the work into planning, discovery, attack and reporting {c('nist115')}, and PTES "
  f"adds pre-engagement and post-exploitation {c('ptes')}; surveys find the same open "
  f"problems of coverage and repeatability {c('bertoglio', 'felderer')}.")

p("Automation has long covered discovery — scanners are mature, cheap and loud — but not the "
  "judgement step: deciding whether a response constitutes a vulnerability. That step is "
  "where testers spend their time, and it is what recent LLM agents claim to automate "
  f"{c('pentestgpt', 'happe')}. Such claims are hard to evaluate without ground truth. If an "
  f"agent reports a vulnerability, it must be independently confirmed; if it reports nothing, "
  f"the tester cannot distinguish a secure system from a failed agent.")

p("This project takes the complementary approach: build a lab whose vulnerabilities are known "
  "by construction, instrument it, run three engines against it, and score them against that "
  "ground truth. The aim was to determine which classes of vulnerability each engine finds, "
  "at what cost, and with what reliability. The objectives were to build the instrumented "
  "target (O1), implement a suite whose every verdict is backed by captured traffic (O2), run "
  "an LLM agent and record both what it claimed and what its traffic proved (O3), run a "
  "multi-agent pipeline and preserve its deliverables even on failure (O4), and score all "
  "three on recall and false positives (O5).")


# ======================================================================
# 2. SYSTEM UNDER TEST
# ======================================================================

h1("2. System Under Test")

p("A single host runs three containers, a host-installed PostgreSQL instance and a Tailscale "
  f"Funnel publishing the application over HTTPS {c('docker')}. Two applications share one "
  "Express process and one database, separated by an `app` column and route middleware. The "
  "**bank** application provides balances, transfers and tuition payment (`bank_user`); the "
  "**Acadia** application provides enrolment, grades and service requests (`student` or "
  "`admin`). A third surface, the **Attack Lab**, exposes deliberately vulnerable endpoints "
  "to authenticated users.")

tbl(["Layer", "Component", "Exposure"],
    [["Client", "Browser or command-line HTTP client", "Internet"],
     ["Edge", "Tailscale Funnel, TLS termination", "Public hostname, 443"],
     ["Proxy", "Caddy 2 (`sim-caddy`)", "Host port 80"],
     ["Application", "Node 22 / Express 5 (`sim-app`)", "Internal 3000"],
     ["Data", "PostgreSQL 18.3", "Host 5432"],
     ["Orchestration", "Temporal 1.7.0 (`shannon-temporal`)", "Internal"]],
    widths=[2.6, 7.4, 5.4])
caption(doc, "Table 1. Deployment layers. The application publishes no port directly; all "
             "inbound traffic traverses Caddy.")

p("Two consequences shaped the assessment. Because every request arrives from the Caddy "
  "container, the application sees one source address for all clients — so a rate limiter "
  "keyed on address applies to the whole deployment rather than to one client. And because "
  "TLS terminates at Tailscale, the application speaks plain HTTP, which is why the suite "
  "reports a missing redirect at the published port while the public URL is correctly served "
  "over TLS.")

p("The deliberate vulnerability design matters for interpreting results. The lab endpoint is "
  "gated behind `LAB_VULNERABLE_MODE` and an MFA-verified session; its query pins the row set "
  "to one application through a materialised CTE and runs inside `BEGIN READ ONLY`. The "
  "injection is therefore real but contained. By contrast, the tuition lookup is not gated at "
  "all: it is ordinary application code and would be exploitable in any deployment, which is "
  "why it carries the highest practical significance here.")

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
     ["8", "Login enumeration", "Response does not reveal account existence"],
     ["9", "Session rotation", "Identifier changes on authentication"],
     ["10", "Registration role control", "Registration cannot create an administrator"],
     ["11", "Authentication rate limiting", "Login attempts are throttled"],
     ["12", "HTTPS enforcement", "Plain HTTP redirects to HTTPS"]],
    widths=[0.7, 4.4, 10.3])
caption(doc, "Table 2. The twelve deterministic checks. Checks 6, 7 and 12 returned "
             "vulnerable on the recorded run.")

p("Checks 4, 5 and 6 form a deliberate triad. Checks 4 and 5 are vertical and cross-tenant "
  "controls that hold; check 6 is a horizontal control within one tenant that does not. "
  "Reporting them together shows that authorisation is not uniformly broken, which is more "
  "accurate than 'authorisation is vulnerable'.")

p("`tools/ai-agent.mjs` gives an LLM three tools: `http_request`, `record_finding` and "
  "`finish`. The harness implements a **two-count measurement** — *claimed*, the number of "
  "findings the model asserts in its final message, and *detected*, the number the harness "
  "can confirm from responses the model actually received. The distinction matters because a "
  "model's final message summarises its own reasoning, and reasoning can discard correct "
  "conclusions. The recorded run exhibited exactly that, and the counts diverge by one.")

p(f"Shannon is an autonomous pipeline of specialised agents for pre-reconnaissance, "
  f"reconnaissance, and per-class analysis and exploitation {c('shannon')}. It cannot run "
  f"inside the application container — there is no Docker binary and no socket, a deliberate "
  f"choice, since mounting `/var/run/docker.sock` into a public-facing container grants "
  f"effective root on the host. It therefore runs under WSL2 behind a small HTTP bridge.")

p(f"Two conventional tools characterised the network and HTTP surface. `nmap` enumerated "
  f"published ports; `nikto` exercised the HTTP surface. Neither was expected to find the "
  f"application defects, and neither did — which is itself a result, since it shows that "
  f"conventional scanning and logic testing address disjoint parts of the surface.")

p("Ground truth required agreement between at least two of: source review identifying the "
  "defect, a runtime request demonstrating it, and a second engine's independent agreement. "
  "Three application vulnerabilities met that bar (F-01, F-02, F-03); two configuration and "
  "header weaknesses (F-04, F-05) are reported but excluded from the comparison, since no "
  "engine was tasked with them. Engines were scored on recall, false positives, wall-clock "
  "time and human interventions — the last added after the first run, because two of the "
  "three engines needed manual repair to continue.")

p(f"Four practices guarded against measurement error. **Negative controls:** every positive "
  f"result was paired with a request that should fail — the Acadia enrolment endpoint, tested "
  f"with the same identifier, correctly returned only the caller's own rows. **Provider "
  f"independence:** the agent's column used a model from a different provider than the "
  f"pipeline's. **Preserved failure:** failed runs were archived with their error logs. "
  f"**Re-execution:** the host rebooted mid-assessment; rather than reporting pre-reboot "
  f"figures, the suite was re-run and reproduced its result, and findings were re-verified "
  f"with a fresh session. The numbers below are from the post-reboot run.")


# ======================================================================
# 4. FINDINGS
# ======================================================================

h1("4. Findings")

tbl(["ID", "Finding", "Severity", "Score", "Basis"],
    [["F-01", "Broken object-level authorisation, tuition lookup", "Medium", "6.5",
      "Runtime, reproduced"],
     ["F-02", "Account lockout counter resets at its own threshold", "Medium", "6.5",
      "Source, corroborated at runtime"],
     ["F-03", "SQL injection in `/api/lab/exploit/sqli`", "Medium", "6.5",
      "Runtime, reproduced"],
     ["F-04", "Plain HTTP served without redirect to HTTPS", "Low", "3.1",
      "Runtime, suite check"],
     ["F-05", "Authentication responses lacked `Cache-Control`", "Low", "3.1",
      "Source, remediated"]],
    widths=[1.2, 8.0, 1.8, 1.2, 4.4])
caption(doc, "Table 3. Confirmed findings, with CVSS 3.1 base scores. Both 6.5 findings sit "
             "in the Medium band (4.0–6.9).")

p("CVSS measures the severity of a technical weakness, not its importance. F-01 scores 6.5 "
  "because its impact is confined to confidentiality of one record class. It is nonetheless "
  "the most consequential finding, because any authenticated user can reach it with no "
  "special conditions and it discloses personal data at the scale of the student body. "
  "Remediation priority is therefore ordered by exploitability, not by score.")

h2("4.1 F-01 — Broken object-level authorisation  (Medium 6.5, CWE-639)")

p(f"The endpoint takes a student identifier from the path and binds it as the query "
  f"parameter. It validates the identifier's **format** but never asks whether the caller may "
  f"see the record it names {c('cwe639')}.")

code("app.get(\"/api/bank/tuition/student/:studentId\", requireApp(\"bank\"), async (req,res) => {\n"
     "  const match = /^AC([0-9]{8})$/.exec(req.params.studentId.toUpperCase());\n"
     "  if(!match) return res.status(400).json({error:\"Use a simulator student ID\"});\n"
     "  const result = await pool.query(\n"
     "    `SELECT sp.display_name, sp.tuition_cents, sp.user_id\n"
     "       FROM student_profiles sp JOIN users u ON u.id=sp.user_id\n"
     "      WHERE sp.user_id=$1 AND u.app='acadia' AND u.role='student'`,\n"
     "    [Number(match[1])]        // <- from the URL, not from the session\n"
     "  );\n"
     "  ...",
     cap="Listing 1. `server.js:1449–1464`. The query is parameterised, so it is immune to "
         "injection; it is unauthorised, because `$1` is attacker-chosen.")

p("This distinction is the analytical core of the finding. `$1` is a bound parameter, so no "
  "payload can alter the statement — this is not injection. The defect is that the value "
  "bound to `$1` came from `req.params`, which the client controls, rather than "
  "`req.session.userId`. Parameterisation and authorisation are orthogonal controls, and the "
  f"presence of the first is routinely mistaken for the second {c('saltzer', 'owaspapi')}.")

p("**Observation.** Signed in as `scan-bank`, whose own record is `AC00000063`:")

code("GET /api/bank/tuition/student/AC00000036\n"
     "Cookie: sim.sid=<scan-bank, MFA-verified session>\n"
     "\n"
     "HTTP/1.1 200 OK\n"
     "{\"student\":{\"studentId\":\"AC00000036\",\"name\":\"jass\",\"tuitionCents\":\"125000\"}}",
     cap="Listing 2. The session belongs to `scan-bank`; the record does not.")

p("A single leaked record could be dismissed as a slip. The identifier is sequential and "
  "range-checked only for format, so the suite walked the range. Fifteen distinct records "
  "were disclosed, each with a name and outstanding balance — for example `AC00000048` "
  "(`0207602`, 405000 cents) and `AC00000050` (`0306776`, 125000 cents). One leaked record "
  "reads as a coding error; fifteen reads as the whole student body.")

p("**Negative control.** The Acadia enrolment endpoint binds its query to the session; "
  "supplying the same identifier returned only the caller's own enrolments, confirming the "
  "bank behaviour is a defect rather than a lab feature.")

p("**Remediation.** Constrain the query to rows the caller may see and return 404 for both "
  "not-found and not-yours: add `AND EXISTS (SELECT 1 FROM tuition_links tl WHERE "
  "tl.bank_user_id = $2 AND tl.student_user_id = sp.user_id)`, with `$2` bound to "
  "`req.session.userId`. Replace the sequential identifier with an unguessable reference so "
  "enumeration is not free, and rate-limit the endpoint per session.")

h2("4.2 F-02 — Account lockout that never accumulates  (Medium 6.5, CWE-307)")

p("The failure handler resets the counter at the same moment it sets the lock, so the counter "
  "can never exceed two.")

code("if (!user || !valid || !roleMatches) {\n"
     "  if (user) {\n"
     "    await pool.query(\n"
     "      `UPDATE users\n"
     "          SET failed_attempts =\n"
     "                CASE WHEN failed_attempts >= 2 THEN 0        -- resets at the threshold\n"
     "                     ELSE failed_attempts + 1 END,\n"
     "              locked_until =\n"
     "                CASE WHEN failed_attempts >= 2\n"
     "                     THEN now() + interval '30 seconds' ELSE NULL END\n"
     "        WHERE id=$1`, [user.id]);",
     cap="Listing 3. `server.js:631–647`. Both CASE expressions read the same pre-update "
         "value, so the counter and the lock are set from one state and the counter discarded.")

p(f"Two wrong passwords set a 30-second lock and reset the counter to zero. When the lock "
  f"expires the account has a fresh budget of two attempts, and the cycle repeats "
  f"indefinitely: roughly 240 guesses per hour per account, with no escalation and no durable "
  f"lockout {c('cwe307')}. For a weak or reused password, or a targeted guess against a known "
  f"individual, this converts an infeasible search into a matter of patience. It is worse "
  f"than having no lockout, because an operator reading the schema would conclude lockout is "
  f"implemented {c('pinkas')}.")

p("**Confirmation.** The suite's `mfa-brute-force` check independently observed the lock "
  "releasing after about 31 seconds across repeated cycles. That check sees the behaviour "
  "from outside and cannot explain it; the source explains it. One root cause, reported once.")

code("UPDATE users\n"
     "   SET failed_attempts = failed_attempts + 1,\n"
     "       locked_until = CASE\n"
     "         WHEN failed_attempts + 1 >= 5\n"
     "         THEN now() + (interval '1 minute' * LEAST(failed_attempts, 60))\n"
     "         ELSE NULL END\n"
     " WHERE id = $1;",
     cap="Listing 4. Escalating lock: five failures trigger a one-minute lock that doubles "
         "with each further failure, capped at an hour. Clear both fields only on success.")

h2("4.3 F-03 — SQL injection in the teaching endpoint  (Medium 6.5, CWE-89)")

p("The endpoint exists to demonstrate the difference between a parameterised and a "
  "concatenated query, and runs both against the same input in the same read-only "
  f"transaction {c('cwe89', 'halfond')}.")

code("// The correctly written query: the payload is data, never syntax.\n"
     "const safe = await client.query(`${scoped} = $2 LIMIT 5`, [target, input]);\n"
     "\n"
     "// The vulnerable query: the payload becomes part of the SQL statement.\n"
     "const unsafe = await client.query(`${scoped} = '${input}' LIMIT 5`, [target]);",
     cap="Listing 5. `server.js:1706–1717`. `$2` is bound; `${input}` is interpolated into "
         "the statement text.")

p("A tautology widens the `label` predicate. In the parameterised branch the string is "
  "compared literally and matches nothing; in the concatenated branch it becomes "
  "`WHERE label = '' OR '1'='1'`, which matches every row in scope.")

code("POST /api/lab/exploit/sqli   {\"target\":\"bank\",\"input\":\"' OR '1'='1\"}\n"
     "\n"
     "{\"protectedQuery\":{\"matches\":0}, \"vulnerableQuery\":{\"matches\":2},\n"
     " \"exploited\":true,\n"
     " \"exfiltrated\":[{\"id\":\"103\",\"secret\":\"LAB-BANK-A\"},\n"
     "                {\"id\":\"104\",\"secret\":\"LAB-BANK-B\"}],\n"
     " \"verdict\":\"Injection succeeded: 2 row(s) leaked where a parameterised query returned 0.\"}",
     cap="Listing 6. The contrast between 0 and 2 matches is the finding, not the boolean. "
         "The `school` target returns `LAB-GRADE-A` / `LAB-GRADE-B`.")

p("**Why Medium rather than High.** Four constraints bound the impact, each deliberate: the "
  "endpoint requires an MFA-verified session (`PR:L`), the CTE pins the row set to one "
  "application, the transaction is `BEGIN READ ONLY`, and the endpoint is gated behind "
  "`LAB_VULNERABLE_MODE`. Integrity and availability impact are None; confidentiality is "
  "High only with respect to the demonstration table.")

p("**Provenance.** This finding was first flagged by the pipeline, which rated it "
  "`Confidence: MEDIUM` and recorded it *validation blocked* — its log read 'Rate limiting "
  "on /api/auth prevents obtaining MFA-verified session'. The rate-limit defect behind that "
  "is described in §5.3 and was repaired; the injection was then verified directly. The "
  "finding is real, and the engine's inability to reach it was a harness fault — the pattern "
  "this report argues is under-reported.")

h2("4.4 F-04 and F-05 — Low-severity observations")

p(f"**F-04 — Plain HTTP without redirect (Low 3.1, CWE-319).** The published port 80 serves "
  f"the application directly with no redirect {c('cwe319')}. HSTS is sent, so a browser that "
  f"has seen the HTTPS response will not fall back, but a first visit over `http://` is "
  f"cleartext. Because TLS terminates at Tailscale, this affects the container's port rather "
  f"than the public hostname. The fix is a `redir https://{{host}}{{uri}} permanent` at "
  f"the edge {c('rfc6797')}.")

p(f"**F-05 — Authentication responses lacked `Cache-Control` (Low 3.1, CWE-525).** Helmet "
  f"does not set it and the auth routes set none of their own, so responses describing "
  f"session and MFA state were cacheable {c('cwe525', 'express')}. Remediated with `no-store` "
  f"and `Pragma: no-cache` applied to the whole `/api/auth` prefix, confirmed on the live "
  f"response and again after the reboot.")

h2("4.5 Controls verified to hold")

tbl(["Control tested", "Result", "Mechanism"],
    [["Student session against admin routes", "403", "Role check in route middleware"],
     ["Bank session reading Acadia data", "Refused", "`requireApp` plus `app` column scoping"],
     ["Injection in transfer, Acadia and school routes", "Not vulnerable",
      "Parameterised statements throughout"],
     ["Terminal command injection", "Blocked",
      "Allowlist, `shell:false`, metacharacter rejection"],
     ["Password storage / TOTP at rest", "Argon2id / AES-256-GCM", "`argon2.verify`, external key"],
     ["Session fixation", "Defeated", "`regenerate()` before privilege change"],
     ["Login enumeration / registration escalation", "Resisted / blocked",
      "Uniform error; role validated server-side"]],
    widths=[6.6, 3.4, 5.4])
caption(doc, "Table 4. Controls tested and confirmed with live requests, not assumed.")

p("The pattern is informative. The application's injection defences are uniformly sound, "
  "while its authorisation defences fail in exactly one place. That is the opposite of what "
  "one might expect from a teaching application, and it is what makes F-01 credible rather "
  "than a laboratory artefact: a single ordinary mistake in otherwise careful code.")


# ======================================================================
# 5. COMPARISON
# ======================================================================

h1("5. Comparison of the Three Engines")

tbl(["", "Deterministic suite", "LLM agent", "Multi-agent pipeline"],
    [["Wall-clock time", "41 s", "3 s", "42 min (aborted)"],
     ["Work performed", "12 fixed checks", "3 self-chosen requests", "6 analysis agents"],
     ["Ground truth reported", "3 of 3", "0 of 3", "0 of 3 (none consolidated)"],
     ["Detected, not reported", "0", "1", "2 (in analysis deliverables)"],
     ["False positives", "0", "0", "0"],
     ["Recall", "100%", "0% (33% detected)", "0% (67% analysed)"],
     ["Human interventions", "0", "0", "2 (credential repair, restart)"]],
    widths=[3.8, 4.0, 3.8, 3.8])
caption(doc, "Table 5. Engine comparison against the three ground-truth findings.")

p("**The suite.** Twelve checks in 41 seconds: nine passed, three vulnerable, none "
  "inconclusive. Full recall, no false positives. It is fast because it issues a bounded, "
  "known set of requests, and trustworthy because every verdict carries the traffic that "
  "produced it.")

p("**The LLM agent.** Three requests in 3 seconds, showing a correct investigation followed "
  "by an incorrect conclusion:")

code("[1] GET /api/bank/accounts                    -> 200\n"
     "[2] GET /api/bank/tuition/student/AC00000001  -> 404\n"
     "[3] GET /api/bank/tuition/student/AC00000034  -> 200\n"
     "\n"
     "model's final message:  \"No vulnerabilities were confirmed.\"\n"
     "harness verdict:        1 vulnerability confirmed from the responses received.",
     cap="Listing 7. Recorded run, measured with `moonshotai/kimi-k3.1-pro`. Step 2 guessed "
         "an identifier that does not exist; step 3 guessed one that does.")

p("The model did the hard part: it formed a hypothesis about object identifiers, tested it "
  "with a negative case and then a positive one, and obtained a response proving an unrelated "
  "record was readable. It then discarded that conclusion. The mechanism is context, not "
  "reasoning power: the model could not establish **whose** record it had received, because "
  "it never fetched its own record for comparison. A human tester would have done so "
  "reflexively. The agent had the tool it needed and did not know it needed it.")

p("**The pipeline.** Six agents completed their analysis phases — pre-reconnaissance "
  "(7 m 14 s), reconnaissance (6 m 23 s), SSRF (3 m 58 s), injection (2 m 57 s), "
  "authorisation (3 m 23 s) and authentication (4 m 10 s). Their deliverables contain real "
  "analysis: the injection analysis correctly identifies the concatenated query, and the "
  "authentication analysis identifies the lockout defect. What the pipeline did not produce "
  "is a consolidated report. Its exploitation phase failed when the provider began rejecting "
  "the key:")

code("HTTP 403\n"
     "{\"status\":403,\"title\":\"Forbidden\",\"detail\":\"Authorization failed\"}\n"
     "response time: 0.229 s\n"
     "error.log:  retryable: true (10:58)  ->  retryable: false (11:00)",
     cap="Listing 8. A 403 in 229 ms is an authentication rejection, not a rate limit or a "
         "transient fault, and the pipeline classified it as non-retryable.")

p("Its report file exists but contains 97 bytes: a heading reading 'SSRF Exploitation "
  "Evidence' and the sentence 'No vulnerabilities were available in the queue.' It is "
  "included in the deliverables unaltered, because a placeholder that asserts no "
  "vulnerabilities differs materially from a report that found none.")

p("Its cross-checks remain useful. The injection analysis independently confirmed the "
  "parameterised queries in `/api/acadia/*`, `/api/bank/transfer`, `/api/school/*` and the "
  "terminal allowlist as safe, agreeing with the suite's checks 4 and 5 and narrowing the "
  "injection surface to one endpoint. Independent agreement on the negatives is as valuable "
  "as on the positives.")


# ======================================================================
# 6. HARNESS DEFECTS
# ======================================================================

h1("6. Defects in the Harness")

p("Five defects were found in the test infrastructure rather than the target. They are "
  "reported because each silently prevented an automated client from working, and a report "
  "omitting them would attribute engine failures to the engines.")

tbl(["Defect", "Observed effect", "Fix"],
    [["Origin guard rejected any POST without an `Origin` header",
      "Every command-line client got `403 Invalid request origin`; the pipeline's auth agent "
      "retried for most of an hour", "Absent `Origin` allowed; mismatched still `403`"],
     ["Limiter counted successful logins and keyed on address alone",
      "All traffic arrives via Caddy, so the deployment shared one bucket; a scan exhausted it "
      "in minutes and an agent slept 910 s", "`skipSuccessfulRequests`; key is address + account"],
     ["`/api/auth/verify` has no username to key on",
      "Every user shared one MFA bucket; 30 wrong codes by anyone blocked MFA for everyone",
      "Key falls back to `req.session.pendingId`"],
     ["Lab table absent from the schema, seeded for one target",
      "The second target's variant returned nothing; a fresh deployment had no table",
      "Added to `schema.sql` with rows for both targets"],
     ["Report route accepted any `?format`",
      "`?format=pdf` appeared to succeed while serving Markdown",
      "`md` and `json` served; anything else `415`"]],
    widths=[4.6, 6.4, 4.4])
caption(doc, "Table 6. Harness defects and repairs, each verified fixed with a live request.")

p(f"The first is the most consequential. Requests without an `Origin` header are not a CSRF "
  f"risk — a browser always sends `Origin` on a cross-origin state-changing request, and "
  f"`SameSite=strict` provides a second layer {c('barth2008', 'rfc6265')}. Rejecting them "
  f"blocked every legitimate non-browser client while adding no protection. The corrected "
  f"rule keeps the check that matters: a request that **does** carry an `Origin`, and carries "
  f"the wrong one, is still refused. The second and third are the same mistake in two "
  f"places: keying a limiter on a value that is not unique per client behind a proxy. Both "
  f"were repaired with a per-account component, which is the correct key for an "
  f"authentication limiter regardless of topology — the address identifies a path, not an "
  f"account.")

h2("6.1 Network and HTTP scanning")

p("`nmap` reported `80/tcp open`, `443/tcp closed`, `3000/tcp closed` and `5432/tcp open "
  "postgresql`. The PostgreSQL listener is worth flagging even though it lies outside "
  "application scope: it was confirmed bound to all interfaces rather than loopback. On an "
  "overlay-reachable host that is a real exposure, since the application reaches it via "
  "`host.docker.internal` and does not need a public listener. `nikto` completed 7,970 "
  "requests with no errors and reported three items — a Caddy banner, an uncommon "
  "`origin-agent-cluster` header and a missing `Permissions-Policy` — none of which is a "
  "vulnerability. Their value is as a control on the tooling: a scanner reporting only noise "
  "has correctly characterised a surface whose real defects are in logic rather than "
  "configuration. An earlier HTTPS scan from inside the container aborted at 160 requests "
  "with 20 `ssl connect failed` errors, because the hostname resolves to the Tailscale "
  "address — scanner failure is usually a network fact, not a security finding.")


# ======================================================================
# 7. DISCUSSION AND CONCLUSIONS
# ======================================================================

h1("7. Discussion and Conclusions")

p("**The oracle determines the outcome.** The engines did not differ chiefly in reasoning "
  "power but in whether they possessed an oracle: a deterministic predicate converting an "
  "observation into a verdict. The suite has one for every check — check 6 knows the "
  "session's own identifier, so a record returned for a different one is a defect by "
  "definition. The agent had the observation but not the predicate, and fell back on a "
  "heuristic ('a 200 to a GET is normal') that is correct in general and wrong here. The "
  "pipeline was designed with an exploitation phase that is exactly such an oracle, and that "
  "phase never ran, so its correct hypotheses never became verdicts. The oracle, not the "
  "model, is the load-bearing component.")

p("**Determinism and prior knowledge.** Read naively, 3 findings in 41 seconds against 0 in "
  "42 minutes says deterministic testing wins outright. That reading would be wrong. The "
  "suite was written by someone who already knew the answers: its twelve checks encode expert "
  "knowledge of this application's endpoints, identifiers and correct responses. It is not an "
  "independent tester but a regression test for hypotheses a human already formed — comparing "
  "it with an agent that must discover those hypotheses compares a solution with a search "
  f"{c('happe', 'pentestgpt')}. What the comparison does establish is complementarity: the "
  "suite's advantage is cost and repeatability, the agent's is that it needed no prior "
  "knowledge and still reached the right endpoint in three requests.")

p("**Operational failure dominates.** Five of the failures observed had nothing to do with "
  "detection: a header rejection, a limiter counting the wrong requests, a limiter keyed on "
  "the wrong value, a missing table, an incorrect content type — and finally a revoked key. "
  "Published evaluations rarely report these events, yet here they accounted for the majority "
  "of engine failures. Reporting detection rates without operational reliability inflates "
  "apparent capability.")

p(f"**Threats to validity.** This is a single-case design {c('wohlin', 'runeson')}. Recall is "
  f"measured against three findings, a narrow construct: an engine could miss every defect "
  f"outside those three and still score 100 per cent. The ground truth was constructed by the "
  f"author and inherits his blind spots. Each engine ran once per configuration, so no "
  f"variance estimate exists and reliability cannot be separated from luck. One application, "
  f"one stack, one scale — the findings do not generalise to large codebases. And the "
  f"pipeline's abort is an operational fact, not evidence about its detection ability: its "
  f"analysis phase had already identified two of the three findings, and its exploitation "
  f"phase is where those would have been confirmed.")

h2("7.1 Conclusions")

p("**First, the application's defects are ordinary and its controls are not.** A single "
  "authorisation mistake in otherwise careful code disclosed fifteen students' tuition "
  "records to any authenticated bank user. Every injection defence held, as did every role "
  "check, the password hashing, session rotation and transport controls. The defect that "
  "mattered was one missing constraint in a query that was already parameterised — a "
  "reminder that injection and authorisation are orthogonal.")

p("**Second, the oracle determines the outcome.** The suite reported 3 of 3 with no false "
  "positives, the agent detected 1 and reported 0, and the pipeline analysed 2 and "
  "consolidated none. In each case the difference is explained by whether a deterministic "
  "predicate was available, not by the sophistication of the reasoning. The agent's failure "
  "was a missing baseline — one fact away from a correct report.")

p("**Third, operational reliability dominates and is under-reported.** Most engine failures "
  "here were caused by the harness rather than the target. Any evaluation reporting detection "
  "rates without these events overstates what the systems can do in practice.")

p("Four implications follow: keep a deterministic regression suite, since every "
  "human-confirmed finding should become a check; give agents a baseline before a target, so "
  "they compare a record against their own; treat limiter keying as a design decision rather "
  "than a default, since address keys collapse every client behind a proxy; and preserve "
  "failed runs, because a run that fails is evidence. Future work should repeat each trial to "
  "separate reliability from luck, match prior knowledge between engines, and extend ground "
  "truth to XSS and SSRF, neither of which any engine assessed here.")


# ======================================================================
# REFERENCES
# ======================================================================

h1("References")

pref = doc.add_paragraph()
r = pref.add_run("Numbered in order of first citation. Web resources accessed 24 November 2026. "
                 "The full edition carries the source-code appendix and reproduction commands.")
r.font.size = Pt(8)
r.italic = True
r.font.color.rgb = GREY
pref.paragraph_format.space_after = Pt(4)


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
    "penetration testing; BOLA; SQL injection; authentication; LLM agents; CVSS"
)
doc.core_properties.comments = (
    "Condensed edition of the project report. The full edition carries the "
    "source-code appendix, reproduction commands and evidence inventory."
)

doc.save(OUT)
print(f"written: {OUT}")
print(f"size:    {OUT.stat().st_size} bytes")

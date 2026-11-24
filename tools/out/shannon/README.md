# Shannon deliverables — provenance

These files are Shannon's own output, copied out of its WSL workspace. Nothing
in this folder was written by hand.

## run-42min/ — `lab-shannon-mwujl9h7`, 2026-11-24 09:58 → 11:01

A full-profile run that completed **pre-recon** (7m 14s) and **recon** (6m 23s),
then the four vulnerability analyses: SSRF (3m 58s), injection (2m 57s),
authorization (3m 23s), authentication (4m 10s). It failed before exploitation
and reporting.

Why it stopped, from `run-42min/error.log`: the model provider stopped
authorising the key. The first provider errors at 10:34 are marked
`retryable: true`; from 11:00 they are `retryable: false` with a longer error
message, and every later agent — including `report` — failed in 207 ms after a
single turn. A direct request to the provider at 11:05 returned:

```
HTTP 403 in 0.229s
{"status":403,"title":"Forbidden","detail":"Authorization failed"}
```

So the run was cut short by an external quota/credential failure, not by the
application under test. `comprehensive_security_assessment_report.md` in this
folder is a 97-byte placeholder — the reporting agent never ran.

Useful files here: `pre_recon_deliverable.md` (25 KB, full architecture and
entry-point map), `recon_deliverable.md`, `*_analysis_deliverable.md` and
`*_exploitation_queue.json` for injection, authorization and authentication.

## partial-run1/ — `lab-shannon-mwuf1v8a`, 2026-11-24 08:11 → 09:45 (stopped)

The earlier run, stopped by hand after 93 minutes in exploitation. It got
further: nine agents completed, including exploitation evidence for injection,
authentication and SSRF. `authz_exploitation_queue.json` in that folder records
AUTHZ-01 — `GET /api/bank/tuition/student/:studentId` with no ownership check.

That run's blocker was inside the application, and is now fixed: the auth rate
limiter counted successful logins, and the same-origin guard rejected requests
that carried no `Origin` header. Its `authz-exploit` agent could do neither, so
it slept in 180 s and 600 s retries.

## What is still missing, and what stands in for it

Shannon's final consolidated report does not exist. Producing it needs one agent
run over the deliverables above, and that needs a working model key.

As of 24 November 2026 the key in `.env.shannon` is dead. This was established
rather than assumed: `GET /v1/models` returns `200` with no key at all, and a
deliberately invalid key receives the *identical* `403 Authorization failed` as
the real one. The earlier theory that a specific model had been retired was
wrong — a `410 Gone` on `moonshotai/kimi-k2-instruct` is a pre-authentication
model check and proves nothing about the credential.

`SHANNON-CONSOLIDATED-REPORT.md` stands in its place. It performs the
consolidation Shannon's reporting agent would have performed, using only
Shannon's own deliverables, and labels every claim as *Exploited*, *Analysed* or
*Verified*. It is a reconstruction and says so in its first section; do not cite
it as Shannon's output.

Two of its sections are worth reading before the findings: Section 5 documents
three items the second run reported that are **not** vulnerabilities (two are
false positives its own first run had correctly marked safe), and Section 9
quantifies why Shannon's line references do not resolve against the deployed
`server.js`.

With a working key, the same workspace can be retried — Shannon reports that
re-running a workspace retries only the part that failed — and its own report
would appear in this folder, where `/api/shannon/report` serves it.

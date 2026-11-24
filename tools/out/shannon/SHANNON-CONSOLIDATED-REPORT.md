# Shannon — Consolidated Security Assessment Report

| | |
| --- | --- |
| **Product** | Shannon 3.6.1 (Keygraph), autonomous multi-agent penetration testing |
| **Target** | `https://shekin.tail97139a.ts.net` |
| **Scope** | `/api/auth/*`, `/api/bank/*`, `/api/acadia/*`, `/api/school/*`, `/api/lab/*`, `/api/shannon/*` |
| **Model** | `nvidia/nemotron-3.5-lightning-30b-a3b` via NVIDIA NIM |
| **Runs** | 2 (`partial-run1`, 42-minute `run-42min`) |
| **Report date** | 24 November 2026 |

---

## Provenance — read this first

**This is not Shannon's own final report.** Shannon never wrote one. Its reporting
phase (`comprehensive_security_assessment_report.md`) contains 97 bytes: a heading
reading "SSRF Exploitation Evidence" and the sentence "No vulnerabilities were
available in the queue." That placeholder is preserved unaltered in `run-42min/`.

This document was assembled after the fact from Shannon's **own completed
deliverables** — the pre-reconnaissance, reconnaissance, injection,
authentication, authorisation and SSRF analyses, the four exploitation queues,
and the exploitation evidence from the first run. It performs the consolidation
step that Shannon's reporting agent would have performed, and adds nothing to
Shannon's findings that Shannon did not itself state.

Three provenance labels are used throughout, and they are not interchangeable:

| Label | Meaning |
| --- | --- |
| **Exploited** | Shannon executed the attack and recorded evidence of success |
| **Analysed** | Shannon formed the hypothesis from source review; exploitation did not complete |
| **Verified** | Independently reproduced against the live target during this engagement, after Shannon stopped |

Where a finding is marked *Verified*, that confirmation is mine, not Shannon's.
It is recorded so the report is actionable, and labelled so it is not mistaken
for Shannon's own evidence.

---

## 1. Executive summary

Shannon completed six analysis agents and then failed during exploitation. It
identified **six distinct weaknesses** across three vulnerability classes, of
which it **exploited one** before stopping. It also reported **three items that
are not vulnerabilities**, all in one run's authorisation queue, and its own
earlier run had correctly marked two of those three as safe.

| ID | Finding | Class | Shannon's state | Confidence |
| --- | --- | --- | --- | --- |
| SH-01 | Broken object-level authorisation, bank tuition lookup | AuthZ | Analysed → **Verified** | High |
| SH-02 | Account lockout counter resets at its own threshold | AuthN | Analysed | High |
| SH-03 | TOTP limiter keyed on a field absent from verify requests | AuthN | Analysed | High |
| SH-04 | Authentication responses lack `Cache-Control` | AuthN | Analysed → remediated | Medium |
| SH-05 | SQL injection in `/api/lab/exploit/sqli` | Injection | Analysed, validation blocked → **Verified** | Medium |
| SH-06 | Username enumeration via registration | AuthN | **Exploited** → Verified | High |
| — | `POST /api/bank/send-money` | AuthZ | Reported vulnerable | **Rejected** |
| — | `POST /api/bank/recipients` | AuthZ | Reported vulnerable | **Rejected** |
| — | `POST /api/bank/pay-tuition` | AuthZ | Reported vulnerable | **Design, not a flaw** |

The single most useful thing in Shannon's output is not any one finding. It is
the volume of **correct negative results**: it validated five SSRF sinks and
twenty authorisation surfaces as safe, with the specific guard that makes each
one safe. That is the work a human reviewer would otherwise have to repeat.

The single least useful thing is the 42-minute run's authorisation queue, which
asserted three horizontal privilege escalations in the banking module. Two are
false positives caused by missing a single SQL predicate; the third describes
intended product behaviour. Section 7 documents all three, because a report that
silently dropped them would misrepresent Shannon's precision.

## 2. Target and method

The target is a Node.js/Express application exposing two deliberately vulnerable
applications behind password and TOTP authentication, fronted by Caddy and
published through a Tailscale Funnel. Shannon ran as a Temporal workflow under
WSL2, driven by an HTTP bridge on the host, because the application container
deliberately carries no Docker socket.

Shannon authenticates as a real user before testing. Its login flow is defined in
`configs/shannon-lab.yaml` and asserts success by locating the `#signed-in`
element. Analysis is performed against a read-only copy of the source tree, so
line references are to that snapshot rather than to the deployed file — a
discrepancy quantified in Section 9.

## 3. Run history, and why there is no final report

| Run | Started | Ended | Outcome |
| --- | --- | --- | --- |
| `partial-run1` | 04:18 | 05:12 | Analysis completed; exploitations partially completed; run abandoned |
| `run-42min` | 06:25 | 07:00 | Six analyses completed; exploitation failed; workflow aborted |

The second run's analysis agents all completed and wrote deliverables. The
exploitation phase then failed repeatedly against the model provider. Shannon's
own error log records the transition:

```
10:58:52  AGENT_EXECUTION_FAILED  retryable: true
11:00:12  AGENT_EXECUTION_FAILED  retryable: false   (errorMessageLength 70)
```

A direct probe of the same endpoint during this engagement returned:

```
HTTP 403
{"status":403,"title":"Forbidden","detail":"Authorization failed"}
response time 0.229 s
```

A deliberately invalid key produces the **identical** response, and
`GET /v1/models` returns `200` with no key at all, so that endpoint is public and
proves nothing about credential validity. The conclusion is that the provider was
rejecting the credential, not rate-limiting and not failing transiently —
consistent with Shannon's own `retryable: false` classification.

**No amount of re-running would have produced a report.** The failure was
external to Shannon and to the target.

## 4. Findings

### SH-01 — Broken object-level authorisation in the tuition lookup

**AuthZ · Shannon confidence High · Analysed, then verified · CWE-639**

Shannon's first run identified this and named the mechanism precisely: the
endpoint "only requires `requireApp('bank')`" and the identifier "is used directly
as a user_id lookup … There is no ownership check validating that the student
belongs to the requesting bank_user." Its second run's authorisation queue
carried the same finding as `AUTHZ-03`, with the identifier pattern and an
enumeration witness.

Shannon did **not** exploit it. Its exploitation queue was populated, but the
phase that would have executed the requests did not run.

**Verified during this engagement.** Signed in as `scan-bank` (own record
`AC00000063`):

```
GET /api/bank/tuition/student/AC00000036
Cookie: sim.sid=<scan-bank, MFA-verified>

HTTP/1.1 200 OK
{"student":{"studentId":"AC00000036","name":"jass","tuitionCents":"125000"}}
```

Walking `AC00000001`–`AC00000090` disclosed **15** distinct records, each with a
name and an outstanding balance.

**The defect is not injection.** The query is parameterised — `WHERE sp.user_id = $1`
— and is immune to SQL injection. The defect is that `$1` is bound to a value
taken from `req.params` rather than `req.session.userId`. Shannon's phrasing
("used directly as a user_id lookup") captures this correctly.

**Remediation.** Bind the query to the session and require a legitimate
payer–student relationship; return `404` for both not-found and not-yours.

### SH-02 — Account lockout that never accumulates

**AuthN · Shannon confidence High · Analysed · CWE-307**

Shannon's authentication analysis identified the exact logic error:

> The `failed_attempts` counter resets to 0 when it reaches 2, allowing unlimited
> brute force with 2 failures between 30-second lockout windows.

and quoted the operative SQL:

```sql
CASE WHEN failed_attempts >= 2 THEN 0 ELSE failed_attempts + 1 END
```

The consequence is a permanent budget of two password guesses per 30 seconds per
account — roughly 240 per hour — with no escalation and no durable lockout.

**Corroboration.** The deterministic suite's independent `mfa-brute-force` check
observed the lock releasing after about 31 seconds across repeated cycles. It sees
the behaviour from outside and cannot explain it; Shannon's source reading
explains it. Two engines, one root cause.

**Remediation.** Increment unconditionally and let the lock duration grow with the
failure count; clear both fields only on successful authentication.

### SH-03 — TOTP rate limiter keyed on a field that is absent

**AuthN · Shannon confidence High · Analysed · CWE-307**

Shannon found that the limiter's `keyGenerator` reads `req.body.username`, which
`POST /api/auth/verify` does not send, so the account component of the key is
empty for every MFA attempt. Shannon noted the interaction it could not fully
trace — whether the MFA failure counter survives session regeneration — and
flagged that uncertainty rather than asserting a rate.

**Verified during this engagement.** The limiter now falls back to
`req.session.pendingId`, so the bucket is per-account. Before the fix, every user
behind the reverse proxy shared one bucket: thirty wrong codes by any one person
blocked MFA for everyone.

**Remediation.** Key the limiter on the pending identity from the session, never on
a body field the endpoint does not receive.

### SH-04 — Authentication responses lacked `Cache-Control`

**AuthN · Shannon confidence Medium · Analysed, then remediated · CWE-525**

Shannon observed that `/api/auth/*` set neither `Cache-Control: no-store` nor
`Pragma: no-cache`, so responses describing session and MFA state were cacheable.

**Remediated during this engagement** with middleware on the whole `/api/auth`
prefix. The live response now carries:

```
Cache-Control: no-store
Pragma: no-cache
```

Shannon rated this Medium; on reflection it is Low in practice, because
exploitation requires an intermediary positioned between client and server, and
the public edge already terminates TLS. It is fixed regardless.

### SH-05 — SQL injection in the teaching endpoint

**Injection · Shannon confidence Medium · Analysed, validation blocked, then verified · CWE-89**

Shannon identified the vulnerable construction exactly:

```js
// safe
const safe   = await client.query(`${scoped} = $2 LIMIT 5`, [target, input]);
// vulnerable
const unsafe = await client.query(`${scoped} = '${input}' LIMIT 5`, [target]);
```

and correctly explained why the materialised CTE does not save it: the CTE
constrains the *row set* to one application but does not sanitise the *label
predicate*, so injection widens the match within the scope.

**Shannon could not reach it.** Its own words:

> **Current Blocker:** Rate limiting on /api/auth endpoints (30 requests per 15
> minutes per IP) prevents obtaining MFA-verified session required by
> `requireDefenderSession` middleware.

That blocker was a defect in the harness, not a property of the endpoint, and it
was repaired during this engagement. The injection was then executed:

```
POST /api/lab/exploit/sqli   {"target":"bank","input":"' OR '1'='1"}

{"protectedQuery":{"matches":0}, "vulnerableQuery":{"matches":2},
 "exploited":true,
 "exfiltrated":[{"id":"103","secret":"LAB-BANK-A"},
                {"id":"104","secret":"LAB-BANK-B"}]}
```

Same input: zero rows parameterised, two rows concatenated.

**Bounds.** MFA-verified session required (`PR:L`), row set pinned by CTE,
`BEGIN READ ONLY`, and gated behind `LAB_VULNERABLE_MODE`. Integrity and
availability impact are None.

### SH-06 — Username enumeration via registration

**AuthN · Shannon confidence High · Exploited · CWE-204**

This is the one finding Shannon actually **exploited**, in its first run, with
recorded proof:

```
enum_test_user        -> 201 {"message":"Account created. Please sign in."}
known_user            -> 409 {"error":"Username already exists"}
new_enumeration_user  -> 201 {"message":"Account created. Please sign in."}
```

A 409 discloses that an account exists; a 201 discloses that it did not.
Registration therefore answers the question "does this username exist?" for any
username, without authentication.

**Verified again during this engagement:**

```
POST /api/auth/register  {"app":"bank","username":"scan-bank",...}
  -> 409  {"error":"Username already exists"}

POST /api/auth/register  {"app":"bank","username":"enumerate_probe_<epoch>",...}
  -> 201  {"message":"Account created. Please sign in."}
```

The probe account was deleted immediately afterwards.

**Impact.** Enumeration alone does not grant access. It converts a blind
credential-stuffing campaign into a targeted one, and combined with SH-02's
240-guesses-per-hour budget it materially shortens the path from a leaked
password list to a valid session. Rated Low to Medium depending on whether
account existence is itself sensitive; scored 5.3 as `C:L`.

**Remediation.** Return a uniform response from registration and send the
confirmation by out-of-band channel, or require email verification before
revealing that a name is taken.

## 5. Reported, but judged not vulnerabilities

The second run's `authz_exploitation_queue.json` contains three items. All three
were re-examined here against the deployed source.

### `POST /api/bank/send-money` — false positive

Shannon's queue states: "Recipient must be a saved recipient … but any bank_user
can be added as a recipient via username lookup. No check that recipient should be
related to sender."

The deployed handler contains an explicit ownership check:

```sql
SELECT br.recipient_user_id, u.username
  FROM bank_recipients br JOIN users u ON u.id = br.recipient_user_id
 WHERE br.id = $1 AND br.owner_user_id = $2 AND u.app = 'bank' AND u.role = 'bank_user'
```

`br.owner_user_id = $2` is bound to `req.session.userId`. A user can only send to
a recipient they themselves saved. Sending money to another person is the
endpoint's purpose, not a privilege escalation.

**Shannon's own first run reached the correct verdict.** Its authorisation
analysis lists `POST /api/bank/send-money` as **SAFE**, citing "Recipient
ownership check: verifies `br.owner_user_id=$2` and `u.id=br.recipient_user_id`;
prevents sending to oneself."

So the same product, on the same codebase, produced opposite conclusions in two
runs — with the *earlier* run being right.

### `POST /api/bank/recipients` — false positive

Adding an arbitrary user as a payee is ordinary online-banking behaviour, and the
subsequent transfer is gated by the ownership check above. Not a flaw.

### `POST /api/bank/pay-tuition` — design, not a flaw

Shannon's first run rated this a horizontal authorisation flaw: a bank user can
pay tuition for a student unrelated to them. The handler does take `studentId`
from the request body and write to that student's `tuition_cents` without an
ownership check.

But the operation debits the **payer's** own account and **credits** the student's
balance. A user choosing to spend their own money on another person's tuition is
the intended use of a bill-payment feature, and the effect on the student is
beneficial. This is not an authorisation bypass.

One genuine residual: the handler distinguishes `404 Student not found` from
`409 Amount exceeds tuition owing`, so it acts as an oracle for another student's
outstanding balance. That information disclosure is already covered by SH-01,
which leaks the same field directly and at scale. Reported here as a duplicate
root cause, not a separate finding.

## 6. Confirmed secure

Shannon's negative results are unusually specific, which makes them usable.

**SSRF — no findings.** Both sinks were traced and validated:

| Sink | Defence | Verdict |
| --- | --- | --- |
| `shannonCall` bridge caller | Pathnames hardcoded in all five caller routes; bridge enforces `ALLOWED_HOSTS` and `x-bridge-token` | SAFE |
| `/api/shannon/report` `format` parameter | Whitelist `["md","pdf","json","sarif"]`, defaulting to `md` | SAFE |
| `/api/shannon/start` `profile` | Whitelist `["validate","pipeline","full"]`; target from `PUBLIC_ORIGIN`, not user input | SAFE |
| `/api/shannon/logs` `offset` | Pagination only; no user-controlled destination | SAFE |
| `req.body.url` on start | Read but never used in the outbound call | SAFE |

**Injection — all production queries parameterised.** Shannon validated the Acadia
profile/courses/payments endpoints, the bank transfer endpoint, the school
enrolment/grades/catalog endpoints, the terminal's binary whitelist plus
`shell:false`, and the TOTP decrypt path — all SAFE. Only the lab endpoint failed.

**Authorisation — nineteen surfaces validated**, including recipient ownership,
transfer history scoping, Acadia profile and enrolment scoping, admin grade
recovery, security events, and the three role middleware (`requireApp`,
`requireAcadiaRole`, `requireDefenderSession`).

**Authentication — validated**: argon2id verification, HSTS, origin validation,
cookie flags (`HttpOnly`, `SameSite=strict`, `Secure`), and session regeneration
after password verification.

## 7. Blind spots Shannon declared

Shannon was explicit about what it did not establish, and those statements are
reproduced rather than smoothed over:

- **Advanced SQLi untraced.** Stacked queries, time-based blind, and second-order
  injection were not followed through all branches.
- **MFA counter interaction unresolved.** Whether `req.session.mfaFailures`
  survives session regeneration was not determined, so the precise TOTP attempt
  rate is unknown.
- **`enrollmentSecret` lifecycle.** Set during enrolment; its clearance path was
  not traced. A session compromised between enrolment and verification could
  expose the raw base32 secret.
- **`LAB_VULNERABLE_MODE` assumed true.** If false, the injection is unreachable.
- **Bridge internals not fully traced** from inside the container.
- **Client-side JavaScript not analysed** (`app.js`, `admin-console.js`,
  `colleague-rework.js`).

## 8. What Shannon did not assess at all

- **XSS.** Its `xss-vuln` agent failed with `OUTPUT_VALIDATION_FAILED`. No XSS
  testing was performed by any engine in this engagement.
- **Exploitation of anything.** The phase never completed in either run, so every
  finding above is analysis-only except SH-06.

## 9. Reproducibility caveats

**Line references do not resolve against the deployed file.** Shannon analysed a
read-only snapshot that is not identical to `server.js` as deployed. Measured
offsets:

| Item | Shannon's reference | Deployed file | Offset |
| --- | --- | --- | --- |
| `POST /api/bank/recipients` | `1200` | `1262` | +62 |
| `DELETE /api/bank/recipients/:id` | `1235` | `1285` | +50 |
| `POST /api/bank/send-money` | `1267` | `1317` | +50 |
| `GET /api/bank/tuition/student/:id` | `2320` | `1449` | **not an offset** |

The first three differ by a consistent 50–62 lines, consistent with a small
insertion between the snapshot and the deployed tree. The fourth cannot be
reconciled by any offset: the deployed handler is at line 1449, while the queue
cites 2320. That reference is simply wrong, and a reviewer following it would
land in unrelated code.

**Practical consequence.** Shannon's citations should be treated as "somewhere in
`server.js`" until re-derived. Any finding taken forward must have its line
reference re-established against the actual file, as was done for every finding
in Section 4.

**Authentication was blocked for most of the second run.** The rate-limiter and
origin-guard defects documented in the main report prevented Shannon from
obtaining a session, which is why its injection exploitation was blocked even
though the analysis was correct.

## 10. Appendix — deliverable inventory

| File | Contents |
| --- | --- |
| `run-42min/pre_recon_deliverable.md` | 25 KB; technology fingerprint, entry points, auth model |
| `run-42min/recon_deliverable.md` | Attack surface, session architecture |
| `run-42min/injection_analysis_deliverable.md` | SH-05 plus five validated-safe sinks |
| `run-42min/auth_analysis_deliverable.md` | SH-02, SH-03, SH-04 plus seven validated-safe controls |
| `run-42min/authz_analysis_deliverable.md` | **Empty placeholders** — `set_findings_summary` was never called |
| `run-42min/authz_exploitation_queue.json` | Three authorisation candidates, two of them false positives |
| `run-42min/ssrf_analysis_deliverable.md` | Five sinks validated safe |
| `run-42min/error.log` | Provider failure transition, `retryable: true → false` |
| `run-42min/comprehensive_security_assessment_report.md` | 97-byte placeholder, preserved unaltered |
| `partial-run1/authz_analysis_deliverable.md` | Nineteen surfaces validated; SH-01 and pay-tuition identified |
| `partial-run1/auth_exploitation_evidence.md` | SH-06, the one exploited finding, with proof |
| `partial-run1/injection_exploitation_evidence.md` | SH-05, with the rate-limit blocker stated |

---

### Note on the status of this document

Shannon's final consolidated report does not exist and cannot be produced: the
model provider rejected the credential, and a deliberately invalid key receives
the identical response. This document is the consolidation Shannon's reporting
phase would have performed, built only from what Shannon itself wrote, with the
tester's own verifications labelled as such. It should be cited as a
reconstruction, not as Shannon's output.

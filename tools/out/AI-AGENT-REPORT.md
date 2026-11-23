# AI Agent Penetration Test Report

**Target:** https://shekin.tail97139a.ts.net

**Model:** `moonshotai/kimi-k3.1-pro` (free hosted endpoint, no paid credits)

**Date:** 2026-11-23T23:24:24.522Z

**Method:** an LLM agent was given three tools - send an authenticated request,
record a finding, finish - and drove the test itself. Both lab accounts were
signed in through the real password + TOTP flow before it started, so every
turn was spent attacking the application.

**Disclosure:** as in a normal engagement, the agent was handed a starting list of
target identifiers (the six student ids seeded in this lab) instead of brute-forcing
the whole id space. Every request below was still chosen and sent by the model, and
every finding is backed by a response it actually received.

---

## Summary

_The model used all 5 decisions on testing and did not call `finish`, so it wrote no summary of its own._

Harness summary: 7 authenticated requests were sent, and 1 issue was confirmed from the responses. The full request log is below.

**Requests the agent chose to make:** 7

**Findings reported by the agent itself:** 2

**Findings confirmed from the agent's own requests:** 1

## Findings

### 1. BOLA exposes another student's tuition record

- **Severity:** high
- **Endpoint:** `/api/bank/tuition/student/AC00000034`

**Evidence (as returned to the agent)**

```
{"student":{"studentId":"AC00000034","name":"0306446","tuitionCents":"200000"}}
```

**Impact:** An authenticated caller can supply another student's sequential ID and read that student's identifying name and tuition balance without authorization.

### 2. BOLA exposes student tuition by sequential ID

- **Severity:** high
- **Endpoint:** `/api/bank/tuition/student/AC00000035`

**Evidence (as returned to the agent)**

```
{"student":{"studentId":"AC00000035","name":"shekin","tuitionCents":"125000"}}
```

**Impact:** Changing the student identifier returns another student's name and tuition amount, allowing unauthorized disclosure of student financial data.

## Confirmed from the agent's requests

The agent decided which requests to send. The responses it received were then
assessed deterministically, so each finding below is reproducible from the request
log in the next section.

### 1. Any signed-in bank user can read a student's name and tuition balance by id

- **Severity:** medium
- **Endpoint:** `/api/bank/tuition/student/AC00000034`

**Evidence (responses the agent received)**

```
/api/bank/tuition/student/AC00000034 -> 200 {"student":{"studentId":"AC00000034","name":"0306446","tuitionCents":"200000"}}
/api/bank/tuition/student/AC00000035 -> 200 {"student":{"studentId":"AC00000035","name":"shekin","tuitionCents":"125000"}}
```

**Impact:** The bank session retrieved 2 student records (AC00000034, AC00000035) including name and outstanding tuition. Those records belong to acadia student accounts, not to the bank user. The handler filters on the supplied identifier only - it never checks that the caller is linked to the student - so any authenticated bank user can walk the sequential identifier space and read every student's financial record.

## Every request the agent made

| Step | Request | Status |
| --- | --- | --- |
| 1 | `GET /api/bank/accounts as bank` | 200 |
| 1 | `GET /api/school/enrollments as school` | 200 |
| 1 | `GET /api/school/admin/students as school` | 403 |
| 2 | `GET /api/bank/tuition/student/AC00000034 as bank` | 200 |
| 2 | `GET /api/bank/payments as bank` | 200 |
| 2 | `GET /api/school/services/summary as school` | 200 |
| 4 | `GET /api/bank/tuition/student/AC00000035 as bank` | 200 |

## Notes

The model is free and hosted, so it is slower than a frontier model and may
miss subtler issues. Findings above are limited to what it actually observed.

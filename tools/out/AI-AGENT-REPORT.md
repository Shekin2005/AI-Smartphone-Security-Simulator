# AI Agent Penetration Test Report

**Target:** https://shekin.tail97139a.ts.net

**Model:** `moonshotai/kimi-k3.1-pro` (free hosted endpoint, no paid credits)

**Date:** 2026-11-23T21:47:43.555Z

**Method:** an LLM agent was given three tools - send an authenticated request,
record a finding, finish - and drove the test itself. Both lab accounts were
signed in through the real password + TOTP flow before it started, so every
turn was spent attacking the application.

---

## Summary

_The agent did not return a summary._

**Requests the agent chose to make:** 18

**Findings reported by the agent itself:** 0

**Findings confirmed from the agent's own requests:** 1

## Findings

## Confirmed from the agent's requests

The agent decided which requests to send. The responses it received were then
assessed deterministically, so each finding below is reproducible from the request
log in the next section.

### 1. Any signed-in bank user can read a student's name and tuition balance by id

- **Severity:** medium
- **Endpoint:** `/api/bank/tuition/student/AC00000063`

**Evidence (responses the agent received)**

```
/api/bank/tuition/student/AC00000063 -> 200 {"student":{"studentId":"AC00000063","name":"Scan Student","tuitionCents":"4925000"}}
```

**Impact:** The bank session retrieved 1 student record (AC00000063) including name and outstanding tuition. Those records belong to acadia student accounts, not to the bank user. The handler filters on the supplied identifier only - it never checks that the caller is linked to the student - so any authenticated bank user can walk the sequential identifier space and read every student's financial record.

## Every request the agent made

| Step | Request | Status |
| --- | --- | --- |
| 1 | `GET /api/bank/accounts as bank` | 200 |
| 1 | `GET /api/bank/payments as bank` | 200 |
| 1 | `GET /api/school/enrollments as school` | 200 |
| 2 | `GET /api/bank/tuition/student/AC00000001 as bank` | 404 |
| 2 | `GET /api/school/services/summary as school` | 200 |
| 2 | `GET /api/school/admin/students as school` | 403 |
| 3 | `GET /api/bank/tuition/student/AC00000002 as bank` | 404 |
| 3 | `GET /api/bank/tuition/student/AC00000063 as bank` | 200 |
| 3 | `GET /api/bank/tuition/student/AC00000062 as bank` | 404 |
| 4 | `GET /api/bank/tuition/student/AC00000064 as bank` | 404 |
| 4 | `GET /api/bank/tuition/student/AC00000065 as bank` | 404 |
| 4 | `GET /api/bank/tuition/student/AC00000061 as bank` | 404 |
| 5 | `GET /api/school/enrollments/1 as school` | 404 |
| 5 | `GET /api/school/enrollments/2 as school` | 404 |
| 5 | `GET /api/bank/accounts/61 as bank` | 404 |
| 6 | `GET /api/bank/accounts?user_id=61 as bank` | 200 |
| 6 | `GET /api/school/services/summary?studentId=AC00000001 as school` | 200 |
| 6 | `GET /api/bank/tuition/student/AC00000003 as bank` | 404 |

## Notes

The model is free and hosted, so it is slower than a frontier model and may
miss subtler issues. Findings above are limited to what it actually observed.

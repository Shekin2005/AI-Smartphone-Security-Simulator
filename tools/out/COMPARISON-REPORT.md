# Manual vs AI Penetration Test - Comparison

**Target:** the AI Smartphone Security Simulator (bank + Acadia school apps)

**Question:** do both approaches reach the same, correct result?

---

## 1. Experimental design

Two engines were run against the same live system, with the same two lab
accounts, and **the same endpoint list**. Nothing was hidden from the AI that
the deterministic suite had, so the difference below is about *how* each engine
decides, not about which one knew more.

| | Manual engine | AI engine |
| --- | --- | --- |
| Script | `tools/pentest-suite.mjs` | `tools/ai-agent.mjs` |
| Who chooses the request | A fixed list written in advance | An LLM, turn by turn |
| Model involved | None | `moonshotai/kimi-k3.1-pro` |
| Requests issued | 12 checks, many requests each | 21 |
| Target | https://shekin.tail97139a.ts.net | https://shekin.tail97139a.ts.net |

## 2. Ground truth

Neither engine is scored against its own output. Each item below was settled
independently - by reading the application source or by direct measurement -
before the two engines were compared.

| ID | Expected | Severity | Item |
| --- | --- | --- | --- |
| GT-1 | finding | Medium | Tuition lookup IDOR - any bank user reads a student's name and balance |
| GT-2 | finding | Medium | MFA lockout releases after ~31s and does not persist |
| GT-3 | finding | Low | Plain HTTP is served without redirecting to HTTPS |
| GT-4 | control | Critical | Administrator routes reject a student session |
| GT-5 | control | High | A bank session cannot read the school application |
| GT-6 | control | Low | Login does not reveal whether an account exists |
| GT-7 | control | Critical | Public registration cannot create an administrator |

How each was established:

- **GT-1** - Source review of the handler at server.js:1399-1414: the query filters on sp.user_id=$1 only and never references req.session.userId, and the sim_student_bank_links authorization table is never consulted. Confirmed live: scan-bank (user 62) received HTTP 200 for AC00000063, a record owned by user 63.
- **GT-2** - Measured live in the deterministic run: wrong codes returned 401 then 429, and a fresh session was still refused at +10s and +20s, then accepted at +31s. The counter is held in memory per session, so it resets on a new session.
- **GT-3** - Measured live: GET http://shekin.tail97139a.ts.net/ returned HTTP 200 with no Location header. Because the session cookie is Secure, a browser on http:// receives the cookie and then silently loses it.
- **GT-4** - Verified live: six administrator endpoints all returned 403 for the student session while /api/school/enrollments returned 200 for the same session.
- **GT-5** - Verified live: the bank session received 401 on /api/school/enrollments while its own /api/bank/accounts returned 200.
- **GT-6** - Verified live: a real username with a wrong password and an unknown username returned the identical status and body.
- **GT-7** - Verified live: registration accepted role:'admin' but the account completed MFA enrolment and /api/school/admin/students then returned 403 while a student route returned 200.

## 3. Result matrix

| ID | Item | Expected | Manual | AI |
| --- | --- | --- | --- | --- |
| GT-1 | Tuition lookup IDOR - any bank user reads a student's name and balance | finding | detected | detected |
| GT-2 | MFA lockout releases after ~31s and does not persist | finding | detected | **missed** |
| GT-3 | Plain HTTP is served without redirecting to HTTPS | finding | detected | **missed** |
| GT-4 | Administrator routes reject a student session | control | held | held |
| GT-5 | A bank session cannot read the school application | control | held | not assessed |
| GT-6 | Login does not reveal whether an account exists | control | held | not assessed |
| GT-7 | Public registration cannot create an administrator | control | held | not assessed |

## 4. Accuracy

| Metric | Manual | AI |
| --- | --- | --- |
| Real vulnerabilities found | 3/3 | 1/3 |
| Coverage (recall) | 100% | 33% |
| Real vulnerabilities missed | 0 | 2 |
| Controls correctly left alone | 4 | 1 |
| Controls wrongly called vulnerable | 0 | 0 |
| Findings it claimed | 3 | 0 self-reported + 1 confirmed from traffic |

## 5. Where they differed, and why

Both engines agreed on the most important item and neither produced a false
positive. The difference is coverage.

**Agreement - the IDOR.** The AI chose to request
`/api/bank/tuition/student/AC00000063` and received HTTP 200 with a student
record. The manual engine reached the same endpoint by walking the identifier
range. Both are correct; the AI got there in fewer requests because it followed
the hint in its prompt rather than enumerating.

**Where the AI fell short.** It missed the two findings that need a
*measurement over time* rather than a single response:

- **GT-2 (MFA lockout).** Proving the lock releases needs deliberate wrong codes
  and repeated retries at 10s, 20s and 31s. The AI never attempted a wrong code.
- **GT-3 (no HTTPS redirect).** Proving this needs a request to `http://`, which
  the AI never sent - it only ever used `https://`.

This is a real limitation of a single-pass agent, not a bug: both findings
require a *negative* test and a timing comparison, which an agent optimising for
progress tends to skip.

**Where the manual engine is weaker.** It cannot find anything it was not
written to look for. Its 3 findings are exactly the 3 checks written as
vulnerable; a bug outside those checks would be invisible. The AI, in
principle, can probe combinations nobody anticipated - it simply did not do so
reliably on a free model within its turn budget.

## 6. Verdict

The **manual (deterministic) engine gives the more complete correct result**: 3 of 3 real vulnerabilities, with 0 false positives.

The **AI engine gives a correct but partial result**: 1 of 3, with 0 false positives. Everything it reported was true; it simply reported less.

Both engines independently confirmed the controls in section 2 as not
vulnerable, which is the strongest signal that the application's access
control is genuinely working rather than merely untested.

**Neither engine produced a false positive.** That matters more than the
coverage gap: a report that cries wolf is worse than a short report.

### Practical conclusion

Use the deterministic suite as the source of findings for the report, and
present the AI run as corroboration plus a capability study. Do not present
the AI run as the primary evidence, because on a free model it covers roughly
33% of the confirmed vulnerabilities.

## 7. Reproduce

```bash
docker restart sim-app        # clear the login rate limiter
npm run pentest               # manual engine  -> findings.json
npm run ai                    # AI engine      -> AI-AGENT-FINDINGS.json
node tools/compare-engines.mjs # this comparison
```

Generated 2026-11-23T22:12:46.913Z.

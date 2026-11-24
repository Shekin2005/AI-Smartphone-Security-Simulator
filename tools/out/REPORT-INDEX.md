# Report index

Every file here was produced by a run against the live deployment at
<https://shekin.tail97139a.ts.net> on 2026-11-24. Nothing is hand-written.

| File | Produced by | What it is | Status |
| --- | --- | --- | --- |
| `NMAP-REPORT.txt` / `.xml` | `nmap -sT -p 80,443,3000,5432 -sV` | Port and service scan of the published surface | complete |
| `NIKTO-REPORT.txt` | `nikto -h host.docker.internal -p 80` | Web server scan, nikto's own `-o` output | complete |
| `NIKTO-CONSOLE.txt` | same run, stdout | The same scan with nikto's request-count summary | complete |
| `AI-AGENT-REPORT.md` | `tools/ai-agent.mjs`, model `nvidia/nemotron-3.5-lightning-30b-a3b` | LLM-driven test of the bank app, 3 requests | complete |
| `PENTEST-REPORT.md` | `tools/pentest-suite.mjs` | The 12 deterministic checks, 3 findings | complete |
| `COMPARISON-REPORT.md` | `tools/compare.mjs` | Both engines scored against independently established ground truth | complete |
| `shannon/` | Shannon, full profile | White-box autonomous pentest, exploit-backed | **not yet produced** |

`shannon/` is empty because only the `validate` profile has completed so far;
validation checks credentials and reachability but performs no scanning, so it
writes no report. A full run is what produces one.

## NMAP

```
PORT     STATE  SERVICE    VERSION
80/tcp   open   http?
443/tcp  closed https
3000/tcp closed ppp
5432/tcp open   postgresql PostgreSQL DB 9.6.0 or later
```

Two things worth reading off this:

- **80 is the only web port.** 443 is closed on the container network because
  Tailscale terminates TLS at the edge and only forwards to port 80. That is
  deliberate, and it is why an HTTPS nmap/nikto scan from inside the container
  cannot work.
- **5432 is reachable** from inside the container. This is by design - the app
  reads `DATABASE_URL` pointing at the host - but it means Postgres listens on
  more than loopback. It is **not** internet-exposed: Funnel forwards 443 to 80
  and nothing else. Worth stating accurately rather than overclaiming.

## NIKTO

The scan made **7,970 requests with 0 errors** and reported 3 items:

```
+ [000287] /: Retrieved via header: 1.1 Caddy.
+ [999100] /: Uncommon header(s) 'origin-agent-cluster' found, with contents: \?1.
+ [013587] /: Suggested security header missing: permissions-policy.
```

`NIKTO-REPORT.txt` is nikto's own `-o` file, which omits the summary counters.
`NIKTO-CONSOLE.txt` is the same run's stdout and includes
`7970 requests: 0 errors and 3 items reported`, so the two together are the
complete record.

## AI agent

Three requests, chosen by the model:

| Step | Request | Status |
| --- | --- | --- |
| 1 | `GET /api/bank/accounts` | 200 |
| 2 | `GET /api/bank/tuition/student/AC00000001` | 404 |
| 3 | `GET /api/bank/tuition/student/AC00000034` | 200 |

Step 2 guessed a non-existent identifier and corrected itself on step 3.

**Findings the model claimed: 0. Findings confirmed from its own responses: 1.**
Both counts are printed because they measure different things - a finding is
credible because the response proves it, not because the model asserted it.

## Manual suite

12 checks, 9 passed, 3 vulnerable, 0 inconclusive, in 63 seconds. The three:

| # | Finding | Severity | CVSS |
| --- | --- | --- | --- |
| 1 | Any bank user can read every student's tuition record (IDOR) | Medium | 6.5 |
| 2 | MFA lockout releases after ~31 s and does not persist | Medium | — |
| 3 | Plain HTTP is served without redirecting to HTTPS | Low | — |

## Comparison

Both engines were given the same endpoint list and scored against ground truth
established beforehand by source review and direct measurement.

| Metric | Manual | AI |
| --- | --- | --- |
| Real vulnerabilities found | 3/3 | 1/3 |
| Controls correctly left alone | 4 | 1 |
| False positives | 0 | 0 |

The AI was incomplete, not wrong. The two it missed both require waiting - a
lockout that only releases after 31 seconds, and a redirect that only appears on
a second request.

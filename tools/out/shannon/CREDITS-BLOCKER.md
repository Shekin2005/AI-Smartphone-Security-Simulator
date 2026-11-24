# Why Shannon still has no final report — the funded-key problem

**Status as of 24 November 2026, 17:20.** Shannon is fully wired and working. It
reaches the exploitation phase. It cannot finish, because the model account has
no credit. This note records the evidence and the exact remedy, so the run can
be completed in one step once funded.

## What was proven

A working OpenRouter key was supplied and it **is valid**. Three independent
checks:

```
GET  /api/v1/key      -> 200, authenticated
POST /api/v1/chat/completions (paid model)   -> 200, real completion
POST /api/v1/chat/completions (free model)   -> 200, valid tool call in 0.6 s
```

The key is not the problem. The **balance** is:

```
GET /api/v1/credits
total_credits : 0
total_usage   : 0.152569
balance       : -0.152569
```

The account holds **zero credit**. The `limit: 5` reported by `/api/v1/key` is a
spending *cap*, not a balance — a distinction that cost several failed runs to
establish.

## The two ceilings, in the provider's own words

**Paid models — refuses to reserve output tokens:**

```
402 This request requires more credits, or fewer max_tokens.
    You requested up to 65536 tokens, but can only afford 16126.
```

Shannon asks for 65536 output tokens per call. Against an empty balance the
reservation check fails immediately, which is why runs died in pre-recon with a
generic `AGENT_EXECUTION_FAILED` and no visible cause — Shannon logged only
`errorMessageLength: 521`.

**Free models — capped per day:**

```
429 Rate limit exceeded: free-models-per-day.
    Add 10 credits to unlock 1000 free model requests per day
```

73 calls succeeded, the run reached **exploitation** — further than any previous
attempt — and then the daily free allowance ran out mid-phase.

## Why this took a proxy to find

Shannon discards the provider's error body. Its `deliverables/error.log` records
only a length, not the message, so the first two failures were opaque. A
throttling proxy (`C:/temp/shannon-proxy.mjs`, started with
`C:/temp/start-proxy-win.cmd`) was interposed to log every upstream status and
body. That is what surfaced both messages above.

One trap worth recording: the proxy must run on the **Windows host**, not in
WSL. Shannon's agents execute in worker containers, where `127.0.0.1` is the
container itself, so a proxy on WSL loopback receives nothing. From a container
the host is `host.docker.internal`. The first attempt at this failed this way and
cost `$0.0000` in zero requests.

## `--pipeline-testing` is not a workaround

It was tried, to fit inside the free daily cap. It produces **stubs**, not
abbreviated analysis:

```
## 1. Executive Summary
Pipeline testing placeholder
...
"notes": "Pipeline testing stub entry."
```

Those files were deleted rather than kept. Presenting them as Shannon's output
would have been misleading. A usable report requires the `full` profile.

## The remedy

**Add credit to the OpenRouter account.** The provider's own message names the
threshold:

| Top-up | What it unlocks |
| --- | --- |
| **$10** | 1,000 free-model requests/day **and** $10 of paid capacity |
| any amount | paid models, subject to the per-request reservation check |

$10 is the right figure: it clears the reservation check that blocks paid
models and lifts the free-tier ceiling twentyfold. A full `full`-profile run
costs well under $1 at current prices — the recorded attempts spent $0.06 each
before failing, and the original successful analysis run cost a fraction of that.

## What happens the moment it is funded

```bash
# 1. put the key in .env.shannon (gitignored)
#    SHANNON_AI_MODEL=openrouter:openai/gpt-oss-120b

# 2. optional but recommended: the logging proxy, so any future provider
#    error is visible instead of swallowed
powershell -File C:\temp\start-proxy-win.cmd
#    then set baseUrl in tools/shannon-models.json to
#    http://host.docker.internal:8899/api/v1

# 3. start the bridge detached
powershell -Command "Start-Process C:\temp\start-bridge.cmd -WindowStyle Hidden"

# 4. run a full scan
curl -X POST http://127.0.0.1:7071/start \
  -H "x-bridge-token: <token>" -H "Content-Type: application/json" \
  -d '{"url":"https://shekin.tail97139a.ts.net","profile":"full"}'
```

Expected duration 30–45 minutes. The consolidated report then appears in this
folder as `comprehensive_security_assessment_report.md`, where
`/api/shannon/report` serves it.

## What is not affected

Nothing about the target or the other two engines. The deterministic suite still
reports 9 passed / 3 vulnerable / 0 inconclusive in 41 s, the AI agent's
two-count result stands, and the five findings in
`../PENTEST-CONSOLIDATED-REPORT.md` are all reproduced with captured traffic.

`SHANNON-CONSOLIDATED-REPORT.md` in this folder remains the stand-in: a
reconstruction of the consolidation Shannon never performed, built only from its
own deliverables, with every claim labelled *Exploited*, *Analysed* or
*Verified*.

## Attempts recorded

| # | Model | Profile | Outcome | Cost |
| --- | --- | --- | --- | --- |
| 1 | `z-ai/glm-5.3-flash` | full | pre-recon failed, 2 m 0 s, 5 turns | $0.0579 |
| 2 | `openai/gpt-oss-120b` | full | pre-recon failed, 9 m 22 s, 19 turns | $0.0567 |
| 3 | `openai/gpt-oss-120b` | full, via WSL proxy | failed at start — proxy unreachable from container | $0.0000 |
| 4 | `nvidia/nemotron-3.5-lightning:free` | pipeline | reached **exploitation**, then free daily quota | $0.0000 |

Attempts 1 and 2 failed for the `402` reason above, not for any fault in the
target or in Shannon. Attempt 4 is the evidence that the pipeline itself now
works end to end: with funding it will complete.

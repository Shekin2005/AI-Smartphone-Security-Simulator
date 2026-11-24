# AI Smartphone Security Simulator

A phone-shaped web simulator with two deliberately vulnerable applications, an
AI Defender console, and an Attack Lab that runs a real penetration test against
the running system.

**Live:** https://shekin.tail97139a.ts.net (phone passcode `1234`)

The point of the project is not the phone UI. It is that a system can be built,
deployed, attacked, and *measured* against known ground truth — and that the
difference between a deterministic scanner and an LLM agent can be demonstrated
rather than asserted.

---

## What is in the phone

| App | What it is |
| --- | --- |
| 🏦 **Banking** | Accounts, payments, tuition lookup. MFA-enforced. |
| 🎓 **Acadia Student** | Enrollments, services, tuition summary. MFA-enforced. |
| 🛡️ **AI Defender** | Streams an LLM agent that chooses its own attacks. |
| ⚠️ **Attack Lab** | Runs the deterministic pentest and the mission exercises. |

Both applications are real Express routes with PostgreSQL-backed sessions,
Argon2 password hashing, and TOTP second factors. They are intentionally
imperfect — that is what the pentest tooling exists to find.

---

## Architecture

```
                 internet
                    │  443 · TLS
              ┌─────▼──────┐
              │   caddy    │  reverse proxy, publishes 80
              └─────┬──────┘
                    │ web network
              ┌─────▼──────┐
              │    app     │  Node/Express
              │            │  · Banking + Acadia routes
              │            │  · AI Defender (spawns tools/ai-agent.mjs)
              │            │  · Attack Lab  (spawns tools/pentest-suite.mjs)
              └─────┬──────┘
                    │
              PostgreSQL
```

Two containers. The pentest tooling runs **inside** the app container, so there
is no scanner service, no Docker socket, and no second network surface. Only
Caddy publishes a port.

---

## Quick start

Requires Docker, and Node 20+ if you want to run the tools from a terminal.

```bash
git clone https://github.com/Shekin2005/AI-Smartphone-Security-Simulator.git
cd AI-Smartphone-Security-Simulator

cp .env.stack.example .env.stack
# fill in DATABASE_URL, SESSION_SECRET, TOTP_ENCRYPTION_KEY, PUBLIC_ORIGIN
chmod 600 .env.stack

docker compose --env-file .env.stack up -d --build
```

Verify:

```bash
curl -s https://your-host/api/health     # {"status":"running"}
docker compose --env-file .env.stack ps  # sim-app healthy, sim-caddy up
```

Open the site, press the power button, unlock with `1234`, then sign in to
Banking or Acadia.

---

## Penetration testing

The project ships two independent engines plus a study that scores both against
verified ground truth. All three run from the website **and** from a terminal.

### From the phone

| Where | Button | Runs |
| --- | --- | --- |
| Attack Lab | **▶ Run Manual Pentest** | `tools/pentest-suite.mjs` |
| AI Defender | **▶ Run AI Agent** | `tools/ai-agent.mjs` |

Both stream live output into the panel and link to the generated report. Both
require a signed-in, MFA-verified session because they spawn a process.

The manual run takes about a minute. The AI run takes about five, because the
free hosted model needs roughly a minute per decision.

### From a terminal

```bash
npm run pentest    # deterministic suite  -> PENTEST-REPORT.md
npm run ai         # LLM agent            -> AI-AGENT-REPORT.md
npm run compare    # scores both          -> COMPARISON-REPORT.md
npm run pentest:all
```

All reports are written to `tools/out/`:

| File | Contents |
| --- | --- |
| `PENTEST-REPORT.md` | Findings, evidence, fixes, and controls that held |
| `AI-AGENT-REPORT.md` | What the model chose to do, request by request |
| `COMPARISON-REPORT.md` | Both engines scored against ground truth |
| `findings.json` / `AI-AGENT-FINDINGS.json` | Machine-readable results |

### The two engines

**Manual** (`tools/pentest-suite.mjs`) runs 12 fixed checks. No LLM, no API key,
no dependencies beyond Node. It signs in with the lab accounts through the real
password + TOTP flow, attacks both apps, and records the actual request and
response behind every verdict. Each check ends `vulnerable`, `passed`, or
`inconclusive` — never a guess.

**AI** (`tools/ai-agent.mjs`) gives a model **three** tools — send an
authenticated request, record a finding, finish — and lets it decide what to
attack. Auth is handled for it so every turn is spent on the target.

Why three tools and not more: a general-purpose scanner offers its model ~44
tools, and free models given that many choices spend every turn on planning
tools (`create_todo`, `get_threat_model`) without ever touching the target.
Measured across five free models and 300+ turns, the attack tool was invoked
zero times. Given eight tools or fewer, the same model calls it correctly.

---

## Results

| | Manual | AI |
| --- | --- | --- |
| Real vulnerabilities found | **3 / 3** | 1 / 3 |
| Coverage | **100%** | 33% |
| False positives | **0** | 0 |
| Controls correctly left alone | 4 | 1 |

**Neither engine produced a false positive.** The AI was incomplete, not wrong.

The AI missed the two findings that need a *measurement over time* rather than a
single response:

- **MFA lockout** — proving the lock releases requires deliberate wrong codes and
  retries at 10s, 20s, 31s. The agent never sent a wrong code.
- **HTTPS redirect** — proving the redirect is missing requires a request to
  `http://`. The agent only used `https://`.

That is a genuine characterisation of a single-pass agent, and it is the
interesting result of the comparison. The manual engine's weakness is the
mirror image: it cannot find anything outside the checks it was written with.

### The three confirmed findings

| Severity | Finding |
| --- | --- |
| Medium (6.5) | **Tuition IDOR** — any bank user reads any student's name and balance by iterating sequential `AC########` IDs. The query filters on the supplied ID only and never on the caller. |
| Medium (5.3) | **Weak MFA lockout** — three wrong codes lock the account, but the lock releases after ~31 seconds and does not persist across sessions. |
| Low (3.1) | **No HTTPS redirect** — `http://` serves 200 with no `Location` header, and the `Secure` cookie is then silently dropped. |

Each is documented with the live request and response that proved it, plus a
concrete fix, in `tools/out/PENTEST-REPORT.md`.

---

## Demo walkthrough

A recording order that shows the whole argument in about eight minutes.

1. Open the site, press the power button, unlock with `1234`.
2. **Banking** → sign in as `scan-bank` with its TOTP code → **Tuition**.
3. Type `AC00000063` → **Lookup**. The panel answers with that student's name
   and balance — a record belonging to someone else. That is finding 1,
   demonstrated from the phone UI rather than from a terminal.
4. **Attack Lab** → **▶ Run Manual Pentest**. About a minute, 12 checks,
   3 confirmed vulnerabilities, then the report link.
5. **AI Defender** → **▶ Run AI Agent**. About five minutes: the model's own
   requests stream past, and it writes its own report.
6. In a terminal, `npm run compare` scores both against ground truth and
   writes `tools/out/COMPARISON-REPORT.md`.

Step 3 and step 4 are the same weakness reached two ways: one by hand, one by
script. Step 5 is the contrast — the agent finds the same weakness on its own,
but misses the two that need a measurement over time.

---

## Lab accounts

| App | Username | Password | Role |
| --- | --- | --- | --- |
| Bank | `scan-bank` | `ScanLab!2026pass` | `bank_user` |
| Acadia | `scan-student` | `ScanLab!2026pass` | `student` |

Both have TOTP enabled. The secrets live in the `.env.stack` configuration used
by the tools, not in this README.

These are deliberately weak accounts in a training lab. They are not secrets, and
the simulator is not a real bank or university service.

---

## Configuration

Set in `.env.stack`:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing key (32+ chars) |
| `TOTP_ENCRYPTION_KEY` | 64 hex chars; encrypts stored TOTP secrets. Changing it breaks every existing MFA enrolment. |
| `PUBLIC_ORIGIN` | Exact public URL; the app compares `Origin` against this |
| `SITE_ADDRESS` | Address Caddy serves |

Tool overrides:

| Variable | Default | Applies to |
| --- | --- | --- |
| `PENTEST_BASE` | public URL | manual suite target |
| `AI_BASE` | public URL | AI agent target |
| `AI_MODEL` | `moonshotai/kimi-k3.1-pro` | AI agent model |
| `AI_MAX_STEPS` | `16` | AI agent decision budget |
| `AI_LLM_KEY` | built-in free key | AI agent key override |

---

## Security posture

This is a deliberately vulnerable teaching system. Do not deploy it against real
users, and do not reuse its credentials anywhere else.

What it does get right, and what the pentest suite verifies each run:

- Argon2 password hashing, TOTP second factor, session-ID rotation on login
- Helmet security headers, `HttpOnly`/`SameSite`/`Secure` cookies
- Session-scoped access control across both applications
- Admin routes refused for non-admin sessions
- Identical login errors for real and fake usernames
- Registration that cannot mint an administrator

The known weaknesses are listed in `tools/out/PENTEST-REPORT.md` with fixes.

The AI agent ships with a free-tier LLM key committed on purpose so a marker can
run it without signing up for anything. If you fork this project, replace it with
your own from <https://build.nvidia.com>.

---

## Project layout

```
server.js                 Express app: auth, sessions, banking, Acadia, tool routes
school-routes.js          Acadia endpoints
school-services-routes.js Acadia services
public/                   Phone UI and app front-ends
  app.js                  Phone navigation, lock screen, power
  ai-agent-panel.js       AI Defender run + stream
  attack-lab-pentest.js   Attack Lab run + stream
tools/
  pentest-suite.mjs       Deterministic pentest
  ai-agent.mjs            LLM-driven agent
  compare-engines.mjs     Manual vs AI scoring
  README-PENTEST.md       Detailed how-to-run guide
  out/                    Generated reports
docker-compose.yml        caddy + app
Caddyfile                 Reverse proxy config
DEPLOY-SELFHOST.md        Deployment on a single host
PROJECT_GUIDE.md          Design notes
```

---

## Documentation

| Document | Contents |
| --- | --- |
| `tools/README-PENTEST.md` | How to run each engine, expected output, troubleshooting |
| `DEPLOY-SELFHOST.md` | Single-host deployment, secrets, Caddy, tunnel |
| `PROJECT_GUIDE.md` | Architecture and design decisions |
| `tools/out/COMPARISON-REPORT.md` | Manual vs AI scoring against ground truth |

---

## Limitations

- All probes are read-only. No write, delete, or state-changing exploitation.
- No fuzzing beyond the targeted injection probes in the suite.
- The AI agent runs on a free hosted model: ~1 minute per decision, and it does
  not always self-report findings. The harness therefore confirms findings
  deterministically from the responses the model actually received.
- The comparison's AI column is single-run, not averaged.

---

Educational simulation only. All data is fictional. No external systems are
targeted.

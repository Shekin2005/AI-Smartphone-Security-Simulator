# AI Smartphone Security Simulator — technical reference

Everything in this document was measured against the running deployment at
<https://shekin.tail97139a.ts.net>. Where a number appears, it came from a run,
not an estimate.

---

## 1. What the system is

A smartphone simulator that teaches application security testing. It presents a
phone UI containing two deliberately vulnerable web applications and three
pentesting engines that examine them.

```
                        https://shekin.tail97139a.ts.net
                                   │
                        ┌──────────▼──────────┐
                        │   Tailscale Funnel  │  terminates TLS, owns :443
                        │   (Let's Encrypt)   │
                        └──────────┬──────────┘
                                   │  proxy to 127.0.0.1:80
                        ┌──────────▼──────────┐
                        │   sim-caddy         │  Caddy 2, container :80
                        └──────────┬──────────┘
                                   │  reverse_proxy app:3000
                        ┌──────────▼──────────┐
                        │   sim-app           │  Node 22 / Express, container :3000
                        │                     │  serves the phone UI + 40 API routes
                        └──────────┬──────────┘
                                   │  host.docker.internal:5432
                        ┌──────────▼──────────┐
                        │  PostgreSQL 18.3    │  native Windows service
                        │  smartphone_security│  31 users
                        └─────────────────────┘
```

Measured on the host:

| Component | Evidence |
| --- | --- |
| `sim-caddy` | `caddy:2-alpine`, `Up 2 hours`, publishes `0.0.0.0:80` |
| `sim-app` | `ai-smartphone-app:1.0.0`, `Up (healthy)`, no published port |
| PostgreSQL | `postgresql-x64-18` service, PID 7780 on `0.0.0.0:5432` |
| Public edge | `tailscaled.exe` owns `:443`, certificate `CN=shekin.tail97139a.ts.net`, valid 23 Nov 2026 → 21 Feb 2027 |
| DNS | `209.177.145.97`, `.192`, `2607:f740:f::67` — Funnel ingress, not the host IP |

The database is **not** containerised. `sim-app` reaches it over
`host.docker.internal:5432`, and the server reports
`inet_server_addr() = 127.0.0.1`. Stop the Windows service and the site dies even
though both containers look healthy.

---

## 2. The two target applications

Both live inside the phone UI and share one authentication service.

### 2.1 Banking (`app = 'bank'`)

- Login: `POST /api/auth/login` → `POST /api/auth/verify` with a 6-digit TOTP
- Roles: `bank_user`, `bank_admin`
- Data: accounts (`/api/bank/accounts/:id`), tuition records
- The IDOR lives here: `/api/bank/accounts/:id` and the tuition lookup return
  another user's record when the identifier is changed

### 2.2 Acadia / school (`app = 'acadia'`)

- Same login flow, `role = 'student'` (and `acadia_admin`)
- Data: students, enrollments, courses
- Its enrollment handler binds the query to `req.session.userId`:

```js
WHERE e.student_user_id=$1     -- $1 is always the session user
```

So the `?student_id=1` parameter is **ignored**, and the application is
genuinely not vulnerable to that class of IDOR. This matters for section 5.

### 2.3 Authentication flow, as measured

```
POST /api/auth/login   {app, username, password, role}   → 200, session cookie
POST /api/auth/verify  {code}                            → 200, MFA satisfied
GET  /api/auth/me                                        → 200, identifies the caller
```

Two protections shape testing:

1. **TOTP is required.** The secret is stored encrypted with
   `TOTP_ENCRYPTION_KEY` (AES-256-GCM), so the suite decrypts it rather than
   asking for a code.
2. **A rate limiter allows 30 authentication requests per IP per 15 minutes.**
   Each suite run spends two. After several runs the limiter returns `429`, and
   checks that need a login report `inconclusive` — which means *undecided*,
   never *safe*. `docker restart sim-app` clears it because the counter is in
   memory.

---

## 3. The phone UI

Single-page application. Eight app icons on the home screen; screens are shown
by toggling `.active` on a `.screen` element.

| Screen | Purpose |
| --- | --- |
| Lock / keypad | `1234` unlocks; cosmetic, not a security control |
| Banking | Bank login, accounts, tuition lookup |
| Acadia | Student login, courses, enrollments |
| AI Pentest | Two engines: in-container agent and Shannon |
| Attack Lab | Interactive terminal running real tools |

Navigation is `#power-button` → `#unlock-button` → `[data-digit]` →
`[data-open="<screen>"]`, with `#back-button` to return.

A CSS detail worth recording because it caused a real regression: `.screen` is
`display:none` until `.active`, and screens are `position:absolute; inset:0`. Any
later stylesheet that sets `display` on a single-class selector of the same
specificity will beat it and paint over the phone. The terminal stylesheet
therefore declares `display` **only** on `.pentest-terminal.active`.

---

## 4. Engine 1 — the manual suite (`npm run pentest`)

**What it is:** one file, `tools/pentest-suite.mjs`, that speaks HTTP directly.
Not a framework. It signs in twice through the real password + TOTP flow, keeps
the two cookie jars **separate**, and that separation is what makes the
isolation checks meaningful — "bank cannot read school" is only a real test if
the sessions are genuinely independent.

**Runtime:** ~50 s. The bulk is check 7, which has to wait out an MFA lockout to
prove the lockout *releases*.

### 4.1 The 12 checks

| # | id | Weight if it fails | What it actually does |
| --- | --- | --- | --- |
| 1 | `unauth-access` | High | Calls protected endpoints with no cookie and expects `401` |
| 2 | `cross-app` | High | Bank session requests school data and vice versa; both must be refused |
| 3 | `vertical-escalation` | Critical | Student session calls admin endpoints; must be `403` |
| 4 | `bola-tuition` | Medium | Requests another user's tuition record by identifier |
| 5 | `mfa-brute-force` | Medium | Sends wrong codes until locked, waits, confirms guessing works again (~31 s) |
| 6 | `register-role` | Critical | Registers with `role=admin`; must not become an administrator |
| 7 | `session-fixation` | Medium | Compares the session identifier before and after authentication |
| 8 | `user-enumeration` | Low | Compares responses for a real and a non-existent username |
| 9 | `auth-ratelimit` | Medium | Repeated login attempts must eventually return `429` |
| 10 | `https-enforcement` | Low | Checks redirect/transport behaviour |
| 11 | `headers` | Info | Records the security-header set |
| 12 | `cookie-flags` | Info | Records `HttpOnly`, `Secure`, `SameSite` |

Each check produces one of three verdicts: **passed**, **vulnerable**, or
**inconclusive**. `inconclusive` is a first-class outcome, not a failure.

### 4.2 A real result

After `docker restart sim-app` (clean limiter), one run gave:
**9 passed, 3 vulnerable, 0 inconclusive.**

Observed vulnerable set: the bank tuition/account IDOR, and the
mass-assignment registration path.

### 4.3 Why check 5 takes a minute

Proving a lockout is *weak* means proving it **releases**. You cannot establish
that in a single request: send wrong codes, observe the lock, wait, then confirm
guessing is possible again. A single-pass agent will never do this, which is the
honest core of the comparison in section 7.

### 4.4 Probe accounts, and why the count drifts

Check 6 registers a throwaway account named:

```js
const username = `pentest_probe_${Date.now().toString(36)}`;
```

Each run therefore adds one to the database, and those accounts surface in the
IDOR check's results, so the record count grows 12 → 13 → 14 across runs. The
findings stay real; only the count drifts. Deleting the `pentest_probe_*` rows
stabilises it.

---

## 5. Engine 2 — the in-container AI agent (`npm run ai`)

**What it is:** `tools/ai-agent.mjs`. An LLM chooses its own HTTP requests
against one target application, records findings, and stops.

**Runtime:** seconds to a couple of minutes depending on the decision budget.

### 5.1 Exactly three tools

| Tool | Purpose |
| --- | --- |
| `http_request` | Send a request: method, path, body; returns status and body |
| `record_finding` | Claim a vulnerability with evidence |
| `finish` | End the run with a summary |

Three is deliberate. A general-purpose scanner exposes ~44 tools; free models
given that many spend every turn on `create_todo` / `get_threat_model` and never
touch the target — measured at **zero attack-tool invocations across 300+ turns**.
At eight or fewer they call correctly.

### 5.2 Two independent counts

The report carries both, and the distinction is the point:

- **Agent findings** — what the model actually called `record_finding` for
- **Detected** — what the harness confirmed from the responses the model received

A finding is credible because the response proves it, not because the model
claimed it.

### 5.3 Two real runs, 68 seconds apart

| | Run 1 (06:57:04) | Run 2 (06:58:08) |
| --- | --- | --- |
| Decisions used | 5 | 8 |
| Step 4 | `GET /api/school/students` → 404 | `GET /api/school/enrollments/6` → 404 |
| Step 5 | `GET /api/school/admin` → 404 | `GET /api/school/admin/students/1` → 404 |
| Step 6 | — | `GET /api/school/enrollments?student_id=1` → 200 |
| Step 8 | — | `GET /api/school/profile` → 404 |

The paths differ because the model chose them, one turn at a time; the report
renders them from the trace of its own tool calls. Nothing is templated.

### 5.4 Why a school-scoped run finds nothing, correctly

Both runs above are school scope. `/api/school/enrollments?student_id=1`
returned `200` — but that was the model's **own** enrollments, because the
handler ignores the parameter (section 2.2). It correctly did not report it.

`/api/school/admin/students → 403` in both runs is the access control holding.
A zero-finding school run is a defended target, not an empty report.

The IDOR is in the bank. Set scope to **Bank**.

### 5.5 Published reports are reproducible

Neither engine contains a student name. Grepping both tools for the names that
appear in a generated report returns **0 matches** — they are rows read from
PostgreSQL at run time. The truncation line is computed as
`hits.length - 8`, and the probe username comes from `Date.now()`.

---

## 6. Engine 3 — Shannon (`tools/shannon-bridge.mjs`)

**What it is:** [KeygraphHQ/shannon](https://github.com/KeygraphHQ/shannon),
AGPL-3.0. A white-box pentester: it reads the source, maps attack paths, then
executes real exploits. "No exploit, no report."

### 6.1 Why it cannot run in the container

Shannon needs Docker for its ephemeral worker container. Measured inside
`sim-app`:

```
$ docker exec sim-app sh -c "command -v docker; ls /var/run/docker.sock"
docker NOT in container
ls: cannot access '/var/run/docker.sock': No such file or directory
```

Mounting the host Docker socket into a **publicly reachable** web application
would give anyone who can register root-equivalent control of the host. So
Shannon runs on the Windows host inside WSL2, behind a bridge.

### 6.2 The architecture

```
phone UI  →  /api/shannon/*  →  sim-app  →  host.docker.internal:7071
                                            (loopback bridge, token-authenticated)
                                                    ↓ wsl.exe
                                              Shannon in WSL2
                                                    ↓
                                              worker container
```

The bridge binds `127.0.0.1` only and requires `x-bridge-token`. Loopback alone
is **not** sufficient as a control, because Docker Desktop forwards
`host.docker.internal` to the host's loopback — verified: a listener on
`127.0.0.1:7081` was reachable from inside the container.

### 6.3 Source staging

Shannon reads the repository and sends source context to the model endpoint.
`.env.stack` holds `SESSION_SECRET`, `TOTP_ENCRYPTION_KEY` and the database
password, so the bridge copies the tree to `.shannon-target` first, excluding:

`.env*`, `node_modules`, `.git`, `backups`, `*.log`, `*.dump`, `*.bak-*`,
`tools/out`

### 6.4 Three profiles

| Profile | Flags | Use |
| --- | --- | --- |
| Validate | `--validate-model` | Prove credentials + target in ~20 s, no scan |
| Pipeline | `--pipeline-testing` | Minimal prompts: fast, shallow |
| Full | — | Complete pentest, 1–1.5 hours |

### 6.5 Measured results

Validate, end to end through the app, signed in as `scan-bank`:

```
/api/shannon/health   → 200
  configured: true   ok: true   wsl: true
  node: v22.14.0     docker: 29.9.3   key set: true
  model: nvidia:nvidia/nemotron-3.5-lightning-30b-a3b

POST /api/shannon/start {profile:"validate"} → 200 {"ok":true,"scanId":"shannon-mwuesdwb"}
state=completed  elapsed=21s  exit=0

Validation COMPLETED
Duration:    2.2s
Total Cost:  $0.0000
Checks:
  - Preflight (LLM credentials, target URL) — OK (1.6s)
  - Cyber access verification — not required for this provider
```

A real scan (stopped deliberately at 165 s, no cost):

```
preflight               completed
pre-recon               completed
recon                   completed
vulnerability-analysis  completed
exploitation            running   (authz-exploit, auth-exploit)
reporting               pending
```

`Cyber access verification — not required for this provider` is why the free
NVIDIA key is the most reliable option: the safeguards that can interrupt a
cyber workload do not apply to a third-party provider.

### 6.6 Cost

Model endpoint is NVIDIA NIM, free tier. Both the validate run and the observed
scan reported **$0.0000**.

---

## 7. AI vs manual — the comparison

| | Manual suite | In-container agent | Shannon |
| --- | --- | --- | --- |
| **Determinism** | Identical every run | Different every run | Different every run |
| **Who chooses the test** | A human, in advance | The model, per turn | The model, from source |
| **Runtime** | ~50 s | seconds–minutes | 1–1.5 h |
| **Checks** | 12 fixed | unbounded, ad hoc | unbounded, source-driven |
| **Multi-step proofs** | Yes (MFA lockout release) | No | Partly |
| **Cost** | $0 | $0 on free key | $0 |
| **Needs** | Container only | A model key | WSL2 + Docker + bridge |
| **Output** | 12 verdicts + evidence | trace + findings | exploit-backed report |
| **False positives** | Structurally impossible | Possible (model claim) | Low — "no exploit, no report" |
| **Coverage** | Narrow, deep | Broad, shallow | Broad, deep |
| **Best for** | Regression, demo, grading | Exploration | Real pentest |

### 7.1 The measured difference that matters

Manual finds what it was written to find, and proves it repeatably. The agent
finds what it happens to think of, and the harness decides whether to believe it.

Observed on the bank application: the agent's step 5 was
`GET /api/bank/accounts/AC00000034 → 404` — it guessed a non-existent
identifier and corrected itself on the next turn. That is genuine exploration,
and also why an agent can spend five turns learning nothing.

Manual found the IDOR on its first attempt because a human already knew where it
was. Neither is better; they answer different questions.

### 7.2 Where they agree

Both engines report the bank IDOR as real when scoped to the bank. Agreement
between a deterministic check and an independent agent is the strongest signal
the system produces.

---

## 8. The Attack Lab terminal

A real prompt on the phone, backed by real tools installed into the app image.

### 8.1 Tools

| Binary | Source |
| --- | --- |
| `nikto` | 2.6.1 from upstream — **removed from Debian bookworm**, so built from the release tarball |
| `nmap` | Debian |
| `whatweb` | Debian |
| `dig` | `dnsutils` |
| `openssl` | Debian |
| `curl` | Debian |

Kali is a distribution; these are packages, so they install directly.

### 8.2 Commands, with measured timings

| Command | Time | Result |
| --- | --- | --- |
| `help` | < 1 s | Command list |
| `clear` | < 1 s | Client-side only |
| `pentest` | ~50 s | The 12-check suite |
| `nmap -sT -p 80 host.docker.internal` | 1 s | `80/tcp open http` |
| `curl -i http://host.docker.internal/api/health` | < 1 s | `HTTP/1.1 200 OK` + Helmet headers |
| `whatweb -a 1 http://host.docker.internal` | 4 s | Caddy, page title, header set |
| `dig +short host.docker.internal` | < 1 s | `192.168.65.254` |
| `openssl s_client -connect shekin.tail97139a.ts.net:443` | < 1 s | TLS 1.3, `Verification: OK` |
| `nikto -h host.docker.internal -p 80` | ~50 s | **7,970 requests, 0 errors, 3 findings** |

### 8.3 A real nikto run

```
lab@attack:~$ nikto -h host.docker.internal -p 80
[exec] nikto -h host.docker.internal -p 80 -nointeractive
- Nikto v2.6.1
+ Target IP:          192.168.65.254
+ Target Port:        80
+ Server: No banner retrieved
+ [000287] /: Retrieved via header: 1.1 Caddy.
+ [999100] /: Uncommon header(s) 'origin-agent-cluster' found, with contents: \?1.
+ [013587] /: Suggested security header missing: permissions-policy.
+ 7970 requests: 0 errors and 3 items reported on the remote host
```

Three genuine findings against the live deployment: a version banner, an
uncommon header, and a missing security header.

### 8.4 Why the public hostname aborts — and it is not a broken install

```
lab@attack:~$ nikto -h https://shekin.tail97139a.ts.net/
+ ERROR: *** Error limit (20) reached ... Last error: opening stream: ssl connect failed. ***
```

Inside the container the hostname resolves to the **Tailscale** address, not the
public funnel:

```
$ docker exec sim-app getent hosts shekin.tail97139a.ts.net
100.111.105.54  shekin.tail97139a.ts.net
```

So nikto scans down the tunnel, and the funnel accepts one request but drops its
hundreds of rapid TLS reconnects. Measured, same binary, same site:

| Target | Requests | Errors | Time | Result |
| --- | --- | --- | --- | --- |
| `-h shekin.tail97139a.ts.net -p 443 -ssl` | 160 | 20 | 1 s | aborted |
| `-h host.docker.internal -p 80` | **7,970** | **0** | 36 s | 3 findings |

`host.docker.internal` reaches the same Caddy instance over the published port
without leaving the host, so nothing is rate limited. The terminal now translates
the URL form into `-h host -p port -ssl` and prints this explanation before the
scan starts.

### 8.5 Guard rails — why this is not a shell

The command line is split into argv and executed with `shell: false`:

- `;` `|` `&` `$` `` ` `` `>` `<` `\` are rejected before execution
- `argv[0]` must be allowlisted (`bash`, `sh`, `env`, `python` are refused)
- every host argument is extracted and checked against this lab
- the process runs as the unprivileged `node` user, minimal environment
  (no database URL, no session secret)
- 4,000 lines / 512 KB / 3 minutes per command

Observed:

```
lab@attack:~$ nikto -h example.com
[!] Out of scope: example.com

lab@attack:~$ curl -i http://host.docker.internal/ ; whoami
[!] Shell metacharacters are not supported here.

lab@attack:~$ bash -c whoami
[!] Unknown command: bash
```

This exists because the site is publicly reachable with open registration: an
unrestricted shell behind a login is remote code execution for anyone who signs
up.

### 8.6 Flags the terminal adds automatically

| Tool | Added | Why |
| --- | --- | --- |
| `nikto` | `-nointeractive`; `-p`/`-ssl` from a URL | nikto prompts about its database; URLs are not its native form |
| `curl` | `-sS` | Its progress meter floods the transcript |
| `openssl` | `-brief` | Without it the command waits for the server to close: **180 s → 0 s** |
| all | stdin closed | Tools that read stdin would block until the guard |

The final argv is printed on the `[exec]` line, so what ran is always visible.

---

## 9. The API surface

**40 routes** in `server.js`, plus two route modules for the school app.

| Group | Count | Examples |
| --- | --- | --- |
| `/api/shannon` | 6 | health, start, status, logs, stop, report |
| `/api/security` | 4 | defender telemetry used by the dashboard |
| `/api/auth` | 4 | login, verify, me, logout |
| `/api/bank` | 3 | accounts, tuition |
| `/api/pentest` | 2 | run (SSE), report |
| `/api/lab` | 2 | terminal exec (SSE), report |
| `/api/ai-agent` | 2 | run (SSE), report |
| `/api/acadia` | 1 | student data |
| `/api/health` | 1 | `200 OK` health probe |

Three streaming transports exist, all Server-Sent Events: the manual suite, the
AI agent, and the terminal. The browser and the CLI therefore consume the same
bytes — a command typed on the phone and the same command typed in a terminal
produce identical output.

Every route that spawns work requires `req.session.userId` and returns `401`
otherwise. Verified: `/api/lab/terminal/exec` → `401`, `/api/shannon/health` →
`401` without a session.

---

## 10. Security posture of the host itself

The application teaches vulnerabilities, so its own edge matters.

| Control | State |
| --- | --- |
| TLS | Let's Encrypt via Funnel, valid to 21 Feb 2027, HSTS 1 year |
| Security headers | Helmet: CSP, COOP, CORP, Referrer-Policy, `X-Powered-By` removed |
| Sessions | PostgreSQL-backed, `HttpOnly` cookie |
| TOTP secrets | AES-256-GCM at rest with `TOTP_ENCRYPTION_KEY` |
| Auth rate limit | 30 requests / IP / 15 min |
| Command execution | argv allowlist, `shell:false`, target pinned, no privileges |
| Docker socket | **not** exposed to the app — deliberate |
| Shannon bridge | loopback + shared token, target allowlist, sanitised source |
| Secrets in git | `.env*` gitignored; only `.env.stack.example` tracked |

Deliberately **not** fixed, because they are the lesson: the bank IDOR, the
mass-assignment registration, and the missing `permissions-policy` header that
nikto reports.

---

## 11. How to run everything

```bash
cd "E:/Security/Project 2/project/ai-smartphone-security"

# core stack
docker compose --env-file .env.stack up -d --build

# manual suite (12 checks, ~50 s)
npm run pentest

# in-container AI agent (needs a model key)
npm run ai

# score both against ground truth
npm run compare

# clear the auth limiter before a demo
docker restart sim-app

# Shannon bridge (Windows host, separate terminal)
export SHANNON_BRIDGE_TOKEN="$(cat token.txt)"
export SHANNON_AI_API_KEY="nvapi-..."
node tools/shannon-bridge.mjs
```

Full command reference: `TERMINAL-COMMANDS.md`.
Shannon feasibility and measurements: `SHANNON.md`.

---

## 12. Known limits, stated plainly

1. **The in-container agent is capped by model quality.** The free-tier models
   available during development complete 5–8 decisions before budget or context
   runs out. A paid key removes the ceiling without changing the code.
2. **A full Shannon run is 1–1.5 hours**, against a demo window measured in
   minutes. Validate and pipeline profiles exist for that reason.
3. **The auth limiter is in memory.** Repeated runs produce `inconclusive`
   verdicts until `sim-app` restarts.
4. **Probe accounts accumulate.** Each suite run adds one `pentest_probe_*` row,
   so the IDOR record count drifts between runs.
5. **HTTPS cannot be scanned from inside the container.** Tailscale terminates
   TLS; only port 80 is published. `openssl s_client` reads the certificate, and
   nikto scans HTTP on the published port.
6. **Shannon needs WSL2 + Docker + a running bridge.** If the bridge is down the
   button reports it and the in-container agent still works.

---

## 13. Report pipeline

The AI report is written to disk and served three ways, all verified:

```
/api/ai-agent/report?format=md    → 200
/api/ai-agent/report?format=json  → 200
/api/ai-agent/report?format=pdf   → 200, %PDF-1.4
/api/ai-agent/report?format=csv   → 404 when there are no findings (correct)
```

The Shannon report is served from the bridge's output directory through
`/api/shannon/report`, content type chosen by extension.

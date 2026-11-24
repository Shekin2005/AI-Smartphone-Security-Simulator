# Terminal commands: running both pentests

Every command in this document was run against the live deployment and the
output shown is the output that was actually observed, not an idealised version.

Two independent engines test the same application, and a third command scores
both against ground truth:

| Engine | Command | What drives it | Output |
| --- | --- | --- | --- |
| Manual pentest | `npm run pentest` | 12 fixed checks, no AI, no API key | `tools/out/PENTEST-REPORT.md` |
| AI pentest | `npm run ai` | an LLM choosing its own requests | `tools/out/AI-AGENT-REPORT.md` |
| Comparison | `npm run compare` | scores both against ground truth | `tools/out/COMPARISON-REPORT.md` |

All three also run from the phone UI (see [section 6](#6-running-from-the-website-instead)).

---

## Quick reference

```bash
# from the project root
cd "E:/Security/Project 2/project/ai-smartphone-security"

npm run pentest          # manual: 12 checks, ~50 seconds
npm run ai               # AI: LLM-driven, seconds per decision
npm run compare          # score both, writes COMPARISON-REPORT.md
npm run pentest:all      # all three in sequence
npm run check:js         # syntax-check server.js and public/app.js
```

`npm start` runs `node server.js` directly, but it needs the same environment
variables as the container (`DATABASE_URL`, `SESSION_SECRET`,
`TOTP_ENCRYPTION_KEY`, `PUBLIC_ORIGIN`). For a demo, use Docker.

Containers:

```bash
docker compose --env-file .env.stack up -d          # start
docker compose --env-file .env.stack ps             # status
docker compose --env-file .env.stack logs -f app    # follow app logs
docker restart sim-app                              # also clears the auth rate limiter
```

---

## 0. Before you run anything

### 0.1 The stack has to be up

```bash
docker compose --env-file .env.stack ps
curl -s https://shekin.tail97139a.ts.net/api/health
```

Observed healthy state:

```
sim-app    Up (healthy)
sim-caddy  Up
{"status":"running"}
```

If `sim-app` is not running, both engines stop at the login step. They never
report a false "clean" result — they say plainly that they could not
authenticate.

### 0.2 Why the tools target the public HTTPS URL, not localhost

The session cookie is issued with the `Secure` flag. Over plain `http://` the
client is not allowed to store it, so the login "succeeds" and then every
subsequent request is anonymous. The suite therefore defaults to
`https://shekin.tail97139a.ts.net`, which is also where Caddy terminates TLS.

### 0.3 Node version

Node 20 or newer. Nothing needs `npm install` — the suite and the agent use
only the Node standard library (`fetch`, `crypto`, `child_process`). The suite
needs no key at all; the agent ships with a free NVIDIA NIM key.

### 0.4 Shell differences on Windows

Git Bash (the shell used for every measurement in this document):

```bash
PENTEST_BASE=https://example.com npm run pentest
```

cmd.exe:

```
set PENTEST_BASE=https://example.com && npm run pentest
```

PowerShell:

```powershell
$env:PENTEST_BASE="https://example.com"; npm run pentest
```

---

## 1. `npm run pentest` — the manual pentest

### 1.1 What the command actually does

`package.json` maps it to `node tools/pentest-suite.mjs`. There is no wrapper
and no framework: it is one file that speaks HTTP directly.

The run proceeds in this order:

1. **Signs in twice, for real.** Password step (`POST /api/auth/login`), then a
   TOTP code computed in-process from the base32 secret (`POST /api/auth/verify`).
   Both apps are signed in — `scan-bank` for banking, `scan-student` for Acadia
   — because half the checks are cross-application tests that need both
   sessions at once.
2. **Keeps the two sessions apart.** Each account gets its own cookie jar, so a
   request is always attributable to a known identity. This is what makes the
   isolation checks meaningful: "bank cannot read school" is only a real test if
   the two sessions are genuinely independent.
3. **Runs 12 checks.** Each check issues live HTTP requests, then compares what
   came back against what a correct system should have returned.
4. **Classifies every check** as `vulnerable`, `passed`, or `inconclusive`, and
   stores the literal request and response that produced that verdict.
5. **Writes two files** into `tools/out/`: `PENTEST-REPORT.md` (human) and
   `findings.json` (machine).

### 1.2 The 12 checks

Each check has a severity that only applies if the check *fails* — it is the
weight of the finding, not a description of the current state.

| # | Check | Weight if it fails | What it proves |
| --- | --- | --- | --- |
| 1 | HTTP security headers | Info | Helmet is emitting the expected headers |
| 2 | Session cookie flags | Info | `HttpOnly`, `SameSite`, `Secure` are set |
| 3 | Protected endpoints reject anonymous callers | High | No endpoint forgets its auth guard |
| 4 | A bank session cannot read the school app (and vice versa) | High | The two apps are actually isolated |
| 5 | A student cannot reach administrator functions | Critical | Role checks are enforced, not just app checks |
| 6 | Any bank user can read every student's name and tuition balance | Medium | **BOLA/IDOR**: ownership is checked |
| 7 | MFA guessing is only weakly rate-limited | Medium | The lockout survives time and new sessions |
| 8 | Login does not reveal whether an account exists | Low | No username enumeration via error text |
| 9 | Session identifier rotates on authentication | Medium | No session fixation |
| 10 | Public registration cannot create an administrator | Critical | Mass assignment on the role field |
| 11 | Authentication endpoints are rate limited | Medium | A limiter is active (policy `30;w=900`) |
| 12 | Plain HTTP is not redirected to HTTPS | Low | `http://` redirects, so the `Secure` cookie is not dropped |

Check 6 is the one that matters most. It walks sequential student IDs
(`AC00000001` upward, `PENTEST_ID_RANGE` wide, default 90) with a single bank
session and asks: does the endpoint return data belonging to someone who is not
the caller? It does, and the report shows the exact request and the response
body that proves it.

Check 7 is why the run takes about a minute. Proving that an MFA lockout is
*weak* means proving it **releases**: the suite sends wrong codes, is locked out,
waits, and confirms guessing is possible again roughly 31 seconds later. You
cannot establish that with a single request, and a single-pass AI agent will
never do it — which is the most interesting difference between the two engines.

### 1.3 Expected output

Observed on 2026-11-24:

```
Target: https://shekin.tail97139a.ts.net

[*] Signing in as bank account...
    OK - bank/bank_user
[*] Signing in as school account...
    OK - acadia/student

[*] HTTP security headers ... passed
[*] Session cookie flags ... passed
[*] Protected endpoints reject anonymous callers ... passed
[*] A bank session cannot read the school app (and vice versa) ... passed
[*] A student cannot reach administrator functions ... passed
[*] Any bank user can read every student's name and tuition balance ... VULNERABLE (Medium)
[*] MFA guessing is only weakly rate-limited ... VULNERABLE (Medium)
[*] Login does not reveal whether an account exists ... passed
[*] Session identifier rotates on authentication ... passed
[*] Public registration cannot create an administrator ... passed
[*] Authentication endpoints are rate limited ... passed
[*] Plain HTTP is not redirected to HTTPS ... VULNERABLE (Low)

================================================================
Confirmed vulnerabilities: 3
Report:  ...\tools\out\PENTEST-REPORT.md
Results: ...\tools\out\findings.json
================================================================
```

Result: **3 vulnerabilities, 9 controls held, 0 inconclusive**, in 50 seconds.

### 1.4 Where the evidence is

`tools/out/PENTEST-REPORT.md` is numbered, and one section is conditional:

1. **1. Executive summary** — counts by severity, and the issue that matters most.
2. **2. Findings that need fixing** — each with the live request, the live
   response, impact, and a concrete fix.
3. **3. Controls that held up** — the defences that were attacked and did not
   break. This is the section that shows the system was tested rather than
   merely declared secure.
4. **N. Inconclusive** — only present when at least one check could not reach a
   decided state. When it is absent, every check was decided. When it is
   present, the section after it is renumbered, so read the headings rather
   than assuming a fixed section number.
5. **Last. How to reproduce this run** — the exact command and the environment
   variables that affect the run.

The current report contains no Inconclusive section because the last run was
12/12 decided (9 passed, 3 vulnerable).

`findings.json` carries the same data for tooling. Its top level is an object,
not a bare array:

```json
{
  "target": "https://shekin.tail97139a.ts.net",
  "generated_at": "2026-11-24T06:34:33.037Z",
  "results": [ /* 12 entries, one per check */ ]
}
```

Each entry in `results` has:

| Field | Example | Meaning |
| --- | --- | --- |
| `id` | `idor-tuition` | Stable machine key for the check |
| `title` | `Any bank user can read every student's name and tuition balance` | Human-readable name |
| `severity` | `Medium` | Weight **if** the check fails |
| `category` | `access-control` | Grouping |
| `cwe` | `CWE-639` | Weakness classification, where one maps |
| `vulnerable` | `true` | The verdict: `true`, `false`, or undecided |
| `summary` | `12 student record(s) disclosed` | One-line result |
| `evidence` | `[{ "request": "...", "response": "..." }]` | The literal request/response pairs behind the verdict |
| `remediation` | prose | The concrete fix |

`evidence` is an array of request/response objects, so a single check can carry
more than one proof — the IDOR check records its enumeration probe and a
single-record follow-up. Example from the current file:

```json
{ "request": "GET /api/bank/tuition/student/AC00000034",
  "response": "HTTP 200 {\"student\":{\"studentId\":\"AC00000034\",\"name\":\"0306446\",\"tuitionCents\":200000..." }
```

### 1.5 Overrides

| Variable | Default | Meaning |
| --- | --- | --- |
| `PENTEST_BASE` | `https://shekin.tail97139a.ts.net` | Target URL |
| `PENTEST_ID_RANGE` | `90` | How far the IDOR scan walks student IDs |
| `PENTEST_BANK_USER` | `scan-bank` | Banking account |
| `PENTEST_BANK_PASS` | `ScanLab!2026pass` | Banking password |
| `PENTEST_BANK_TOTP` | bank base32 secret | Banking TOTP secret |
| `PENTEST_SCHOOL_USER` | `scan-student` | Acadia account |
| `PENTEST_SCHOOL_PASS` | `ScanLab!2026pass` | Acadia password |
| `PENTEST_SCHOOL_TOTP` | school base32 secret | Acadia TOTP secret |
| `PENTEST_OUT_DIR` | `tools/out` | Where reports are written |

Example — widen the enumeration to make the IDOR more obvious:

```bash
PENTEST_ID_RANGE=200 npm run pentest
```

### 1.6 The one thing that will bite you

The login limiter allows **30 authentication requests per IP per 15 minutes**
(policy `30;w=900`). Each suite run spends two logins, and each browser sign-in
spends more. Repeated back-to-back runs exhaust the budget, and checks 9 and 10
then report `inconclusive` because they cannot log in — a 429, not a
regression. `inconclusive` means "not decided", never "safe".

Clear it before a demo or a final run:

```bash
docker restart sim-app
```

The limiter is in memory, so the restart resets it. After a restart the same
run returned **9 passed, 3 vulnerable, 0 inconclusive**.

---

## 2. `npm run ai` — the AI pentest

### 2.1 What the command actually does

`package.json` maps it to `node tools/ai-agent.mjs`. The script:

1. Signs in to every application in scope — the same real password + TOTP flow.
2. Sends the model a system prompt containing the target, the known endpoints,
   and a starting list of identifiers.
3. Enters a loop: ask the model for one decision, execute the tool call it
   returns, feed the result back, repeat — up to `AI_MAX_STEPS`.
4. Assesses every response the model actually received, deterministically.
5. Writes `tools/out/AI-AGENT-REPORT.md` and `AI-AGENT-FINDINGS.json`.

The difference from the manual suite is not the reporting — it is **who chooses
the requests**. The suite has 12 requests written by a human. The agent has a
target and has to decide, turn by turn, what to send next.

### 2.2 The three tools the model is given

```text
http_request     send an authenticated request to bank or school
record_finding   report a vulnerability it believes it found
finish           end the assessment and summarise
```

Three, deliberately. A general-purpose scanner exposes roughly 44 tools, and a
free model given that many choices spends every turn on planning tools
(`create_todo`, `get_threat_model`) and never touches the target. Measured
across five free models and 300+ turns, the attack tool was invoked zero times.
With eight tools or fewer, the same model calls it correctly.

### 2.3 Scope: bank, school, or both

```bash
AI_TARGET=bank   npm run ai     # banking only
AI_TARGET=school npm run ai     # Acadia only
AI_TARGET=both   npm run ai     # both (default)
```

The scope changes the system prompt (which endpoints and identifiers are
listed), which accounts get signed in, and the `**Scope:**` line in the report.
A scoped run is a smaller, faster, more focused test — and it is what the phone
UI's Bank / School / Both buttons set.

Observed, bank scope, 5 decisions:

```
Model  : nvidia/nemotron-3.5-lightning-30b-a3b (free endpoint)
Steps  : max 5

[*] Logging in as bank...
    OK
[ 1] GET /api/bank/accounts as bank -> 200
[ 2] GET /api/bank/accounts/AC00000034 as bank -> 404
[ 3] GET /api/bank/tuition/student/AC00000034 as bank -> 200
[ 4] GET /api/bank/tuition/student/AC00000035 as bank -> 200
[ 5] GET /api/bank/tuition/student/AC00000036 as bank -> 200

================================================================
Requests executed : 5
Agent findings    : 0
Detected          : 1
================================================================
```

Read the last three lines carefully, because they are the honest part of this
project:

- **Requests executed: 5** — all chosen by the model.
- **Agent findings: 0** — the model did not call `record_finding`. Small free
  models are unreliable at self-reporting.
- **Detected: 1** — the harness assessed the responses independently and
  confirmed the IDOR. The finding is real because the *response* proves it, not
  because the model claimed it.

Step 2 is also worth noting: the model guessed an endpoint that does not exist,
got a 404, and corrected itself. That is the agent actually exploring rather
than replaying a script.

### 2.4 How a finding is confirmed

Two independent counts appear in the report:

| Line | Meaning |
| --- | --- |
| Findings reported by the agent itself | What the model chose to `record_finding` on |
| Findings confirmed from the agent's own requests | What the harness can prove from the responses received |

The second does not depend on the model remembering anything. Every confirmed
finding is traceable to a request in the report's full request log, so a marker
can verify the count by hand.

### 2.5 The model, and why it is a small one

| Setting | Value | Note |
| --- | --- | --- |
| Endpoint | `https://integrate.api.nvidia.com/v1` | OpenAI-compatible, free tier, no card |
| Model | `nvidia/nemotron-3.5-lightning-30b-a3b` | 30B MoE, 3B active |
| Fallback | `nvidia/nemotron-3.5-bolt-e4b` | tried once if the primary errors or times out |

Measured tool-calling latency on this free key:

```
nvidia/nemotron-3.5-lightning-30b-a3b   683 ms   tool call returned
nvidia/nemotron-3.5-bolt-e4b            644 ms   tool call returned
minimaxai/minimax-m3.1-flash          68048 ms   tool call returned
z-ai/glm-5.3-flash                    70006 ms   aborted (timeout)
moonshotai/kimi-k3.1-pro              25733 ms   16 tokens, reasoning ate the budget
```

The last line is why the default changed. A reasoning model spends its output
budget thinking before it acts; 26 seconds for a 16-token reply, and longer on
a real turn, which is what made earlier runs appear to stall. A small
tool-calling model answers in well under a second and is far better at this
particular job — pick the tool, fill in four fields.

### 2.6 No second login

The browser session that reaches the terminal is already MFA-verified, so the
server passes that cookie down (`AI_SESSION_COOKIE`) and the agent adopts it
after checking `/api/auth/me`. Without this, the agent would log in again and
**replay the same 30-second TOTP code the browser just used**, which fails and
burns rate-limit budget. From the terminal you will see:

```
[*] Logging in as bank...
    reused the signed-in bank session
```

### 2.7 Overrides

| Variable | Default | Meaning |
| --- | --- | --- |
| `AI_BASE` | public URL | Target |
| `AI_TARGET` | `both` | `bank`, `school`, or `both` |
| `AI_MAX_STEPS` | `16` | Decision budget |
| `AI_DEADLINE_MS` | `600000` | Wall-clock cap (10 minutes) |
| `AI_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b` | Any tool-calling model |
| `AI_MODEL_FALLBACK` | `nvidia/nemotron-3.5-bolt-e4b` | Retried once if the primary fails |
| `AI_LLM_BASE` | NVIDIA NIM | Any OpenAI-compatible base URL |
| `AI_LLM_KEY` | built-in free key | Override with your own |
| `AI_OUT_DIR` | `tools/out` | Report location |
| `AI_BANK_USER` / `_PASS` / `_TOTP` | lab values | Banking credentials |
| `AI_SCHOOL_USER` / `_PASS` / `_TOTP` | lab values | Acadia credentials |

Example — a deeper run on one application:

```bash
AI_TARGET=bank AI_MAX_STEPS=10 npm run ai
```

---

## 3. `npm run compare` — scoring both engines

```bash
npm run pentest && npm run ai && npm run compare
# or in one step:
npm run pentest:all
```

`compare` reads the two result files the previous runs produced and scores them
against a ground-truth set defined in `tools/compare-engines.mjs`. Each
ground-truth entry is either an `expected: "finding"` (an engine must report it)
or `expected: "control"` (an engine must *not* report it). That second category
is what makes the comparison honest: an engine that screams "vulnerable" at
everything scores badly too.

Output: `tools/out/COMPARISON-REPORT.md`.

```bash
npm run compare     # safe to re-run; it only reads existing result files
```

If either result file is missing, run the corresponding engine first — `compare`
scores results, it does not generate them.

---

## 4. The real SQL injection (one request)

`POST /api/lab/exploit/sqli` runs two queries over the same rows — one
parameterised, one with the input concatenated into the statement — and returns
both result sets plus the rows the injection read. It requires a signed-in
session and `LAB_VULNERABLE_MODE=true`, and the transaction is `READ ONLY`.

From the phone: **Attack Lab → ▶ Run SQL Injection**.

Observed with the default payload `' OR '1'='1`:

```
Parameterised query : 0 rows
Injected query      : 2 rows
id=101  label=Training student A  secret=LAB-GRADE-A
id=102  label=Training student B  secret=LAB-GRADE-B
```

Sending ordinary text such as `Training student A` returns 1 row from *both*
queries and reports `exploited: false`, so the panel does not fire on normal
input. That control is the difference between a demonstration and a magic trick.

The row set is pinned by a `MATERIALIZED` CTE before the predicate is injected,
input is capped at 64 characters, and the transaction cannot write. An injected
`OR` can widen the match *inside* the target application but cannot reach
another table.

---

## 5. Verifying the code before a run

```bash
npm run check:js
```

Syntax-checks `server.js` and `public/app.js`. Cheap, and it catches the class of
mistake that silently kills a page (a stray brace, an unclosed template literal).

```bash
node --check tools/pentest-suite.mjs
node --check tools/ai-agent.mjs
```

Check either engine without touching the network.

```bash
grep -c 'title: "' tools/pentest-suite.mjs     # 12 - the check count
```

---

## 6. Running from the website instead

The phone UI runs the same two scripts inside the app container. Nothing is
reimplemented in the browser: the server spawns the script and streams its
stdout back over Server-Sent Events.

| Screen | Control | HTTP it calls | Runs |
| --- | --- | --- | --- |
| 🖥️ Attack Lab | ▶ Run Manual Pentest | `GET /api/pentest/run` (SSE) | `tools/pentest-suite.mjs` |
| 🖥️ Attack Lab | ⤓ Report | `GET /api/pentest/report?download=1` | `MANUAL-PENTEST-REPORT.md` |
| 🧪 AI Pentest | Bank / School / Both | passed as `target` → `AI_TARGET` | — |
| 🧪 AI Pentest | ▶ Run | `GET /api/ai-agent/run?steps=5&target=bank` (SSE) | `tools/ai-agent.mjs` |
| 🧪 AI Pentest | ⤓ Report | `GET /api/ai-agent/report?download=1` | `AI-PENTEST-REPORT.md` |

Both `run` routes return `401` without a signed-in session, and both streams
emit three event types: `start`, `log` (one line at a time), and `done`.

So the terminal output and the phone output are the same bytes from the same
program. That is deliberate — it means a demo on the phone and a run in VS Code
cannot disagree.

---

## 7. Troubleshooting, by the exact message

| Message you see | Cause | Fix |
| --- | --- | --- |
| `429 Too many requests` during sign-in | Auth limiter spent (30 per 15 min per IP) | `docker restart sim-app`, wait 5 s, re-run |
| `... inconclusive` for checks 9 and 10 | Same limiter: `login 200, verify 429` | Same fix. `inconclusive` is not "safe" |
| `Could not establish an authenticated session` | Stack down, wrong URL, or rotated TOTP secret | `docker compose ps`, curl `/api/health`, check secrets |
| `403 Invalid request origin` | `Origin` header missing or not equal to `PUBLIC_ORIGIN` | Use the public HTTPS URL; send `Origin` when scripting |
| Session lost right after login | You used `http://`; the `Secure` cookie was dropped | Use `https://` |
| `LLM 410: model ... end of life` | A retired model id in `AI_MODEL` | Unset it, or use `nvidia/nemotron-3.5-lightning-30b-a3b` |
| Agent prints `(no tool call)` twice | Weak model lost the thread | The agent rebuilds a short context and retries; lower `AI_MAX_STEPS` if it persists |
| `Agent findings: 0` but `Detected: 1` | The model did not self-report | Not a failure — see [2.4](#24-how-a-finding-is-confirmed) |

---

## 8. One-glance summary of what each command proves

| Command | Proven by |
| --- | --- |
| `npm run pentest` | 12 checks, each with its request/response attached; deterministic, repeatable |
| `npm run ai` | a model choosing its own requests, with findings confirmed from the responses it received |
| `npm run compare` | both engines scored against a ground-truth set that includes controls |
| `▶ Run SQL Injection` | two queries over the same rows returning different results — the injection is executed, not described |

And the result those commands produce: **the manual engine finds 3 of 3 real
issues with 0 false positives; the AI agent finds 1, also with 0 false
positives.** The AI misses the two that need a *measurement over time* — an MFA
lockout that releases after 31 seconds, and a missing HTTPS redirect that
requires asking for `http://`. That gap is the finding, not a bug in the demo.

---

## 9. The Attack Lab terminal (nikto, nmap, curl)

Attack Lab is not just a button any more: it has a prompt you can type into.

```
lab@attack:~$ nikto -h host.docker.internal -p 80 -maxtime 40s
```

The tools are the ones Kali ships — Kali is a distribution, the tools are just
packages, so `nikto`, `nmap`, `whatweb`, `dig`, `whois` and `openssl` are
installed directly into the app image. `nikto` was dropped from Debian bookworm,
so it is built from the upstream 2.6.1 release.

### 9.1 Commands

| Command | What it does |
| --- | --- |
| `help` | List everything below |
| `clear` | Clear the transcript (client-side, no request) |
| `pentest` | Run the 12-check manual suite — identical to the button |
| `nikto -h <host> -p <port>` | Web server scan; add `-maxtime 90s` to bound it |
| `nmap -sT -p 1-1000 <host>` | Port scan (connect scan: works as the unprivileged `node` user) |
| `nmap -sV -p 80,443 <host>` | Service and version detection |
| `curl -i http://<host>/api/health` | Raw request with response headers |
| `whatweb -a 1 http://<host>` | Fingerprint the stack |
| `dig <host>` | DNS lookup |
| `openssl s_client -connect <host>:443` | Inspect the TLS certificate |

Targets are limited to this lab: `shekin.tail97139a.ts.net`,
`host.docker.internal`, `127.0.0.1`, `localhost`.

### 9.2 Real output, from a run through the browser prompt

```
lab@attack:~$ nikto -h host.docker.internal -p 80 -maxtime 40s
[exec] nikto -h host.docker.internal -p 80 -maxtime 40s -nointeractive
- Nikto v2.6.1
---------------------------------------------------------------------------
+ Target IP:          192.168.65.254
+ Target Hostname:    host.docker.internal
+ Target Port:        80
+ Platform:           Windows
---------------------------------------------------------------------------
+ Server: No banner retrieved
+ [000287] /: Retrieved via header: 1.1 Caddy.
+ [999100] /: Uncommon header(s) 'origin-agent-cluster' found, with contents: \?1.
+ [013587] /: Suggested security header missing: permissions-policy.
+ Scan terminated: 0 errors and 3 items reported on the remote host
+ 1 host(s) tested
```

That is nikto's own output, unmodified: a real version banner, real Caddy
detection, and real missing-header findings against the running site.

### 9.3 Why it is not a shell

The command line is split into argv and executed with `shell: false`. That means:

- `;`, `|`, `&`, `$`, `` ` ``, `>`, `<`, `\` are **rejected** before execution, and
  the terminal says so
- `argv[0]` must be on the allowlist — `bash`, `sh`, `env`, `python` are refused
- every host argument is extracted and checked against this lab, so the terminal
  cannot be used to scan a third party
- the process runs as the unprivileged `node` user with a minimal environment
  (no database URL, no session secret)
- output is capped at 4,000 lines / 512 KB and 3 minutes per command

This matters because the site is publicly reachable and registration is open: an
unrestricted shell behind a login would be remote code execution for anyone who
signed up. The allowlist keeps it a terminal for the exercise.

Observed rejections:

```
lab@attack:~$ nikto -h example.com
[!] Out of scope: example.com
    This terminal may only target this lab.

lab@attack:~$ curl -i http://host.docker.internal/ ; whoami
[!] Shell metacharacters are not supported here.
    Commands run as argv, not through a shell - pass options separately.

lab@attack:~$ bash -c whoami
[!] Unknown command: bash
```

### 9.4 How it is wired

| Piece | Detail |
| --- | --- |
| Route | `GET /api/lab/terminal/exec?cmd=<url-encoded>` |
| Auth | `401` without a signed-in session |
| Transport | Server-Sent Events, `log` per line then `done` with the exit code |
| Client | `public/attack-lab-terminal.js` — history on Arrow Up/Down, focus handled on screen open |
| Image | `Dockerfile` installs the tools and nikto 2.6.1 |

Because the browser and this document use the same route, a command typed on the
phone behaves exactly like the same command typed in a terminal.

### 9.5 Why an HTTPS scan of the public hostname stops early

This is the one result that looks like a broken install and is not. Typing the
URL from the browser address bar:

```
lab@attack:~$ nikto -h https://shekin.tail97139a.ts.net/
```

produces two findings and then aborts:

```
+ ERROR: *** Error limit (20) reached for host, giving up. Last error: opening stream: ssl connect failed. ***
+ ERROR: *** Consider using mitmproxy to avoid TLS fingerprinting. ***
+ Scan terminated: 20 errors and 2 items reported on the remote host
```

Measured cause. Inside the container the hostname does **not** resolve to the
public funnel address; it resolves to the Tailscale interface:

```
$ docker exec sim-app getent hosts shekin.tail97139a.ts.net
100.111.105.54  shekin.tail97139a.ts.net
```

So nikto scans down the tunnel, and the funnel accepts one request (0.23 s) but
drops the hundreds of rapid TLS reconnects a scan makes. Nikto's own message
about TLS fingerprinting is the tell: the handshake, not the tool, is being
refused.

Measured difference, same binary, same site:

| Target | Requests | Errors | Time | Result |
| --- | --- | --- | --- | --- |
| `-h shekin.tail97139a.ts.net -p 443 -ssl` | 160 | 20 | 1 s | aborted |
| `-h host.docker.internal -p 80` | **7,970** | **0** | 36 s | 3 findings |

`host.docker.internal` reaches the same Caddy instance over the published port
without leaving the host, so nothing is rate-limited. Use it:

```bash
nikto -h host.docker.internal -p 80
```

The terminal now translates the URL form into nikto's flags (`-h host -p port
-ssl`) and prints the explanation above before the scan starts, so the output
cannot be mistaken for a missing tool.

One related detail: Caddy publishes **only port 80** in this stack, with
Tailscale owning 443. `nikto -h https://host.docker.internal/` therefore resolves
to port 443 and reports `[FAIL] Unable to connect` — correct, not a bug. The
phone's HTTPS is terminated by Tailscale, not by the container.

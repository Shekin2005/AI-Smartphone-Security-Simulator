# Screen recording — run sheet

Every number below was measured on this machine. Total screen time is about
**7 minutes**; with talking, plan for 8–10.

---

## Part 1 — Pre-flight (do this immediately before recording)

Run these in order. Do not skip step 3.

### 1. Confirm the stack is up

```bash
docker ps --format "{{.Names}} | {{.Status}}"
```

Expect `sim-app | Up ... (healthy)` and `sim-caddy | Up ...`.
If `sim-app` is missing: `docker compose --env-file .env.stack up -d`.

### 2. Start the Shannon bridge — leave the window open

Double-click:

```
tools\start-shannon.cmd
```

A console window opens and stays open. It must remain open for the whole
recording. Expect:

```
[launcher] config from: .env.shannon, .env.stack
SHANNON BRIDGE
listening   127.0.0.1:7071 (loopback only)
```

If it says `SHANNON_AI_API_KEY is missing`, `.env.shannon` is absent.
If it says `refusing to start`, the token is missing from `.env.stack`.

### 3. Clear the authentication rate limiter

```bash
docker restart sim-app
sleep 20
curl -s -o /dev/null -w "%{http_code}\n" https://shekin.tail97139a.ts.net/
```

**This is the step that gets forgotten.** The limiter allows 30 auth requests per
IP per 15 minutes and is held in memory. Measured: after my testing it returned
`429 Too many requests` on login, and the AI panel then showed
`Sign in as a lab user before running the agent` — which looks like a broken app
and is only an exhausted counter. Restarting clears it. Wait for `200`.

### 4. Hard-refresh the page

`Ctrl+F5` in the browser. The terminal and Shannon clients are separate files; a
cached `index.html` hides them.

### 5. Have the TOTP code ready

In a terminal, leave this running and re-run it when a code expires:

```bash
node tools/totp-code.mjs OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI
```

It prints the current 6-digit code and the seconds left.

---

## Part 2 — The recording

### Shot 1 — Open on the phone (0:00, 20 s)

Open `https://shekin.tail97139a.ts.net`.

**Say:** "This is a smartphone simulator with two deliberately vulnerable web
applications, and three different pentesting engines that examine them."

Press the power button, unlock with **`1234`**.

### Shot 2 — Sign in to the bank (0:20, 40 s)

Banking → `scan-bank` / `ScanLab!2026pass` → the 6-digit code from step 5.

**Say:** "Real authentication: Argon2 password hashing and a real TOTP second
factor. The secret is encrypted at rest."

### Shot 3 — Attack Lab, real tools (1:00, 90 s)

Attack Lab → type at the `lab@attack:~$` prompt:

```
nmap -sT -p 80 host.docker.internal
```

Expect, in about a second:

```
PORT   STATE SERVICE
80/tcp open  http
```

Then:

```
curl -i http://host.docker.internal/api/health
```

Expect `HTTP/1.1 200 OK` plus the Helmet header set.

**Say:** "These are the real tools — nmap 7.93 and Nikto 2.6.1 are installed in
the container, and this is their own output. Commands are split into argv and run
without a shell, with the binary allowlisted and targets pinned to this lab, so
this is a terminal for the exercise rather than an open shell on a public site."

Then start the set piece and keep talking while it runs (about 50 s):

```
nikto -h host.docker.internal -p 80
```

Expect the finale:

```
+ [000287] /: Retrieved via header: 1.1 Caddy.
+ [999100] /: Uncommon header(s) 'origin-agent-cluster' found, with contents: \?1.
+ [013587] /: Suggested security header missing: permissions-policy.
+ 7970 requests: 0 errors and 3 items reported on the remote host
```

**Say:** "Seven thousand nine hundred and seventy requests, zero errors, three
real findings — a version banner, an uncommon header, and a missing
`permissions-policy` header."

### Shot 4 — The manual suite (2:30, 80 s)

Still in Attack Lab:

```
pentest
```

This takes **63 seconds**; it deliberately waits out an MFA lockout. Keep talking.

Expect a per-check verdict list ending:

```
Any bank user can read every student's name and tuition balance ... VULNERABLE (Medium)
MFA guessing is only weakly rate-limited ... VULNERABLE (Medium)
Plain HTTP is not redirected to HTTPS ... VULNERABLE (Low)
Confirmed vulnerabilities: 3
```

**Say:** "Twelve deterministic checks, nine passed, three real vulnerabilities.
Every verdict is repeatable — run it again and you get the same twelve."

### Shot 5 — The AI agent (3:50, 40 s)

AI Pentest screen. Engine is **In-container agent**. Scope **Banking**.
Decisions **3 · quick**. Press **Run AI Pentest**.

Expect in about **3 seconds**:

```
Model  : nvidia/nemotron-3.5-lightning-30b-a3b (free endpoint)
[ 1] GET /api/bank/accounts as bank -> 200
[ 2] GET /api/bank/tuition/student/AC00000001 as bank -> 404
[ 3] GET /api/bank/tuition/student/AC00000034 as bank -> 200
Agent findings    : 0
Detected          : 1
```

**Say:** "The model chose those requests itself. Step two guessed a
non-existent identifier and got a 404, so on step three it tried a different one
and got a 200. Two independent counts are shown on purpose: the model recorded
zero findings, but the harness detected one from the response it actually
received. A finding is credible because the response proves it, not because the
model claimed it."

### Shot 6 — Shannon (4:30, 60 s)

Same screen. Click **Shannon · WSL2**.

Expect the badge to change to **READY** with:

```
Ready — WSL2, Node v22.14.0, Docker 29.9.3. Model: nvidia:nvidia/nemotron-3.5-lightning-30b-a3b
```

Set **Shannon run** to **Validate only**. Press **✓ Validate model**.

Expect in about **20 seconds**:

```
Validation COMPLETED
Status:      completed
Total Cost:  $0.0000
Checks:
  - Preflight (LLM credentials, target URL) — OK (1.6s)
  - Cyber access verification — not required for this provider
[bridge] scan completed
```

**Say:** "This is Shannon, an autonomous pentester that reads the source and then
executes real exploits — no exploit, no report. It needs Docker for its worker
container, and this app deliberately has no Docker socket, because mounting one
into a publicly reachable app would be root-equivalent access to the host. So
Shannon runs in WSL2 behind a loopback bridge, and the app proxies to it. It
validated on the free model at zero cost, and cyber-access verification isn't
required for this provider — which is why it won't be interrupted mid-run."

Click back to **In-container agent** to show the switch works both ways.

### Shot 7 — Reports (5:30, 30 s)

Press **⬇ Report** on the AI Pentest screen.

**Say:** "The report is generated from the run trace — the model's own chosen
requests, not a template."

If you want to show the format contract:

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://shekin.tail97139a.ts.net/api/ai-agent/report?format=md"    # 200
curl -s -o /dev/null -w "%{http_code}\n" "https://shekin.tail97139a.ts.net/api/ai-agent/report?format=pdf"   # 415
```

**Say:** "The agent produces Markdown, so asking for PDF returns 415 rather than
quietly sending Markdown with a 200."

### Shot 8 — Close (6:00, 20 s)

**Say:** "Deterministic checks prove what they were written to prove. The AI agent
explores and can find things nobody scripted, but it is non-deterministic.
Running both and comparing them is the actual point of the project."

---

## Part 3 — If something breaks on camera

| Symptom | Cause | Fix on the spot |
| --- | --- | --- |
| `429 Too many requests` at login | auth limiter exhausted (30/15 min) | `docker restart sim-app`, wait 20 s, retry |
| Shannon badge **OFFLINE** | bridge window closed | double-click `tools\start-shannon.cmd` |
| `Ready` never appears, status says `Bridge unreachable` | same | same |
| `nikto` stops at ~160 requests with `ssl connect failed` | scanning the public hostname down the Tailscale tunnel | use `host.docker.internal -p 80` |
| Terminal says `[!] Unknown command: whois` | `whois` is not allowlisted (unsupported in this image) | skip it |
| AI panel shows `Sign in as a lab user` | not signed in, or limiter | sign in; restart if 429 |

---

## Part 4 — Do not do these on camera

| Avoid | Why |
| --- | --- |
| `nikto -h https://shekin.tail97139a.ts.net/` | Aborts at 160 requests — the funnel drops its rapid TLS reconnects |
| `nikto -h https://host.docker.internal/` | Port 443 is not published; prints `[FAIL] Unable to connect` |
| `whois ...` | Not allowlisted |
| Shannon **Full pentest** | 1–1.5 hours |
| Several full takes without restarting | Limiter returns `429` and checks 9–10 report `inconclusive` |

---

## Part 5 — Credentials card

| | Banking | Acadia |
| --- | --- | --- |
| Username | `scan-bank` | `scan-student` |
| Password | `ScanLab!2026pass` | `ScanLab!2026pass` |
| Role | `bank_user` | `student` |
| TOTP secret | `OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI` | `NAWFGQ2TKBTW2PSUJVDSCKLTH5KG4ZLC` |

Code: `node tools/totp-code.mjs OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI`

Phone unlock: `1234`

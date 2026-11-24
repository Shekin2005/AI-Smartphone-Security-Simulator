# AI Smartphone Security Simulator

A phone-shaped web simulator with two deliberately vulnerable applications, an
AI Pentest terminal, and an Attack Lab that runs a real penetration test against
the running system. Both pentest screens are terminals: they stream live output
and hand you a finished Markdown report.

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
| 🧪 **AI Pentest** | Terminal that runs an LLM agent against banking, school, or both, then downloads its report. |
| 🖥️ **Attack Lab** | A real terminal: nikto, nmap, curl, whatweb, dig, openssl, the 12-check suite, and a real SQL injection. |

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
              │            │  · AI Pentest  (spawns tools/ai-agent.mjs)
              │            │  · Attack Lab  (real SQLi + spawns tools/pentest-suite.mjs)
              └─────┬──────┘
                    │
              PostgreSQL
```

Three containers. The pentest tooling runs **inside** the app container, so there
is no scanner service, no Docker socket, and no second network surface. Only
Caddy publishes a port; the database is reachable only on the internal network.

---

## Setup on a new machine

Everything needed is in this repository. A fresh clone starts with **one
command**: no `.env` to write, no database to create, no SQL to run by hand.

### 1. What you need

| Requirement | Notes |
| --- | --- |
| Docker Desktop (Windows, macOS) or Docker Engine + Compose v2 (Linux) | `docker --version` and `docker compose version` should both work |
| Git | To clone |
| Node.js 20+ | **Optional.** Only needed to run the scanners from a terminal instead of the UI |

Port 80 must be free. If something already uses it, see
[Changing the port](#5-changing-the-port-or-the-address).

### 2. Start it

```bash
git clone https://github.com/Shekin2005/AI-Smartphone-Security-Simulator.git
cd AI-Smartphone-Security-Simulator
docker compose up -d --build
```

The first build takes roughly three to five minutes: it compiles the native
`argon2` module and installs `nmap`, `nikto` and `whatweb` into the app image.
Later starts take seconds.

Then open **<http://localhost>**, press the power button, and unlock the phone
with passcode `1234`.

### 3. What happens on the first start

Nothing is hidden behind manual steps, so this is the full sequence:

1. The **db** container initialises a PostgreSQL volume and runs `schema.sql`
   before it accepts connections.
2. The **app** container waits for the database health check, then runs
   `docker/bootstrap.mjs`.
3. The bootstrap applies `schema.sql` **and every other `.sql` file** in the
   repository. The files are not numbered and their dependencies do not follow
   alphabetical order, so it makes repeated passes, retrying whatever failed,
   until a pass makes no progress. On a clean database this applies **10 of 10**
   files.
4. It seeds three lab accounts — **only when the `users` table is empty**, so
   restarting never overwrites accounts you created yourself.
5. It prints the account credentials and TOTP secrets **once**, because the
   secrets are stored encrypted and cannot be recovered afterwards.
6. The Express server starts on port 3000 and Caddy proxies port 80 to it.

The expected log looks like this:

```text
[bootstrap] database reachable after 1 attempt(s)
[bootstrap] schema: pass 1 applied 6, retrying 4
[bootstrap] schema: 10/10 file(s) applied
[bootstrap] accounts: users table is empty, seeding lab accounts
==============================
 LAB ACCOUNTS CREATED
==============================
 bank scan account
   username     : scan-bank
   totpSecret   : OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI
 ...
[bootstrap] ready
```

Read it with:

```bash
docker compose logs app
```

### 4. The accounts it creates

| App | Username | Password | Role | TOTP secret |
| --- | --- | --- | --- | --- |
| Bank | `scan-bank` | `ScanLab!2026pass` | `bank_user` | `OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI` |
| Acadia | `scan-student` | `ScanLab!2026pass` | `student` | `NAWFGQ2TKBTW2PSUJVDSCKLTH5KG4ZLC` |
| Acadia | `professor` | `Acadia-Admin-2026!` | `admin` | `IYZUKTCLOFJCKQKVLVLHEQC3PFDWKMDQ` |

These secrets are **fixed on purpose**. The scanners in `tools/` use them as
defaults, so a fresh clone can run a pentest immediately instead of creating
accounts first. Add any of them to Google Authenticator, Microsoft
Authenticator or 1Password, or generate a code on the command line:

```bash
node tools/totp-code.mjs OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI
```

The administrator signs in through the **Administrator Login** card inside the
Acadia app, not the student form. The login API requires the role to match the
stored value, so an administrator's credentials are rejected by the student form
by design.

### 5. Changing the port or the address

Every default can be overridden with an environment variable:

```bash
# serve on port 8080 instead of 80
HTTP_PORT=8080 PUBLIC_ORIGIN=http://localhost:8080 docker compose up -d

# publish on a real hostname with automatic HTTPS
SITE_ADDRESS=demo.example.com PUBLIC_ORIGIN=https://demo.example.com docker compose up -d
```

`PUBLIC_ORIGIN` must match the URL in the browser **exactly**, including scheme
and port. It is compared against the request's `Origin` header, so
`http://localhost` and `http://localhost:8080` are different values and a
mismatch makes every POST return 403.

To use an existing PostgreSQL server instead of the bundled container, copy the
template and point it at your database:

```bash
cp .env.stack.example .env.stack
# set DATABASE_URL, SESSION_SECRET, TOTP_ENCRYPTION_KEY, PUBLIC_ORIGIN
docker compose --env-file .env.stack up -d --build
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `HTTP_PORT` | `80` | Host port Caddy publishes |
| `SITE_ADDRESS` | `:80` | Hostname Caddy serves; a real domain enables HTTPS |
| `PUBLIC_ORIGIN` | `http://localhost` | Exact browser URL; must match or POSTs are refused |
| `TOOL_BASE_URL` | `http://127.0.0.1:3000` | Address the in-container scanners attack |
| `DATABASE_URL` | bundled `db` service | PostgreSQL connection string |
| `SESSION_SECRET` | development value | Session signing key, 32+ characters |
| `TOTP_ENCRYPTION_KEY` | development value | Exactly 64 hex characters; encrypts TOTP secrets |
| `SEED_DEMO_ACCOUNTS` | `true` | Set `false` to start with no accounts |
| `LAB_VULNERABLE_MODE` | `true` | Enables the deliberately vulnerable lab endpoints |
| `AI_LLM_KEY` | built-in free key | Overrides the key baked into `tools/ai-agent.mjs` |
| `SHANNON_BRIDGE_TOKEN` | empty | Enables the Shannon pipeline button |

The two development secrets are fine for a local demo. **Replace both** before
putting this on a network, and generate them with:

```bash
openssl rand -base64 48   # SESSION_SECRET
openssl rand -hex 32      # TOTP_ENCRYPTION_KEY
```

### 6. Verify the installation

```bash
# 1. containers up
docker compose ps                     # db and caddy up, app up (healthy)

# 2. application and database reachable
curl -s http://localhost/api/health   # {"status":"running"}

# 3. accounts were seeded
docker compose exec db psql -U smartphone -d smartphone_security \
  -c "select app, username, role from users order by role;"

# 4. schema is complete
docker compose exec db psql -U smartphone -d smartphone_security \
  -c "\dt" | tail -20
```

### 7. Run a penetration test

**From the UI.** Open the phone, choose **Attack Lab**, press
**▶ Run Manual Pentest**. The suite signs in with the seeded accounts, runs 12
checks and writes a report you can download from the same screen. The
**AI Pentest** app does the same with an LLM agent.

**From a terminal.** Node 20+ on the host, and the stack already running:

```bash
npm install                     # one time, compiles argon2
PENTEST_BASE=http://localhost npm run pentest
```

A run takes about a minute — most of it is a deliberate 31-second wait that
measures how long the MFA lockout lasts. Output goes to `tools/out/`.

On a clean local stack you should see **3 confirmed vulnerabilities**:

```text
[*] Any bank user can read every student's name and tuition balance ... VULNERABLE (Medium)
[*] MFA guessing is only weakly rate-limited ... VULNERABLE (Medium)
[*] Session cookie flags ... VULNERABLE (Info)
[*] Plain HTTP is not redirected to HTTPS ... inconclusive
```

Two of these are the findings the project is about. The other two depend on the
scheme: a local stack runs over plain HTTP, so the cookie genuinely is not
`Secure` and the redirect check cannot tell HTTPS from HTTP on a loopback
address. On the HTTPS deployment those rows read differently. That difference is
a property of the environment, not a change in the code.

### 8. Stop, restart, reset

```bash
docker compose restart            # restart, keeping the database
docker compose down               # stop, keeping the database volume
docker compose down -v            # stop and DELETE the database
docker compose up -d --build      # rebuild after a code change
```

`down -v` is the way to get a genuinely clean install: it removes the volume, so
the next start re-applies the schema and re-seeds the accounts.

### 9. Running without Docker

Useful for editing code, because there is no rebuild step.

```bash
npm install
cp .env.example .env      # then set DATABASE_URL, SESSION_SECRET, TOTP_ENCRYPTION_KEY
psql "$DATABASE_URL" -f schema.sql
npm start                 # http://127.0.0.1:3000
```

`npm install` compiles `argon2`, so the machine needs Python, `make` and a C++
compiler. On Windows that means the Visual Studio Build Tools; on Debian or
Ubuntu, `apt install build-essential python3`. A failure building `argon2` is
almost always the missing compiler, not Node.

This path has no Caddy, so `PUBLIC_ORIGIN` must be `http://127.0.0.1:3000`, and
you create the accounts yourself:

```bash
node create-scan-account.js --app bank --username scan-bank --password "ScanLab!2026pass"
node create-scan-account.js --app acadia --role admin --username professor --password "Acadia-Admin-2026!"
```

### 10. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `port is already allocated` | Something already uses port 80 | `HTTP_PORT=8080 PUBLIC_ORIGIN=http://localhost:8080 docker compose up -d` |
| Page loads, every POST returns 403 | `PUBLIC_ORIGIN` does not match the browser URL | Set it to the exact URL you type, scheme and port included |
| Login accepts the password, then every request is unauthenticated | `Secure` cookie over plain HTTP | Covered by the defaults; if you set `PUBLIC_ORIGIN` to an `https://` URL, serve it over HTTPS |
| `relation "users" does not exist` | Bootstrap was skipped or failed | `docker compose logs app`, then `docker compose down -v` and start again |
| Accounts missing after an upgrade | Seeding only runs on an empty `users` table | Provision manually with `create-scan-account.js`, or `down -v` for a clean start |
| `exec /app/docker/entrypoint.sh failed: No such file or directory` | Windows CRLF line endings on the shell script | Fixed by `.gitattributes` and a `sed` in the Dockerfile; re-clone if you have an old copy |
| `npm ci` fails in the build with `EUSAGE` | `package.json` and `package-lock.json` out of sync | `npm install --package-lock-only`, commit the lockfile, rebuild |
| Every TOTP code is rejected | The authenticator's clock has drifted | Enable automatic time sync, or use `node tools/totp-code.mjs <SECRET>` |
| Scan buttons report a connection error | `TOOL_BASE_URL` points somewhere the app cannot reach | Leave it at the default `http://127.0.0.1:3000` for a Docker stack |
| AI agent finishes with no findings | Free LLM key rate-limited or revoked | Set `AI_LLM_KEY` to your own key from <https://build.nvidia.com> |

```

---

## Penetration testing

The project ships two independent engines plus a study that scores both against
verified ground truth. All three run from the website **and** from a terminal.

### From the phone

| Where | Button | Runs |
| --- | --- | --- |
| Attack Lab | **▶ Run Exploit** | `POST /api/lab/exploit/sqli` |
| Attack Lab | **▶ Run Manual Pentest** | `tools/pentest-suite.mjs` |
| Attack Lab | **⤓ Download report** | `GET /api/pentest/report?download=1` |
| AI Pentest | **Bank / School / Both** | scope passed to `tools/ai-agent.mjs` as `AI_TARGET` |
| AI Pentest | **▶ Run** | `tools/ai-agent.mjs` at 3, 5 or 8 decisions |
| AI Pentest | **⤓ Download report** | `GET /api/ai-agent/report?download=1` |

All three engines stream live output into their terminal and produce a report
you can download from the same screen. All three require a signed-in,
MFA-verified session.

The exploit runs in under a second. The manual run takes about a minute. The AI
run takes seconds per decision on the free hosted model (see
`AI_MODEL`), and the terminal reports how many requests it chose to send.

Because the browser session is already MFA-verified, the server hands that
cookie to the agent (`AI_SESSION_COOKIE`) instead of logging in a second time;
a second TOTP login would replay the same 30-second code and spend auth
rate-limit budget. When the run covers the other application, the agent logs in
for that app normally.

### The real exploit

**▶ Run Exploit** performs an actual SQL injection against the running
database. The server does not simulate it and does not replay a recording: it
runs two queries over the same data and shows you what each one returned.

- one query binds the payload as a parameter
- one query concatenates the payload into the statement

With the default payload `' OR '1'='1` the parameterised query returns 0 rows
and the concatenated query returns 2, including the `secret` column. Sending
ordinary text such as `Training student A` returns 1 row from both queries and
reports `exploited: false`, so the panel does not fire on legitimate input.

The run is contained. The target rows are pinned by a `MATERIALIZED` CTE, the
transaction is opened `READ ONLY`, input is capped at 64 characters, and the
route requires an MFA-verified session, a consent row and
`LAB_VULNERABLE_MODE=true`. Each run is written to `lab_incidents`, so the
Attack history in the panel lists real events rather than sample data.

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
4. **Attack Lab** → **▶ Run Exploit**. Instant. Parameterised 0 rows, injected
   2 rows, and the leaked rows printed with their secrets — a live injection
   against the running database.
5. **Attack Lab** → **▶ Run Manual Pentest**. About a minute, 12 checks,
   3 confirmed vulnerabilities, then the report link.
6. **AI Pentest** → choose **Bank**, 5 decisions → **▶ Run**. The model's own
   requests stream past as it chooses identifiers to test, and it writes its own
   report. **⤓ Download report** saves `AI-PENTEST-REPORT.md`. Switch the scope to
   **School** or **Both** to show the same terminal covering the second app.
7. In a terminal, `npm run compare` scores both against ground truth and
   writes `tools/out/COMPARISON-REPORT.md`.

Step 3 and step 5 are the same weakness reached two ways: one by hand, one by
script. Step 4 shows a different class of bug, the one with the largest blast
radius, demonstrated directly. Step 6 is the contrast — the agent finds the
broken access control on its own, but misses the two that need a measurement
over time.

---

## Lab accounts

| App | Username | Password | Role | TOTP secret |
| --- | --- | --- | --- | --- |
| Bank | `scan-bank` | `ScanLab!2026pass` | `bank_user` | `OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI` |
| Acadia | `scan-student` | `ScanLab!2026pass` | `student` | `NAWFGQ2TKBTW2PSUJVDSCKLTH5KG4ZLC` |
| Acadia | `professor` | `Acadia-Admin-2026!` | `admin` | `IYZUKTCLOFJCKQKVLVLHEQC3PFDWKMDQ` |

All three have TOTP enabled, and all three are created automatically on first
start (see [Setup on a new machine](#setup-on-a-new-machine)).

These are deliberately weak accounts in a training lab. They are not secrets, and
the simulator is not a real bank or university service.

---

## Configuration

The stack runs with working defaults. Set these in `.env.stack` (and pass it
with `--env-file`) only when you want to override them. The full table, with
defaults, is in [Setup on a new machine](#5-changing-the-port-or-the-address).

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Session signing key (32+ chars) |
| `TOTP_ENCRYPTION_KEY` | 64 hex chars; encrypts stored TOTP secrets. Changing it breaks every existing MFA enrolment. |
| `PUBLIC_ORIGIN` | Exact public URL; the app compares `Origin` against this |
| `TOOL_BASE_URL` | Where the in-container scanners attack; loopback in Docker |
| `SITE_ADDRESS` | Address Caddy serves |

Tool overrides, when running a scanner from a terminal:

| Variable | Default | Applies to |
| --- | --- | --- |
| `PENTEST_BASE` | `http://localhost` | manual suite target |
| `AI_BASE` | `http://localhost` | AI agent target |
| `AI_MODEL` | `nvidia/nemotron-3.5-lightning-30b-a3b` | AI agent model |
| `AI_MODEL_FALLBACK` | `nvidia/nemotron-3.5-bolt-e4b` | used if the primary model errors or times out |
| `AI_TARGET` | `both` | agent scope: `bank`, `school`, or `both` (the terminal sets this) |
| `AI_MAX_STEPS` | `16` | AI agent decision budget (the terminal offers 3, 5 or 8) |
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
  ai-agent-panel.js       AI Pentest terminal: scope, steps, run, report
  attack-lab-pentest.js   Attack Lab manual pentest terminal + report
  attack-lab-exploit.js   Attack Lab real SQL injection
  pentest-terminal.css    Terminal styling shared by both screens
tools/
  pentest-suite.mjs       Deterministic pentest
  ai-agent.mjs            LLM-driven agent
  compare-engines.mjs     Manual vs AI scoring
  README-PENTEST.md       Detailed how-to-run guide
  out/                    Generated reports
docker-compose.yml        caddy + app + db
docker/bootstrap.mjs      schema application + account seeding on first start
docker/entrypoint.sh      waits for the database, then starts the server
Caddyfile                 Reverse proxy config
DEPLOY-SELFHOST.md        Deployment on a single host
PROJECT_GUIDE.md          Design notes
```

---

## Documentation

| Document | Contents |
| --- | --- |
| `TERMINAL-COMMANDS.md` | Every command for both engines, what each one does, all 12 checks, all variables, and troubleshooting by exact message |
| `tools/README-PENTEST.md` | How to run each engine, expected output, troubleshooting |
| `DEPLOY-SELFHOST.md` | Single-host deployment, secrets, Caddy, tunnel |
| `PROJECT_GUIDE.md` | Architecture and design decisions |
| `tools/out/COMPARISON-REPORT.md` | Manual vs AI scoring against ground truth |

---

## Limitations

- Probes are read-only. The one state-changing write is the `lab_incidents`
  row each run records for the history panel.
- The SQL injection reads only. Its transaction is `READ ONLY`, its target
  rows are pinned by a `MATERIALIZED` CTE, and it cannot reach another table.
- No fuzzing beyond the targeted injection probes in the suite.
- The AI agent runs on a free hosted model. The default is a small, fast
  tool-calling model (well under a second per decision); if that endpoint fails,
  the agent falls back to a second free model and names the one it used in the
  report. It does not always self-report findings, so the harness also confirms
  findings deterministically from the responses the model actually received.
- The comparison's AI column is single-run, not averaged.

---

Educational simulation only. The accounts, balances and grades are invented.
The attacks against them are real: the SQL injection executes on the local
PostgreSQL instance and the confirmed weaknesses were found by running the
suites, not authored as sample output. No external system is targeted.

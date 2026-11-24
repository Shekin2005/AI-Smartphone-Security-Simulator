::: title
Project Structure and Setup Guide
AI Smartphone Security Simulator
How the code is arranged, and how to stand it up on another computer from nothing
Node 22 · Express 5 · PostgreSQL 18.3 · Caddy 2 · Docker Compose · Tailscale Funnel
Author: Shekin David Raj   ·   Acadia University   ·   COMP 3123
::: endtitle

::: pagebreak

# 1. What is in the folder right now

Before rearranging anything it helps to see what is actually on disk, because the working folder and the repository are not the same thing. Measured on the development machine:

::: table Table 1. Contents of the working folder, with measured sizes. Only two of these items are the project.
| Item | Size | What it is | Keep? |
| `ai-smartphone-security/` | 1.0 GB on disk, 11 MB tracked | The git repository and the actual application | Yes, this is the project |
| `backups/` (inside the repo) | 891 MB | Local database dumps, gitignored | Archive elsewhere |
| `node_modules/` (inside the repo) | 41 MB | Installed dependencies, gitignored | Never copy, reinstall |
| `slides/` (inside the repo) | 39 MB | Deck builder plus its own node_modules | Keep the scripts only |
| `DockerDesktopWSL/` | 18 GB | Docker Desktop's virtual disk | No, Docker manages it |
| `Docker Desktop Installer.exe` | 596 MB | Installer already used | No |
| `.shannon/` | 24 KB | Generated launcher scripts, one per Shannon run | No |
| `.shannon-target/` | 3.8 MB | A duplicate copy of the source tree used for scanning | No, and it contains a secret |
| `PENTEST terminal report/` | 165 KB | Copies of earlier scan outputs | Archive |
| `HackerAI-windows-x64.exe` | 3.0 MB | Unrelated tool installer | No |

The important conclusion is that **the repository is 11 MB across 149 tracked files**, while the folder around it holds roughly 20 GB of installers, virtual disks and scan output. Copying the folder to another machine would move four orders of magnitude more data than the project needs, and would carry a hardcoded API key with it.

# 2. Recommended structure

The single change that makes this project portable is to stop treating the parent folder as the project. Put the repository somewhere clean, and let the machine keep its own installers and Docker disks wherever it likes.

::: table Table 2. Two-level layout. Everything above the repository line is machine state that must never be copied between computers.
| Location | Purpose | Copied between machines? |
| Anywhere outside the repo | Docker Desktop, WSL disk, installers | No, each machine installs its own |
| A clean parent directory | Holds the cloned repository | Only the repository moves |
| `ai-smartphone-security/` | The project itself | Yes, via git clone or a zip |

A clean parent directory looks like this:

```text
Dev/
└── ai-smartphone-security/       <- git clone of the repository
    ├── server.js
    ├── schema.sql
    ├── docker-compose.yml
    └── ...
```

Everything the application needs is inside that one directory. There is no build step that reaches outside it, and no absolute path is hardcoded in the source.

# 3. Repository file map

The repository has 149 tracked files. Table 3 groups the ones that matter, so you know what to read and what to leave alone.

::: table Table 3. What each part of the repository does.
| Path | Role |
| `server.js` | The whole Express application: auth, sessions, MFA, banking and school APIs, attack lab, report routes. About 2,880 lines |
| `school-routes.js` | Acadia student routes mounted by the server, about 26 handlers |
| `school-services-routes.js` | Acadia service requests, about 16 handlers |
| `public/` | Front end: index.html, the phone UI, per-feature scripts and stylesheets |
| `schema.sql` | Table definitions plus the four lab injection rows. Must be applied by hand |
| `docker-compose.yml` | Two services: app and caddy, on a private network |
| `Dockerfile` | Two-stage build: compile argon2, then a slim runtime with nmap, nikto and whatweb |
| `Caddyfile` | Reverse proxy, streaming for the live log, forwarded scheme headers |
| `.env.stack.example` | Template for the Docker deployment |
| `.env.example` | Template for running directly on Node without Docker |
| `create-scan-account.js` | Provisions a scan account with a known TOTP secret |
| `create-admin.js` | Interactive provisioning of an Acadia administrator |
| `tools/pentest-suite.mjs` | The twelve deterministic checks |
| `tools/ai-agent.mjs` | The single LLM agent, three tools |
| `tools/compare-engines.mjs` | Builds the head-to-head comparison report |
| `tools/shannon-bridge.mjs` | HTTP bridge that drives Shannon on the host |
| `tools/start-shannon.mjs` | Launcher that loads env then starts the bridge |
| `tools/totp-code.mjs` | Prints a valid TOTP code for an account |
| `configs/shannon-lab.yaml` | Credentials and login flow for the Shannon scanner |
| `docs/` | Reports, screenshots and the document builders |
| `slides/` | Deck builders and their verification scripts |

Two things are worth knowing about this layout. First, `schema.sql` is **not** copied into the Docker image and `server.js` never reads it, so a fresh database stays empty until you apply it yourself. Second, the pentest tools in `tools/` are copied into the image, which is why the AI agent can run from inside the container with no extra service and no Docker socket.

# 4. Clean-up before you move

Do this once, on the current machine, before copying anything.

**Archive the backups.** `backups/` is 891 MB of database dumps. It is gitignored, so git will never carry it, but a zip of the folder will. Move it to external storage.

```bash
mv backups ~/archive/simulator-backups
```

**Delete the duplicate source tree.** `.shannon-target/` is a staging copy that Shannon scans. It is byte-identical to the real source, it is regenerated when needed, and it currently contains a live API key in `tools/ai-agent.mjs`. Delete it and let the launcher recreate it.

```bash
rm -rf .shannon-target .shannon
```

**Leave the Docker disk alone.** `DockerDesktopWSL/` and the installer belong to Docker Desktop. Uninstalling is the only correct way to reclaim that space; deleting the folder by hand breaks Docker.

**Do not copy `node_modules/`.** It contains a compiled native `argon2` binary for one specific platform. Copying it to a machine with a different OS or CPU architecture produces a module that will not load. Reinstall instead, which is one command.

# 5. Three ways to run it

The application can be stood up three ways. They differ in what the other computer needs, not in what the application does.

::: table Table 4. The three deployment paths. Pick by what the other machine is for.
| Path | Use when | Needs | Public URL |
| A. Docker Compose | Normal use, a demo, a server | Docker Desktop or Docker Engine | Caddy on port 80, plus a tunnel or DNS |
| B. Bare Node | Editing code, quick experiments | Node 20+, PostgreSQL, no Docker | http://127.0.0.1:3000 |
| C. Cloud host | Always-on submission demo | A small VPS with Docker | Real domain and certificate |

Path A is the one to use for anything you intend to show someone. Path B is faster to start and easier to debug, but it does not give you the reverse proxy, so the origin guard and the secure-cookie behaviour differ from production.

# 6. Path A: Docker Compose

This is the full stack: Caddy in front, the application behind it, PostgreSQL somewhere it can reach.

## 6.1 Prerequisites

::: table Table 5. What must be installed before starting.
| Requirement | Version used | Check |
| Docker Desktop or Docker Engine | Current | `docker --version` |
| Docker Compose v2 | Bundled with Docker | `docker compose version` |
| Git | Any recent | `git --version` |
| PostgreSQL | 18.3 tested | `psql --version` |
| A terminal | PowerShell or Git Bash on Windows | — |

PostgreSQL is not in the Compose file. The application expects a database it can reach over the network, and the development machine ran it natively on the host, which the container reaches as `host.docker.internal`. You can equally point `DATABASE_URL` at a managed instance such as Neon, in which case nothing needs installing locally.

## 6.2 Get the code

```bash
git clone https://github.com/Shekin2005/AI-Smartphone-Security-Simulator.git
cd AI-Smartphone-Security-Simulator
```

The clone is about 11 MB. If the repository is private, authenticate with a personal access token or an SSH key first, or transfer a zip of the folder with `node_modules`, `backups` and `.git` excluded.

## 6.3 Create the database and apply the schema

The application does not migrate its own schema. On a new machine the database is empty and every query fails until `schema.sql` has been applied, so this step is not optional.

```bash
# create the database and a dedicated user
psql -U postgres -c "CREATE USER smartphone WITH PASSWORD 'choose-a-strong-password';"
psql -U postgres -c "CREATE DATABASE smartphone_security OWNER smartphone;"

# apply the schema as that user
psql "postgresql://smartphone:choose-a-strong-password@localhost:5432/smartphone_security" -f schema.sql
```

`schema.sql` is safe to re-run: every table uses `CREATE TABLE IF NOT EXISTS`, and the four lab injection rows use fixed ids with `ON CONFLICT DO NOTHING`.

It creates the tables and seeds `lab_sqli_demo` with four rows (ids 101 to 104, two for the bank target and two for the school target). It does **not** create any user accounts. That is step 6.6.

## 6.4 Generate the secrets

Two secrets must be generated fresh for a new machine. A third must be preserved if you are reusing an existing database.

```bash
openssl rand -base64 48     # SESSION_SECRET
openssl rand -hex 32        # TOTP_ENCRYPTION_KEY
```

`TOTP_ENCRYPTION_KEY` must be exactly 64 hexadecimal characters, because the application reads it as 32 raw bytes for AES-256-GCM. If it is the wrong length, account provisioning refuses to run and existing MFA secrets cannot be decrypted.

::: table Table 6. How to treat each secret when moving to a new machine.
| Secret | New empty database | Existing database |
| `SESSION_SECRET` | Generate a new one | May generate a new one, users just re-login |
| `TOTP_ENCRYPTION_KEY` | Generate a new one | Must copy the original exactly, or every account fails MFA |

## 6.5 Write the stack environment file

```bash
cp .env.stack.example .env.stack
```

Edit `.env.stack` and set these values:

::: table Table 7. Values required in .env.stack. The application refuses to start without the first four.
| Variable | Example | Notes |
| `DATABASE_URL` | `postgresql://smartphone:pw@host.docker.internal:5432/smartphone_security` | Use `host.docker.internal`, not `localhost`, from inside a container |
| `SESSION_SECRET` | output of `openssl rand -base64 48` | At least 32 characters |
| `TOTP_ENCRYPTION_KEY` | output of `openssl rand -hex 32` | Exactly 64 hex characters |
| `PUBLIC_ORIGIN` | `http://localhost` | Must match the browser URL exactly, or every POST returns 403 |
| `SITE_ADDRESS` | `localhost` | The hostname Caddy serves |
| `LAB_VULNERABLE_MODE` | `true` | Enables the deliberately vulnerable lab endpoints |

`PUBLIC_ORIGIN` is the single most common cause of a setup that loads but cannot log in. The application's same-origin guard compares the request's `Origin` header against this value, so `http://localhost` and `http://localhost:80` and `http://127.0.0.1` are three different origins. Set it to the URL you will actually type.

## 6.6 Start the stack

```bash
docker compose --env-file .env.stack up -d --build
```

The first build takes a few minutes because it compiles the native `argon2` module. Later starts are seconds.

```bash
docker compose --env-file .env.stack ps
```

You want `sim-app` reporting `Up (healthy)` and `sim-caddy` reporting `Up`.

## 6.7 Verify

```bash
curl -fsS http://localhost/api/health
```

Expect HTTP 200 and `{"status":"running"}`. The route runs `SELECT 1` against PostgreSQL before answering, so a 200 confirms the container, the network and the database connection in one call. A 503 with `{"status":"database unavailable"}` means the container is fine and the connection string is not.

Then open `http://localhost` in a browser. You should see the phone lock screen.

## 6.8 Create the accounts

No users exist yet. Provision the two scan accounts with known TOTP secrets, which is what makes the pentest tools able to log in unattended.

```bash
DATABASE_URL="postgresql://smartphone:pw@localhost:5432/smartphone_security" \
TOTP_ENCRYPTION_KEY="<the same 64 hex characters from .env.stack>" \
node create-scan-account.js --app bank --username scan-bank --password "ScanLab!2026pass"

DATABASE_URL="postgresql://smartphone:pw@localhost:5432/smartphone_security" \
TOTP_ENCRYPTION_KEY="<the same 64 hex characters from .env.stack>" \
node create-scan-account.js --app acadia --username scan-student --password "ScanLab!2026pass"
```

This runs on the host with Node and connects to the database directly on `localhost`, not through Docker. The image deliberately contains only the files the server needs, so `create-scan-account.js` is **not** inside the container and cannot be run with `docker compose run`. Run `npm install` once on the host first, because the script needs `argon2`, `pg` and `speakeasy`.

The script prints the TOTP secret it generated. Write it down: without it you cannot compute login codes, and the API tests cannot authenticate. Re-running the script resets the password, issues a new secret and clears the replay counter, so it is safe to repeat.

If you need an Acadia administrator, the same script provisions one with a known TOTP secret. The `--role admin` flag is what distinguishes an administrator from a student, and it is accepted only for the `acadia` application:

```bash
DATABASE_URL="postgresql://smartphone:pw@localhost:5432/smartphone_security" \
TOTP_ENCRYPTION_KEY="<the same 64 hex characters from .env.stack>" \
node create-scan-account.js --app acadia --role admin \
  --username professor --password "Acadia-Admin-2026!"
```

Administrators sign in through the **Administrator Login** card in the Acadia app, not the student form, and the login API requires the role to match the stored value: an administrator's credentials are rejected by the student form by design. `create-admin.js` is the older interactive alternative; it prompts for a username and password and inserts an `admin` row, but it does not enrol MFA, so the account stops at the enrolment step on first login.

## 6.9 Sign in

Open the site, unlock the phone with the passcode, choose an app, and sign in with the username, password and a current TOTP code. To generate a code on the command line:

```bash
node tools/totp-code.mjs <BASE32-SECRET>
```

The secret is a positional argument, not a flag. The script prints the current code and how many seconds it remains valid.

# 7. Path B: bare Node, no Docker

Useful for editing code, because it removes the rebuild step entirely.

```bash
npm install
cp .env.example .env
```

Edit `.env` so that `DATABASE_URL` points at `localhost` and `PORT` is 3000. Then apply `schema.sql` exactly as in section 6.3, and start:

```bash
npm start
```

`npm install` compiles `argon2`, so the machine needs Python, make and a C++ compiler. On Windows that means the Visual Studio Build Tools; on Debian or Ubuntu, `apt install build-essential python3`. If the install fails on `argon2`, that is almost always the missing compiler rather than a Node problem.

The application then listens on `http://127.0.0.1:3000`. There is no Caddy in this path, so `PUBLIC_ORIGIN` must be `http://127.0.0.1:3000` and cookies will not be marked `Secure`, because the connection is plain HTTP.

# 8. Making it reachable

## 8.1 Same machine only

Nothing to do. `http://localhost` through Caddy, or `http://127.0.0.1:3000` in Path B.

## 8.2 Local network

Caddy already publishes port 80 on the host, so other devices on the same network can reach the machine's LAN address.

```bash
ipconfig            # Windows, look for the IPv4 address
ip addr             # Linux or macOS
```

Then set `SITE_ADDRESS` to that address or to `:80`, and set `PUBLIC_ORIGIN` to the matching URL, for example `http://192.168.1.50`. Restart the stack after changing either value.

## 8.3 Public hostname with Tailscale

This is how the development machine is published. Tailscale terminates TLS and forwards to Caddy on port 80, which is why the Compose file publishes only 80 and not 443.

```bash
tailscale up
tailscale funnel --bg 443 on
tailscale funnel status
```

Then set `PUBLIC_ORIGIN` to the funnel hostname, for example `https://machine.tailnet-name.ts.net`, and restart. The value must match exactly, including the scheme.

::: table Table 8. Why Docker does not publish 443 in this deployment.
| Symptom if 443 is published | Cause |
| `tailscaled` cannot bind 443 | Docker holds the port, so the funnel listener fails |
| Certificate works but login fails | Tailscale terminates TLS, Caddy sees plain HTTP, so the scheme header matters |

The Caddyfile sets `X-Forwarded-Proto https` on both proxy blocks for exactly this reason. Without it the application sees an insecure request and withholds the `Secure` session cookie, so login appears to succeed and every subsequent request is unauthenticated.

## 8.4 Real domain on a server

Point an `A` record at the host, set `SITE_ADDRESS` to the domain, open ports 80 and 443, and Caddy will obtain a certificate automatically.

# 9. Environment variable reference

Table 9 lists every variable the application and its tools read, with the component that uses it.

::: table Table 9. Environment variables by consumer. Change these only if you understand the consequence in the last column.
| Variable | Used by | Required | Effect if wrong |
| `DATABASE_URL` | server, provisioning scripts | Yes | App exits at start |
| `SESSION_SECRET` | server | Yes | Sessions cannot be signed |
| `TOTP_ENCRYPTION_KEY` | server, provisioning scripts | Yes | MFA fails for every account |
| `PUBLIC_ORIGIN` | server | In production | Every POST returns 403 |
| `PORT` | server | No, default 3000 | Caddy cannot reach the app |
| `HOST` | server | No, default 0.0.0.0 in Docker | App not reachable from Caddy |
| `LAB_VULNERABLE_MODE` | server | No, default true | Lab endpoints disabled |
| `SHANNON_BRIDGE_TOKEN` | server, bridge | For Shannon | Scanner button reports not configured |
| `SHANNON_BRIDGE_PORT` | server, bridge | No, default 7071 | Bridge unreachable |
| `AI_LLM_KEY` | ai-agent | Recommended | Falls back to a shared key |
| `AI_LLM_BASE` | ai-agent | No | Defaults to an NVIDIA endpoint |
| `AI_MODEL` | ai-agent | No | Defaults to a small Nemotron model |
| `AI_MAX_STEPS` | ai-agent | No, default 16 | Run ends early or overruns |
| `PENTEST_BASE` | suite | No | Defaults to the author's hostname |
| `PENTEST_BANK_USER` and related | suite | No | Defaults to the demo accounts |

There is one gap worth knowing about. `.env.stack.example` lists `AI_LLM_KEY`, but `docker-compose.yml` does not pass it into the container, so setting it there has no effect and the agent silently uses the key compiled into `tools/ai-agent.mjs`. To actually use your own key, add it to the `environment:` block of the `app` service:

```yaml
      AI_LLM_KEY: ${AI_LLM_KEY:-}
      AI_MODEL: ${AI_MODEL:-}
```

Then restart with `docker compose --env-file .env.stack up -d`.

# 10. The pentest engines on the new machine

## 10.1 The deterministic suite

This needs nothing but Node and the accounts from section 6.8. It reads the target from `PENTEST_BASE`.

```bash
PENTEST_BASE=http://localhost npm run pentest
```

A full run takes about a minute, most of it one deliberate 31-second wait that measures how long the MFA lockout lasts. Output lands in `tools/out/`.

## 10.2 The single agent

The agent needs an OpenAI-compatible endpoint and a key. It is configured through `AI_LLM_BASE`, `AI_MODEL` and `AI_LLM_KEY`.

```bash
AI_BASE=http://localhost \
AI_LLM_KEY=<your key> \
AI_LLM_BASE=https://integrate.api.nvidia.com/v1 \
AI_MODEL=nvidia/nemotron-3.5-lightning-30b-a3b \
node tools/ai-agent.mjs
```

It also needs `AI_BANK_USER`, `AI_BANK_PASS` and `AI_BANK_TOTP` if you did not use the default account names in section 6.8.

## 10.3 Shannon, if you want the multi-agent pipeline

Shannon is not part of this repository and does not run inside the application container, which deliberately has no Docker socket. It runs on the host, under WSL2 on Windows or natively on Linux, and the app talks to it through a small HTTP bridge.

```bash
# on the host, with WSL2 and Node 22 available
export SHANNON_AI_API_KEY=<key>
export SHANNON_BRIDGE_TOKEN=<shared secret, same value the app receives>
node tools/start-shannon.mjs
```

::: table Table 10. Shannon prerequisites and why each is required.
| Requirement | Reason |
| WSL2, or Linux | Shannon needs Docker, which the app container must not have |
| Docker inside WSL2 | Shannon starts its own container per run |
| Node 22 inside WSL2 | The bridge and launcher use modern syntax |
| `SHANNON_BRIDGE_TOKEN` on both sides | Otherwise the app gets 401 from the bridge |
| `configs/shannon-lab.yaml` | Supplies the login flow and the success condition |

The bridge listens on port 7071 on the host. From inside the app container that address is `host.docker.internal:7071`.

# 11. Secret hygiene: action required

`tools/ai-agent.mjs` contains a fallback API key in source, at the `LLM_KEY` constant, so that a fresh clone runs with no setup. That is a reasonable choice for a teaching lab and an unacceptable one for anything else. The key has appeared in this repository's history and in a duplicate copy of the tree, so it must be treated as public and rotated.

Four steps, in order:

1. Revoke the existing key at the provider console.
2. Remove the fallback so the agent fails loudly instead of silently using a shared credential:

```javascript
const LLM_KEY = process.env.AI_LLM_KEY;
if (!LLM_KEY) {
  console.error("[agent] AI_LLM_KEY is not set. Refusing to run.");
  process.exit(1);
}
```

3. Pass the key through the environment, per section 9.
4. Delete `.shannon-target/`, which contains a second copy of the same string.

If the repository is ever made public, assume every secret that has been committed is compromised, including `SESSION_SECRET` and `TOTP_ENCRYPTION_KEY` from any committed environment file.

# 12. Troubleshooting

These are the failures actually encountered while building this project, with the cause rather than a guess.

::: table Table 11. Symptoms, causes and fixes.
| Symptom | Cause | Fix |
| Page loads but every POST returns 403 | `PUBLIC_ORIGIN` does not match the browser URL exactly | Set it to the exact scheme, host and port you type |
| Login succeeds, then every request is unauthenticated | `Secure` cookie withheld because the app sees plain HTTP behind TLS | Ensure the proxy sends `X-Forwarded-Proto https` |
| App restarts in a loop, `SyntaxError` at a line near the end of server.js | The image contains a truncated copy of `server.js` | Rebuild, then check byte length and `node --check` inside the image |
| `ECONNREFUSED` to the database at start | `localhost` inside a container means the container | Use `host.docker.internal` or the managed database host |
| `argon2` fails to install on bare Node | No C++ compiler or Python | Install build tools, or use the Docker path |
| `TOTP_ENCRYPTION_KEY must be 64 hex characters` | Wrong key length or a base64 key | Generate with `openssl rand -hex 32` |
| Existing accounts all fail MFA after a move | A new `TOTP_ENCRYPTION_KEY` was generated against an old database | Restore the original key |
| `relation "users" does not exist` | `schema.sql` was never applied | Apply it, per section 6.3 |
| Suite stops before testing anything | The scan account does not exist or the password differs | Re-run `create-scan-account.js` |
| Agent run fails instantly | No key, or the endpoint is unreachable or rate limited | Set `AI_LLM_KEY`, check `AI_LLM_BASE` |
| Shannon button reports not configured | `SHANNON_BRIDGE_TOKEN` empty on one side | Set the same value in `.env.stack` and `.env.shannon` |
| Caddy serves a certificate error | DNS not pointing at the host, or port 80 blocked | Fix DNS, open the port |
| Port 3000 reachable from outside | Should not happen in the Compose stack | Check you are not running Path B on a public interface |

# 13. Verification checklist

Work down this list on the new machine. Each line is a command with an expected result, so a failure is localised rather than mysterious.

::: table Table 12. Post-setup verification, in dependency order.
| Check | Command | Expected |
| Containers running | `docker compose --env-file .env.stack ps` | app healthy, caddy up |
| Application alive | `curl -fsS http://localhost/api/health` | HTTP 200, running status |
| Schema applied | `psql "$DATABASE_URL" -c "\dt"` | users, student_profiles and the rest present |
| Lab rows seeded | `psql "$DATABASE_URL" -c "select count(*) from lab_sqli_demo;"` | 4 |
| Accounts exist | `psql "$DATABASE_URL" -c "select username, app from users;"` | scan-bank and scan-student |
| Browser | open the site | phone lock screen |
| Login | passcode, password, TOTP | dashboard for that app |
| Suite | `npm run pentest` | 12 checks, report written |
| Agent | run with a key set | trace written, report written |

# 14. Moving to the other computer

Table 13 is the short version of the whole document, in the order to do it.

::: table Table 13. The complete sequence for a new machine.
| Step | Action |
| 1 | Install Docker, Git and PostgreSQL on the new machine |
| 2 | `git clone` the repository into a clean parent directory |
| 3 | Create the database, then apply `schema.sql` with psql |
| 4 | Copy `.env.stack.example` to `.env.stack` and fill in the four required values |
| 5 | `docker compose --env-file .env.stack up -d --build` |
| 6 | `curl http://localhost/api/health` until it returns 200 |
| 7 | Run `create-scan-account.js` twice, for bank and acadia, and record both TOTP secrets |
| 8 | Open the site and sign in with a TOTP code from `tools/totp-code.mjs` |
| 9 | Run `npm run pentest` to confirm the suite reproduces its twelve checks |
| 10 | Set your own `AI_LLM_KEY`, then run the agent |
| 11 | Only if you need the pipeline: start Shannon under WSL2 with a matching bridge token |
| 12 | Repoint `PUBLIC_ORIGIN` and `SITE_ADDRESS` once the final URL is known |

Two warnings carry over from the sections above and bear repeating here. The database schema is never applied automatically, so step 3 is mandatory even though the app starts without it and then fails on first use. And `TOTP_ENCRYPTION_KEY` must be the original value if you are pointing at an existing database, because generating a new one silently breaks every account's MFA.

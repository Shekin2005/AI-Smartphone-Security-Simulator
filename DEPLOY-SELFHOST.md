# Run everything on one host (no Render)

> **Status:** the Strix scanner service has been removed. The stack is now two
> containers - `caddy` and `app` - and the AI pentest agent runs inside `app`
> (see `tools/README-PENTEST.md`). Everything here about building the image,
> secrets, Caddy and the tunnel still applies. Ignore the `scanner` container,
> the Docker socket mount, the `STRIX_*` variables and the `strix-scanner`
> health checks: those no longer exist.

This document replaces Render entirely: one machine runs the website, the
pentest tooling and HTTPS. The stack is two containers and needs no Docker
socket, so it fits on any small host - including a free tier.

---

## Why one host is better here

| | Split (Render + PC) | One host |
| --- | --- | --- |
| Website always up | yes | yes |
| Scanning always up | only when PC on | yes |
| Tunnel needed | yes, changes every restart | **no** |
| Re-paste URLs on restart | yes | **no** |
| Extra service exposed | yes | **no**, only the site is published |
| Moving parts | 2 hosts + tunnel | 1 host, 2 containers |

Only Caddy publishes a port. The app is reachable only through it, on a private
Docker network, so there is no second URL to secure.

---

## What runs

```
                 internet
                    │  443 (Caddy, automatic TLS)
              ┌─────▼──────┐
              │   caddy    │  publishes 80; terminates TLS at the edge
              └─────┬──────┘
                    │ web network
              ┌─────▼──────┐
              │    app     │  Node/Express + AI pentest agent (tools/)
              └────────────┘
```

Files: `Dockerfile`, `docker-compose.yml`, `Caddyfile`, `.env.stack.example`.

---

## Which host

Any machine with a public IP and Docker works. Pick by budget.

| Host | Cost | Card | Always on | Notes |
| --- | --- | --- | --- | --- |
| **Oracle Cloud Always Free** | $0 | yes (ID check, no charge) | yes | 2 OCPU / 12 GB ARM. Best free option. |
| **Any small VPS** (Hetzner, DigitalOcean, Vultr, Contabo) | ~$4–6/mo | yes | yes | Simplest, no capacity lottery. |
| **GitHub Codespaces** | 120 core-hrs/mo | **no** | no, sleeps | Free and card-free. Good for demos. |
| **Your own PC** | $0 | no | only when on | Use the tunnel guide instead. |

2 GB is comfortable and 1 GB is the practical minimum. There is no scanner
sandbox any more, so the image size is all that matters.

---

## Deploy

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

### 2. Get the code

```bash
git clone https://github.com/Shekin2005/AI-Smartphone-Security-Simulator.git
cd AI-Smartphone-Security-Simulator
```

### 3. Configure

```bash
cp .env.stack.example .env.stack
chmod 600 .env.stack
nano .env.stack
```

Fill in:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | your Neon string (unchanged), or `host.docker.internal` for a local DB |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `TOTP_ENCRYPTION_KEY` | the SAME value that encrypted your existing secrets |
| `PUBLIC_ORIGIN` | `https://lab.yourdomain.com` |
| `SITE_ADDRESS` | `lab.yourdomain.com` |

If you change `TOTP_ENCRYPTION_KEY`, every existing account breaks its MFA.

### 4. DNS

Point an `A` record for `SITE_ADDRESS` at the server's public IP. Caddy will
not issue a certificate until this resolves.

### 5. Start

```bash
docker compose --env-file .env.stack up -d --build
```

First build is a few minutes (it compiles the `argon2` native module).

### 6. Verify

```bash
docker compose --env-file .env.stack ps
curl -fsS https://lab.yourdomain.com/api/health
```

Expect two healthy containers and `{"status":"running"}`.

### 7. Provision scan accounts (live database)

```bash
DATABASE_URL="<same as .env.stack>" \
TOTP_ENCRYPTION_KEY="<same as .env.stack>" \
node create-scan-account.js --app bank --username scan-bank --password "ScanLab!2026pass"
```

Needs Node on the host, or run it inside the app container:

```bash
docker compose --env-file .env.stack run --rm --no-deps app \
  node create-scan-account.js --app bank --username scan-bank --password "ScanLab!2026pass"
```

### 8. First AI run

Open `https://lab.yourdomain.com`, sign in as a lab user, scroll to **AI Defender**
and press **Run AI Agent**. The panel streams the agent's output live and links to
the generated report. No key or extra setup is needed: the image ships with a free
tier LLM key.

---

## Removing Render

1. Render dashboard → your service → **Settings → Delete Web Service**.
2. Keep the Neon database; it is independent of Render.
3. Your new host's `.env.stack` already carries the same `DATABASE_URL`.

Nothing in the app depends on Render. The only Render-specific code is the
`PUBLIC_ORIGIN` handling, which now points at your own domain.

---

## Verification performed locally

This exact stack was built and run on Windows Docker:

| Check | Result |
| --- | --- |
| App image build | `ai-smartphone-app:1.0.0`, builds clean |
| Container start | `sim-app` healthy, connects to PostgreSQL, listens on 0.0.0.0:3000 |
| `GET /api/health` via Caddy | `200 {"status":"running"}` |
| `GET /` via Caddy HTTPS | `200` |
| `GET /api/ai-agent/report` no session | `401` |
| `GET /api/ai-agent/report` signed in | `200 text/markdown` |
| Containers | `sim-caddy`, `sim-app (healthy)` |

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Caddy serves a certificate error | DNS not pointing at the host yet, or 80/443 blocked |
| `403 Invalid request origin` | `PUBLIC_ORIGIN` does not exactly match the browser URL |
| App exits at start | `DATABASE_URL` wrong; inside containers `localhost` is the container |
| Agent run fails instantly | free LLM endpoint unreachable or rate limited |
| Port 3000 reachable from outside | expected to fail; the app publishes no ports |

---

## Operations

```bash
docker compose --env-file .env.stack ps
docker compose --env-file .env.stack logs -f app
docker compose --env-file .env.stack up -d --build     # after git pull
docker compose --env-file .env.stack down               # keeps volumes
```

AI reports are written to `tools/out/` inside the app container and served at
`/api/ai-agent/report`; certificates live in the `caddy-data` volume.

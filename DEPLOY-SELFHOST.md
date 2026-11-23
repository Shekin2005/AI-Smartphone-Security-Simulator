# Run everything on one host (no Render)

Render cannot run Strix. It is a container platform: you give it a container and
it runs it, but it never hands your container a Docker daemon. Strix launches one
sandbox container per scan, and in 1.7.0 Docker is its **only** backend:

```
strix/runtime/backends.py → _BACKENDS = {"docker": _docker_backend}
```

So Render was only ever hosting the website. This document replaces Render
entirely: one machine runs the website, the scanner, and HTTPS.

---

## Why one host is better here

| | Split (Render + PC) | One host |
| --- | --- | --- |
| Website always up | yes | yes |
| Scanning always up | only when PC on | yes |
| Tunnel needed | yes, changes every restart | **no** |
| Re-paste URLs on restart | yes | **no** |
| Scanner exposed to internet | yes | **no**, private network only |
| Moving parts | 3 hosts + tunnel | 1 host, 3 containers |

The app reaches Strix at `http://scanner:8000` over a private Docker network.
That removes the tunnel, the temporary URL, and the token-in-browser surface.

---

## What runs

```
                 internet
                    │  443 (Caddy, automatic TLS)
              ┌─────▼──────┐
              │   caddy    │
              └─────┬──────┘
                    │ web network
              ┌─────▼──────┐
              │    app     │  Node/Express + /strix-api proxy
              └─────┬──────┘
                    │ internal network (not internet-routable)
              ┌─────▼──────┐
              │  scanner   │  Strix; mounts the host Docker socket
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

12 GB is comfortable; 4 GB is the practical minimum (the scanner plus one
sandbox). The sandbox image is multi-arch, so ARM is fine and fast.

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
| `STRIX_SCAN_TOKEN` | `openssl rand -hex 24` |

If you change `TOTP_ENCRYPTION_KEY`, every existing account breaks its MFA.

### 4. DNS

Point an `A` record for `SITE_ADDRESS` at the server's public IP. Caddy will
not issue a certificate until this resolves.

### 5. Start

```bash
docker compose --env-file .env.stack up -d --build
```

First build is a few minutes (it compiles `argon2` and installs Strix).

### 6. Verify

```bash
docker compose --env-file .env.stack ps
curl -fsS https://lab.yourdomain.com/api/health
```

Expect three healthy containers and `{"status":"running"}`.

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

### 8. First scan

Open `https://lab.yourdomain.com`, unlock with `1234`, go to **AI Defender**,
enter your LLM key in section 01 and the account in section 02, then START SCAN.

The first run downloads Strix's sandbox image (~4 GB) once.

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
| `GET /defender-console.js` | `200` |
| `GET /strix-api/health` no session | `401` |
| app → `http://scanner:8000` | `200`, `strix 1.7.0`, `docker: true` |
| scanner from internet | not routable; loopback only |
| Containers | `sim-caddy`, `sim-app (healthy)`, `strix-scanner (healthy)` |

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Caddy serves a certificate error | DNS not pointing at the host yet, or 80/443 blocked |
| `403 Invalid request origin` | `PUBLIC_ORIGIN` does not exactly match the browser URL |
| `502 Scan service unreachable` | scanner container down: `docker logs strix-scanner` |
| `401 Invalid or missing scan token` | `.env.stack` token changed but the app was not recreated (`up -d --force-recreate`) |
| App exits at start | `DATABASE_URL` wrong; inside containers `localhost` is the container |
| Scans fail instantly | no LLM key in section 01 |
| Port 3000 reachable from outside | expected to fail; the app publishes no ports |

---

## Operations

```bash
docker compose --env-file .env.stack ps
docker compose --env-file .env.stack logs -f app
docker compose --env-file .env.stack up -d --build     # after git pull
docker compose --env-file .env.stack down               # keeps volumes
```

Reports persist in the `strix-runs` volume; certificates in `caddy-data`.

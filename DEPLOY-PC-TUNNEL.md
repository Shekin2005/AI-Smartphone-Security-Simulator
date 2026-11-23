# Website on Render + scanner on your PC

This is the arrangement in use: Render always hosts the website, this PC runs
Strix, and a tunnel connects them.

It exists because Strix needs a real Docker daemon. In 1.7.0 Docker is its only
backend, and Render cannot hand a container a daemon, so the scanner cannot run
there — the site can.

```
 browser ──► Render (always on) ──► tunnel ──► your PC: scanner ──► sandbox container
```

The scanner attacks `https://ai-smartphone-security-simulator.onrender.com`
(the public site), not localhost, because the app compares the request's Origin
against `PUBLIC_ORIGIN` and rejects anything else with 403.

---

## Daily use

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\sheki\cloudflared\start-scanner.ps1
```

The script checks Docker, starts the scanner container, waits until it reports
healthy, opens the tunnel, and prints the two Render values.

Leave the window open. Keep the PC awake while scanning.

---

## The one weakness: a changing URL

A Cloudflare **quick tunnel** gives a random `*.trycloudflare.com` address that
changes on every restart. Each time, `STRIX_SCANNER_URL` in Render must be
updated or scanning returns `502 Scan service unreachable`.

Three ways to deal with it, best first.

### 1. Tailscale Funnel — stable URL, free, no card

Free Personal plan. The hostname is tied to your machine and never changes:

```
https://<machine>.<tailnet>.ts.net
```

Setup, once:

```powershell
winget install -e --id Tailscale.Tailscale
tailscale up                              # opens a browser to log in
```

Enable Funnel in the admin console: **Access controls → Funnel → Add Funnel to
policy**. Then:

```powershell
tailscale funnel --bg 8000
tailscale funnel status
```

Paste the `https://...ts.net` address into Render as `STRIX_SCANNER_URL` **once**.
It survives restarts, reboots and reconnects. `start-scanner.ps1` detects
Tailscale automatically and prefers it.

Funnel limits worth knowing: it only forwards public HTTPS on port 443 (fine,
since it maps to your local 8000), traffic routes through Tailscale's relays so
throughput is modest, and it uses the `*.ts.net` domain only — no custom domain.

### 2. Cloudflare named tunnel — stable, needs a domain on Cloudflare

Stable hostname like `scanner.yourdomain.com`, but requires owning a domain.
Use this only if you already have one.

### 3. Automate the Render update

Render has an API for environment variables. A small script can read the new
tunnel URL and `PUT` it to the service after each start, so you never touch the
dashboard. Needs a Render API key (Account Settings → API Keys) and the service
ID `srv-dc194uvf3r2c73c1ikdg`.

---

## Render settings (set once)

Render → your service → **Environment**:

| Variable | Value |
| --- | --- |
| `STRIX_SCANNER_URL` | your tunnel or `*.ts.net` URL |
| `STRIX_SCAN_TOKEN` | from `strix-scanner/.env` in this repo |

`STRIX_SCAN_TOKEN` must match exactly on both sides. Mismatch gives
`401 Invalid or missing scan token`.

---

## Scan accounts

They must exist in the database Render uses (Neon), encrypted with Render's
`TOTP_ENCRYPTION_KEY`:

```powershell
$env:DATABASE_URL = "<Neon connection string>"
$env:TOTP_ENCRYPTION_KEY = "<exact Render value>"
node create-scan-account.js --app bank   --username scan-bank    --password "ScanLab!2026pass"
node create-scan-account.js --app acadia --username scan-student --password "ScanLab!2026pass"
Remove-Item Env:DATABASE_URL; Remove-Item Env:TOTP_ENCRYPTION_KEY
```

Accounts created against the local Postgres are invisible to the live site.

---

## Verified

Observed against the live site through the public tunnel:

| Check | Result |
| --- | --- |
| Scanner container | healthy, `strix 1.7.0`, `docker: true`, `pdf: true` |
| `target_base` | `https://ai-smartphone-security-simulator.onrender.com` |
| Tunnel, no token | `401` |
| Tunnel, with token | `200` |
| `POST /api/scans` through the tunnel | `200 {"scan_id":"c7ab98a760f5","status":"running"}` |
| Render site | `200` |

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `502 Scan service unreachable` | tunnel down, or the URL changed |
| `401 Invalid or missing scan token` | token mismatch, or Render not redeployed |
| Scan fails at once | no LLM key entered in section 01 |
| `403 Invalid request origin` | `TARGET_BASE` is not the public site origin |
| Tunnel dies | PC slept, or the terminal window closed |
| Container `unhealthy` | dev server not started; run `docker logs strix-scanner` |
| `Funnel refused` | Funnel not enabled in the Tailscale ACL |

---

## Keeping it reliable

- Windows power settings: **never sleep** while plugged in, or the tunnel drops.
- Docker Desktop must be running before the script starts.
- Restarting the PC means re-running `start-scanner.ps1`.
- With Tailscale, Render needs no change after a restart. With Cloudflare quick
  tunnels, it does.

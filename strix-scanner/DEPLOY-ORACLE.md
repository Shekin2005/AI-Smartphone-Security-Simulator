# Deploying the scanner to Oracle Cloud Always Free (ARM)

Strix launches one sandbox container per scan, so it needs a real Docker
daemon. In Strix 1.7.0 the only runtime backend that exists is Docker:

```
strix/runtime/backends.py → _BACKENDS = {"docker": _docker_backend}
```

That is why Render (or any container PaaS) cannot run it: those platforms run
your container but never expose a daemon. A VM can.

Oracle's Always Free tier gives a real root VM that does not expire.

---

## 1. Create the instance

In the Oracle console: **Compute → Instances → Create Instance**.

| Setting | Value |
| --- | --- |
| Image | Ubuntu 22.04 (marked *Always Free Eligible*) |
| Shape | **VM.Standard.A1.Flex** (Ampere ARM) |
| OCPUs | 2 (up to 4 if your tenancy still allows it) |
| Memory | 12 GB (up to 24 GB if available) |
| Boot volume | 50–200 GB |
| SSH key | paste your public key (`ssh-keygen -t ed25519`) |

The current Always Free Arm allowance is **2 OCPU / 12 GB** — Oracle halved it
from 4 / 24 during 2026, so older guides quote the wrong numbers.

The sandbox image is multi-arch (`amd64` + `arm64`), so ARM runs natively; no
emulation penalty. 12 GB is enough for the scanner plus one sandbox.

If you get **"Out of host capacity"**, try another availability domain or a
less busy region. This is the most common stumbling block, not a configuration
error.

---

## 2. Run the setup script

```bash
ssh ubuntu@<vm-public-ip>

curl -fsSL https://raw.githubusercontent.com/Shekin2005/AI-Smartphone-Security-Simulator/main/strix-scanner/setup-oracle.sh -o setup-oracle.sh
bash setup-oracle.sh
```

It installs Docker, clones the repo, writes `strix-scanner/.env` with a shared
token, builds the scanner, and prints the token plus the exact Render variables.

Roughly 5–10 minutes, most of it the first image build.

---

## 3. Publish the scanner

Keep it private — `docker-compose.yml` binds it to `127.0.0.1:8000`, so it is
not reachable from the internet by default.

```bash
cloudflared tunnel --url http://localhost:8000
```

Copy the `https://....trycloudflare.com` hostname it prints.

Do **not** open port 8000 in the Oracle security list unless you also put TLS
and auth in front of it.

---

## 4. Point Render at it

Render → your service → **Environment**:

```
STRIX_SCANNER_URL  = https://<your-tunnel-hostname>
STRIX_SCAN_TOKEN   = <the token the script printed>
```

Both values must match the VM's `strix-scanner/.env`. If the token differs,
every scan fails with `401 Invalid or missing scan token`.

Render redeploys automatically after you save.

---

## 5. Provision scan accounts in the LIVE database

The accounts must exist in Neon, not the local Postgres, and the TOTP secret
must be encrypted with the **same** `TOTP_ENCRYPTION_KEY` Render uses:

```powershell
$env:DATABASE_URL = "<Neon connection string>"
$env:TOTP_ENCRYPTION_KEY = "<copy the exact value from Render>"
node create-scan-account.js --app bank   --username scan-bank    --password "ScanLab!2026pass"
node create-scan-account.js --app acadia --username scan-student --password "ScanLab!2026pass"
Remove-Item Env:DATABASE_URL; Remove-Item Env:TOTP_ENCRYPTION_KEY
```

If the key differs, the secret decrypts to garbage and login fails even with
the correct code.

---

## 6. First scan

On the live site: unlock (`1234`) → **AI Defender** → section 01 fill in your
LLM → section 02 enter the account → **START SCAN**.

The first run downloads `ghcr.io/usestrix/strix-sandbox:1.3.0` (~4 GB) into the
VM's Docker, so it is slow once and fast afterwards.

---

## 7. Operations

```bash
cd ~/AI-Smartphone-Security-Simulator/strix-scanner

sudo docker compose ps
sudo docker compose logs -f --tail 100
sudo docker compose up -d --build      # after a git pull
sudo docker compose down               # stop (named volumes persist)
```

Reports live in the `strix-runs` volume and survive rebuilds.

---

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `401 Invalid or missing scan token` | Render and VM tokens differ |
| `502 Scan service unreachable` | Tunnel is down, or `STRIX_SCANNER_URL` is wrong |
| Never gets past the model call | No LLM key entered in section 01 |
| `403 Invalid request origin` from the target | `TARGET_BASE` is not exactly the public site origin |
| Scan works but login fails | TOTP key mismatch, or accounts only exist locally |
| Container exits immediately | `sudo docker logs strix-scanner`; usually the daemon socket |

---

## Why not just run it on Render?

- No Docker daemon, and Docker is Strix's only backend.
- Free tier spins down after inactivity (50s cold start).
- The filesystem is ephemeral; a long scan would be interrupted and its report
  lost.

Render hosts the site. The VM does the scanning. That split is the design.

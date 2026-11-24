# Shannon (Keygraph) — feasibility and how to run it here

Shannon is an autonomous AI pentester: <https://github.com/KeygraphHQ/shannon>
(AGPL-3.0). This document records what was actually tested on this machine, so
the decision about whether to use it is based on measurements rather than on the
project's marketing.

## Verdict

| Question | Answer | Evidence |
| --- | --- | --- |
| Is Shannon real and open source? | Yes | `KeygraphHQ/shannon`, AGPL-3.0, 6.1k forks |
| Can it run on this machine? | **Yes, inside WSL2** | CLI refuses native Windows, runs under Ubuntu 22.04 |
| Can it run inside the `sim-app` container? | **No** | no `docker` binary and no `/var/run/docker.sock` in the container |
| Does it need a paid key? | **No** | validated and ran on the free NVIDIA NIM key, cost $0.0000 |
| Did a real scan progress? | **Yes** | Pre-Recon, Recon, Vulnerability Analysis completed; exploitation agents ran |
| How long is a full scan? | 1–1.5 hours (vendor figure) | the smoke run was still in exploitation at 165 s |
| Is it a drop-in for the AI Pentest terminal? | **No, but it is now an engine switch** | needs Docker + a host-side bridge; that bridge is shipped, see below |

## Why it cannot run inside the app container

Shannon's architecture requires Docker:

> Shannon pulls the worker image from Docker Hub, starts the required local
> infrastructure, mounts the target repository read-only inside an ephemeral
> worker container, and writes results to a local workspace.

Verified inside `sim-app`:

```
$ docker exec sim-app sh -c "command -v docker; ls /var/run/docker.sock"
docker NOT in container
ls: cannot access '/var/run/docker.sock': No such file or directory
```

Mounting the host Docker socket into a **publicly reachable** web application
would give anyone who can reach the tool route root-equivalent control of the
host. That is not a trade this project should make, so Shannon cannot be spawned
from the app process the way `tools/ai-agent.mjs` and `tools/pentest-suite.mjs`
are.

## Why it cannot run on native Windows

```
$ npx @keygraph/shannon@latest --help
ERROR: Shannon does not run on native Windows.
Run Shannon inside WSL2.
```

## The path that does work

WSL2 on this machine already has what Shannon needs:

| Requirement | State | Note |
| --- | --- | --- |
| WSL2 distro | Ubuntu 22.04.5 LTS | `wsl -l -v` |
| Docker | `/usr/bin/docker` + socket present | Docker Desktop WSL integration |
| Node 22+ | installed to `/tmp/node22` for the test | distro default is v12, too old |
| Model key | free NVIDIA NIM | `nvapi-...` |

### Setup, verified

```bash
# inside WSL2
curl -fsSL -o /tmp/n.tar.xz https://nodejs.org/dist/v22.14.0/node-v22.14.0-linux-x64.tar.xz
mkdir -p /tmp/node22 && tar -xJf /tmp/n.tar.xz -C /tmp/node22 --strip-components=1
export PATH=/tmp/node22/bin:$PATH
```

`models.json` describing the free NVIDIA endpoint (Shannon's catalogue does not
carry this model, so it has to be described):

```json
{
  "providers": {
    "nvidia": {
      "baseUrl": "https://integrate.api.nvidia.com/v1",
      "api": "openai-completions",
      "apiKey": "placeholder",
      "models": [
        {
          "id": "nvidia/nemotron-3.5-lightning-30b-a3b",
          "name": "Nemotron 3.5 Lightning 30B",
          "contextWindow": 131072,
          "maxTokens": 8192,
          "compat": { "supportsDeveloperRole": false, "supportsReasoningEffort": false }
        }
      ]
    }
  }
}
```

### Preflight (measured)

```bash
export SHANNON_AI_API_KEY='<nvidia key>'
export SHANNON_AI_MODEL='nvidia:nvidia/nemotron-3.5-lightning-30b-a3b'

npx --yes @keygraph/shannon@latest start \
  -u https://shekin.tail97139a.ts.net \
  -r '/mnt/e/Security/Project 2/project/ai-smartphone-security' \
  --models-config /tmp/shannon-test/models.json \
  --validate-model
```

Observed:

```
Validation COMPLETED
Duration:    4.1s
Total Cost:  $0.0000
Model:       nvidia:nvidia/nemotron-3.5-lightning-30b-a3b

Checks:
  - Preflight (LLM credentials, target URL) — OK (2.2s)
  - Cyber access verification — not required for this provider
```

`Cyber access verification — not required for this provider` matters: the
Anthropic and OpenAI safeguards that can interrupt a cyber workload mid-run do
not apply to a third-party provider. That is why the free NVIDIA key is the most
reliable option here.

### A real scan (measured, then stopped deliberately)

```bash
npx --yes @keygraph/shannon@latest start \
  -u https://shekin.tail97139a.ts.net \
  -r '/mnt/e/Security/Project 2/project/ai-smartphone-security' \
  --models-config /tmp/shannon-test/models.json \
  --pipeline-testing -w smoke-free
```

Phase state at 165 s:

```
preflight              completed
auth-validation        skipped
pre-recon              completed
recon                  completed
vulnerability-analysis completed   (injection, xss, auth, ...)
exploitation           running     (authz-exploit, auth-exploit)
reporting              pending
```

The run was stopped on purpose with `stop --all`, so no report was produced and
no cost was incurred.

## How it is wired into the phone UI

The bridge is shipped. `tools/shannon-bridge.mjs` runs on Windows, listens on
`127.0.0.1:7071`, requires an `x-bridge-token` header, and drives `wsl.exe`.
`server.js` adds six session-gated proxy routes — `/api/shannon/health`,
`start`, `status`, `logs`, `stop`, `report` — and the AI Pentest screen has an
engine switch that swaps the in-container agent for Shannon without leaving the
page.

Two measured facts shaped that design:

1. **WSL background processes do not survive the session.** A test listener
   started with `nohup ... &` inside `wsl -e bash -lc` was gone immediately
   afterwards (`port 7071 NOT listening`). The bridge is therefore a long-lived
   Windows process started once per session, not a per-scan script.
2. **A full run is 1–1.5 hours**, against a terminal whose SSE stream caps at
   three minutes per command. So Shannon is polled (`start` → `status` → `logs`)
   rather than streamed, and the in-container agent stays as the fast path that
   needs no WSL2, no Docker socket and no bridge.

## Credentials are a config file, not a guess

`configs/shannon-lab.yaml` names the provisioned scan account, its password and
its TOTP secret, and describes the login flow. The bridge passes it with `-c`.

Without it the exploit agents had to invent their own way in. Measured on
2026-11-24: `authz-exploit` registered throwaway accounts that could not
complete MFA enrolment, then slept in 180 s and 600 s retries; the run reached
93 minutes in the exploitation phase and was stopped with no report. The phase
that never finished was the one that needed a signed-in bank session.

The page they sign in through is `/lab-login.html`: a plain form over the same
`/api/auth/login` and `/api/auth/verify` endpoints the phone UI uses, so the
test engine does not have to drive the phone shell — power button, PIN pad, app
tile — before it can reach an API. Its behaviour lives in `public/lab-login.js`
because Helmet sends `script-src 'self'`: an inline `<script>` is blocked
silently and the form falls back to a native GET submit, which looks exactly
like a rejected login.

## Licensing note

Shannon is AGPL-3.0. Running it unmodified for your own testing is fine.
Offering a modified Shannon as part of a network service obliges you to offer
the Corresponding Source to that service's users. This repository is public, so
that requirement is easy to satisfy — but do not vendor Shannon into the app and
then describe it as if it were the project's own engine.

## What a run costs

Budget an hour per scan, and expect a 30B free model to produce a weaker
pentest than the frontier models Shannon is tuned for. The bridge stages a
sanitised copy of the repository (`.env*`, `node_modules`, `.git`, `backups`
and `tools/out` excluded) into `.shannon-target`, so a scan never reads its own
output and never sees a secret.

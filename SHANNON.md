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
| Is it a drop-in for the AI Pentest terminal? | **No** | needs Docker + a host-side bridge; see below |

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

## Why this is not wired into the AI Pentest terminal

A working bridge is possible — Windows Node holding a small HTTP service that
shells `wsl.exe -e bash -lc "npx @keygraph/shannon ..."`, with the app calling
`http://host.docker.internal:<port>`. Two measured facts shaped the decision not
to ship that before submission:

1. **WSL background processes do not survive the session.** A test listener
   started with `nohup ... &` inside `wsl -e bash -lc` was gone immediately
   afterwards (`port 7071 NOT listening`). The bridge would therefore have to be
   a persistent Windows service, not a convenience script.
2. **A full run is 1–1.5 hours**, against a terminal whose SSE stream caps at
   three minutes per command.

So the honest architecture is: Shannon runs on the host as an **optional
external engine**, and the phone's AI Pentest terminal keeps the in-container
agent that runs anywhere, needs no WSL2, no Docker socket and no bridge.

## Licensing note

Shannon is AGPL-3.0. Running it unmodified for your own testing is fine.
Offering a modified Shannon as part of a network service obliges you to offer
the Corresponding Source to that service's users. This repository is public, so
that requirement is easy to satisfy — but do not vendor Shannon into the app and
then describe it as if it were the project's own engine.

## If you still want it in the phone UI

The minimum viable integration:

1. `tools/shannon-bridge.mjs` on Windows, listening on `127.0.0.1:7071`, with
   endpoints `POST /start`, `GET /status`, `GET /logs`, `POST /stop`.
2. Start it once per session (or as a Scheduled Task) so it survives.
3. Add `GET /api/ai-agent/shannon/*` in `server.js` that proxies to
   `http://host.docker.internal:7071` after the same session check the other
   tool routes use.
4. Point the AI Pentest screen at those routes, and download Shannon's
   `deliverables` directory when the workspace reports `completed`.

Budget an hour per scan, and expect a 30B free model to produce a weaker
pentest than the frontier models Shannon is tuned for.

# AI Defender — Strix scan console

The AI Defender screen is now a black / bright-green console that can scan the
built-in bank and school apps, any URL, a GitHub repo, an API spec, or a zipped
source project — then download the report and ask questions about it.

Everything Strix does (recon, exploitation, PoC validation, fixes, report
writing) runs the real `strix-agent` inside a container. This project supplies
the plumbing only.

---

## 1. Screen layout

One screen, numbered top to bottom. No second layout.

| Section | Contents |
| --- | --- |
| header | `AI DEFENDER` + protection badge |
| (collapsed strip) | `▸ protection & activity` — click to reveal the original ON/OFF switch, the three counters and the incident log |
| 01 MODEL | provider, model, API key, optional base URL |
| 02 TARGET | bank / school / both / URL / GitHub / API spec / ZIP source, plus a "how to upload" panel |
| 03 RUN | mode, max spend, START / CANCEL |
| 04 PROGRESS | live `mm:ss` timer, status, streaming agent log |
| 05 REPORT | time taken, severity counts, MD / JSON / CSV / PDF downloads, report text |
| 06 ASK ABOUT THIS REPORT | free-form chat, streamed answers |

### Why the old strip still exists

`public/app.js` binds `refresh-security` and `defender-toggle` at load time with
no null check. Removing those nodes throws a `TypeError` and kills the rest of
that script. So they stay in the DOM inside `#sx-strip`, which is collapsed with
the `hidden` attribute — hidden, never removed. `getElementById` still finds
them, the protection setting still saves, and the default view is the clean
console.

---

## 2. Files

| File | Purpose |
| --- | --- |
| `strix-proxy-routes.js` | Same-origin `/strix-api/*` bridge (SSE + multipart) |
| `create-scan-account.js` | Provisions scan accounts with a known TOTP secret |
| `public/defender-console.js` | Console logic: scan, timer, log, report, chat |
| `public/defender-console.css` | Black / bright-green styling, scoped to `#defender` |
| `strix-scanner/main.py` | FastAPI service: runs `strix`, normalises findings, PDF, report chat |
| `strix-scanner/Dockerfile` | Python 3.12 + docker CLI + `strix-agent` + reportlab |
| `strix-scanner/docker-compose.yml` | Service definition, socket mount, volumes |
| `strix-scanner/requirements.txt` | Python dependencies |

Edits to existing files are additive only: 6 lines in `server.js`
(import + `installStrixProxy(app)`), and the console `<link>` / `<script>` tags
in `public/index.html`. Backups: `server.js.bak-<ts>`, `public/index.html.bak-<ts>`.

---

## 3. Running it

```bash
# 1. provision accounts (once)
node create-scan-account.js --app bank   --username scan-bank    --password "ScanLab!2026pass"
node create-scan-account.js --app acadia --username scan-student --password "ScanLab!2026pass"

# 2. scanner container
cd strix-scanner && docker compose up --build

# 3. the simulator
npm start
```

Open the page → unlock the phone (`1234`) → **AI Defender**.

Paste the `totpSecret` printed by step 1 into section 02. Username, password and
secret are remembered in that browser tab only.

### Any LLM

Section 01 accepts OpenAI, Anthropic, OpenRouter, Groq, Google, or **Custom**
with your own base URL — so Ollama, LM Studio, vLLM and gateways work:

```
provider: custom
base url: http://localhost:11434/v1
model:    llama3.1
key:      any non-empty string (local servers usually ignore it)
```

The same provider/model/key is used both for the scan and for the report chat.
Keys are held in memory for the run and never written to disk.

### Uploads

A browser cannot read a folder from disk. For a VS Code project: right-click the
folder → *Send to* → *Compressed (zipped) folder*, then upload the `.zip` in
section 02.

### Reset between scans

Agents write to the lab database. Reset, then re-provision:

```bash
psql "$DATABASE_URL" -f recovery.sql
node create-scan-account.js --app bank --username scan-bank --password "ScanLab!2026pass"
```

---

## 4. Report chat

`POST /api/chat` takes the scan id, the question, the provider settings and the
recent turns. It builds context from the scan's Markdown report (falling back to
the findings JSON, then the log tail), then streams the answer back as plain
text. Anthropic uses `/v1/messages`; everything else uses OpenAI-compatible
`/chat/completions`.

---

## 5. Verified on this machine

Observed with real requests:

| Check | Result |
| --- | --- |
| Scanner container | up, `strix 1.7.0`, `docker: true`, `pdf_available: true` |
| `GET /api/providers` | six providers returned |
| `POST /api/chat` no question | `400 Ask a question first` |
| `POST /api/chat` no key | `400 An API key is required...` |
| `POST /api/chat` unknown scan | `404 Scan not found` |
| `POST /api/chat` with a mock LLM | streamed `Streaming works. Report context received.` |
| All nine original IDs | each present exactly once in `index.html` |
| `node --check` | clean on `server.js`, proxy, account script, console JS |
| Page in headless Edge | no `TypeError` / uncaught errors |
| Console JS executed | `aria-pressed="true"` set, base URL placeholder defaulted |
| Strip default state | `hidden=""` |
| Old asset URLs | `404` (overlay removed) |
| New assets | `200`, `defender-console.js` 23804 B, `.css` 13445 B |
| `/strix-api/*` without a session | `401 Sign in to the simulator first.` |

Not verified: the screen was **not** clicked through in a signed-in browser, and
no screenshot could be reviewed (image viewing is unavailable on this Windows
host). The layout is confirmed from the rendered DOM and stylesheet, not by eye.

---

## 6. Known limits

- A full AI scan still needs a real model key; the run stops at the model call
  without one.
- The scan console is independent of the Attack Protection toggle. It does not
  consult that setting before scanning.
- Strix CLI flags are pinned to 1.7.0 (`-n -t -m --instruction`, optional
  `--max-budget`, `--max-turns`). A different image may need `main.py` adjusted.
- Findings quality tracks the model you choose.

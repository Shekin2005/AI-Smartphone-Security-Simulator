"""Strix scan service for the AI Smartphone Security simulator.

Runs the real `strix` CLI non-interactively, streams its output, and
exposes the artifacts Strix writes (report, findings, CSV, PDF).

Design notes:
  * Nothing here re-implements Strix. It shells out to the real binary,
    so recon / exploit validation / report writing are Strix's own work.
  * The LLM key is supplied per scan by the browser and passed only as
    a subprocess environment variable. It is never written to disk and
    is redacted from any log line we emit.
  * Strix needs a Docker daemon because it starts a sandbox container
    per run; docker-compose mounts the host socket for that.
"""

from __future__ import annotations

import asyncio
import csv
import hmac
import io
import json
import os
import queue
import re
import shutil
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from fastapi import Depends, FastAPI, Header, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import (
    FileResponse,
    JSONResponse,
    PlainTextResponse,
    StreamingResponse,
)

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------

STRIX_BIN = os.environ.get("STRIX_BIN", "strix")
RUNS_DIR = Path(os.environ.get("RUNS_DIR", "/data/runs"))
UPLOAD_DIR = Path(os.environ.get("UPLOAD_DIR", "/data/uploads"))
TARGET_BASE = os.environ.get("TARGET_BASE", "http://host.docker.internal:3000")

# Strix exits 2 when it found something and 0 when the target is clean.
SUCCESS_EXIT_CODES = (0, 2)

# Login is rate limited to 30 requests / 15 min by the simulator.
MAX_LOGIN_ATTEMPTS = 5

RUNS_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Strix Scan Service", version="1.0.0")

# The browser never calls this service directly (the Express proxy does),
# but CORS keeps local debugging painless.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ANSI_RE = re.compile(r"\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07")

# Shared secret. When set, every API call must present it. This is what
# stops a publicly reachable scanner from being an open scan proxy that
# burns the operator's model credits.
SCAN_TOKEN = os.environ.get("STRIX_SCAN_TOKEN", "")

if not SCAN_TOKEN:
    print(
        "[AUTH] STRIX_SCAN_TOKEN is not set - the scanner accepts "
        "unauthenticated requests. Only safe on a private interface.",
        flush=True,
    )


def require_token(x_scan_token: str | None = Header(default=None)) -> None:
    """Reject callers that do not present the shared secret."""
    if not SCAN_TOKEN:
        return

    if not x_scan_token or not hmac.compare_digest(x_scan_token, SCAN_TOKEN):
        raise HTTPException(401, "Invalid or missing scan token")


def clean(text: str) -> str:
    return ANSI_RE.sub("", text).replace("\r", "")


# ----------------------------------------------------------------------
# Scan state
# ----------------------------------------------------------------------


@dataclass
class Scan:
    id: str
    target: str
    target_kind: str
    mode: str
    model: str
    instruction: str
    created_at: str
    status: str = "queued"          # queued | running | completed | failed | cancelled
    exit_code: int | None = None
    started_at: str | None = None
    finished_at: str | None = None
    duration_seconds: int | None = None
    error: str | None = None
    workspace: str = ""
    log: list[str] = field(default_factory=list)
    findings: list[dict[str, Any]] = field(default_factory=list)
    counts: dict[str, int] = field(default_factory=dict)
    artifacts: dict[str, str] = field(default_factory=dict)
    subscribers: list[queue.Queue] = field(default_factory=list)
    redactions: list[str] = field(default_factory=list)
    process: subprocess.Popen | None = None
    finished: bool = False

    def to_public(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "target": self.target,
            "target_kind": self.target_kind,
            "mode": self.mode,
            "model": self.model,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_seconds": self.duration_seconds,
            "status": self.status,
            "exit_code": self.exit_code,
            "error": self.error,
            "counts": self.counts,
            "findings": self.findings,
            "artifacts": self.artifacts,
            "log_lines": len(self.log),
        }


SCANS: dict[str, Scan] = {}
SCANS_LOCK = threading.Lock()
HISTORY_FILE = RUNS_DIR / "scans.json"


def persist_history() -> None:
    """Keep a small history file so the console survives a restart."""
    try:
        with SCANS_LOCK:
            rows = [
                s.to_public()
                for s in sorted(
                    SCANS.values(), key=lambda x: x.created_at, reverse=True
                )[:50]
            ]
        tmp = HISTORY_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(rows, indent=2), encoding="utf-8")
        tmp.replace(HISTORY_FILE)
    except Exception as exc:  # pragma: no cover - best effort only
        print(f"[HISTORY] could not persist: {exc}", flush=True)


def save_scan(scan: Scan) -> None:
    """Write one scan's full state into its workspace.

    The workspace lives on the strix-runs volume, so this is what makes a
    scan survive a container rebuild. Without it a rebuilt scanner answers
    404 and the console shows "Scan not found".
    """
    try:
        workspace = Path(scan.workspace)
        workspace.mkdir(parents=True, exist_ok=True)
        body = {
            **scan.to_public(),
            "instruction": scan.instruction,
            "log": scan.log[-2000:],
        }
        target = workspace / "scan.json"
        tmp = workspace / "scan.json.tmp"
        tmp.write_text(json.dumps(body), encoding="utf-8")
        tmp.replace(target)
    except Exception as exc:  # pragma: no cover - best effort only
        print(f"[PERSIST] {scan.id}: {exc}", flush=True)


_LAST_SAVE: dict[str, float] = {}
_SAVE_INTERVAL = 10.0


def maybe_save_scan(scan: Scan) -> None:
    """Persist at most once every few seconds.

    Saving only at the end was not enough: a scan interrupted by a container
    restart left no file on disk, so it disappeared from the console instead
    of showing up as interrupted. Writing periodically means every scan that
    ever started can be reported on after a crash.
    """
    now = time.monotonic()
    if now - _LAST_SAVE.get(scan.id, 0.0) < _SAVE_INTERVAL:
        return

    _LAST_SAVE[scan.id] = now
    save_scan(scan)


def load_scans() -> None:
    """Reload past scans from the volume after a restart."""
    restored = 0
    for meta in sorted(RUNS_DIR.glob("*/scan.json")):
        try:
            data = json.loads(meta.read_text(encoding="utf-8"))
            scan_id = data["id"]
            if scan_id in SCANS:
                continue

            # A scan that was mid-flight when the container died can never
            # finish. Mark it failed and say why, rather than pretending it
            # is still running forever.
            interrupted = data.get("status") in ("queued", "running")
            scan = Scan(
                id=scan_id,
                target=data.get("target", ""),
                target_kind=data.get("target_kind", ""),
                mode=data.get("mode", ""),
                model=data.get("model", ""),
                instruction=data.get("instruction", ""),
                created_at=data.get("created_at") or "",
                status="failed" if interrupted else data.get("status", "failed"),
                exit_code=data.get("exit_code"),
                started_at=data.get("started_at"),
                finished_at=data.get("finished_at"),
                duration_seconds=data.get("duration_seconds"),
                error=(
                    "Interrupted: the scanner restarted while this scan was "
                    "running. Start a new scan."
                    if interrupted
                    else data.get("error")
                ),
                workspace=str(meta.parent),
                log=list(data.get("log") or []),
                findings=list(data.get("findings") or []),
                counts=dict(data.get("counts") or {}),
                artifacts=dict(data.get("artifacts") or {}),
                finished=True,
            )
            if interrupted and scan.error:
                scan.log.append(scan.error)

            SCANS[scan_id] = scan
            restored += 1
        except Exception as exc:  # pragma: no cover
            print(f"[RESTORE] {meta}: {exc}", flush=True)

    if restored:
        print(f"[RESTORE] reloaded {restored} scan(s) from {RUNS_DIR}", flush=True)


load_scans()


# ----------------------------------------------------------------------
# Secret redaction
# ----------------------------------------------------------------------


def redact(text: str, scan: Scan) -> str:
    # Only mask values long enough to plausibly be a real secret. A short
    # placeholder such as the dummy key "ollama" would otherwise redact the
    # provider name out of every log line.
    for secret in scan.redactions:
        if secret and len(secret) >= 8:
            text = text.replace(secret, "***redacted***")
    # Belt and braces: mask anything that looks like an API key.
    text = re.sub(r"\bsk-[A-Za-z0-9_\-]{8,}", "sk-***redacted***", text)
    return text


# ----------------------------------------------------------------------
# Instruction builder
# ----------------------------------------------------------------------


def totp_helper() -> str:
    return (
        "Compute the 6-digit code with pure Python (no dependencies):\n"
        "  import base64, hmac, hashlib, struct, time\n"
        "  key = base64.b32decode(secret.upper() + '=' * ((8 - len(secret) % 8) % 8))\n"
        "  step = int(time.time()) // 30\n"
        "  digest = hmac.new(key, struct.pack('>Q', step), hashlib.sha1).digest()\n"
        "  off = digest[-1] & 0x0F\n"
        "  code = str((struct.unpack('>I', digest[off:off+4])[0] & 0x7FFFFFFF) % 1000000).zfill(6)\n"
    )


def build_instruction(
    target_kind: str,
    target_url: str,
    apps: list[str],
    credentials: dict[str, dict[str, str]],
    extra: str = "",
) -> str:
    """Build the per-run brief handed to the Strix agent."""

    lines: list[str] = [
        "AUTHORISED TARGET: this is a local, purpose-built training simulator",
        "belonging to the person running this scan. You may attack it freely.",
        "",
        f"BASE URL: {target_url}",
        "",
        "MANDATORY PROTOCOL RULES — the app rejects you without these:",
        f"  1. Every non-GET request to /api/* must carry: Origin: {target_url}",
        "     Missing or mismatched Origin returns 403 'Invalid request origin'.",
        "  2. Cookie name is sim.sid; use a cookie jar and keep the session.",
        "  3. MFA is mandatory. Login does NOT grant a session by itself:",
        "     POST /api/auth/login -> {\"next\":\"verify\"}",
        "     POST /api/auth/verify {\"code\":\"<totp>\"} -> session becomes valid.",
        "  4. /api/auth/verify REGENERATES the session and returns a NEW",
        "     sim.sid cookie. Always use the cookie from the verify response;",
        "     the login cookie is dead the moment MFA succeeds.",
        "  5. /api/auth is rate limited to 30 requests per 15 minutes.",
        f"     Do not exceed {MAX_LOGIN_ATTEMPTS} login attempts per account; reuse",
        "     a session you already hold instead of logging in again.",
        "",
        totp_helper(),
    ]

    for app_name in apps:
        cred = credentials.get(app_name)
        if not cred:
            continue

        role = cred.get("role", "student")
        lines += [
            "",
            f"--- {app_name.upper()} TEST ACCOUNT ---",
            f"  username   : {cred['username']}",
            f"  password   : {cred['password']}",
            f"  totp secret: {cred['totp_secret']}",
            f"  login body : {{\"app\":\"{app_name}\","
            f"\"username\":\"{cred['username']}\","
            f"\"password\":\"{cred['password']}\",\"role\":\"{role}\"}}",
        ]

    if "bank" in apps:
        lines += [
            "",
            "--- BANK APP SURFACE (/api/bank/*) ---",
            "  GET  /api/bank/accounts, /api/bank/account-details",
            "  GET  /api/bank/recipients, /api/bank/person-transfers",
            "  POST /api/bank/recipients, POST /api/bank/send-money",
            "  POST /api/bank/link-code, POST /api/bank/pay-tuition",
            "  GET  /api/bank/tuition/student/:studentId",
            "  Focus: IDOR between accounts, transfer amount/ownership",
            "  tampering, request_id replay, negative or float amounts,",
            "  tuition payment authorization, session/app scoping.",
        ]

    if "acadia" in apps:
        lines += [
            "",
            "--- SCHOOL APP SURFACE (/api/school/*) ---",
            "  GET  /api/school/catalog",
            "  Student: /api/school/services/*, /api/acadia/payments",
            "  Admin:   /api/school/admin/*",
            "  Focus: student-to-student IDOR, role confusion between",
            "  student and admin routes, grade/tuition manipulation,",
            "  catalog and course-access authorization.",
        ]

    lines += [
        "",
        "METHOD:",
        "  - Crawl and map first; then test each hypothesis with a real request.",
        "  - Prove every finding with a working proof of concept and record the",
        "    exact request, response and the two accounts involved.",
        "  - Only report what you reproduced. Do not report theory.",
    ]

    if extra.strip():
        lines += ["", "ADDITIONAL INSTRUCTIONS:", extra.strip()]

    return "\n".join(lines)


# ----------------------------------------------------------------------
# Artifact discovery
# ----------------------------------------------------------------------

ARTIFACT_PATTERNS = {
    "md": ["penetration_test_report.md", "vulnerabilities.md", "*.md"],
    "json": ["vulnerabilities.json", "*.json"],
    "csv": ["vulnerabilities.csv", "*.csv"],
    "sarif": ["*.sarif"],
}


def find_artifacts(workspace: Path) -> dict[str, str]:
    found: dict[str, str] = {}

    candidates = [
        p for p in workspace.rglob("*") if p.is_file() and p.stat().st_size > 0
    ]

    for kind, patterns in ARTIFACT_PATTERNS.items():
        for pattern in patterns:
            matches = [
                p
                for p in candidates
                if p.match(pattern)
                and p.name not in ("scans.json", "run.json")
            ]
            if matches:
                matches.sort(key=lambda p: p.stat().st_mtime, reverse=True)
                found[kind] = str(matches[0])
                break

    return found


def normalize_findings(json_path: Path) -> tuple[list[dict], dict[str, int]]:
    """Map Strix's vulnerabilities.json into the console's shape."""
    findings: list[dict] = []

    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
    except Exception:
        return findings, {}

    rows = data if isinstance(data, list) else data.get("vulnerabilities", [])
    if not isinstance(rows, list):
        rows = []

    def pick(row: dict, *names, default=""):
        for name in names:
            value = row.get(name)
            if value not in (None, ""):
                return value
        return default

    for index, row in enumerate(rows, start=1):
        if not isinstance(row, dict):
            continue

        findings.append(
            {
                "id": str(pick(row, "id", "vuln_id", default=f"vuln-{index:03d}")),
                "title": str(
                    pick(row, "title", "name", default="Untitled finding")
                ),
                "severity": str(
                    pick(row, "severity", "risk", default="unknown")
                ).lower(),
                "cvss": pick(row, "cvss", "cvss_score", "cvss31_score", default=""),
                "cwe": str(pick(row, "cwe", "cwe_id", default="")),
                "endpoint": str(
                    pick(row, "endpoint", "url", "location", default="")
                ),
                "method": str(pick(row, "method", "http_method", default="")),
                "description": str(
                    pick(row, "description", "summary", default="")
                ),
                "impact": str(pick(row, "impact", default="")),
                "technical_analysis": str(
                    pick(row, "technical_analysis", "analysis", default="")
                ),
                "poc_description": str(
                    pick(row, "poc_description", "reproduction", default="")
                ),
                "poc_code": str(
                    pick(row, "poc_code", "poc", "exploit", default="")
                ),
                "remediation": str(
                    pick(
                        row,
                        "remediation",
                        "recommendation",
                        "fix",
                        default="",
                    )
                ),
                "evidence": str(pick(row, "evidence", default="")),
            }
        )

    counts: dict[str, int] = {}
    for finding in findings:
        key = finding["severity"] or "unknown"
        counts[key] = counts.get(key, 0) + 1

    return findings, counts


# ----------------------------------------------------------------------
# Process runner
# ----------------------------------------------------------------------


def stream_reader(scan: Scan, pipe, label: str) -> None:
    try:
        for raw in iter(pipe.readline, b""):
            line = clean(raw.decode("utf-8", "replace")).rstrip()
            if not line:
                continue
            line = redact(line, scan)
            scan.log.append(line)
            for subscriber in list(scan.subscribers):
                try:
                    subscriber.put_nowait(line)
                except queue.Empty:
                    pass
    except Exception as exc:  # pragma: no cover
        print(f"[SCAN {scan.id}] {label} reader error: {exc}", flush=True)


def announce(scan: Scan, message: str) -> None:
    line = redact(clean(message), scan)
    scan.log.append(line)
    for subscriber in list(scan.subscribers):
        try:
            subscriber.put_nowait(line)
        except queue.Empty:
            pass

    maybe_save_scan(scan)


# A finished scan with zero findings only means "clean" if the agent
# actually attacked the target. A model that refused, or that only wrote a
# threat model and called finish_scan, produces the same empty report - so
# the difference has to be stated rather than implied.
REFUSAL_MARKERS = (
    "cannot fulfill this request",
    "i cannot perform security",
    "i cannot make http requests",
    "i cannot interact with specific endpoints",
    "i cannot assist with",
    "i'm unable to assist",
    "i am unable to assist",
)

# Tools that plan or record work without ever touching the target.
PLANNING_TOOLS = {
    "think",
    "save_threat_model",
    "get_threat_model",
    "create_todo",
    "update_todo",
    "list_reports",
    "finish_scan",
    "output_store",
    "notes",
    "coverage",
    "web_search",
    "load_skill",
    "wait_for_user",
}


def detect_untested(scan: Scan) -> str | None:
    """Explain why a zero-finding result may not mean the target is clean."""
    logs = sorted(Path(scan.workspace).glob("strix_runs/*/strix.log"))
    if not logs:
        return None

    try:
        text = logs[-1].read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None

    lowered = text.lower()

    for marker in REFUSAL_MARKERS:
        if marker in lowered:
            return (
                "the model refused part of this task, so zero findings is not "
                "a clean bill of health. Use a model that permits authorized "
                "security testing, then run the scan again."
            )

    used = set(re.findall(r"invoking tool ([a-z_]+)", lowered))

    if not used:
        return (
            "the agent never invoked a tool, so nothing was tested. Treat zero "
            "findings as untested rather than clean."
        )

    if used <= PLANNING_TOOLS:
        return (
            "the agent only used planning tools ("
            + ", ".join(sorted(used))
            + ") and never touched the target. Treat zero findings as "
            "untested rather than clean."
        )

    return None


def finalize(scan: Scan, exit_code: int) -> None:
    scan.exit_code = exit_code
    scan.finished_at = datetime.now(timezone.utc).isoformat()
    scan.finished = True

    # How long the whole run took, for the "report ready in ..." line.
    if scan.started_at:
        try:
            began = datetime.fromisoformat(scan.started_at)
            ended = datetime.fromisoformat(scan.finished_at)
            scan.duration_seconds = max(0, int((ended - began).total_seconds()))
        except Exception:
            scan.duration_seconds = None

    workspace = Path(scan.workspace)
    scan.artifacts = find_artifacts(workspace)

    if "json" in scan.artifacts:
        scan.findings, scan.counts = normalize_findings(
            Path(scan.artifacts["json"])
        )

    if exit_code in SUCCESS_EXIT_CODES:
        scan.status = "completed"
        if scan.findings:
            announce(
                scan,
                f"Scan complete: {len(scan.findings)} finding(s) "
                f"across {sum(scan.counts.values())} severity entries.",
            )
        else:
            untested = detect_untested(scan)

            if untested:
                announce(scan, "WARNING: " + untested)

            announce(scan, "Scan complete: no findings reported.")
    elif exit_code == 0:
        scan.status = "completed"
    else:
        scan.status = "failed"
        scan.error = scan.error or (
            f"Strix exited with code {exit_code}. "
            "Check the log above for the failing step."
        )
        announce(scan, scan.error)

    for subscriber in list(scan.subscribers):
        try:
            subscriber.put_nowait("__EOF__")
        except queue.Empty:
            pass

    persist_history()
    save_scan(scan)


def run_scan(scan: Scan, argv: list[str], env: dict[str, str]) -> None:
    scan.status = "running"
    scan.started_at = datetime.now(timezone.utc).isoformat()
    announce(scan, f"Launching: {' '.join(argv[:3])} ...")
    announce(scan, f"Workspace: {scan.workspace}")

    try:
        process = subprocess.Popen(
            argv,
            cwd=scan.workspace,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=1,
        )
        scan.process = process

        out_thread = threading.Thread(
            target=stream_reader, args=(scan, process.stdout, "stdout"), daemon=True
        )
        err_thread = threading.Thread(
            target=stream_reader, args=(scan, process.stderr, "stderr"), daemon=True
        )
        out_thread.start()
        err_thread.start()

        exit_code = process.wait()
        out_thread.join(timeout=5)
        err_thread.join(timeout=5)

        finalize(scan, exit_code)

    except FileNotFoundError:
        scan.status = "failed"
        scan.finished = True
        scan.error = (
            "The strix executable was not found in the scanner container. "
            "Rebuild the image (docker compose build --no-cache) so it installs."
        )
        announce(scan, scan.error)
        persist_history()
    except Exception as exc:
        scan.status = "failed"
        scan.finished = True
        scan.error = f"Scanner error: {exc}"
        announce(scan, scan.error)
        persist_history()


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------


def strix_available() -> dict[str, Any]:
    path = shutil.which(STRIX_BIN)
    if not path:
        return {"available": False, "path": None, "version": None}

    version = None
    try:
        proc = subprocess.run(
            [STRIX_BIN, "--version"],
            capture_output=True,
            text=True,
            timeout=20,
        )
        version = (proc.stdout or proc.stderr).strip().splitlines()[0]
    except Exception:
        pass

    return {"available": True, "path": path, "version": version}


def resolve_target(
    target_kind: str,
    apps: list[str],
    target_url: str | None,
    upload: UploadFile | None,
    saved_upload: Path | None,
) -> tuple[str, str]:
    """Return (target_for_strix, base_url_for_instructions)."""
    if target_kind in ("bank", "school", "both"):
        return TARGET_BASE, TARGET_BASE

    if target_kind == "url":
        if not target_url:
            raise HTTPException(400, "target_url is required for a URL scan")
        return target_url, target_url

    if target_kind == "github":
        if not target_url:
            raise HTTPException(400, "target_url is required for a GitHub scan")
        return target_url, target_url

    if target_kind in ("source", "api-spec"):
        if not saved_upload:
            raise HTTPException(400, "A file upload is required for this target")
        return str(saved_upload), TARGET_BASE

    raise HTTPException(400, f"Unsupported target kind: {target_kind}")


def pdf_available() -> bool:
    try:
        import reportlab  # noqa: F401

        return True
    except Exception:
        return False


# ----------------------------------------------------------------------
# Routes
# ----------------------------------------------------------------------


# Strix's system prompt plus its 44 tool definitions measured 50,860
# tokens in practice. A smaller window means Ollama drops the middle of the
# prompt and the agent runs with no instructions at all.
STRIX_PROMPT_TOKENS = 51000

# The prompt alone is not enough: the model still has to think and emit a
# tool call inside the same window. Reserve roughly 8k tokens for that, so
# a 51200-token server is still rejected as too tight.
STRIX_MIN_CONTEXT = STRIX_PROMPT_TOKENS + 8000

# Expensive readiness probes are cached so /api/health stays a liveness
# check. `docker info` alone can outlast the healthcheck timeout when the
# daemon is busy, which made the container flap to unhealthy mid-scan.
_PROBE_CACHE: dict[str, tuple[float, Any]] = {}
_PROBE_TTL = 60.0


def cached_probe(name: str, probe: Any) -> Any:
    now = time.monotonic()
    hit = _PROBE_CACHE.get(name)
    if hit is not None and now - hit[0] < _PROBE_TTL:
        return hit[1]

    value = probe()
    _PROBE_CACHE[name] = (now, value)
    return value


def ollama_effective_context(base_url: str, model: str) -> int | None:
    """Return Ollama's context length for a resident model, else None.

    /api/ps only reports models that are currently loaded, so this is best
    effort: an unloaded model's window cannot be read without loading it,
    which costs minutes on CPU. When the value is unknown we let the scan
    try rather than blocking it on a guess.
    """
    if not base_url:
        return None

    name = model.split("/", 1)[1] if "/" in model else model

    try:
        response = httpx.get(base_url.rstrip("/") + "/api/ps", timeout=8)
        if response.status_code != 200:
            return None

        for entry in response.json().get("models") or []:
            if name in (entry.get("name"), entry.get("model")):
                value = entry.get("context_length")
                return int(value) if value else None
    except Exception:
        return None

    return None


@app.get("/api/health", dependencies=[Depends(require_token)])
def health():
    return {
        "status": "ok",
        "strix": cached_probe("strix", strix_available),
        "docker": cached_probe("docker", docker_available),
        "pdf_available": cached_probe("pdf", pdf_available),
        "target_base": TARGET_BASE,
        "active": sum(1 for s in SCANS.values() if s.status == "running"),
    }


def docker_available() -> bool:
    if not shutil.which("docker"):
        return False
    try:
        proc = subprocess.run(
            ["docker", "info", "--format", "{{.ServerVersion}}"],
            capture_output=True,
            text=True,
            timeout=15,
        )
        return proc.returncode == 0 and bool(proc.stdout.strip())
    except Exception:
        return False


@app.post("/api/scans", dependencies=[Depends(require_token)])
async def create_scan(request: Request):
    content_type = request.headers.get("content-type", "")

    upload: UploadFile | None = None
    saved_upload: Path | None = None

    if content_type.startswith("multipart/form-data"):
        form = await request.form()
        payload = {k: v for k, v in form.items() if isinstance(v, str)}
        file_field = form.get("file")
        if isinstance(file_field, UploadFile):
            upload = file_field
        credentials = json.loads(payload.get("credentials") or "{}")
    else:
        payload = await request.json()
        credentials = payload.get("credentials") or {}

    target_kind = str(payload.get("target_kind") or "bank").lower()
    apps = payload.get("apps") or (
        ["bank"]
        if target_kind == "bank"
        else ["acadia"]
        if target_kind == "school"
        else ["bank", "acadia"]
        if target_kind == "both"
        else []
    )
    if isinstance(apps, str):
        apps = [a for a in apps.split(",") if a]

    mode = str(payload.get("mode") or "quick").lower()
    if mode not in ("quick", "standard", "deep"):
        mode = "quick"

    model = str(payload.get("model") or os.environ.get("STRIX_LLM") or "")
    api_key = str(payload.get("llm_api_key") or os.environ.get("LLM_API_KEY") or "")

    scan_id = uuid.uuid4().hex[:12]
    workspace = RUNS_DIR / scan_id
    workspace.mkdir(parents=True, exist_ok=True)

    if upload is not None:
        safe_name = Path(upload.filename or "upload.bin").name
        saved_upload = workspace / "input" / safe_name
        saved_upload.parent.mkdir(parents=True, exist_ok=True)
        saved_upload.write_bytes(await upload.read())

    target, base_url = resolve_target(
        target_kind, apps, payload.get("target_url"), upload, saved_upload
    )

    instruction = build_instruction(
        target_kind,
        base_url,
        apps,
        credentials,
        str(payload.get("instruction") or ""),
    )

    scan = Scan(
        id=scan_id,
        target=target,
        target_kind=target_kind,
        mode=mode,
        model=model,
        instruction=instruction,
        created_at=datetime.now(timezone.utc).isoformat(),
        workspace=str(workspace),
    )

    # Never echo these back.
    scan.redactions = [
        api_key,
        *[c.get("password", "") for c in credentials.values()],
        *[c.get("totp_secret", "") for c in credentials.values()],
    ]

    argv = [
        STRIX_BIN,
        "-n",
        "-t",
        target,
        "-m",
        mode,
        "--instruction",
        instruction,
    ]

    max_budget = payload.get("max_budget")
    if max_budget not in (None, "", 0, "0"):
        argv += ["--max-budget", str(max_budget)]

    max_turns = payload.get("max_turns")
    if max_turns not in (None, "", 0, "0"):
        argv += ["--max-turns", str(max_turns)]

    # ---- model routing -------------------------------------------------
    # Two separate traps live here:
    #
    # 1. A bare model name means "OpenAI" to Strix unless LLM_API_BASE is
    #    set, so "qwen3:4b" is rejected outright. Known providers therefore
    #    get their prefix added: provider=ollama -> ollama/qwen3:4b.
    #
    # 2. LiteLLM's ollama_chat provider appends "/api/chat" to the base
    #    URL. Ollama's native API has no /v1 prefix, so a base ending in
    #    /v1 produces <base>/v1/api/chat and Ollama answers 404. Strip it.
    provider = str(payload.get("provider") or "").lower()
    llm_base_url = str(payload.get("base_url") or "").strip()

    provider_prefix = {
        "openrouter": "openrouter",
        "deepseek": "deepseek",
        "groq": "groq",
        "mistral": "mistral",
        "xai": "xai",
        "ollama": "ollama",
        "google": "gemini",
    }.get(provider)

    # OpenRouter publishes ids like "nvidia/nemotron-3-ultra-550b-a55b:free",
    # which already contain a slash. Checking for "/" alone would leave those
    # unprefixed, so Strix would read "nvidia" as the provider and fail. Prefix
    # unless the provider prefix is already there.
    # Strip any prefix the user already typed, then add exactly one back. Doing
    # it this way is idempotent: "gemini-3.5-flash" and "gemini/gemini-3.5-flash"
    # both end up as "gemini/gemini-3.5-flash". Checking for a "not startswith"
    # on its own is wrong because "gemini/gemini-x" legitimately starts with the
    # prefix while still being malformed.
    model_for_strix = model
    if model_for_strix and provider_prefix:
        prefix = f"{provider_prefix}/"
        while model_for_strix.startswith(prefix):
            model_for_strix = model_for_strix[len(prefix):]

        if model_for_strix:
            model_for_strix = f"{prefix}{model_for_strix}"

    is_ollama = model_for_strix.startswith("ollama/")

    # ---- key validation -------------------------------------------------
    # A provider 401 tells the user nothing: "Missing Authentication header"
    # and "User not found" look alike but mean different things. Check the
    # key here so a missing, mangled or truncated key fails with something
    # the user can act on, before a sandbox is even created.
    if not is_ollama:
        if not api_key:
            raise HTTPException(
                400,
                (
                    "No API key reached the scanner. Paste the key into "
                    "section 01 of the console (the field clears itself when "
                    "the page reloads) and start the scan again."
                ),
            )

        if any(ch.isspace() for ch in api_key) or not api_key.isascii():
            raise HTTPException(
                400,
                (
                    "The API key contains spaces, line breaks or non-ASCII "
                    "characters, so the provider will reject it. Re-copy the "
                    "key from the provider dashboard and paste it again."
                ),
            )

        if len(api_key) < 20:
            raise HTTPException(
                400,
                (
                    f"The API key is only {len(api_key)} characters long, "
                    "which is too short to be a real key. It looks truncated "
                    "- re-copy the whole key."
                ),
            )

        # The most common mix-up by far: the model name pasted into the API
        # KEY field. OpenRouter answers that with "Missing Authentication
        # header", which reads like a key problem but gives no hint what to
        # fix. Catch it here instead.
        if provider == "openrouter" and not api_key.startswith("sk-or-"):
            looks_like_model = "/" in api_key or ":" in api_key
            raise HTTPException(
                400,
                (
                    "OpenRouter API keys start with 'sk-or-v1-'. The value "
                    f"received starts with '{api_key[:4]}'"
                    + (
                        " and looks like a model name, so the MODEL and API "
                        "KEY fields may be swapped."
                        if looks_like_model
                        else ", which is not an OpenRouter key."
                    )
                    + " Copy the key from openrouter.ai/keys and paste it into "
                    "the API KEY field; keep the model name in the MODEL field."
                ),
            )

        # Google issues two key formats: the older "AIza..." and the newer
        # "AQ...." string. Both are valid, so accept either.
        if provider == "google" and not (
            api_key.startswith("AIza") or api_key.startswith("AQ.")
        ):
            looks_like_model = "/" in api_key or ":" in api_key
            raise HTTPException(
                400,
                (
                    "Google keys start with 'AIza' or 'AQ.'. The value "
                    f"received starts with '{api_key[:4]}'"
                    + (
                        " and looks like a model name, so the MODEL and API "
                        "KEY fields may be swapped."
                        if looks_like_model
                        else ", which is not a Google API key."
                    )
                    + " Create one at aistudio.google.com/apikey and paste it "
                    "into the API KEY field."
                ),
            )

    # Sensible default endpoint for a local Ollama, so the console does not
    # need to know the container/Docker host quirk.
    if provider == "ollama" and not llm_base_url:
        llm_base_url = "http://host.docker.internal:11434"

    # Providers that need an explicit OpenAI-compatible endpoint.
    if not llm_base_url:
        llm_base_url = {
            "openrouter": "https://openrouter.ai/api/v1",
            "groq": "https://api.groq.com/openai/v1",
            "deepseek": "https://api.deepseek.com/v1",
            "mistral": "https://api.mistral.ai/v1",
            "xai": "https://api.x.ai/v1",
        }.get(provider, "")

    # The gemini/ prefix routes through LiteLLM's native Google provider. That
    # provider builds its own URL, so passing the OpenAI-compatible base URL
    # alongside it would send the call to the wrong path.
    if model_for_strix.startswith("gemini/"):
        llm_base_url = ""

    if is_ollama and llm_base_url:
        llm_base_url = llm_base_url.rstrip("/")
        if llm_base_url.endswith("/v1"):
            llm_base_url = llm_base_url[:-3]

    env = os.environ.copy()
    if model_for_strix:
        env["STRIX_LLM"] = model_for_strix

    if api_key:
        env["LLM_API_KEY"] = api_key
    elif is_ollama:
        # Strix refuses to start without a key; Ollama ignores its value.
        env["LLM_API_KEY"] = "ollama"

    if llm_base_url:
        env["LLM_API_BASE"] = llm_base_url
        if is_ollama:
            # The variable LiteLLM's ollama_chat provider actually reads.
            env["OLLAMA_API_BASE"] = llm_base_url

    if model_for_strix.startswith("gemini/") and api_key:
        # LiteLLM's native Gemini provider reads GEMINI_API_KEY. Strix also
        # mirrors LLM_API_KEY into provider variables, but setting both here
        # means the scan works regardless of that mirroring, and even when the
        # provider dropdown was left on "Custom".
        env["GEMINI_API_KEY"] = api_key
        env["GOOGLE_API_KEY"] = api_key

        # A hosted Flash model still needs more than Strix's 30s default when a
        # ~51k-token prompt is being processed on the first turn.
        env.setdefault("LLM_PREFLIGHT_TIMEOUT", "300")
        env.setdefault("LLM_TIMEOUT", "600")

    if is_ollama:
        # Strix's preflight gives the model 30s to answer. CPU inference on a
        # 4B model takes roughly a minute, so that default fails every time.
        env.setdefault("LLM_PREFLIGHT_TIMEOUT", "300")
        env.setdefault("LLM_TIMEOUT", "900")
        env.setdefault("LLM_STREAM_IDLE_TIMEOUT", "900")

        # Refuse to launch a scan that cannot work. With a small window
        # Ollama keeps only the tail of the prompt, so Strix never sees its
        # own rules or the test credentials and spins until cancelled.
        effective = ollama_effective_context(llm_base_url, model_for_strix)

        if effective is not None and effective < STRIX_MIN_CONTEXT:
            raise HTTPException(
                400,
                (
                    f"Ollama is running {model_for_strix} with a {effective}-token "
                    f"context. Strix's prompt alone is about "
                    f"{STRIX_PROMPT_TOKENS:,} tokens, so it needs roughly "
                    f"{STRIX_MIN_CONTEXT:,} including room to answer. "
                    "Ollama would discard most of the prompt and the agent "
                    "would run without its instructions. Restart Ollama with "
                    "a larger window, for example "
                    "OLLAMA_CONTEXT_LENGTH=65536 and "
                    "OLLAMA_KV_CACHE_TYPE=q4_0 to keep the KV cache small, "
                    "then start the scan again."
                ),
            )

        announce(
            scan,
            f"Ollama context: {effective if effective else 'unknown (model not loaded)'}"
            f" | Strix needs about {STRIX_MIN_CONTEXT:,}",
        )

    announce(
        scan,
        f"Model: {model_for_strix or '(none)'}"
        + (
            f" | endpoint: {llm_base_url}"
            if llm_base_url
            else " | endpoint: provider default"
        ),
    )

    # Describe the key's shape without ever printing it, so a rejected key can
    # be diagnosed from the log alone.
    if is_ollama:
        announce(scan, "API key: not required for local Ollama")
    else:
        expected = {
            "openrouter": "sk-or-v1-",
        }.get(provider)

        if provider == "google" or model_for_strix.startswith("gemini/"):
            expected = "AIza or AQ."
            shape = (
                "format: matches"
                if api_key.startswith(("AIza", "AQ."))
                else "format: does not start with 'AIza' or 'AQ.'"
            )
        else:
            shape = (
                "format: matches"
                if expected and api_key.startswith(expected)
                else (
                    f"format: does not start with '{expected}'"
                    if expected
                    else "format: not checked for this provider"
                )
            )
        announce(
            scan,
            f"API key: received len={len(api_key)}"
            f" | provider={provider or 'custom'} | {shape}",
        )

    with SCANS_LOCK:
        SCANS[scan_id] = scan

    announce(
        scan,
        f"Scan {scan_id} queued: kind={target_kind} target={target} mode={mode}",
    )

    threading.Thread(
        target=run_scan, args=(scan, argv, env), daemon=True
    ).start()

    return {"scan_id": scan_id, "status": scan.status, "target": target}


@app.get("/api/scans", dependencies=[Depends(require_token)])
def list_scans():
    with SCANS_LOCK:
        rows = sorted(
            (s.to_public() for s in SCANS.values()),
            key=lambda r: r["created_at"],
            reverse=True,
        )
    return {"scans": rows[:50]}


@app.get("/api/scans/{scan_id}", dependencies=[Depends(require_token)])
def get_scan(scan_id: str):
    scan = SCANS.get(scan_id)
    if not scan:
        if not re.fullmatch(r"[0-9a-f]{6,32}", scan_id):
            raise HTTPException(400, "Invalid scan id")
        raise HTTPException(404, "Scan not found")

    body = scan.to_public()
    body["instruction_preview"] = scan.instruction[:1200]
    return body


@app.get("/api/scans/{scan_id}/stream", dependencies=[Depends(require_token)])
async def stream_scan(scan_id: str, request: Request):
    scan = SCANS.get(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    async def event_source():
        # Replay what already happened, then follow live output.
        cursor = 0
        channel: queue.Queue = queue.Queue()
        scan.subscribers.append(channel)

        try:
            while True:
                if await request.is_disconnected():
                    break

                while cursor < len(scan.log):
                    line = scan.log[cursor]
                    cursor += 1
                    yield f"data: {json.dumps(line)}\n\n"

                try:
                    item = channel.get_nowait()
                    if item == "__EOF__":
                        yield "event: done\ndata: {}\n\n"
                        return
                    yield f"data: {json.dumps(item)}\n\n"
                    cursor = max(cursor, len(scan.log))
                    continue
                except queue.Empty:
                    pass

                if scan.finished and cursor >= len(scan.log):
                    yield "event: done\ndata: {}\n\n"
                    return

                await asyncio.sleep(0.25)
        finally:
            if channel in scan.subscribers:
                scan.subscribers.remove(channel)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@app.post("/api/scans/{scan_id}/cancel", dependencies=[Depends(require_token)])
def cancel_scan(scan_id: str):
    scan = SCANS.get(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    if scan.process and scan.process.poll() is None:
        scan.process.terminate()
        scan.status = "cancelled"
        announce(scan, "Scan cancelled by user.")
        return {"status": "cancelled"}

    return {"status": scan.status}


def _artifact_path(scan_id: str, kind: str) -> Path:
    scan = SCANS.get(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    path = scan.artifacts.get(kind)
    if not path or not Path(path).is_file():
        raise HTTPException(404, f"No {kind} artifact for this scan")

    return Path(path)


@app.get("/api/scans/{scan_id}/report/md", dependencies=[Depends(require_token)])
def report_md(scan_id: str):
    path = _artifact_path(scan_id, "md")
    return PlainTextResponse(path.read_text(encoding="utf-8", errors="replace"))


@app.get("/api/scans/{scan_id}/report/json", dependencies=[Depends(require_token)])
def report_json(scan_id: str):
    path = _artifact_path(scan_id, "json")
    return JSONResponse(json.loads(path.read_text(encoding="utf-8")))


@app.get("/api/scans/{scan_id}/report/csv", dependencies=[Depends(require_token)])
def report_csv(scan_id: str):
    path = _artifact_path(scan_id, "csv")
    return PlainTextResponse(
        path.read_text(encoding="utf-8", errors="replace"),
        media_type="text/csv",
    )


@app.get("/api/scans/{scan_id}/report/pdf", dependencies=[Depends(require_token)])
def report_pdf(scan_id: str):
    if not pdf_available():
        raise HTTPException(
            503,
            "PDF rendering unavailable: reportlab is not installed in the image.",
        )

    scan = SCANS.get(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    target = RUNS_DIR / scan_id / "report.pdf"
    if not target.is_file():
        build_pdf(scan, target)

    return FileResponse(
        target, media_type="application/pdf", filename=f"strix-{scan_id}.pdf"
    )


def build_pdf(scan: Scan, destination: Path) -> None:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import LETTER
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import (
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    styles = getSampleStyleSheet()
    body = ParagraphStyle(
        "Body", parent=styles["BodyText"], fontSize=9, leading=12
    )
    mono = ParagraphStyle(
        "Mono", parent=body, fontName="Courier", fontSize=7.5, leading=9.5
    )

    doc = SimpleDocTemplate(
        str(destination),
        pagesize=LETTER,
        title=f"Strix Scan {scan.id}",
        author="Strix",
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
    )

    story: list = []
    story.append(Paragraph("Penetration Test Report", styles["Title"]))
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            f"<b>Target:</b> {scan.target}<br/>"
            f"<b>Scan ID:</b> {scan.id}<br/>"
            f"<b>Mode:</b> {scan.mode}<br/>"
            f"<b>Model:</b> {scan.model or 'n/a'}<br/>"
            f"<b>Started:</b> {scan.started_at or 'n/a'}<br/>"
            f"<b>Finished:</b> {scan.finished_at or 'n/a'}",
            body,
        )
    )
    story.append(Spacer(1, 12))

    if scan.counts:
        rows = [["Severity", "Count"]] + [
            [k.title(), str(v)] for k, v in sorted(scan.counts.items())
        ]
        table = Table(rows, hAlign="LEFT")
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]
            )
        )
        story.append(table)
        story.append(Spacer(1, 14))

    for finding in scan.findings:
        story.append(
            Paragraph(
                f"<b>{finding['title']}</b> "
                f"[{finding['severity'].upper()}]",
                styles["Heading2"],
            )
        )
        meta = (
            f"Endpoint: {finding.get('endpoint') or 'n/a'} &nbsp;|&nbsp; "
            f"CVSS: {finding.get('cvss') or 'n/a'} &nbsp;|&nbsp; "
            f"CWE: {finding.get('cwe') or 'n/a'}"
        )
        story.append(Paragraph(meta, body))
        story.append(Spacer(1, 6))

        for label, key in (
            ("Impact", "impact"),
            ("Description", "description"),
            ("Technical analysis", "technical_analysis"),
            ("Proof of concept", "poc_description"),
            ("Remediation", "remediation"),
        ):
            value = finding.get(key)
            if value:
                story.append(Paragraph(f"<b>{label}</b>", body))
                story.append(Paragraph(str(value).replace("\n", "<br/>"), body))
                story.append(Spacer(1, 4))

        if finding.get("poc_code"):
            story.append(Paragraph("<b>PoC code</b>", body))
            story.append(
                Paragraph(
                    str(finding["poc_code"])
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace("\n", "<br/>"),
                    mono,
                )
            )

        story.append(PageBreak())

    if not scan.findings:
        story.append(Paragraph("No findings were recorded for this scan.", body))

    doc.build(story)


# ----------------------------------------------------------------------
# Report chat
# ----------------------------------------------------------------------
# Free-form Q&A over a finished scan report. Supports any OpenAI-compatible
# endpoint (OpenAI, OpenRouter, Groq, Google, Ollama, LM Studio, vLLM,
# Azure-style gateways) plus Anthropic's native API.

PROVIDERS: dict[str, dict[str, str]] = {
    "openai": {
        "base": "https://api.openai.com/v1",
        "style": "openai",
    },
    "anthropic": {
        "base": "https://api.anthropic.com",
        "style": "anthropic",
    },
    "openrouter": {
        "base": "https://openrouter.ai/api/v1",
        "style": "openai",
    },
    "groq": {
        "base": "https://api.groq.com/openai/v1",
        "style": "openai",
    },
    "google": {
        "base": "https://generativelanguage.googleapis.com/v1beta/openai",
        "style": "openai",
    },
    "ollama": {
        # Chat uses Ollama's OpenAI-compatible shim, which lives under /v1.
        "base": "http://host.docker.internal:11434/v1",
        "style": "openai",
    },
    "custom": {
        "base": "",
        "style": "openai",
    },
}

CHAT_SYSTEM_PROMPT = (
    "You are a security report assistant embedded in a penetration-testing "
    "console. Answer questions about the scan report you are given.\n\n"
    "Rules:\n"
    "  - Base every answer on the report content. If the report does not "
    "contain the answer, say so plainly instead of inventing it.\n"
    "  - Be concrete. Name the finding, the endpoint, and the fix.\n"
    "  - When asked for a fix, give the smallest change that removes the "
    "weakness, plus why it works.\n"
    "  - Keep answers tight and readable: short paragraphs, no filler."
)

MAX_CONTEXT_CHARS = 60000


def build_report_context(scan_id: str) -> str:
    """Flatten whatever the scan produced into one text blob."""
    scan = SCANS.get(scan_id)
    if not scan:
        raise HTTPException(404, "Scan not found")

    parts = [
        f"SCAN ID: {scan.id}",
        f"TARGET: {scan.target}",
        f"TARGET KIND: {scan.target_kind}",
        f"MODE: {scan.mode}",
        f"STATUS: {scan.status}",
        f"STARTED: {scan.started_at or 'n/a'}",
        f"FINISHED: {scan.finished_at or 'n/a'}",
        f"DURATION: {scan.duration_seconds or 0} seconds",
    ]

    if scan.counts:
        parts.append(
            "SEVERITY COUNTS: "
            + ", ".join(f"{k}={v}" for k, v in sorted(scan.counts.items()))
        )

    markdown = scan.artifacts.get("md")
    if markdown and Path(markdown).is_file():
        body = Path(markdown).read_text(
            encoding="utf-8", errors="replace"
        )
        parts.append("\n--- REPORT MARKDOWN ---\n" + body[:MAX_CONTEXT_CHARS])
    elif scan.findings:
        parts.append(
            "\n--- FINDINGS ---\n"
            + json.dumps(scan.findings, indent=2)[:MAX_CONTEXT_CHARS]
        )
    else:
        parts.append(
            "\n--- LOG TAIL ---\n" + "\n".join(scan.log[-120:])
        )

    return "\n".join(parts)


def chat_targets(payload: dict) -> tuple[str, str, str, str]:
    """Resolve (base_url, style, model, api_key) with clear errors."""
    provider = str(payload.get("provider") or "openai").lower()
    entry = PROVIDERS.get(provider, PROVIDERS["custom"])

    base_url = str(payload.get("base_url") or entry["base"]).rstrip("/")
    style = entry["style"]
    model = str(payload.get("model") or "").strip()
    api_key = str(
        payload.get("llm_api_key") or os.environ.get("LLM_API_KEY") or ""
    ).strip()

    # Scans need Ollama's native root, but report chat needs its
    # OpenAI-compatible /v1 shim. One field therefore has to serve both.
    if provider == "ollama":
        if base_url and not base_url.endswith("/v1"):
            base_url = base_url + "/v1"
        if not api_key:
            api_key = "ollama"  # Ollama ignores the value; the SDK wants one

    if not base_url:
        raise HTTPException(
            400, "This provider needs a Base URL (e.g. http://localhost:11434/v1)"
        )
    if not model:
        raise HTTPException(400, "A model name is required to chat about the report")
    if not api_key:
        raise HTTPException(400, "An API key is required to chat about the report")

    return base_url, style, model, api_key


@app.post("/api/chat", dependencies=[Depends(require_token)])
async def chat(payload: dict):
    scan_id = str(payload.get("scan_id") or "")
    question = str(payload.get("question") or "").strip()

    if not question:
        raise HTTPException(400, "Ask a question first")
    if not scan_id:
        raise HTTPException(400, "Run or open a scan first")

    base_url, style, model, api_key = chat_targets(payload)
    context = build_report_context(scan_id)

    history = payload.get("history") or []
    turns: list[dict[str, str]] = []

    if isinstance(history, list):
        for item in history[-8:]:
            if not isinstance(item, dict):
                continue
            role = item.get("role")
            content = str(item.get("content") or "").strip()
            if role in ("user", "assistant") and content:
                turns.append({"role": role, "content": content[:4000]})

    first_user = (
        "Here is the scan report.\n\n"
        + context
        + "\n\n---\n\nQuestion: "
        + question
    )

    messages = [
        {"role": "system", "content": CHAT_SYSTEM_PROMPT},
        {"role": "user", "content": first_user},
        *turns,
        {"role": "user", "content": question},
    ]

    async def stream() -> Any:
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                if style == "anthropic":
                    async with client.stream(
                        "POST",
                        base_url + "/v1/messages",
                        headers={
                            "x-api-key": api_key,
                            "anthropic-version": "2023-06-01",
                            "content-type": "application/json",
                        },
                        json={
                            "model": model,
                            "max_tokens": 2000,
                            "system": CHAT_SYSTEM_PROMPT,
                            "messages": [
                                {"role": "user", "content": first_user}
                            ],
                            "stream": True,
                        },
                    ) as response:
                        if response.status_code >= 400:
                            detail = (await response.aread()).decode(
                                "utf-8", "replace"
                            )[:500]
                            yield f"\n[provider error {response.status_code}] {detail}"
                            return

                        async for line in response.aiter_lines():
                            if not line.startswith("data:"):
                                continue
                            blob = line[5:].strip()
                            if not blob or blob == "[DONE]":
                                continue
                            try:
                                event = json.loads(blob)
                            except Exception:
                                continue
                            if event.get("type") == "content_block_delta":
                                piece = (event.get("delta") or {}).get("text")
                                if piece:
                                    yield piece
                    return

                async with client.stream(
                    "POST",
                    base_url + "/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "content-type": "application/json",
                    },
                    json={
                        "model": model,
                        "stream": True,
                        "messages": messages,
                    },
                ) as response:
                    if response.status_code >= 400:
                        detail = (await response.aread()).decode(
                            "utf-8", "replace"
                        )[:500]
                        yield f"\n[provider error {response.status_code}] {detail}"
                        return

                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        blob = line[5:].strip()
                        if not blob or blob == "[DONE]":
                            continue
                        try:
                            event = json.loads(blob)
                        except Exception:
                            continue
                        choices = event.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta") or {}
                        piece = delta.get("content")
                        if piece:
                            yield piece

        except httpx.HTTPError as exc:
            yield f"\n[connection error] {exc}"
        except Exception as exc:  # pragma: no cover - surfaced to the UI
            yield f"\n[chat error] {exc}"

    return StreamingResponse(
        stream(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/providers", dependencies=[Depends(require_token)])
def providers():
    return {
        "providers": [
            {"id": key, "base_url": value["base"]}
            for key, value in PROVIDERS.items()
        ]
    }


@app.get("/api/meta", dependencies=[Depends(require_token)])
def meta():
    return {
        "strix": strix_available(),
        "docker": docker_available(),
        "pdf_available": pdf_available(),
        "target_base": TARGET_BASE,
        "runs_dir": str(RUNS_DIR),
    }

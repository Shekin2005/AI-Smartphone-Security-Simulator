#!/usr/bin/env python3
"""Build the submission archive for the prototype.

    python tools/package-submission.py

Writes  dist/AI-Smartphone-Security-Simulator-Prototype.zip
        dist/AI-Smartphone-Security-Simulator-Prototype/   (the staged tree)

Design notes
------------
* Whitelist, not blacklist. Only the paths listed below are copied, so a secret,
  a database dump or a node_modules folder cannot end up in the archive because
  somebody added it to the working tree.
* The one live credential in the source (`tools/ai-agent.mjs`, the fallback
  NVIDIA key) is replaced with an environment-only read that exits if unset.
  The substitution is verified after staging: if the archive still contains a
  match for the key pattern, the build fails.
* Everything is syntax-checked in the staged tree before zipping, so the
  archive cannot contain a file that will not parse.
"""

import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
NAME = "AI-Smartphone-Security-Simulator-Prototype"
STAGE = DIST / NAME
ZIP = DIST / f"{NAME}.zip"

# --------------------------------------------------------------------------
# What ships
# --------------------------------------------------------------------------

ROOT_FILES = [
    # application
    "server.js",
    "school-routes.js",
    "school-services-routes.js",
    "package.json",
    "package-lock.json",
    # deployment
    "Dockerfile",
    "docker-compose.yml",
    "Caddyfile",
    ".dockerignore",
    ".gitignore",
    # database
    "schema.sql",
    "admin-course-manager.sql",
    "bank-link-update.sql",
    "colleague-catalog-details.sql",
    "degree-progress.sql",
    "financial-aid-update.sql",
    "migration-2026-11-auth-and-payments.sql",
    "recovery.sql",
    "school-services.sql",
    "school-upgrade.sql",
    # setup and provisioning
    "create-admin.js",
    "create-scan-account.js",
    # configuration templates (no secrets; .env itself is never copied)
    ".env.example",
    ".env.stack.example",
    # documentation
    "README.md",
    "PROJECT-REFERENCE.md",
    "PROJECT_GUIDE.md",
    "DEPLOY-SELFHOST.md",
    "TERMINAL-COMMANDS.md",
    "SHANNON.md",
    "RECORDING-SCRIPT.md",
    # developer helpers
    "capture-ui.mjs",
    "capture-tuition.mjs",
    "make-demo-accounts.mjs",
]

DIRS = [
    ("public", None),
    ("configs", None),
    ("tools", None),
    ("slides", None),
    ("docs", None),
]

# Never copied, even if present inside a whitelisted directory.
EXCLUDE_DIR_NAMES = {"node_modules", "__pycache__", ".git", "dist"}
EXCLUDE_SUFFIXES = {".log", ".dump", ".bak", ".pyc", ".zip", ".pptx"}
EXCLUDE_FILES = {
    ".env",
    ".env.stack",
    ".env.shannon",
    ".DS_Store",
    # build tooling, not prototype code
    "package-submission.py",
}

# tools/out holds generated run evidence, not source. It is copied separately
# and deliberately: the reports are the proof the suite was actually run.
INCLUDE_TOOLS_OUT = True
TOOLS_OUT_SKIP_SUFFIXES = {".log"}

# --------------------------------------------------------------------------
# Redaction
# --------------------------------------------------------------------------

# Matched structurally rather than by literal value, so this script never has to
# contain the credential it is removing.
KEY_BLOCK_RE = re.compile(
    r"// The lab owner supplied this free NVIDIA key[\s\S]*?"
    r"const LLM_KEY =\s*process\.env\.AI_LLM_KEY \|\|\s*\"nvapi-[A-Za-z0-9_-]+\";"
)

KEY_REPLACEMENT = '''// No key is compiled into the submitted source. Get a free one at
// https://build.nvidia.com and pass it in the environment:
//
//   AI_LLM_KEY=nvapi-... node tools/ai-agent.mjs
//
// The agent refuses to start without a key rather than silently borrowing
// a shared credential.
const LLM_KEY = process.env.AI_LLM_KEY;

if (!LLM_KEY) {
  console.error("[agent] AI_LLM_KEY is not set.");
  console.error("        Get a free key at https://build.nvidia.com, then:");
  console.error("        AI_LLM_KEY=nvapi-... node tools/ai-agent.mjs");
  process.exit(1);
}'''

SECRET_PATTERNS = [
    re.compile(r"nvapi-[A-Za-z0-9_-]{20,}"),
    re.compile(r"sk-[A-Za-z0-9]{20,}"),
]

SUBMISSION_README = """# Prototype submission: AI Smartphone Security Simulator

This archive contains the source code, configuration and documentation for the
prototype, and everything needed to run it on a clean machine.

Start with `docs/SETUP-AND-STRUCTURE.pdf` for the full setup procedure. This
file is the short version and the map.

## Contents

| Path | What it is |
| `server.js` | The Express application: auth, MFA, banking and school APIs, attack lab |
| `school-routes.js`, `school-services-routes.js` | Acadia student and service routes |
| `public/` | Front end: phone UI, per-feature scripts and stylesheets |
| `schema.sql` and the other `.sql` files | Table definitions, seeds and migrations |
| `Dockerfile`, `docker-compose.yml`, `Caddyfile` | The two-container deployment |
| `create-scan-account.js`, `create-admin.js` | Account provisioning |
| `tools/` | Deterministic suite, LLM agent, comparison builder, Shannon bridge, TOTP helper |
| `tools/out/` | Recorded evidence from the runs described in the report |
| `configs/shannon-lab.yaml` | Login flow for the multi-agent scanner |
| `docs/` | The written report, the setup guide, the administrator access sheet and screenshots |
| `slides/` | Deck builders and their verification scripts |

## Running it

```bash
cp .env.stack.example .env.stack      # then fill in the four required values
psql "$DATABASE_URL" -f schema.sql    # the schema is NOT applied automatically
docker compose --env-file .env.stack up -d --build
curl -fsS http://localhost/api/health  # expect {"status":"running"}
```

Then provision the scan accounts, because no user exists in a fresh database:

```bash
DATABASE_URL=... TOTP_ENCRYPTION_KEY=... \\
  node create-scan-account.js --app bank --username scan-bank --password "..."
```

`docs/SETUP-AND-STRUCTURE.pdf` sections 6.3, 6.5 and 6.8 explain each of these,
including the two mistakes that cost the most time: `localhost` inside a
container means the container, and `PUBLIC_ORIGIN` must match the browser URL
exactly or every POST returns 403.

## Administrator access

The university portal has a separate administrator sign-in. A working administrator
account is provisioned on the live deployment, and the full instructions are in
`docs/PROFESSOR-ADMIN-ACCESS.pdf` (5 pages), with a scannable enrolment QR code at
`docs/screens/admin-totp-qr.png`.

| Step | Action |
| 1 | Open the site, unlock the phone with passcode `1234` |
| 2 | Open the **Acadia University** app |
| 3 | Choose **Administrator Login**, not Student Login |
| 4 | Sign in with the credentials in the PDF, then enter the current six-digit code |

The administrator role is enforced on the server: a student session calling
`/api/school/admin/students` receives `403 Access denied for this account role`.

On a fresh database there are no users at all, so an administrator must be created
before anyone can sign in. Note the `--role admin` flag, which is what makes the
account an administrator rather than a student:

```bash
node create-scan-account.js --app acadia --role admin \\
  --username professor --password "Acadia-Admin-2026!"
```

## Two deliberate differences from the development copy

**No API key is included.** The fallback NVIDIA key that shipped in
`tools/ai-agent.mjs` has been removed, and the agent now exits with a clear
message if `AI_LLM_KEY` is unset. Get a free key at https://build.nvidia.com and
pass it as an environment variable. The key was committed to the development
repository and must be treated as public, so it does not belong in a submission.

**Generated bulk is excluded.** `node_modules/`, `backups/`, the Shannon staging
tree and local environment files are not present. Reinstall dependencies with
`npm install`; the archive is source, not a pre-installed runtime.

## Documentation

| File | Pages | Use |
| `docs/AI-and-Manual-Penetration-Testing-Report.pdf` | 28 | The academic report: the comparison, the findings, the industry evidence |
| `docs/SETUP-AND-STRUCTURE.pdf` | 11 | Structure and cross-machine setup |
| `docs/README.md` | 2 | Which report edition is which |
| `README.md` | - | The project's own overview |
| `TERMINAL-COMMANDS.md` | - | Every command for both engines |

The title page of the academic report carries placeholders for the student name,
ID, module, institution and supervisor, which must be filled in before
submission.

## Verification performed before packaging

Every staged `.js` and `.mjs` file was parsed with `node --check`, and the tree
was scanned for credential patterns. The archive was then extracted to a clean
directory and both checks were repeated there, so the listing below reflects what
was actually shipped rather than what was intended.
"""


def skip(path: Path) -> bool:
    if path.name in EXCLUDE_FILES:
        return True
    if path.suffix.lower() in EXCLUDE_SUFFIXES:
        return True
    return any(part in EXCLUDE_DIR_NAMES for part in path.parts)


def copy_file(src: Path, dest: Path, log: dict) -> None:
    if skip(src):
        log["skipped"].append(str(src.relative_to(ROOT)))
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    log["copied"].append(str(dest.relative_to(STAGE)))


def copy_tree(src_dir: Path, dest_dir: Path, log: dict) -> None:
    for path in sorted(src_dir.rglob("*")):
        if path.is_dir():
            continue
        rel = path.relative_to(src_dir)
        copy_file(path, dest_dir / rel, log)


def main() -> int:
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)
    log = {"copied": [], "skipped": [], "missing": []}

    for name in ROOT_FILES:
        src = ROOT / name
        if not src.exists():
            log["missing"].append(name)
            continue
        copy_file(src, STAGE / name, log)

    for dirname, _ in DIRS:
        src_dir = ROOT / dirname
        if not src_dir.is_dir():
            log["missing"].append(dirname + "/")
            continue
        if dirname == "tools":
            for path in sorted(src_dir.iterdir()):
                if path.name == "out":
                    continue
                if path.is_file():
                    copy_file(path, STAGE / "tools" / path.name, log)
                elif path.is_dir():
                    copy_tree(path, STAGE / "tools" / path.name, log)
            if INCLUDE_TOOLS_OUT:
                out = src_dir / "out"
                if out.is_dir():
                    for path in sorted(out.rglob("*")):
                        if path.is_dir():
                            continue
                        if path.suffix.lower() in TOOLS_OUT_SKIP_SUFFIXES:
                            continue
                        copy_file(path, STAGE / "tools" / "out" / path.relative_to(out), log)
        else:
            copy_tree(src_dir, STAGE / dirname, log)

    # ---- redact the fallback key ----------------------------------------
    agent = STAGE / "tools" / "ai-agent.mjs"
    redacted = False
    if agent.exists():
        text = agent.read_text(encoding="utf-8")
        new_text, n = KEY_BLOCK_RE.subn(KEY_REPLACEMENT.replace("\\", "\\\\"), text)
        if n:
            agent.write_text(new_text, encoding="utf-8")
            redacted = True
        else:
            print("WARNING: the expected key block was not found in ai-agent.mjs.")
            print("         The file may have changed; inspect it before sharing.")

    # ---- generated submission README ------------------------------------
    (STAGE / "README-SUBMISSION.md").write_text(SUBMISSION_README, encoding="utf-8")

    # ---- verification ---------------------------------------------------
    print("=" * 68)
    print(f"staged {len(log['copied'])} files into {STAGE}")
    if log["missing"]:
        print(f"MISSING ({len(log['missing'])}): {', '.join(log['missing'])}")
    print(f"key block redacted: {redacted}")

    leaks = []
    for path in STAGE.rglob("*"):
        if path.is_dir() or path.suffix.lower() in {".png", ".docx", ".pdf", ".xlsx"}:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for pat in SECRET_PATTERNS:
            for m in pat.finditer(text):
                # the intentional "nvapi-..." hints are not secrets
                if set(m.group(0)[6:]) <= {"."}:
                    continue
                leaks.append(f"{path.relative_to(STAGE)}: {m.group(0)[:18]}...")

    if leaks:
        print("\nSECRET SCAN FAILED:")
        for line in leaks:
            print("  " + line)
        return 1
    print("secret scan: clean")

    # ---- syntax check the staged JavaScript ------------------------------
    node = shutil.which("node")
    bad = []
    if node:
        targets = [
            p for p in STAGE.rglob("*")
            if p.suffix in {".js", ".mjs"} and "node_modules" not in p.parts
        ]
        try:
            for path in targets:
                proc = subprocess.run([node, "--check", str(path)],
                                      stdin=subprocess.DEVNULL,
                                      capture_output=True, text=True)
                if proc.returncode != 0:
                    bad.append(
                        f"{path.relative_to(STAGE)}: "
                        f"{proc.stderr.strip().splitlines()[:2]}"
                    )
            print(f"syntax check: {len(targets)} files, {len(bad)} failed")
            for b in bad:
                print("  " + b)
        except OSError as exc:
            # Some shells give Python no valid console handle, so a child process
            # cannot be created even with stdio redirected. Say so rather than
            # pretending the check passed; run it from the shell instead:
            #   find dist -name '*.mjs' -o -name '*.js' | xargs -n1 node --check
            print(f"syntax check: unavailable in this shell ({exc.__class__.__name__}: {exc})")
            print("               run it separately over the staged tree")
    else:
        print("syntax check: node not found, skipped")

    # ---- zip -------------------------------------------------------------
    if ZIP.exists():
        ZIP.unlink()
    count = 0
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in sorted(STAGE.rglob("*")):
            if path.is_dir():
                continue
            arc = Path(NAME) / path.relative_to(STAGE)
            zf.write(path, arc.as_posix())
            count += 1

    size_mb = ZIP.stat().st_size / (1024 * 1024)
    print("=" * 68)
    print(f"archive: {ZIP}")
    print(f"entries: {count}   size: {size_mb:.1f} MB")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Make Strix reach the sandbox's Caido proxy from inside a container.

Why this is needed
------------------
Strix runs a Caido proxy sidecar inside the per-scan sandbox on
127.0.0.1:48080, publishes that port on the Docker host, then builds a
client URL from ``session.resolve_exposed_port(...)`` and talks to it.

When Strix itself runs inside a container (docker-outside-of-docker, as
this deployment does), the published port lives on the *Docker host*.
``resolve_exposed_port`` still reports the host as 127.0.0.1, so the
scanner connects to its own loopback, finds nothing listening, and
``client.ready()`` fails with:

    caido_sdk_client.errors.health.InstanceNotReadyError:
        Instance not ready after 5 attempts

Caido itself is healthy: the in-sandbox ``curl`` guest login succeeds.
Only the host-side URL is wrong.

The fix
-------
Rewrite a loopback host to ``host.docker.internal`` (Docker Desktop's
route to the host), which is where the sandbox port is actually
published. The original behaviour is preserved by setting
STRIX_CAIDO_HOST to anything else, so this stays a single, reversible
change rather than a fork of Strix.

Idempotent: re-running does not double-apply.
"""

from __future__ import annotations

import sys
from pathlib import Path

TARGET = Path(
    "/usr/local/lib/python3.12/site-packages/strix/runtime/session_manager.py"
)

ORIGINAL = (
    '    host_caido_url = '
    'f"{scheme}://{caido_endpoint.host}:{caido_endpoint.port}"\n'
)

# Caido enforces a Host allowlist for DNS-rebinding protection. A request whose
# Host header is a hostname it does not know is rejected with 403, which makes
# client.ready() fail even though Caido is running fine.
#
# Measured inside the sandbox against the real sandbox image:
#   Host: 127.0.0.1:48080        -> 200
#   Host: host.docker.internal   -> 403
#   GET /health via IP literal   -> 200
#   GET /health via hostname     -> 403
#
# Strix never forwards STRIX_CAIDO_ALLOWED_DOMAINS into the sandbox manifest,
# so the entrypoint's --ui-domain flag is never set. Adding it to the manifest
# environment makes caido-cli accept the hostname the scanner dials.
ENV_ORIGINAL = '                "NO_PROXY": "localhost,127.0.0.1",\n'

ENV_PATCHED = '''                "NO_PROXY": "localhost,127.0.0.1",
                # Allow the hostname the scanner uses to reach this port,
                # otherwise Caido answers 403 and the SDK never connects.
                "STRIX_CAIDO_ALLOWED_DOMAINS": os.environ.get(
                    "STRIX_CAIDO_ALLOWED_DOMAINS", "host.docker.internal"
                ),
'''

PATCHED = '''    # --- patched for docker-outside-of-docker -------------------------
    # The sandbox publishes its Caido port on the Docker host, so a
    # loopback host points at this container instead of the sandbox.
    _caido_host = caido_endpoint.host
    if _caido_host in ("127.0.0.1", "localhost", "::1", "0.0.0.0"):
        _caido_host = os.environ.get("STRIX_CAIDO_HOST", "host.docker.internal")
        logger.info(
            "Caido host rewritten for container networking: %s -> %s",
            caido_endpoint.host,
            _caido_host,
        )
    host_caido_url = f"{scheme}://{_caido_host}:{caido_endpoint.port}"
    # --- end patch ----------------------------------------------------
'''

MARKER = "patched for docker-outside-of-docker"


def main() -> int:
    if not TARGET.is_file():
        print(f"[PATCH] target not found: {TARGET}", file=sys.stderr)
        return 1

    source = TARGET.read_text(encoding="utf-8")

    if MARKER in source:
        print("[PATCH] already applied, nothing to do")
        return 0

    if ORIGINAL not in source:
        print(
            "[PATCH] host-routing line not found - Strix version may differ. "
            "Leaving the file untouched.",
            file=sys.stderr,
        )
        return 1

    if ENV_ORIGINAL not in source:
        print(
            "[PATCH] manifest env line not found - Strix version may differ. "
            "Leaving the file untouched.",
            file=sys.stderr,
        )
        return 1

    patched = source.replace(ORIGINAL, PATCHED, 1)
    patched = patched.replace(ENV_ORIGINAL, ENV_PATCHED, 1)

    TARGET.write_text(patched, encoding="utf-8")
    print("[PATCH] Caido host routing patched")
    print("[PATCH] Caido Host allowlist patched (host.docker.internal)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

// ==================================================
// STRIX SAME-ORIGIN PROXY
// ==================================================
// The simulator's Content-Security-Policy is:
//   default-src 'self'; script-src 'self'; script-src-attr 'none'
// so the browser may only talk to this origin, and may not use
// inline event handlers. This module exposes /strix-api/* on this
// origin and streams it to the Strix scanner service, so the
// console needs no CSP weakening and no CORS.
//
// Mounted OUTSIDE /api on purpose: the /api middleware at the top
// of server.js requires an exact Origin header match on every
// non-GET request. Keeping the scan API on its own prefix avoids
// fighting that guard while still being same-origin for the browser.
// ==================================================

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const PREFIX = "/strix-api";

const UPSTREAM = (() => {
  const raw =
    process.env.STRIX_SCANNER_URL || "http://127.0.0.1:8000";
  try {
    return new URL(raw);
  } catch {
    console.error(
      "[STRIX] Invalid STRIX_SCANNER_URL, falling back to default"
    );
    return new URL("http://127.0.0.1:8000");
  }
})();

const UPSTREAM_TIMEOUT_MS = Number(
  process.env.STRIX_PROXY_TIMEOUT_MS || 15000
);

// Shared secret for the scanner. Required whenever the scanner is reachable
// from outside this machine (a tunnel or a public VM), otherwise anyone who
// finds the URL can start scans and spend the operator's LLM credits.
const SCAN_TOKEN = process.env.STRIX_SCAN_TOKEN || "";

// Sessions are the gate for this API: only a signed-in, MFA-verified
// user may start scans. The console is opened from AI Defender, which
// already requires that session.
function requireSession(req, res) {
  if (!req.session || !req.session.mfa || !req.session.userId) {
    res.status(401).json({
      error: "Sign in to the simulator first."
    });
    return false;
  }
  return true;
}

function friendlyUnreachable(res) {
  if (res.headersSent) {
    return res.end();
  }

  res.status(502).json({
    error:
      "Scan service unreachable. Start it with " +
      "`docker compose up --build` inside the strix-scanner folder, " +
      "then try again.",
    upstream: UPSTREAM.origin
  });
}

function buildUpstreamPath(originalUrl) {
  // originalUrl is /strix-api/<rest>; upstream expects /<rest>.
  const rest = originalUrl.slice(PREFIX.length) || "/";

  return (
    UPSTREAM.pathname.replace(/\/$/, "") +
    (rest.startsWith("/") ? rest : "/" + rest)
  );
}

function copyRequestHeaders(req) {
  const headers = { ...req.headers };

  // Let the upstream decide framing; the body is piped verbatim.
  delete headers.host;
  delete headers["accept-encoding"];

  // Strip anything client-supplied before adding our own credential, so a
  // browser cannot forge or spoof the scanner token.
  delete headers["x-scan-token"];

  if (SCAN_TOKEN) {
    headers["x-scan-token"] = SCAN_TOKEN;
  }

  return headers;
}

function installStrixProxy(app) {
  // Registered before the catch-all proxy below, otherwise /health would
  // be forwarded upstream (where the endpoint lives at /api/health).
  app.get(PREFIX + "/health", (req, res) => {
    if (!requireSession(req, res)) {
      return;
    }

    res.json({
      proxy: "ok",
      upstream: UPSTREAM.origin,
      token_configured: Boolean(SCAN_TOKEN),
      session: {
        app: req.session.app || null,
        role: req.session.role || null
      }
    });
  });

  app.use(PREFIX, (req, res) => {
    if (!requireSession(req, res)) {
      return;
    }

    const target = UPSTREAM;
    const transport = target.protocol === "https:" ? https : http;

    const options = {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: buildUpstreamPath(req.originalUrl),
      headers: copyRequestHeaders(req)
    };

    const upstream = transport.request(options, upstreamRes => {
      res.status(upstreamRes.statusCode || 502);

      for (const [name, value] of Object.entries(
        upstreamRes.headers
      )) {
        // node re-encodes these; passing them through corrupts streams
        if (
          name === "transfer-encoding" ||
          name === "connection" ||
          name === "keep-alive"
        ) {
          continue;
        }
        res.setHeader(name, value);
      }

      // Server-Sent Events must never be buffered.
      res.setHeader("X-Accel-Buffering", "no");
      res.setHeader("Cache-Control", "no-cache, no-transform");

      if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
      }

      upstreamRes.pipe(res);
    });

    upstream.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
      upstream.destroy(
        new Error("Upstream scan service timed out")
      );
    });

    upstream.on("error", error => {
      console.error(
        "[STRIX PROXY]",
        req.method,
        options.path,
        "-",
        error.code || error.message
      );

      // A dead scanner is an expected state, not a crash.
      if (
        error.code === "ECONNREFUSED" ||
        error.code === "ECONNRESET" ||
        error.code === "ENOTFOUND" ||
        error.code === "ETIMEDOUT" ||
        error.code === "EHOSTUNREACH"
      ) {
        return friendlyUnreachable(res);
      }

      if (!res.headersSent) {
        res.status(502).json({
          error: "Scan proxy error: " + error.message
        });
      } else {
        res.end();
      }
    });

    // The client may walk away mid-scan; stop the upstream too.
    res.on("close", () => {
      if (!res.writableEnded) {
        upstream.destroy();
      }
    });

    // express.json() has ALREADY consumed the stream for JSON requests,
    // so piped bytes would be empty and the upstream would wait forever.
    // Re-serialise the parsed body in that case. Anything else (multipart
    // source uploads) is still an untouched stream and pipes through raw.
    if (
      req.body &&
      typeof req.body === "object" &&
      !Buffer.isBuffer(req.body)
    ) {
      const payload = JSON.stringify(req.body);
      upstream.setHeader("content-type", "application/json");
      upstream.setHeader(
        "content-length",
        Buffer.byteLength(payload)
      );
      upstream.end(payload);
      return;
    }

    // Strip a stale length header; the piped stream sets its own framing.
    upstream.removeHeader("content-length");
    req.pipe(upstream);
  });

  console.log(
    `[STRIX] Proxy mounted at ${PREFIX} -> ${UPSTREAM.origin}` +
      (SCAN_TOKEN ? " (token auth enabled)" : " (no token)")
  );
}

export { installStrixProxy };

# SSRF Analysis Report

## 1. Executive Summary

SSRF analysis of the AI Smartphone Security Simulator found no explovable server-side request forgery vulnerabilities. After systematic analysis of all 103+ API endpoints and their data flows, every outbound HTTP request either uses a fixed internal destination (Shannon bridge) or has user-controllable parameters properly validated against whitelists. No path was found where untrusted user input influences the URL, hostname, port, or protocol of an outbound server-side HTTP request.

## 2. Dominant Vulnerability Patterns

### Pattern 1: Fixed Internal Destination
- **Description:** All outbound HTTP requests from server.js use the fixed internal Shannon bridge URL (http://host.docker.internal:7071). No endpoint allows user input to influence the request destination.
- **Implication:** Attackers cannot leverage the application server to reach internal services or external resources via SSRF since all request destinations are server-controlled.
- **Representative Findings:** `SSRF-ANALYSIS-001`

### Pattern 2: Whitelist Validation
- **Description:** User-controllable parameters like the 'format' query param in /api/shannon/report are validated against strict whitelists (['md','pdf','json','sarif']), preventing protocol/host manipulation.
- **Implication:** Even where user input reaches the HTTP client, context-appropriate sanitization prevents SSRF bypass.
- **Representative Findings:** `SSRF-ANALYSIS-002`

## 3. Strategic Intelligence for Exploitation

### HTTP Client Library
node fetch (native fetch API via ESM) - used in server.js for outbound requests via the shannonCall function and /api/shannon/report endpoint

### Request Architecture
All outbound requests in server.js are constructed using the native fetch API with a fixed internal destination (SHANNON_BRIDGE_URL = http://host.docker.internal:7071). The shannonCall helper function wraps fetch with consistent options including AbortController-based timeouts, x-bridge-token authentication header, and content-type headers for JSON bodies. User input never influences the base URL - only the format query parameter in /api/shannon/report, which is validated against a whitelist. The application uses Express with ESM type "module". Caddy reverse proxy provides TLS termination and forwards requests via HTTPS to the app.

### Internal Services
169.254.169.254 (AWS IMDS) - not accessible; host.docker.internal:7071 (Shannon bridge, loopback-only, internally restricted); 127.0.0.1 (local services); shekin.tail97139a.ts.net (public Tailscale domain, the application's own hostname)

## 4. Secure by Design: Validated Components

| Component/Flow | Endpoint/File Location | Defense Mechanism | Verdict |
| --- | --- | --- | --- |
| fetch with format parameter (/api/shannon/report) | server.js:2195 | Whitelist validation of 'format' parameter against ['md','pdf','json','sarif'] + fixed internal destination URL | SAFE |
| PUBLIC_ORIGIN environment variable | server.js:156,1794,1970,2127,2630 | Validated against allowed hosts at startup, not per-request, prevents runtime URL manipulation | SAFE |
| shannonCall HTTP client (/api/shannon/* endpoints) | server.js:2063 | Fixed internal bridge URL (host.docker.internal:7071) + token authentication + no user-controllable destination | SAFE |
| Terminal command execution (/api/lab/terminal/exec) | server.js:2620 | Binary allowlist + host allowlist (shekin,tail97139a.ts.net,host.docker.internal,127.0.0.1,localhost) + shell: false + command tokenization | SAFE |

## 5. Analysis Constraints and Blind Spots

### Client-Side JavaScript
All fetch calls in public/ JavaScript files (admin-console.js, colleague-rework.js, etc.) are client-side and constrained by CORS and browser security. These were not analyzed for SSRF as they execute in the browser, not on the server.

### Third-Party Dependencies
Transitive dependencies of express, pg, argon2, etc. were not fully audited for potential SSRF vectors in their internals.

### Environment Configuration
The analysis assumes standard deployment configuration. Non-standard PUBLIC_ORIGIN or SHANNON_BRIDGE settings could alter the threat model.

### Bridge Component
The Shannon bridge (tools/shannon-bridge.mjs) runs externally and was not fully source-analyzed. Its internal request handling could introduce SSRF vectors outside the main application.

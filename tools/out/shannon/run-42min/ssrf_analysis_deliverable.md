# SSRF Analysis Report

## 1. Executive Summary

Analysis of all identified SSRF sinks in the Shannon-Target application revealed no exploitable vulnerabilities where untrusted user input reaches outbound server-side HTTP requests. The two sinks identified (shannonCall bridge API caller and fetch with format query parameter) both have context-appropriate sanitization: shannonCall has hardcoded pathnames in all routes and the bridge enforces ALLOWED_HOSTS restrictions; the fetch endpoint validates format against a strict whitelist of four values, defaulting to "md" for invalid inputs.

## 2. Dominant Vulnerability Patterns

*No dominant patterns identified.*

## 3. Strategic Intelligence for Exploitation

### HTTP Client Library
Node.js built-in fetch (used via shannonCall function and direct fetch calls). The shannonCall function at server.js:2094 uses fetch with pathname appended to SHANNON_BRIDGE_URL (http://host.docker.internal:7071). The /api/shannon/report endpoint at server.js:2226 uses fetch with format query parameter.

### Request Architecture
Outbound requests are constructed by appending the pathname parameter to SHANNON_BRIDGE_URL (http://host.docker.internal:7071) in the shannonCall function. The /api/shannon/report endpoint constructs URLs as ${SHANNON_BRIDGE_URL}/report?format= where format is a validated query parameter. The Shannon bridge (separate Windows process) independently validates target hosts against ALLOWED_HOSTS set (shekin.tail97139a.ts.net, host.docker.internal, 127.0.0.1, localhost) and requires x-bridge-token authentication. All callers of shannonCall hardcode the pathname — no route passes user-controlled data as the pathname. The /api/shannon/report format parameter is validated against whitelist ["md","pdf","json","sarif"] before URL construction.

### Internal Services
The Shannon bridge at host.docker.internal:7071 (loopback-only, requires x-bridge-token). The application itself at https://shekin.tail97139a.tsnet. Internal PostgreSQL database accessible via DATABASE_URL env var. The bridge ALLOWED_HOSTS includes shekin.tail97139a.ts.net, host.docker.internal, 127.0.0.1, and localhost.

## 4. Secure by Design: Validated Components

| Component/Flow | Endpoint/File Location | Defense Mechanism | Verdict |
| --- | --- | --- | --- |
| /api/shannon/* health/status/stop routes (server.js:2135,2173,2201) | server.js:2135,2173,2201 | All pathnames hardcoded with no user input; offset/log parameters serve internal purposes only | SAFE |
| /api/shannon/logs route (server.js:2186) | server.js:2186 | Offset query parameter used only for pagination in bridge path (/logs?offset=); no user-controlled destination URL reached | SAFE |
| /api/shannon/start route (server.js:2147) | server.js:2147 | Profile parameter validated against whitelist ["validate","pipeline","full"]; target URL sourced from PUBLIC_ORIGIN env var (not user-controllable); req.body.url read but never used in shannonCall body | SAFE |
| fetch format parameter in /api/shannon/report (server.js:2226) | server.js:2226 | Format query parameter validated against strict whitelist ["md","pdf","json","sarif"]; invalid formats default to "md"; URL always routes to bridge only | SAFE |
| shannonCall bridge API caller (server.js:2094) | server.js:2094 | Hardcoded pathnames in all 5 caller routes; bridge enforces ALLOWED_HOSTS restrictions (shekin.tail97139a.ts.net, host.docker.internal, 127.0.0.1, localhost) and requires x-bridge-token | SAFE |

## 5. Analysis Constraints and Blind Spots

### Bridge Internal Behavior
The Shannon bridge (separate Windows process) has its own SSRF protections including ALLOWED_HOSTS validation and x-bridge-token requirement. The full logic of the bridge could not be completely traced within the containerized analysis environment, representing a minor gap in end-to-end verification.

### PUBLIC_ORIGIN Environment Variable Scope
The PUBLIC_ORIGIN env var defaults to https://shekin.tail97139a.ts.net but could theoretically be set to a different value at container startup. While not exploitable via user input during a running session, this represents a potential configuration-level SSRF surface if container deployment is compromised.

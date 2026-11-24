# Penetration Test Scope & Boundaries

**Primary Directive:** Your analysis is strictly limited to the **network-accessible attack surface** of the application. All subsequent tasks must adhere to this scope. Before reporting any finding (e.g., an entry point, a vulnerability sink), you must first verify it meets the "In-Scope" criteria.

### In-Scope: Network-Reachable Components
A component is considered **in-scope** if its execution can be initiated, directly or indirectly, by a network request that the deployed application server is capable of receiving. This includes:
- Publicly exposed web pages and API endpoints.
- Endpoints requiring authentication via the application's standard login mechanisms.
- Any developer utility, debug console, or script that has been mistakenly exposed through a route or is otherwise callable from other in-scope, network-reachable code.

### Out-of-Scope: Locally Executable Only
A component is **out-of-scope** if it **cannot** be invoked through the running application's network interface and requires an execution context completely external to the application's request-response cycle. This includes tools that must be run via:
- A command-line interface (e.g., `go run ./cmd/...`, `python scripts/...`).
- A development environment's internal tooling (e.g., a "run script" button in an IDE).
- CI/CD pipeline scripts or build tools (e.g., Dagger build definitions).
- Database migration scripts, backup tools, or maintenance utilities.
- Local development servers, test harnesses, or debugging utilities.
- Static files or scripts that require manual opening in a browser (not served by the application).
---

## 1. Executive Summary

The AI Smartphone Security Simulator is a single-tenant monolithic Node.js/Express training application deployed via Docker compose with Caddy reverse proxy and Tailscale Funnel for public HTTPS. It implements defense-in-depth: Argon2id password hashing, AES-256-GCM encrypted TOTP secrets, PostgreSQL-backed sessions with httpOnly/sameSiteStrict/secure cookies, Helmet security headers, rate limiting on auth endpoints, and origin-based CSRF protection. Known deliberate vulnerabilities include IDOR in bank endpoints (e.g., /api/bank/accounts/:id allows reading other users' data via identifier enumeration) and an opt-in SQL injection lab (/api/lab/exploit/sqli) bounded by BEGIN READ ONLY + MATERIALIZED CTE. The 75+ API endpoints are mostly authenticated (MFA + app role), with 6 public endpoints. No JWTs are used; authentication is cookie-session based. All secrets (SESSION_SECRET, TOTP_ENCRYPTION_KEY) are env-sourced, gitignored, and validated on startup. Overall security posture is B-: strong crypto and headers, good session protection, but deliberate teaching-focused attack surfaces.

## 2. Architecture & Technology Stack

- **Framework & Language:** Node.js 22 + Express 5.3.0
- **Architectural Pattern:** Monolithic Express in Docker
- **Critical Security Components:** Argon2id, AES-256-GCM, Helmet, session guards

## 3. Authentication & Authorization Deep Dive

- **Authentication Mechanisms:** "POST /api/auth/register (argon2 hash, auto-role), POST /api/auth/login (argon2 verify, MFA pending session), POST /api/auth/enroll (TOTP secret + QR code), POST /api/auth/verify (6-digit TOTP validation, sets req.session.mfa), GET /api/auth/me (auth status), POST /api/auth/logout (destroy session, clear sim.sid cookie). No JWTs; cookie-session based with PostgreSQL store."
- **Session Management:** "Cookie flags at server.js:113-117: httpOnly: true, sameSite: 'strict', secure (prod only), maxAge 15min. Session rotation via regenerate() (server.js:346) enabled by rolling: true. PostgreSQL store (server.js:21-27). Helpers: saveSession (server.js:334), regenerate (server.js:346). Session data: mfa, role, app, userId, pendingId/pendingApp/pendingUntil, enrollmentSecret. Lockout: 3 failed attempts → locked_until = now + 30s (server.js:418-430)."
- **Authorization Model:** "Session-role based with app scoping. req.session.app ('bank'|'acadia') gates cross-domain access; all bank queries add AND u.role='bank_user'. requireAcadiaRole('student'|'admin') middleware (server.js:301) enforces req.session.mfa, req.session.userId, and req.session.role. Role assignment: bank → bank_user; acadia admin → admin; otherwise student. No JWT scopes or OAuth permissions. Role mismatches → 403."
- **Multi-tenancy:** "Single-tenant with logical domain separation via 'app' column ('bank' vs 'acadia'). All data queries scope by u.app = req.session.app preventing cross-app access. No true multi-tenancy (no tenant IDs, no per-tenant schemas); app column is sole separation mechanism within shared PostgreSQL instance."
- **SSO/OAuth/OIDC Flows:** none

## 4. Data Security & Storage

- **Database Security:** PostgreSQL
- **Data Flow Security:** Argon2 + AES-256-GCM
- **Multi-tenant Data Isolation:** app-column scoping

## 5. Attack Surface Analysis

- **External Entry Points:** /api/auth routes
- **Internal Service Communication:** Shannon bridge
- **Input Validation Patterns:** Username/password regex
- **Background Processing:** No background jobs

## 6. Infrastructure & Operational Security

- **Secrets Management:** ENV vars
- **Configuration Security:** Caddy + Helmet
- **External Dependencies:** express, argon2, pg
- **Monitoring & Logging:** security_events table

## 7. Overall Codebase Indexing

Root directory /repos/.shannon-target/ contains: server.js (main Express ~79KB, all routes/auth/logic), package.json (dependencies, engines, scripts), Dockerfile (multi-stage build), docker-compose.yml (sim-app + sim-caddy), Caddyfile (TLS termination), schema.sql (121 lines, 31-table PostgreSQL), .gitignore (node_modules, .env, backups), TERMINAL-COMMANDS.md (61KB attack lab reference), PROJECT-REFERENCE.md (25KB), PROJECT_GUIDE.md (15KB). Top-level scripts: create-admin.js, create-scan-account.js, migration-2026-11-auth-and-payments.sql. tools/ directory: ai-agent.mjs (3-tool in-container agent), compare-engines.mjs, pentest-suite.mjs (12 fixed checks), shannon-bridge.mjs (6 bridge endpoints), shannon-models.json. public/ frontend: index.html, app.js, admin-console.js, colleague-rework.js, shannon-panel.js, school-services.js, school-upgrade.js, attack-lab-terminal.js, and CSS files. Key conventions: ESM ("type": "module"), Helmet on every response, express-session with PG store, argon2 password hashing, speakeasy TOTP, AES-256-GCM for MFA secrets. Build orchestration via Docker compose; no separate frontend/backend repos."

## 8. Critical File Paths

- **Configuration:** `Caddyfile`, `docker-compose.yml`, `Dockerfile`, `package.json`, `.env.stack.example`, `schema.sql`
- **Authentication & Authorization:** `server.js (auth endpoints + session middleware, lines 362-893)`, `school-routes.js (requireAcadiaRole + student/admin routes)`, `create-admin.js (admin account creation with argon2)`, `create-scan-account.js (TOTP setup script)`
- **API & Routing:** `server.js (all /api routes definitions, line 362+)`, `school-routes.js (installed routes with role guards)`, `school-services-routes.js (Acadia payment endpoints)`
- **Data Models & DB Interaction:** `schema.sql (31-table PostgreSQL with role column, password_hash, totp_secret)`, `migration-2026-11-auth-and-payments.sql (adds role column + defaults)`, `server.js embedded queries for users, bank_accounts, bank_transfers, tuition_payments`
- **Dependency Manifests:** `package.json (express 5.3.0, helmet 8.3.0, argon2 0.45.1, speakeasy, qrcode, pg, connect-pg-simple, express-rate-limit)`
- **Sensitive Data & Secrets Handling:** `server.js (argon2 at lines 387-388, 565; AES-256-GCM at lines 71-96; TOTP_ENCRYPTION_KEY and SESSION_SECRET env var validation at lines 10-52)`, `.env (gitignored, contains DATABASE_URL, SESSION_SECRET, TOTP_ENCRYPTION_KEY, PUBLIC_ORIGIN)`
- **Middleware & Input Validation:** `server.js (helmet line 91, rate-limit line 185, origin guard lines 55-80, body size limit line 92, input validation regexes lines 62-77)`, `public/admin-console.js and public/colleague-rework.js client-side validation`
- **Logging & Monitoring:** `server.js (security_events table, logEventInBackground function)`, `TERMINAL-COMMANDS.md (attack lab command reference)`
- **Infrastructure & Deployment:** `Caddyfile (TLS termination, X-Forwarded-Proto https)`, `docker-compose.yml (sim-app + sim-caddy orchestration, private web network)`, `Dockerfile (multi-stage build, tini process manager)`

## 9. XSS Sinks and Render Contexts

### HTML Body Context
- **innerHTML** at `public/admin-console.js:58`
- **innerHTML** at `public/admin-console.js:62`
- **innerHTML** at `public/admin-console.js:63`
- **innerHTML** at `public/admin-console.js:64`
- **innerHTML** at `public/admin-console.js:91`
- **innerHTML** at `public/admin-console.js:106`
- **innerHTML** at `public/colleague-rework.js:22`

### HTML Attribute Context
*(scanned, no sinks of this kind found)*

### JavaScript Context
*(scanned, no sinks of this kind found)*

### CSS Context
*(scanned, no sinks of this kind found)*

### URL Context
*(scanned, no sinks of this kind found)*

## 10. SSRF Sinks

### HTTP(S) Clients
- **fetch with user-controllable URL** at `server.js:2110`
- **fetch with format parameter** at `server.js:2196`

### Raw Sockets & Connect APIs
*(scanned, no sinks of this kind found)*

### URL Openers & File Includes
*(scanned, no sinks of this kind found)*

### Redirect & "Next URL" Handlers
*(scanned, no sinks of this kind found)*

### Headless Browsers & Render Engines
*(scanned, no sinks of this kind found)*

### Media Processors
*(scanned, no sinks of this kind found)*

### Link Preview & Unfurlers
*(scanned, no sinks of this kind found)*

### Webhook Testers & Callback Verifiers
*(scanned, no sinks of this kind found)*

### SSO/OIDC Discovery & JWKS Fetchers
*(scanned, no sinks of this kind found)*

### Importers & Data Loaders
*(scanned, no sinks of this kind found)*

### Package/Plugin/Theme Installers
*(scanned, no sinks of this kind found)*

### Monitoring & Health Check Frameworks
*(scanned, no sinks of this kind found)*

### Cloud Metadata Helpers
*(scanned, no sinks of this kind found)*

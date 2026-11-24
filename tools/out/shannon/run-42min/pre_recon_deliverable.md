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

The Shannon-Target application is a Node.js/Express monolith serving a simulated university-banking environment, deployed as a single Docker container with PostgreSQL and fronted by Caddy reverse-proxy. The architecture employs defense-in-depth: Helmet HTTP headers, argon2id password hashing, TOTP-based MFA with AES-256-GCM encrypted secrets, SameSite=strict/secure session cookies, per-account rate limiting, and origin-validation CSRF guards. The codebase is intentionally hardened yet contains several deliberately vulnerable endpoints for penetration testing purposes. The attack surface is concentrated on /api routes spanning banking operations (account transfers, recipient management, tuition payments), academic management (course enrollment, grade posting, attendance), and a controlled SQL injection lab endpoint. Critical trust boundaries exist between public auth endpoints and role-restricted banking/academic APIs, and between student and admin roles within the Acadia subsystem. While cryptographic implementations (argon2, AES-256-GCM) and session management are well-executed, the application's most significant risks stem from input validation gaps that enable cross-site scripting via innerHTML in the admin console, server-side command execution through a ?cmd= query parameter, and the deliberately vulnerable SQL injection demo. IDOR (Insecure Direct Object Reference) vulnerabilities are present in banking and tuition APIs where user-supplied identifiers can be manipulated to access unauthorized records. The overall security posture is "hardened with intentional gaps" — suitable as a security learning lab, but with real-world attack paths that a disciplined penetration test can exploit.

## 2. Architecture & Technology Stack

- **Framework & Language:** Node.js (ES-module runtime) with Express 4.x framework running as a monolithic single-process application. All API routes register on one Express app instance. PostgreSQL accessed via pg.Pool with connection pooling. No microservices or separate processes. Security implications: Single process means a single compromised route can affect the entire application; no network isolation between domains. The ES-module syntax and modern dependency set (argon2, speakeasy, helmet) indicate a contemporary stack, but the monolithic pattern concentrates attack surface.
- **Architectural Pattern:** Monolith with unified Express entry point. All functional domains (banking, academics, security lab, AI agent) co-located in same process, separated logically by route prefixes (/api/bank, /api/acadia, /api/school, /api/auth) and middleware guards. Trust boundaries enforced via requireApp() and requireAcadiaRole() middleware. No service mesh, no inter-process communication beyond direct PostgreSQL access. Database is shared across all domains, requiring application-level isolation.
- **Critical Security Components:** 1. Session management: express-session with connect-pg-simple (PostgreSQL-based session store), cookie flags (httpOnly, sameSite='strict', secure in prod). 2. Password hashing: argon2id via argon2 package. 3. MFA: TOTP with speakeasy, secrets AES-256-GCM encrypted at rest. 4. HTTP hardening: helmet middleware (CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy). 5. Origin CSRF guard: custom middleware validating Origin header on non-GET requests. 6. Rate limiting: per-account bucket (30/15min) with locked_until after failures. 7. Account lockout: locked_until column (30s after 2-3 failures).

## 3. Authentication & Authorization Deep Dive

- **Authentication Mechanisms:** "The application uses session-based authentication with TOTP MFA. Exhaustive API endpoints: 1) POST /api/auth/register — registers new user with username/password (argon2 hashed), sets totp_enabled=false. 2) POST /api/auth/login — verifies password via argon2, returns {next: 'verify' if totp_enabled else 'enroll'}. 3) GET /api/auth/me — returns current session auth status (userId, app, role, totp_enabled). 4) POST /api/auth/verify — verifies TOTP code via speakeasy (window=1, ±30s), establishes MFA-authenticated session, sets locked_until on 3 failures. 5) POST /api/auth/enroll — generates base32 TOTP secret, encrypts with AES-256-GCM, stores encrypted blob in totp_secret column, returns QR code data URL. 6) POST /api/auth/logout — destroys session (req.session.destroy). Account lockout: 2 failed DB login attempts set locked_until (30s); 3 MFA failures set locked_until (30s). Password policy: 12-128 characters during registration. No OAuth, OpenID Connect, or third-party identity providers. All endpoints are under /api prefix. Provisioned scan account: scan-bank (role=bank_user, already MFA-enrolled)."
- **Session Management:** "Session management is handled by express-session with connect-pg-simple (PgStore) in server.js lines 98-146. Cookie flags configured at lines 113-116: httpOnly: true (prevents JS access), sameSite: 'strict' (CSRF protection — cookie not sent in cross-site requests), secure: true when NODE_ENV===production (HTTPS-only). Session maxAge: 15 minutes with rolling renewal (timer resets on each request, line 124). Session regeneration after login via req.session.regenerate() at line 664 to prevent fixation. MFA state tracked across req.session.mfa, req.session.userId, req.session.app, req.session.role. Session data persists in PostgreSQL via connect-pg-simple, surviving restarts. The /api/auth/logout endpoint (server.js line ~672) destroys the session entirely. Session fixation resistance: regenerate ID after login; MFA enrollment resets lockout counters."
- **Authorization Model:** "Role-based access control (RBAC) with two nested systems. Global app assignment: requireApp('bank') grants bank_user role; any other app assignment grants 'student' role (server.js line 431). Within Acadia subsystem: requireAcadiaRole('student') vs requireAcadiaRole('admin') (server.js line 338, lines 314-352). Role hierarchy: 'bank_user' < 'admin' < 'student' in terms of domain separation — each domain is independent. Enforcement: requireApp() middleware (lines 314-352) checks req.session.app against expected value; requireAcadiaRole() (lines 338-352) checks req.session.role. Role assignment during login (line 557): user.row.role must match expected role or 401 is returned. Privilege escalation path: if an attacker can manipulate req.session.app or req.session.role, they gain access to a different domain's routes. No resource-level RBAC beyond user_id ownership checks in banking operations (from_user_id, to_user_id checks). The scan account scan-bank has role=bank_user and can access banking routes but not admin-only academic routes."
- **Multi-tenancy:** "Single-tenant application. All users share the same database schema and application process. Tenant isolation is enforced entirely through application-layer middleware (requireApp, requireAcadiaRole) and foreign-key constraints with ON DELETE CASCADE. The CHECK constraint app IN ('bank','acadia') and role check constraints provide database-level discrimination, but a bypass of application middleware would collapse isolation. No separate schemas, databases, or tenancy-scoped resources. The scan-bank and student accounts all operate within the same shared instance."
- **SSO/OAuth/OIDC Flows:** Not applicable — no SSO/OAuth/OIDC integration detected.

## 4. Data Security & Storage

- **Database Security:** PostgreSQL is the sole data store. All queries use parameterized $1, $2 placeholders through pg.Pool, preventing SQL injection in normal operations. The lab /api/lab/exploit/sqli endpoint demonstrates string concatenation injection but is gated behind LAB_VULNERABLE_MODE=true and MFA-authenticated consent. Table-level access control via PostgreSQL GRANT statements (GRANT SELECT,INSERT,UPDATE,DELETE ON school_service_requests,school_attendance,school_fee_definitions TO smartphone). RLS not enabled at DB level; isolation is application-layer via user_id foreign keys and role checks. Check constraints enforce valid app/role/kind values. No encryption at rest beyond TOTP secret encryption; bank account balances and student records are stored in clear text. Connection pool settings: connectionTimeoutMillis=5000, statement_timeout=10000, idle_in_transaction_session_timeout=10000 to prevent connection starvation.
- **Data Flow Security:** Sensitive data flows: 1) PII (usernames, display names, program, year_of_study) flows from API routes into database and is rendered via innerHTML in admin console — XSS risk if not escaped. 2) Payment data (balance_cents, amount_cents) flows through /api/bank/transfer, /api/bank/pay-tuition endpoints with row-level locking (FOR UPDATE) preventing concurrent modifications. 3) TOTP secrets are encrypted at rest via AES-256-GCM (library: custom encrypt/decrypt in server.js lines 251-310) and decrypted only in memory during verification. 4) Audit data (security_events, lab_incidents) logs auth changes, failed attempts, privilege escalations. 5) User-supplied identifiers (username, user_id, request_id) flow into URL/query parameters without consistent sanitization, enabling IDOR and XSS. HTTPS enforced via Caddy HSTS; no mixed-content issues identified.
- **Multi-tenant Data Isolation:** The application is single-tenant. All users share the same database schema, and isolation is enforced entirely through application-layer middleware (requireApp, requireAcadiaRole, per-user session checks) and foreign-key constraints (ON DELETE CASCADE). The CHECK constraint app IN ('bank','acadia') and role constraints provide some DB-level discrimination, but a bypass of application middleware would collapse tenant isolation. No separate schemas or databases per tenant. The lab_sqli_demo table is shared across both 'bank' and 'school' targets, further blurring isolation.

## 5. Attack Surface Analysis

- **External Entry Points:** All 97+ endpoints under /api are network-reachable. Public (no auth): POST /api/auth/register, POST /api/auth/login, GET /api/auth/me. Authenticated (session-based): GET/POST /api/auth/verify (TOTP), POST /api/auth/logout. Banking (requireApp('bank'), MFA-verified): 16 routes including GET /api/bank/accounts, POST /api/bank/transfer, GET/POST/DELETE /api/bank/recipients, etc. Acadia student (requireAcadiaRole('student')): 3 routes — GET /api/acadia/profile, /api/acadia/courses, /api/acadia/payments. Acadia admin (requireAcadiaRole('admin')): 20 routes for full curriculum management. Lab (requires LAB_VULNERABLE_MODE=true + MFA): /api/lab/exploit/sqli (SQL injection demo), /api/lab/terminal/exec (command execution with allowlisted binaries). Health: GET /api/health. Bridge: /api/shannon/health/start/status/logs/stop/report (connects to host.docker.internal:7071, loopback-only). Pentest: /api/pentest/run, /api/pentest/report. AI agent: /api/ai-agent/run, /api/ai-agent/report. All /api routes undergo origin validation (403 on mismatch) and auth rate limiting (30/15min per account+IP).
- **Internal Service Communication:** Application is a single monolithic process with no internal RPC fabric. All data access goes through the single PostgreSQL instance. The only 'internal' communication is the Caddy reverse-proxy -> Node.js app flow, and the bridge to host.docker.internal:7071 for AI agent orchestration. Trust assumptions: the app trusts the database entirely (no DB-level RLS), trusts the session store, and trusts the Origin header after initial handshake. No inter-service authentication or mTLS.
- **Input Validation Patterns:** Input validation is inconsistent. Username validated via regex ^[a-zA-Z0-9._-]{3,40}$ during registration/login (server.js ~line 55). All other fields (query params, body, headers) rely on type constraints and application middleware. Origin header validated on non-GET /api requests. No Sanitization library used; HTML escaping via custom esc() function in admin-console.js but not always applied before innerHTML assignment. SQL queries use $1,$2 parameterized placeholders (pg.Pool) — safe from injection except the deliberate lab endpoint. TOTP secrets decrypted only in memory. No global XSS sanitization — innerHTML sinks accept raw data from API responses or user input. The /api/lab/exploit/sqli endpoint explicitly concatenates user input into SQL strings, capped at 64 chars and scoped via MATERIALIZED CTE to lab_sqli_demo table.
- **Background Processing:** No async job queue, background workers, or scheduled tasks observed. All request processing is synchronous within the Express request-response cycle. The /api/lab/terminal/exec endpoint spawns child processes (node:child_process.spawn) but only with allowlisted binaries and shell:false, and it is invoked synchronously within an API request. No event-driven processing, message queues, or cron-style jobs exist in the codebase.

## 6. Infrastructure & Operational Security

- **Secrets Management:** Three critical environment variables required at startup: DATABASE_URL (postgres://...), SESSION_SECRET (≥32 hex chars, validated in server.js lines 13-32), TOTP_ENCRYPTION_KEY (exactly 64 hex chars, validated similarly). Missing/placeholder values cause hard start-up error, preventing deployment with defaults. SESSION_SECRET and TOTP_ENCRYPTION_KEY are read via process.env; no secret management service (Vault, KMS) — relies on Docker/env-file or Kubernetes secrets. No secret rotation mechanism observed; rotation would require restart. TOTP secrets are encrypted at rest in PostgreSQL using AES-256-GCM with a key derived from TOTP_ENCRYPTION_KEY; only the encrypted blob is stored, decrypted in memory during verification. The .env file is excluded via .dockerignore and not checked into git.
- **Configuration Security:** Caddyfile provides HSTS (max-age=31536000; includeSubDomains), X-Content-Type-Options: nosniff. Node env separation: helmet middleware active, x-powered-by disabled, secure cookie flag only in production (NODE_ENV===production). Origin validation middleware permits only hosts matching the deployed host or PUBLIC_ORIGIN env var. Rate limiting configured per-account (not global). No WAF beyond Caddy defaults. Dockerfile builds a minimal Node image. No .env checked in; deployment CI must supply vars via docker-compose env_file or Kubernetes env.
- **External Dependencies:** Key third-party packages: express, pg (PostgreSQL driver), helmet, argon2, speakeasy (TOTP), qrcode, express-rate-limit, pg-simple (session store), dotenv, crypto (Node built-in). No known vulnerable dependencies detected in package-lock.json scan. The lab relies on Caddy for TLS termination and reverse-proxy. No external SaaS APIs are called by default — only the optional /api/lab/exploit/sqli demo and bridge calls to host.docker.internal. No feature flags or remote config endpoints observed other than the LAB_VULNERABLE_MODE env var.
- **Monitoring & Logging:** Audit logging via security_events table (auth changes, failed attempts, privilege escalations), lab_incidents (recorded attack scenarios and outcomes), and lab_defender_settings (ON/OFF state). Events include user_id, app, event_type, detail, created_at. No centralized log aggregation (e.g., ELK, Splunk) — logs are PostgreSQL-bound. Rate-limit headers emitted (draft-7 standard). No security event alerts or real-time monitoring observed. The /api/security/events endpoint allows authenticated users to view their own event history.

## 7. Overall Codebase Indexing

The Shannon-Target codebase is organized under /repos/.shannon-target/ with the following structure: Root contains package.json and package-lock.json for dependency management, server.js (82KB, the main Express application entry point), school-routes.js (54KB, academic API route installer), and school-services-routes.js (15KB, school services API route installer). Supporting directories include configs/ (environment and lab configuration), public/ (client-side JavaScript and UI assets), tools/, Dockerfile and docker-compose.yml (container deployment), .dockerignore and .gitignore (build exclusions). SQL schema files (schema.sql, school-services.sql, school-upgrade.sql, bank-link-update.sql, etc.) define the PostgreSQL database structure. The .shannon/ directory contains deliverables/ (output directory for security assessment tools, currently empty except .git/) and scratchpad/ for temporary work. The Caddyfile provides reverse-proxy and TLS termination. Public-facing client JavaScript files are in public/: admin-console.js, app.js, attack-lab-exploit.js, lab-login.js, colleague-rework.js, school-services.js, school-upgrade.js, shannon-panel.js. Route installation functions (installAuthRoutes, installBankRoutes, installSchoolRoutes, installSchoolServices) are exported from their respective route files and registered on the Express app in server.js. All API routes are prefixed with /api. The codebase uses ES-module import syntax throughout, with a single PostgreSQL database connection pool shared across all routes. Security middleware (helmet, rate limiting, origin validation, session configuration) is configured in server.js before route registration. The deliberate vulnerability lab is controlled via LAB_VULNERABLE_MODE environment variable."

## 8. Critical File Paths

- **Configuration:** `server.js`, `school-routes.js`, `school-services-routes.js`, `docker-compose.yml`, `Dockerfile`, `Caddyfile`, `.env.example (inferred)`, `package.json`, `package-lock.json`
- **Authentication & Authorization:** `server.js (lines 13-32: env validation, lines 418-419: argon2 hash, lines 596: argon2 verify, lines 251-310: TOTP encrypt/decrypt, lines 664: session.regenerate)`, `server.js (lines 98-146: session config with pg-store, lines 113-116: cookie flags httpOnly/sameSite/secure)`
- **API & Routing:** `server.js (route registration: /api/auth, /api/bank, /api/acadia, /api/school, /api/school/services, /api/security, /api/lab/exploit/sqli)`, `school-routes.js (installSchoolRoutes function, all /api/school/... endpoints)`, `school-services-routes.js (installSchoolServicesRoutes function, all /api/school/services/... endpoints)`
- **Data Models & DB Interaction:** `schema.sql (PostgreSQL table definitions: users, bank_accounts, bank_transfers, student_profiles, student_courses, security_events, lab_sqli_demo)`, `school-services.sql (school_service_requests, school_attendance, school_fee_definitions tables)`, `server.js (pg.Pool configuration: connectionTimeoutMillis, statement_timeout, idle_in_transaction_session_timeout)`
- **Dependency Manifests:** `package.json (express, pg, helmet, argon2, speakeasy, qrcode, express-rate-limit, dotenv, pg-simple, crypto)`, `package-lock.json (full dependency tree with versions)`
- **Sensitive Data & Secrets Handling:** `server.js (lines 13-32: DATABASE_URL, SESSION_SECRET, TOTP_ENCRYPTION_KEY validation; lines 251-310: AES-256-GCM TOTP secret encryption; lines 418-419: argon2.hash/verify)`, `server.js (line 61: crypto import for encryption)`
- **Middleware & Input Validation:** `server.js (origin validation middleware lines 134-185, rate limiter lines 213, helmet at line 91, csrf complement via sameSite='strict')`, `school-routes.js (requireAcadiaRole middleware usage)`, `school-services-routes.js (requireAcadiaRole middleware usage)`
- **Logging & Monitoring:** `server.js (security_events table writes via pool.query, lab_incidents inserts)`, `server.js (rate limit header emission via limiter)`
- **Infrastructure & Deployment:** `Dockerfile (Node.js container build, env var exposure)`, `docker-compose.yml (app + PostgreSQL service, port mapping)`, `Caddyfile (HSTS, reverse-proxy to app:3000, loopback bridge to host.docker.internal:7071)`

## 9. XSS Sinks and Render Contexts

### HTML Body Context
- **innerHTML** at `public/admin-console.js:57` — Tab navigation markup set via root.innerHTML = `...`
- **innerHTML** at `public/admin-console.js:63` — View function sets $('ac-view').innerHTML = html; where html from API response
- **innerHTML** at `public/admin-console.js:64` — Student results display: $('ac-results').innerHTML = state.students.map(...)
- **innerHTML** at `public/admin-console.js:91` — Grade publishing: $('ac-grade-enrollment').innerHTML = '<option>...' + rows.map(e=>opt(e.id,`${e.code} — ${e.title}...`))
- **innerHTML** at `public/admin-console.js:106` — Attendance tracking: $('ac-attendance-content').innerHTML = `<select...` + session dates/statuses
- **innerHTML** at `public/admin-console.js:116-118` — Finance adjustment history: $('ac-finance-history').innerHTML = `<h4>Outstanding balance...</h4>` + record data
- **innerHTML** at `public/colleague-rework.js:22` — Static welcome text: home.innerHTML = '<h2>Hello, Welcome to Colleague Self-Service!</h2>...'
- **view(html)** at `public/admin-console.js:58` — view() function passes arbitrary HTML parameter to innerHTML assignment

### HTML Attribute Context
- **view(html)** at `public/admin-console.js:58` — HTML attribute context — view function could reflect user-controlled HTML into onclick/onerror attributes
- **innerHTML** at `public/colleague-rework.js:22` — No HTML attribute sinks found; static welcome text has no user-controllable attributes

### JavaScript Context
- **spawn()** at `server.js:1844` — child_process.spawn — server-side command execution, not browser JS
- **spawn()** at `server.js:2005` — child_process.spawn — server-side command execution for terminal bridge
- **spawn()** at `server.js:2665` — child_process.spawn — server-side command execution for SSH bridge

### CSS Context
*(scanned, no sinks of this kind found)*

### URL Context
- **new URL(address)** at `public/app.js:2257` — window.open(new URL(address).href, '_blank') — browser URL opening from user input
- **URLSearchParams(location.search)** at `public/lab-login.js:16` — Search parameter parsing from page URL

## 10. SSRF Sinks

### HTTP(S) Clients
- **shannonCall** at `server.js:2094` — Bridge API call where pathname influenced by caller routes
- **fetch** at `server.js:2226` — Format from query param influences upstream bridge URL
- **fetch** at `public/attack-lab-exploit.js:49` — SQL injection payload from UI influences request body

### Raw Sockets & Connect APIs
*(scanned, no sinks of this kind found)*

### URL Openers & File Includes
- **new URL + window.open** at `public/app.js:2257` — Browser address field user input opened in new tab
- **URLSearchParams** at `public/lab-login.js:16` — Search parameter parsing from page URL

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

# Reconnaissance Deliverable:

## 0) HOW TO READ THIS
This reconnaissance report provides a comprehensive map of the application's attack surface, with special emphasis on authorization and privilege escalation opportunities for the Authorization Analysis Specialist.

**Key Sections for Authorization Analysis:**
- **Section 4 (API Endpoint Inventory):** Contains authorization details for each endpoint - focus on "Required Role" and "Object ID Parameters" columns to identify IDOR candidates.
- **Section 6.4 (Guards Directory):** Catalog of authorization controls - understand what each guard means before analyzing vulnerabilities.
- **Section 7 (Role & Privilege Architecture):** Complete role hierarchy and privilege mapping - use this to understand the privilege lattice and identify escalation targets.
- **Section 8 (Authorization Vulnerability Candidates):** Pre-prioritized lists of endpoints for horizontal, vertical, and context-based authorization testing.

**How to Use the Network Mapping (Section 6):** The entity/flow mapping shows system boundaries and data sensitivity levels. Pay special attention to flows marked with authorization guards and entities handling PII/sensitive data.

**Priority Order for Testing:** Start with Section 8's High-priority horizontal candidates, then vertical escalation endpoints for each role level, finally context-based workflow bypasses.

## 1. Executive Summary

Shannon-Target is a Node.js/Express security lab deployed at https://shekin.tail97139a.ts.net, simulating a university-banking environment. The application is a single Docker container with PostgreSQL, fronted by Caddy reverse-proxy. It contains two deliberately vulnerable domains: Royal Banking (role: bank_user) and Acadia Student (role: student). The architecture employs defense-in-depth with Helmet headers, argon2id password hashing, TOTP-based MFA with AES-256-GCM encrypted secrets, SameSite=strict/secure session cookies, per-account rate limiting, and origin-validation CSRF guards. However, the application contains several deliberately vulnerable endpoints: IDOR vulnerabilities in banking and tuition APIs where user-supplied identifiers can be manipulated to access unauthorized records, cross-site rendering via innerHTML in the admin console enabling XSS, server-side command execution through /api/lab/terminal/exec with allowlisted binaries, and a SQL injection demo at /api/lab/exploit/sqli. The scan account scan-bank is MFA-enrolled with role=bank_user. The application's most significant risks stem from input validation gaps that enable IDOR and XSS, while cryptographic implementations and session management are well-executed.

## 2. Technology & Service Map

- **Frontend:** React/Vue SPA with plain JavaScript, HTML5, CSS. Client-side rendering with innerHTML sinks in admin-console.js, app.js, and other public JS files. Authentication UI with TOTP code entry.
- **Backend:** Node.js (ES-module runtime) with Express 4.x framework monolith. PostgreSQL accessed via pg.Pool with connection pooling. Security dependencies: helmet, argon2id password hashing, speakeasy TOTP, aes-256-gcm encryption, express-rate-limit, pg-simple session store, dotenv, crypto (Node built-in). ES-module import syntax throughout.
- **Infrastructure:** Docker containerized deployment with Caddy reverse-proxy providing TLS termination and HSTS. PostgreSQL database service. Environment variables: DATABASE_URL, SESSION_SECRET (≥32 hex chars), TOTP_ENCRYPTION_KEY (64 hex chars). Controlled via LAB_VULNERABLE_MODE env var for lab endpoints.

## 3. Authentication & Session Management Flow

- **Entry Points:** /api/auth/login (POST), /api/auth/me (GET)
- **Mechanism:** POST /api/auth/login validates credentials via argon2, returns MFA step 'verify' or 'enroll'; TOTP verification via /api/auth/verify with speakeasy window=1; session regenerated via req.session.regenerate(); /api/auth/me checks session; /api/auth/logout destroys session
- **Code Pointers:** server.js:557-610 (login), server.js:630-650 (verify), server.js:664 (session.regenerate), server.js:672 (logout)

### 3.1 Role Assignment Process

- **Role Determination:** requireApp('bank') grants bank_user; requireAcadiaRole('student') vs requireAcadiaRole('admin') checks req.session.role; user.row.role must match expected role during login
- **Default Role:** bank users:get bank_user, Acadia students:get student, staff:get admin
- **Role Upgrade Path:** MFA enrollment self-service for totp_enabled; admin promotion requires administrative approval
- **Code Implementation:** server.js:314-352 (requireApp), server.js:338-352 (requireAcadiaRole), server.js:557 (role check during login)

### 3.2 Privilege Storage & Validation

- **Storage Location:** JWT-like session data (req.session: userId, app, role, mfa) persisted in PostgreSQL via connect-pg-simple (PgStore)
- **Validation Points:** requireApp() middleware checks req.session.app; requireAcadiaRole() middleware checks req.session.role; inline role checks in route handlers
- **Cache/Session Persistence:** 15-minute maxAge with rolling renewal (timer resets on each request); session data refreshed on each request
- **Code Pointers:** server.js:98-146 (session config with pg-store), server.js:113-116 (cookie flags httpOnly/sameSite/secure), server.js:314-352 (requireApp), server.js:338-352 (requireAcadiaRole)

### 3.3 Role Switching & Impersonation

*(Not applicable — no impersonation, sudo mode, or role-switching features were identified.)*

## 4. API Endpoint Inventory

_[Section 4: not provided — `add_endpoints` was not called]_

## 5. Potential Input Vectors for Vulnerability Analysis

_[Section 5: not provided — `set_input_vectors` was not called]_

## 6. Network & Interaction Map

_[Section 6: not provided — `set_network_map` was not called]_

## 7. Role & Privilege Architecture

_[Section 7: not provided — `set_role_architecture` was not called]_

## 8. Authorization Vulnerability Candidates

_[Section 8: not provided — `set_authz_candidates` was not called]_

## 9. Injection Sources (Command Injection, SQL Injection, LFI/RFI, SSTI, Path Traversal, Deserialization)

_[Section 9: not provided — `set_injection_sources` was not called]_

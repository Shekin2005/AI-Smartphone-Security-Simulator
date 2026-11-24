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

AI Smartphone Security Simulator: A single-tenant monolithic Node.js/Express training application deployed via Docker compose with Caddy reverse proxy and Tailscale Funnel for public HTTPS. The application implements defense-in-depth with Argon2id password hashing, AES-256-GCM encrypted TOTP secrets, PostgreSQL-backed sessions with httpOnly/sameSiteStrict/secure cookies, Helmet security headers, rate limiting on auth endpoints, and origin-based CSRF protection. Known deliberate vulnerabilities include IDOR in bank endpoints (e.g., /api/bank/accounts/:id allows reading other users' data via identifier enumeration) and an opt-in SQL injection lab (/api/lab/exploit/sqli) bounded by MATERIALIZED CTE. The 103+ API endpoints are mostly authenticated (MFA + app role), with 6 public endpoints. No JWTs are used; authentication is cookie-session based. All secrets (SESSION_SECRET, TOTP_ENCRYPTION_KEY) are env-sourced, gitignored, and validated on startup. Overall security posture is B-: strong crypto and headers, good session protection, but deliberate teaching-focused attack surfaces.

## 2. Technology & Service Map

- **Frontend:** Vanilla HTML/JS application with client-side JavaScript files (public/ directory). UI rendered through DOM manipulation in app.js, admin-console.js, colleague-rework.js, and other public JS files. No frontend framework detected - pure DOM rendering with innerHTML. CSS files for styling. Client-side forms collect user input for API submission.
- **Backend:** Node.js 22 + Express 5.3.0 monolithic application. ESM type: "module". Key dependencies: express 5.3.0, helmet 8.3.0, argon2 0.45.1, pg 8.11.0, connect-pg-simple, speakeasy for TOTP, qrcode for QR code generation, express-rate-limit. Core security: Argon2id password hashing, AES-256-GCM for TOTP encryption, parameterized SQL queries ($1, $2 via pg.Pool), Helmet middleware, express-session with PostgreSQL store, origin-based CSRF protection, rate limiting.
- **Infrastructure:** Docker compose orchestration with two services: sim-app (Node.js/Express) and sim-caddy (Caddy reverse proxy). Caddyfile provides TLS termination. Tailscale Funnel for public HTTPS exposure. PostgreSQL database instance. Internal "shannon" bridge network connects services. Network exposure via Tailscale tail domain (shekin.tail97139a.ts.net).

## 3. Authentication & Session Management Flow

- **Entry Points:** /api/auth/register, /api/auth/login, /api/auth/enroll, /api/auth/verify, /api/auth/me, /api/auth/logout
- **Mechanism:** Cookie-session based auth with PostgreSQL store. MFA flow enroll->verify. Session data: mfa,role,app,userId. Cookie flags: httpOnly,sameSiteStrict,secure,maxAge 15min. Origin CSRF protection on /api. Session rotation via regenerate().
- **Code Pointers:** server.js:10-52,362-893

### 3.1 Role Assignment Process

- **Role Determination:** Role based on app (bank/acadia) and scope (Global). Default: student. Admin via create-admin.js.
- **Default Role:** student
- **Role Upgrade Path:** create-admin.js explicit DB insertion
- **Code Implementation:** server.js:301-313,398-418,170,255

### 3.2 Privilege Storage & Validation

- **Storage Location:** PostgreSQL users.role + Express session req.session
- **Validation Points:** requireApp('bank'), requireAcadiaRole(), requireDefenderSession
- **Cache/Session Persistence:** rolling:true + connect-pg-simple PG store
- **Code Pointers:** server.js:113-117,21-27,334,346,418-430

### 3.3 Role Switching & Impersonation

*(Not applicable — no impersonation, sudo mode, or role-switching features were identified.)*

## 4. API Endpoint Inventory

| Method | Endpoint Path | Required Role | Object ID Parameters | Authorization Mechanism | Description & Code Pointer |
| --- | --- | --- | --- | --- | --- |
| GET | /api/acadia/courses | student | None | requireAcadiaRole('student') + MFA verified | Get enrolled courses with grades (server.js:982) |
| GET | /api/acadia/payments | student | None | requireAcadiaRole('student') + MFA verified | Get tuition payment history (server.js:1019) |
| GET | /api/acadia/profile | student | None | requireAcadiaRole('student') + MFA verified | Get student profile (server.js:943) |
| GET | /api/ai-agent/run | user | None | MFA-verified session required | Run AI pentest agent (server.js:2720) |
| POST | /api/auth/enroll | user | None | requireAuth + MFA pending check | MFA enrollment (TOTP setup), sets enrollmentSecret and pending session data (server.js:428) |
| POST | /api/auth/login | anon | None | None - public login endpoint with argon2 verify and MFA step returned | Password login returning MFA pending session (server.js:202) |
| POST | /api/auth/logout | user | None | requireAuth + session destruction | Destroy session, clear sim.sid cookie, record security event (server.js:980) |
| GET | /api/auth/me | user | None | requireAuth session check | Check authentication status and return mfa, role, app (server.js:973) |
| POST | /api/auth/register | anon | None | None - public registration endpoint | Register new account with argon2 hash and auto-role assignment (server.js:57) |
| POST | /api/auth/verify | user | None | requireAuth + OTP verification | Validate 6-digit TOTP code, set mfa, regenerate session (server.js:478) |
| GET | /api/bank/account-details | bank_user | None | requireApp('bank') + MFA verified | Get account numbers/details (server.js:711) |
| POST | /api/bank/accounts | bank_user | None | requireApp('bank') + MFA verified | Get chequing/savings accounts for bank app (server.js:645) |
| POST | /api/bank/link-code | bank_user | None | requireApp('bank') + MFA verified | Issue one-time linking code for bank transfers (server.js:678) |
| POST | /api/bank/pay-tuition | bank_user | studentId, from, amount | requireApp('bank') + MFA verified + AC+8 studentId + enum + safe integer + UUID | Pay student tuition (server.js:961) |
| GET | /api/bank/payments | bank_user | None | requireApp('bank') + MFA verified | Get tuition payments made (server.js:946) |
| GET | /api/bank/person-transfers | bank_user | None | requireApp('bank') + MFA verified | P2P transfer history (server.js:1253) |
| GET | /api/bank/recipients | bank_user | None | requireApp('bank') + MFA verified | Get saved recipients (server.js:1197) |
| POST | /api/bank/recipients | bank_user | recipient_username | requireApp('bank') + MFA verified + username regex validation | Add a saved recipient (server.js:1216) |
| DELETE | /api/bank/recipients/:id | bank_user | id | requireApp('bank') + MFA verified + ownership check | Remove a recipient (server.js:1237) |
| GET | /api/bank/scholarship-credits | bank_user | None | requireApp('bank') + MFA verified | Get scholarship credits received (server.js:803) |
| POST | /api/bank/send-money | bank_user | recipientId, from, amount | requireApp('bank') + MFA verified + numeric + enum + safe integer + UUID v4 | Send money to recipient (server.js:1276) |
| POST | /api/bank/transfer | bank_user | from, to, amount | requireApp('bank') + MFA verified + amount enum + UUID requestId | Execute transfer between accounts (server.js:833) |
| GET | /api/bank/transfers | bank_user | None | requireApp('bank') + MFA verified | Get transfer history (last 30) (server.js:745) |
| GET | /api/bank/tuition/student/:studentId | bank_user | studentId | requireApp('bank') + MFA verified + AC+8 studentId format | Get student tuition info (server.js:927) |
| POST | /api/lab/exploit/sqli | user | target, input | requireDefenderSession + LAB_VULNERABLE_MODE=true opt-in | SQL injection lab (deliberately vulnerable with MATERIALIZED CTE containment) (server.js:2578) |
| POST | /api/school/admin/catalog | admin | None | requireAcadiaRole('admin') + MFA verified | Create/update course via course manager (school-routes.js:67) |
| POST | /api/school/admin/course-manager/apply-defaults | admin | None | requireAcadiaRole('admin') + MFA verified | Apply default courses (school-routes.js:132) |
| POST | /api/school/admin/course-manager/assign | admin | studentId, courseId | requireAcadiaRole('admin') + MFA verified + assign authorization | Assign course to student (school-routes.js:119) |
| GET | /api/school/admin/course-manager/catalog | admin | None | requireAcadiaRole('admin') + MFA verified | Full catalog (course manager) (school-routes.js:84) |
| POST | /api/school/admin/course-manager/catalog | admin | None | requireAcadiaRole('admin') + MFA verified | Create/update via course manager (school-routes.js:87) |
| GET | /api/school/admin/course-manager/defaults | admin | None | requireAcadiaRole('admin') + MFA verified | Default courses (course manager) (school-routes.js:124) |
| POST | /api/school/admin/course-manager/defaults | admin | None | requireAcadiaRole('admin') + MFA verified | Set default courses (school-routes.js:127) |
| GET | /api/school/admin/course-manager/student/:id | admin | id | requireAcadiaRole('admin') + MFA verified + student lookup | Student enrollments (course manager) (school-routes.js:97) |
| GET | /api/school/admin/course-manager/students | admin | None | requireAcadiaRole('admin') + MFA verified | Search students (course manager) (school-routes.js:93) |
| POST | /api/school/admin/degree-requirements | admin | None | requireAcadiaRole('admin') + MFA verified | Add degree requirement (school-routes.js:82) |
| DELETE | /api/school/admin/degree-requirements/:id | admin | id | requireAcadiaRole('admin') + MFA verified + removal authorization | Remove degree requirement (school-routes.js:83) |
| GET | /api/school/admin/enrollments | admin | None | requireAcadiaRole('admin') + MFA verified | List all enrollments (admin only) (school-routes.js:32) |
| GET | /api/school/admin/grade-recovery | admin | None | requireAcadiaRole('admin') + MFA verified | Get recovery records (school-routes.js:48) |
| POST | /api/school/admin/grade-recovery/:id/restore | admin | id | requireAcadiaRole('admin') + MFA verified + restore authorization | Restore grade (school-routes.js:51) |
| POST | /api/school/admin/grades | admin | None | requireAcadiaRole('admin') + MFA verified | Publish grade (school-routes.js:48) |
| GET | /api/school/admin/requests | admin | None | requireAcadiaRole('admin') + MFA verified | Pending profile requests (admin only) (school-routes.js:28) |
| POST | /api/school/admin/requests/:id | admin | id | requireAcadiaRole('admin') + MFA verified + ownership review | Review/approve/reject pending request (school-routes.js:30) |
| GET | /api/school/admin/students | admin | None | requireAcadiaRole('admin') + MFA verified | List all students (admin only) (school-routes.js:24) |
| GET | /api/school/catalog | student | None | requireAcadiaRole('student') + MFA verified | Course catalog (school-routes.js:6) |
| GET | /api/school/degree-progress | student | None | requireAcadiaRole('student') + MFA verified | Degree progress tracking (school-routes.js:67) |
| GET | /api/school/enrollments | student | None | requireAcadiaRole('student') + MFA verified | Get enrollments (school-routes.js:7) |
| POST | /api/school/enrollments | student | catalogId | requireAcadiaRole('student') + MFA verified + safe integer catalogId | Enroll in course (school-routes.js:8) |
| GET | /api/school/finance | student | None | requireAcadiaRole('student') + MFA verified | Finance summary (school-routes.js:24) |
| GET | /api/school/profile-requests | student | None | requireAcadiaRole('student') + MFA verified | Profile change requests (school-routes.js:25) |
| POST | /api/school/profile-requests | student | name, program, year | requireAcadiaRole('student') + MFA verified + trim + max length + integer range | Submit profile request (school-routes.js:26) |
| GET | /api/school/services/admin/attendance | admin | None | requireAcadiaRole('admin') + MFA verified | Attendance enrollments (school-services-routes.js:106) |
| POST | /api/school/services/admin/attendance | admin | None | requireAcadiaRole('admin') + MFA verified | Record attendance (school-services-routes.js:107) |
| POST | /api/school/services/admin/charge-fee | admin | None | requireAcadiaRole('admin') + MFA verified | Charge fee (school-services-routes.js:119) |
| GET | /api/school/services/admin/fees | admin | None | requireAcadiaRole('admin') + MFA verified | Fee definitions (school-services-routes.js:122) |
| POST | /api/school/services/admin/fees | admin | None | requireAcadiaRole('admin') + MFA verified | Add/update fee definitions (school-services-routes.js:123) |
| POST | /api/school/services/admin/finance-adjust | admin | None | requireAcadiaRole('admin') + MFA verified | Financial adjustment (school-services-routes.js:15) |
| GET | /api/school/services/admin/finance-history/:id | admin | id | requireAcadiaRole('admin') + MFA verified + finance history access | Finance history by request ID (school-services-routes.js:11) |
| GET | /api/school/services/admin/requests | admin | None | requireAcadiaRole('admin') + MFA verified | All service requests (admin only) (school-services-routes.js:104) |
| POST | /api/school/services/admin/requests/:id | admin | id | requireAcadiaRole('admin') + MFA verified + request review | Review service request (school-services-routes.js:105) |
| GET | /api/school/services/bank-link | student | None | requireAcadiaRole('student') + MFA verified | Check linked bank account (school-services-routes.js:49) |
| POST | /api/school/services/bank-link | student | None | requireAcadiaRole('student') + MFA verified | Link bank account (school-services-routes.js:55) |
| POST | /api/school/services/bank-unlink | student | None | requireAcadiaRole('student') + MFA verified | Unlink bank account (school-services-routes.js:85) |
| GET | /api/school/services/financial-aid | student | None | requireAcadiaRole('student') + MFA verified | Financial aid records (school-services-routes.js:8) |
| GET | /api/school/services/requests | student | None | requireAcadiaRole('student') + MFA verified | Service requests (school-services-routes.js:102) |
| POST | /api/school/services/requests | student | None | requireAcadiaRole('student') + MFA verified | Submit service request (school-services-routes.js:103) |
| GET | /api/school/services/summary | student | None | requireAcadiaRole('student') + MFA verified | Student summary (school-services-routes.js:91) |
| GET | /api/security/defender | user | None | requireDefenderSession | Defender status (server.js:1468) |
| POST | /api/security/defender | user | None | requireDefenderSession | Set defender enabled/disabled (server.js:1482) |
| GET | /api/security/defender/events | user | None | requireDefenderSession | Lab incident history (server.js:1496) |
| GET | /api/security/events | user | None | requireAuth session check | Security events for user (server.js:1434) |

## 5. Potential Input Vectors for Vulnerability Analysis

- **URL Parameters:**
  - ["?redirect_url= @auth.controller.ts:88", "?target= @lab/exploit/sqli:2095", "?studentId= @bank/tuition/student/:studentId:927", "?id= @school/admin/requests/:id:30", "?recipient_id= @bank/recipients/:id:1237", "?person_recipient= @bank/person-send:1276", "?person_from= @bank/person-send:1276", "?person_amount= @bank/person-send:1276", "?cmd= @lab/terminal/exec:2620", "?download=1 @ai-agent/report:/api/ai-agent/report?download=1", "?download=1 @pentest/report:/api/pentest/report?download=1"}
- **POST Body Fields (JSON/Form):**
  - username @ server.js:57 (register)
  - password @ server.js:57 (register)
  - username @ server.js:202 (login)
  - password @ server.js:202 (login)
  - code @ server.js:478 (verify OTP)
  - enrollmentSecret @ server.js:428 (enroll)
  - target @ server.js:2578 (sqli lab)
  - input @ server.js:2578 (sqli lab)
  - recipient_username @ server.js:1216 (bank recipients)
  - recipientId @ server.js:1276 (send-money)
  - amount @ server.js:1276 (send-money)
  - from @ server.js:833 (transfer)
  - to @ server.js:833 (transfer)
  - studentId @ server.js:927/961 (tuition)
  - from @ server.js:961 (pay-tuition)
  - name @ school-routes.js:26 (profile-requests)
  - program @ school-routes.js:26 (profile-requests)
  - year @ school-routes.js:26 (profile-requests)
  - catalogId @ school-routes.js:8 (enrollments)
  - studentId @ server.js:119 (course-manager/assign)
  - courseId @ server.js:119 (course-manager/assign)
  - charge @ server-services-routes.js:119 (charge-fee)
  - fee @ server-services-routes.js:123 (fees)
- **HTTP Headers:**
  - Cookie: sim.sid @ server.js:113-117 (session cookie)
  - X-Forwarded-For @ Caddy reverse proxy
  - Origin @ server.js:55-80 (CSRF check)
  - X-Requested-With @ helmet middleware
  - Authorization @ bearer token (if applicable)
- **Cookie Values:**
  - sim.sid @ server.js:113-117 (session cookie, httpOnly, sameSiteStrict, secure, maxAge 15min)
  - enrollmentSecret @ server.js:428 (TOTP enrollment secret in pending session)
  - mfa @ server.js:654 (MFA verification flag in session)

## 6. Network & Interaction Map

### 6.1 Entities

| Title | Type | Zone | Tech | Data | Notes |
| --- | --- | --- | --- | --- | --- |
| Caddy Reverse Proxy | ExternAsset | Edge | Caddy with TLS termination | Public | TLS termination, X-Forwarded-Proto https, request forwarding to sim-app |
| Tailscale Funnel | ThirdParty | Edge | Tailscale secure network tunnel | Public | Provides public HTTPS exposure for locally deployed Docker application |
| User Session | Identity | App | cookie-session PostgreSQL store | Tokens, PII | PostgreSQL-backed cookie-session with httpOnly/sameSiteStrict/secure flags. Holds: mfa, role, app, userId, pendingId/pendingApp/pendingUntil, enrollmentSecret |
| Web Application | Service | App | Node.js 22 + Express 5.3.0 | Tokens, PII | Monolithic Express application serving banking and academic portals via HTTPS |
| PostgreSQL Database | DataStore | Data | PostgreSQL 14+ | PII, Tokens, Payments, Secrets | 31-table relational database with users, bank_accounts, bank_transfers, tuition_payments, lab_sqli_demo tables. Session data stored via connect-pg-simple. |

### 6.2 Entity Metadata

| Title | Metadata |
| --- | --- |
| Caddy Reverse Proxy | Hosts: shekin.tail97139a.ts.net; Endpoints: Public HTTPS entry point; TLS: Let's Encrypt via Tailscale Funnel |
| Tailscale Funnel | Hosts: shekin.tail97139a.ts.net; Network: WireGuard-encrypted overlay network |
| User Session | Session Store: PostgreSQL via connect-pg-simple; Cookie Flags: httpOnly, sameSiteStrict, secure (prod), maxAge 15min |
| Web Application | Hosts: /api/auth, /api/bank, /api/acadia, /api/lab, /api/security, /api/ai-agent endpoints; Endpoints: ~103 network-accessible API endpoints; Auth: Cookie-session based, PostgreSQL session store, MFA with TOTP; Database: PostgreSQL with 31 tables |
| PostgreSQL Database | Engine: PostgreSQL; Exposure: Internal - accessed only via application; Consumers: Web Application only; Credentials: Managed via ENV vars, gitignored |

### 6.3 Flows (Connections)

| FROM → TO | Channel | Path/Port | Guards | Touches |
| --- | --- | --- | --- | --- |
| Caddy Reverse Proxy → Web Application | HTTPS | :443 /api/... | origin-based CSRF check | Tokens, PII |
| Internet → Caddy Reverse Proxy | HTTPS | :443 | TLS termination, Tailscale Funnel | Public |
| Web Application → AI Pentest Agent | Token | /api/ai-agent/run | MFA-verified session required | Public |
| Web Application → child_process.spawn | TCP | lab/terminal/exec | requireDefenderSession, binary allowlist (nikto,nmap,curl,whatweb,dig,host,nslookup,openssl), target allowlist (shekin,tail97139a.ts.net,host.docker.internal,127.0.0.1,localhost), command tokenization rejecting ; & \| ` $ < > | Public |
| Web Application → PostgreSQL Database | TCP | :5432 | parameterized queries ($1, $2), connection pool validation | PII, Tokens, Payments, Secrets |
| Web Application → Security Events | TCP | PostgreSQL | requireAuth | PII, Tokens |
| Web Application → User Session | HTTP | sim.sid | requireAuth, session validation (PG store), cookie flags (httpOnly/sameSiteStrict/secure) | Tokens, PII |

### 6.4 Guards Directory

| Guard Name | Category | Statement |
| --- | --- | --- |
| requireApp | Auth | Checks req.session.app === 'bank'/'acadia' to gate cross-domain access |
| requireAuth | Auth | Validates session cookie sim.sid with PostgreSQL store, checks MFA status and session existence |
| requireDefenderSession | Auth | Checks MFA + userId for lab/defender endpoints |
| requireAcadiaRole | Authorization | Checks req.session.app === 'acadia' and req.session.role === 'student'/'admin' for academic portal access |
| binary allowlist | Network | child_process.spawn only allows binaries from allowlist: nikto,nmap,curl,whatweb,dig,host,nslookup,openssl |
| target allowlist | Network | Terminal command targets restricted to: shekin.tail97139a.ts.net, host.docker.internal, 127.0.0.1, localhost |
| origin-based CSRF | Protocol | Validates Origin header against allowed hosts + PUBLIC_ORIGIN env var for non-GET /api endpoints |
| parameterized queries | Protocol | All production SQL uses $1, $2 parameter placeholders preventing SQL injection |

## 7. Role & Privilege Architecture

### 7.1 Discovered Roles

| Role Name | Privilege Level | Scope/Domain | Code Implementation |
| --- | --- | --- | --- |
| anon | 0 | Global | No session - unauthenticated access |
| user | 1 | Global | requireAuth middleware (server.js:113-130) |
| bank_user | 3 | bank app | requireApp('bank') middleware (server.js:398-418) |
| student | 3 | acadia app | requireAcadiaRole('student') middleware (server.js:301-313) |
| admin | 5 | acadia admin | requireAcadiaRole('admin') middleware (server.js:301-313) + create-admin.js |

### 7.2 Privilege Lattice

```
Privilege Ordering (→ means "can access resources of"):
anon (0) → user (1) → bank_user (3) / student (3) || admin (5)

Privilege hierarchy: anonymous users at level 0, authenticated users at level 1,
bank_users and students at level 3 (parallel isolation - separate app domains),
administrators at level 5 (acadia-only, sits above both bank_user and student).

Parallel isolation: bank_user (app=bank) || student (app=acadia) - both at level 3
but isolated from each other by app scoping (u.app = req.session.app).

Parallel Isolation (|| means "not ordered relative to each other"):
bank_user (app=bank) || student (app=acadia) - both at privilege level 3 but isolated by application domain. Admin (level 5) has authority over acadia domain only and sits above both parallel roles. No role-switching or impersonation mechanisms exist between roles.
```

### 7.3 Role Entry Points

| Role | Default Landing Page | Accessible Route Patterns | Authentication Method |
| --- | --- | --- | --- |
| anon | N/A | None | None |
| user | /bank-dashboard or /acadia-dashboard | /api/bank/*, /api/acadia/* | Cookie-session with PostgreSQL store |
| bank_user | /api/bank/accounts | /api/bank/* | Cookie-session with MFA verified + req.session.app === 'bank' |
| student | /api/acadia/profile | /api/acadia/* | Cookie-session with MFA verified + req.session.app === 'acadia' + req.session.role === 'student' |
| admin | /api/school/admin/students | /api/school/admin/* | Cookie-session with MFA verified + req.session.app === 'acadia' + req.session.role === 'admin' |

### 7.4 Role-to-Code Mapping

| Role | Middleware/Guards | Permission Checks | Storage Location |
| --- | --- | --- | --- |
| anon | None | N/A | N/A |
| user | requireAuth + session validation | req.session.authenticated === true | PostgreSQL session + req.session |
| bank_user | requireApp('bank') + requireAuth | req.session.app === 'bank' && req.session.mfa === true | PostgreSQL users.role + req.session.app |
| student | requireAcadiaRole('student') + requireAuth | req.session.app === 'acadia' && req.session.role === 'student' && req.session.mfa === true | PostgreSQL users.role + req.session.app + req.session.role |
| admin | requireAcadiaRole('admin') + requireAuth | req.session.app === 'acadia' && req.session.role === 'admin' && req.session.mfa === true | PostgreSQL users.role + req.session.app + req.session.role |

## 8. Authorization Vulnerability Candidates

### 8.1 Horizontal Privilege Escalation Candidates

| ID | Priority | Endpoint Pattern | Object ID Parameter | Data Type | Sensitivity |
| --- | --- | --- | --- | --- | --- |
| AUTHZ-CAND-01 | High | /api/bank/accounts/:id | id | user_data | User can access other users' bank account data via identifier enumeration |
| AUTHZ-CAND-02 | High | /api/bank/recipients/:id | id | user_data | User can access other users' saved recipients via identifier enumeration |

### 8.2 Vertical Privilege Escalation Candidates

| ID | Target Role | Endpoint Pattern | Functionality | Risk Level |
| --- | --- | --- | --- | --- |
| AUTHZ-CAND-03 | admin | /api/school/admin/* | Administrative functions - student records, grades, course management | High |
| AUTHZ-CAND-04 | admin | /api/school/admin/grade-recovery/* | Grade recovery and restoration - academic record manipulation | High |
| AUTHZ-CAND-05 | student | /api/bank/transfer | Bank transfer functionality - students should not execute bank transfers | Medium |

### 8.3 Context-Based Authorization Candidates

| ID | Workflow | Endpoint | Expected Prior State | Bypass Potential |
| --- | --- | --- | --- | --- |
| AUTHZ-CAND-06 | MFA Enrollment | /api/auth/verify | User must have completed enrollment flow (POST /api/auth/enroll) with valid enrollmentSecret in session | Attacker could skip enrollment and directly verify OTP if code is obtained through phishing, bypassing the intended MFA setup flow |
| AUTHZ-CAND-07 | Profile Change | /api/school/profile-requests | User must be authenticated with MFA-verified student role in acadia app | Attacker could submit profile change requests without proper authentication if session fixation or cross-site request forgery succeeds |

## 9. Injection Sources (Command Injection, SQL Injection, LFI/RFI, SSTI, Path Traversal, Deserialization)

### Command Injection
- **child_process.spawn** at `server.js:2620 - /api/lab/terminal/exec endpoint, req.query.cmd parameter` — Command tokenization rejects shell metacharacters. Binary allowlist: nikto,nmap,curl,whatweb,dig,host,nslookup,openssl. Target allowlist: shekin.tail97139a.ts.net, host.docker.internal, 127.0.0.1, localhost. shell: false.
- **spawn** at `server.js:2720 - /api/ai-agent/run endpoint` — Spawns AI agent script. Requires MFA-verified session.

### SQL Injection
- **client.query** at `server.js:2045-2105 - /api/lab/exploit/sqli endpoint, req.body.input parameter` — Deliberately vulnerable lab endpoint. Raw SQL concatenation with user input. Gated by LAB_VULNERABLE_MODE=true + MFA-verified session.

### LFI/RFI
*(scanned, no sources of this kind found)*

### Path Traversal
*(scanned, no sources of this kind found)*

### SSTI
*(scanned, no sources of this kind found)*

### Deserialization
*(scanned, no sources of this kind found)*

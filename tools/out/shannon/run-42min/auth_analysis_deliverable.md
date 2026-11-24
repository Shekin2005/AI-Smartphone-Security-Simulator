# Authentication Analysis Report

## 1. Executive Summary

Three logical authentication vulnerabilities were identified in the Shannon-Target application: a lockout bypass enabling unlimited password brute force via a 2-attempt threshold reset, ineffective rate limiting on the TOTP verification endpoint enabling code brute forcing, and missing Cache-Control headers on auth responses enabling potential caching-based information exposure. The lockout bypass and TOTP rate limiting flaws are directly exploitable from the internet and represent the highest-severity findings.

## 2. Dominant Vulnerability Patterns

### Pattern 1: Lockout Threshold Bypass
- **Description:** The failed_attempts counter resets to 0 when it reaches 2, allowing unlimited brute force with 2 failures between 30-second lockout windows (server.js:493-507).
- **Implication:** An attacker can perform unlimited password brute force attacks against user accounts, circumventing the account lockout mechanism entirely.
- **Representative Findings:** `AUTH-VULN-01`

### Pattern 2: Ineffective TOTP Rate Limiting
- **Description:** The TOTP verify endpoint's rate limit key uses req.body.username which is absent in verify requests, combined with MFA failure counter reset after 30s session regeneration allows 3 code attempts per 30s window indefinitely (server.js:606-658, lines 213-227).
- **Implication:** An attacker can brute-force TOTP codes against enrolled accounts from the internet, bypassing the MFA protective control.
- **Representative Findings:** `AUTH-VULN-02`

### Pattern 3: Missing Cache-Control Headers on Auth Responses
- **Description:** Auth endpoint responses (me, verify, enroll) lack Cache-Control: no-store and Pragma: no-cache headers, making them potentially cacheable by intermediates or browsers (server.js: no caching headers on /api/auth/*).
- **Implication:** Authenticated or MFA-status responses could be cached and later retrieved, potentially exposing session state or authentication context.
- **Representative Findings:** `AUTH-VULN-03`

## 3. Strategic Intelligence for Exploitation

### Authentication Method
Session-based authentication with TOTP MFA. Users authenticate via POST /api/auth/login (password verified with argon2id), then complete MFA via POST /api/auth/verify (TOTP code) or POST /api/auth/enroll (if TOTP not previously configured). Session data (userId, app, role, mfa) persisted in PostgreSQL via connect-pg-simple. Password policy: 12-128 character minimum during registration; argon2id hashing with default parameters.

### Session Token Details
JWT-like session data stored in PostgreSQL via connect-pg-simple (PgStore). Cookie name: sim.sid. Cookie flags: httpOnly (prevents JS access), sameSite: strict (prevents CSRF across sites), secure: true in production (HTTPS-only). Session maxAge: 15 minutes with rolling renewal (timer resets on each request). Session regenerated via req.session.regenerate() after login to prevent fixation. MFA state tracked via req.session.mfa=true, req.session.userId, req.session.app, req.session.role. TOTP secrets AES-256-GCM encrypted at rest with TOTP_ENCRYPTION_KEY env var; only encrypted blob stored in DB, decrypted in memory during verification.

### Password Policy
12-128 character minimum during registration; passwords hashed via argon2id (argon2.argon2id type) with default parameter set (mCost=65536, tCost=3, pCost=1). No default credentials observed in code or fixtures. Password policy enforced only during registration; no server-side complexity validation beyond length constraints.

## 4. Secure by Design: Validated Components

| Component/Flow | Endpoint/File Location | Defense Mechanism | Verdict |
| --- | --- | --- | --- |
| Argon2 password hashing | server.js:463-479 | argon2.verify() used for password verification during login | SAFE |
| HSTS enforcement | Caddyfile | strict-transport-security: max-age=31536000; includeSubDomains | SAFE |
| Origin validation | server.js:134-185 | Origin header validated against host and PUBLIC_ORIGIN for non-GET /api requests | SAFE |
| Password hashing | server.js:282-298 | argon2id hashing with default parameters (one-way, computationally expensive) | SAFE |
| Role-based access control | server.js:314-352 (requireApp), server.js:338-352 (requireAcadiaRole) | requireApp() checks req.session.app; requireAcadiaRole() checks req.session.role against expected role | SAFE |
| Session cookie flags | server.js:113-116 | httpOnly, sameSite=strict, secure (in production) cookie configuration | SAFE |
| Session fixation resistance | server.js:664 | req.session.regenerate() called after password verification before MFA setup | SAFE |

## 5. Analysis Constraints and Blind Spots

### MFA Failure Counter Reset Behavior
After 3 failed MFA attempts, the session is regenerated and the DB locked_until is set for 30 seconds. It is unclear whether req.session.mfaFailures resets to 0 after regeneration or persists from the old session, creating uncertainty about the true brute-force barrier. This gap affects the precise exploitation hypothesis for AUTH-VULN-02.

### Rate Limit / MFA Counter Interaction
The express-rate-limit key uses req.body.username which is absent in /api/auth/verify requests, but the per-account locked_until mechanism and MFA failure counter interact in ways not fully traced. The exact rate at which an attacker can attempt TOTP codes from a single IP depends on the interplay between these three mechanisms (rate limit, lockout, MFA counter).

### TOTP Clock Skew Edge Cases
The verify code checks timeStep > Number(user.last_totp_step). Users with clocks slightly behind the server may experience frequent TOTP verification failures, and the behavior with out-of-sync clocks is not explicitly handled beyond the step comparison.

### enrollmentSecret Lifecycle
The req.session.enrollmentSecret is set during TOTP enrollment (server.js:579) but its clearance pathway after successful verification or enrollment abandonment is not explicitly traced. If a session is compromised between enrollment and verification, the raw base32 secret could be exposed.

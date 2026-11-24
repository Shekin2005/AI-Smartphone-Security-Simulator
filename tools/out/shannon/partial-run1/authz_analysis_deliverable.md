# Authorization Analysis Report

## 1. Executive Summary

Analysis of 10 authorization vulnerability candidates identified 2 exploitable flaws: a horizontal IDOR in /api/bank/tuition/student/:studentId allowing bank users to read any student's tuition data, and a horizontal flaw in /api/bank/pay-tuition allowing bank users to pay tuition for arbitrary students. All other candidates (horizontal, vertical, and context-based) were found to be properly guarded with appropriate ownership checks and role validation.

## 2. Dominant Vulnerability Patterns

### Pattern 1: Missing Ownership Check in Cross-Domain Endpoint
- **Description:** Endpoints taking a user/student ID parameter from the request without validating that the resource belongs to the authenticated user. The :studentId parameter in /api/bank/tuition/student/:studentId and studentId in /api/bank/pay-tuition are used directly in DB queries without checking against req.session.userId.
- **Implication:** Attackers can enumerate IDs to access or modify data belonging to other users across application domains (bank_app users accessing acadia student data).
- **Representative Findings:** `AUTHZ-VULN-01`, `AUTHZ-VULN-02`

## 3. Strategic Intelligence for Exploitation

### Session Management Architecture
Cookie-session based authentication with PostgreSQL session store. Session data includes mfa, role, app, userId. Session cookie has httpOnly, sameSiteStrict, secure flags and maxAge 15min. MFA flow uses TOTP with enrollment flow (enroll→verify). Session regeneration occurs on login. Role is determined by app (bank/acadia) and scope (Global). Default role: student. Admin role requires explicit creation via create-admin.js. Session data is trusted by downstream guards - many endpoints use req.session.role and req.session.app directly in DB queries without additional ownership re-validation.

### Role/Permission Model
Three roles: user (global, level 1), bank_user (bank app, level 3), student (acadia app, level 3). Parallel isolation: bank_user (app=bank) || student (app=acadia) both at level 3 but isolated by app scoping. Admin (level 5) has authority over acadia domain only and sits above both parallel roles. Role embedded in JWT and database; checks inconsistent - many admin routes only check req.user presence without additional validation. requireAcadiaRole('student') checks app===acadia && role===student; requireAcadiaRole('admin') checks app===acadia && role===admin. requireApp('bank') checks app===bank. Guards appear consistent within each domain but cross-domain boundary checks are absent.

### Resource Access Patterns
Most endpoints use path parameters for resource IDs (/api/bank/tuition/student/:studentId, /api/bank/recipients/:id, etc.). Bank endpoints filter by req.session.userId in DB queries (e.g., WHERE user_id=$1). Acadia student endpoints filter by req.session.userId (e.g., WHERE student_user_id = $1). Admin endpoints do NOT filter by a specific userId - they may act on any student's data (finance-adjust, charge-fee, admin-requests, attendance, fees). Bank tuition endpoints (:studentId) use the path parameter directly without userId filtering, enabling cross-domain data access. Tenant/organization boundaries exist via app scoping (req.session.app) but are not enforced at the query level for the tuition endpoints.

### Workflow Implementation
Multi-step processes use status flags and flow control: MFA flow uses enrollmentSecret and pending session state (5-minute window from login). Tuition payment flow validates student existence and amount against tuition_cents, then deducts from both bank account and student tuition_cents. Grade recovery workflow uses administrator_id tracking (records which admin created the record) with restore checking administrator_id match. Profile change workflow uses student_user_id tracking. No multi-step workflows were found that skip prior-state validation - all steps appear to validate prior conditions before applying state changes.

## 4. Vectors Analyzed and Confirmed Secure

| Endpoint | Guard Location | Defense Mechanism | Verdict |
| --- | --- | --- | --- |
| DELETE /api/bank/recipients/:id | server.js:1235 | Ownership check: WHERE id=$1 AND owner_user_id=$2 with req.session.userId ensures user can only delete their own recipients | SAFE |
| GET /api/acadia/profile | server.js:943 | requireAcadiaRole('student') with ownership check via WHERE user_id=$1 | SAFE |
| GET /api/auth/me | server.js:973 | Inline session check: authenticated = !!req.session.mfa | SAFE |
| GET /api/bank/accounts | server.js:931 | requireApp('bank') middleware enforces MFA + app=bank check; DB query filters by req.session.userId | SAFE |
| GET /api/bank/recipients | server.js:1200 | Filters recipients by owner_user_id=req.session.userId; only returns current user's recipients | SAFE |
| GET /api/bank/transfers | server.js:745 | Filters by WHERE user_id=$1 with req.session.userId; only current user's transfer history | SAFE |
| GET /api/school/admin/* | school-routes.js | requireAcadiaRole('admin') middleware checks app===acadia && role===admin; proper role enforcement | SAFE |
| GET /api/school/admin/grade-recovery | school-routes.js:48 | WHERE administrator_id=$1 filters to current admin's own records | SAFE |
| GET /api/school/finance | school-routes.js:24 | WHERE student_user_id=$1 and WHERE user_id=$1; only current student's finance data | SAFE |
| GET /api/security/events | server.js:1434 | WHERE user_id = $1 filters to current user's events; requires MFA + userId | SAFE |
| parameterized SQL queries | server.js throughout | All production SQL uses $1, $2 parameter placeholders via pg.Pool preventing SQL injection | SAFE |
| POST /api/auth/logout | server.js:980 | Session destruction + cookie clearing; proper logout flow | SAFE |
| POST /api/bank/send-money | server.js:1267 | Recipient ownership check: verifies br.owner_user_id=$2 and u.id=br.recipient_user_id; prevents sending to oneself | SAFE |
| POST /api/school/admin/grade-recovery/:id/restore | school-routes.js:51 | WHERE id=$1 AND administrator_id=$2 restricts to admin's own records | SAFE |
| POST /api/school/enrollments | school-routes.js:8 | Uses req.session.userId as student_user_id in all DB queries; duplicate checks also filter by student_user_id | SAFE |
| requireAcadiaRole('admin') middleware | server.js:307 | Enforces req.session.mfa, req.session.userId, req.session.app === 'acadia', and req.session.role === 'admin'; guards all admin-facing acadia endpoints | SAFE |
| requireAcadiaRole('student') middleware | server.js:307 | Enforces req.session.mfa, req.session.userId, req.session.app === 'acadia', and req.session.role === 'student'; guards all student-facing acadia endpoints | SAFE |
| requireApp('bank') middleware | server.js:283 | Enforces req.session.mfa, req.session.app === 'bank', and req.session.userId existence; guards all bank endpoints | SAFE |
| requireDefenderSession middleware | server.js:1545 | Checks req.session.mfa && req.session.userId for lab/defender endpoints | SAFE |

## 5. Analysis Constraints and Blind Spots

### Untraced Asynchronous Flows
The codebase may contain asynchronous error paths or edge cases not fully traced during analysis, particularly in the banking transfer and tuition payment flows which use client transactions with BEGIN/COMMIT/ROLLBACK patterns. Any unhandled exceptions or edge cases in these flows could not be fully verified.

### Limited Visibility into Session State Initialization
The session initialization flow (particularly how roles are assigned and how users transition between roles) was not fully traced. The create-admin.js mechanism for admin role creation and the role assignment logic during registration could not be fully verified for all code paths.

### Minified/Compiled JavaScript
The public/ directory contains client-side JavaScript files (app.js, admin-console.js, colleague-rework.js) that were not fully analyzed. While these primarily handle UI rendering, certain authorization decisions or state manipulations could potentially occur client-side, though client-side checks are not reliable as authorization guards.

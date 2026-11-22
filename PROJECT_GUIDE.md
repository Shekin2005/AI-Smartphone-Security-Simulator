# AI Smartphone Security Simulator

## Run the current simulator

With PostgreSQL running and the database connection configured in `.env`, run `npm.cmd start` from the `ai-smartphone-security` folder in PowerShell. Open http://localhost:3000 and unlock the simulated phone with PIN `1234`.

Banking, Acadia Student, AI Defender, and the phone utilities are available. Attack Lab and the separate Python AI service were retired. The setup notes and reports below reflect earlier versions of the project.

---

*Source: `PROJECT2_SETUP.md`*

# Project 2 — Acadia School Portal Simulator Upgrade

This is a **fictional** student portal for a COMP 3123 security simulation, not Acadia University Colleague Self-Service. Never use real student/bank data. Keep Project 1 as a backup.

## What is included

- Complete source tree based on the uploaded **Project 1.zip**, with the previous school-upgrade code and the additional student self-service code.
- Student course catalogue and course registration, schedule, grades, tuition charge ($3,000 per newly registered course), profile requests, and admin controls from the earlier upgrade.
- Student Planning, Course Catalog, Academic Attendance, Banking Information *request* (not a live bank-data editor), Enrollment Verification request, Transcript Request, Graduation Application request, Degree Change request, and admin review of those requests.
- Configurable other fee definitions, and an explicit admin action to post a selected fee to a student's balance. **Fee definitions alone do not charge students.**

## Setup (Windows / VS Code)

1. Back up your current Project 1 and PostgreSQL `smartphone_security` database in pgAdmin. Do not overwrite Project 1.
2. Extract this ZIP into `Security/Project 2` so the app lives in `Project 2/ai-smartphone-security`.
3. Copy **your own existing `.env`** from Project 1 into `Project 2/ai-smartphone-security/.env`. The ZIP deliberately does not include private secrets.
4. Open VS Code terminal **inside `Project 2/ai-smartphone-security`**. Verify `Test-Path .\package.json` is `True`.
5. In pgAdmin, connect to the **correct backed-up database**. Run `school-upgrade.sql` and then `school-services.sql` as the database administrator. These migrations create new tables and grant access to the application role `smartphone`. If your database role differs, edit the GRANT lines. The scripts do not remove existing tuition payments.
6. Run `npm install`, then `node --check server.js`, `node --check school-routes.js`, `node --check school-services-routes.js`, `node --check public/school-upgrade.js`, and `node --check public/school-services.js`.
7. To distinguish Project 2 from any old server, use `$env:PORT = '3001'` then `npm start`. Open `http://localhost:3001` and verify `http://localhost:3001/school-services.js` shows JavaScript.
8. Hard refresh (Ctrl+Shift+R) and sign in as Acadia Student / Acadia Admin with your existing fictional accounts.

## Acceptance tests

1. Student > Courses: register for a course not already present in legacy records. Expect $3,000 additional outstanding tuition and a row in Schedule and Grades (unpublished).
2. Admin > Grades: publish a grade for that enrollment; student should see it after refresh.
3. Student > Profile: submit a profile change; Admin > Students: approve; verify student profile updates.
4. Student > Student Planning, Course Catalog, Academic Attendance: verify student-specific data.
5. Student > Graduation / Degree: submit simulated requests. Student > Enrollment Verifications / Transcript Requests / Banking Information: submit request. Admin > Student Services: approve or reject. Verify request status.
6. Admin > Student Services: enter attendance for a registered course; student sees the attendance entry.
7. Admin > Student Services: create a fee definition; **explicitly post** the fee to the intended student and term. Verify Finance balance increases once, and duplicate posting is rejected.
8. Banking > Pay Tuition: make a small **fictional** payment only after verifying the student and amount; confirm the student outstanding balance decreases and payment history is intact.
9. Confirm AI Defender loads.

## Limitations / important details

- Existing `student_courses` legacy entries are preserved; they are **not retroactively charged**. Only newly registered courses in `acadia_enrollments` receive the $3,000 charge.
- Course catalogue currently uses one offering per course code, not a full university section/prerequisite/waitlist engine. The conflict check only compares exact start time on the same day and term; overlapping durations are not modeled.
- New grades are numeric 0–100; existing legacy grades may use letter grades. Automatic GPA, degree-audit eligibility, generated PDF transcript, downloadable enrollment letter, and automatic graduation eligibility are **not implemented**. Requests and admin review are implemented instead.
- Banking Information is a *request workflow*, not a direct editor for sensitive banking information. Never enter real account numbers.
- The extra fee definitions are sample **fictional** values, not official Acadia fees.
- Admin review of a degree/graduation/transcript request changes its request status; it does not itself generate a diploma or modify a student's program. Profile change approval does update the student profile.
- The ZIP has been syntax checked; live database migration, real browser workflows, and security/production testing require testing in your environment.
- The existing app uses the same database if you reuse `DATABASE_URL` from Project 1. For true isolation, clone your PostgreSQL database and point Project 2 at the clone.

---

*Source: `COLLEAGUE_LAYOUT_SETUP.md`*

# Project 2 — Colleague-style Student Self-Service layout

This upgrade replaces the **student-facing navigation** with the eleven tiles visible in the supplied screenshots: Student Finance, Financial Aid, Tax Information, Banking Information, Student Planning, Course Catalog, Grades, Graduation Overview, Enrollment Verifications, Transcript Requests and Academic Attendance. It does not delete underlying records or alter the Admin/Banking application.

## Install
1. Keep Project 1 unchanged. Back up your current Project 2 folder and PostgreSQL database.
2. Extract this ZIP as `Project 2/ai-smartphone-security` (avoid nesting two `ai-smartphone-security` directories).
3. Copy your private `.env` from the current working Project 2 into the extracted folder; the ZIP intentionally contains no `.env`.
4. In pgAdmin, connected to `smartphone_security`, run `colleague-catalog-details.sql` **after** `school-upgrade.sql` and `school-services.sql` have been applied. The new SQL only adds catalog metadata columns and example descriptions.
5. In PowerShell, `cd` into `Project 2/ai-smartphone-security`, run `npm install`, then `$env:PORT='3001'` and `npm start`.
6. Visit `http://localhost:3001`, hard-refresh (Ctrl+Shift+R), sign into Acadia **Student**.

## Functionality and limits
- Course Catalog: searchable/filterable courses from `acadia_catalog`; displays code, description, credits, term, professor, weekday, start/end, location and $3,000 tuition. Unknown details show TBA. Admin can populate details through SQL; the old admin course form does not yet edit all metadata.
- Add Course to Plan: saves a draft plan in the **current browser's localStorage**, not in PostgreSQL. A draft is not registration and does not charge tuition. The draft is browser-local and should not be used for shared computers.
- Student Planning: shows planned courses, allows **Register for Section**, shows newly registered courses in a weekday view. Registration uses the existing authenticated `/api/school/enrollments` backend and adds the $3,000 charge exactly as before.
- Student Finance, Grades, Graduation, Banking Information, Enrollment Verifications, Transcript Requests and Academic Attendance use the existing Project 2 panels and API behavior. Financial Aid and Tax Information are explicitly **informational placeholders**; they do not connect to real records.
- Existing legacy course enrollments do not automatically appear in the new planning timetable. Admin-defined courses are the source for the new course catalog.
- The screenshot-like dashboard is adapted for the small 3D phone screen. It is not a copy of Acadia's real system and does not connect to real student data.

## Quick tests
- Student login → see dashboard tiles → Course Catalog → search COMP → Add Course to Plan → Back → Student Planning → Register for Section → Student Finance. Confirm exactly $3,000 was added, then verify Banking tuition payment and grade publishing via Admin.
- Do not register twice to test a duplicate payment; registration rejects existing enrollment.
- If you see old navigation, check `http://localhost:3001/colleague-rework.js`, check you are running Project 2, and force-refresh.

---

*Source: `REVIEW_AND_SETUP.md`*

# Source review and integration repair — 2026-11-03

This package contains your source code without `.env` or `node_modules`. It is a **preliminary schema/configuration repair**, not a verified production release.

## Findings
- Original schema.sql omitted `users.role`, while registration and login depend on it.
- Original schema.sql omitted bank_recipients, bank_person_transfers, tuition_payments; server.js uses all three.
- Server listened only on 127.0.0.1; HOST may now be configured for a deployment platform.
- Recipient lookup now compares usernames case-insensitively.
- Original ZIP included `.env`, which must not be published. Rotate credentials before deployment.
- The student and admin login interfaces have separate handlers. Full browser/database tests are still required.
- The AI detection comparison has not been validated.

## Steps in VS Code
1. Back up your current source folder and PostgreSQL database before changing anything.
2. Extract this package to a NEW folder, do not overwrite your working folder yet.
3. Copy your own `.env` into the new folder locally. Never upload it.
4. In pgAdmin, select `smartphone_security`, run `migration-2026-11-auth-and-payments.sql` once. Review the resulting tables.
5. Run `npm ci`, `node --check server.js`, `node --check public/app.js`, then `npm start`.
6. Test registration, password login, MFA enrollment/verification, student/admin role access, recipients, Activity, and tuition using fictional test accounts.
7. Check browser Network responses and Node terminal for failures; no claim of end-to-end success until tested.
8. Before deploying: rotate all secrets from uploaded `.env`, configure HTTPS, reverse proxy trust carefully, hosted PostgreSQL, backups, migrations, and staging tests.

## Known limitations
- A clean database needs `schema.sql`.
- Existing user roles are only populated when NULL. Verify any existing role values manually.
- This migration cannot fix every older schema drift or existing corrupt account.

---

*Source: `SECURITY-REVIEW.md`*

# Security Review Summary

## Scope and limitations

Reviewed the AI Defender behavior and the directly related Attacker Lab routes. This is a source review only: no exploit requests were sent, no application tests were executed, and no database records were changed. The AI Defender currently evaluates recorded security events and behavior; it does not scan application code or dependencies for weak spots.

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | `attack-lab-routes.js` | 927-950, 2450-2555 | Interactive lab scenarios can directly update a signed-in user's registered grade or balance when enabled. Localhost, non-production, and opt-in guards limit exposure, but these writes are not exploit results. | 9/10 |
| 2 | 🟡 MEDIUM | `application-behavior-ai.js` | 53-95 | Behavior features are aggregated by application without a user filter, which can muddy attribution between users. | 8/10 |
| 3 | ⚪ LOW | `attack-lab-routes.js` | 799-808, 1551-1559 | The Defender status GET calls an upsert helper, so reading status can insert or update a settings row. | 9/10 |

## Recommended follow-up

Keep any active security checks separate from the interactive lab's record-writing scenarios. Run checks against an isolated local or staging environment with synthetic accounts, explicitly allowlisted checks, and assertions that protected records remain unchanged. Report the resulting evidence separately from event-risk scores; the current AI assessment is advisory and is not a vulnerability scanner.

---

*Source: `BATCH1_STATUS.md`*

# Batch 1 — implementation status (20 planned focuses)

This is an **incremental code update**, not a claim that all 20 attacks are complete.

## New executable test

1. **Login Authentication Bypass** — makes one real HTTP POST to the original Acadia `/api/auth/login` with a bounded SQL-style username probe. No new users or training data. Reports rejected attempts as `blocked`, not `successful`. A 2xx response is flagged for investigation, not proof of full session bypass.

## Remaining 19 focuses

The original project handlers and their existing checks are preserved. Most still perform partial read-only checks or return inconclusive / not implemented; they are **not** verified exploits. They require focus-specific implementation and testing before being called complete.

## Testing

Run `node --check attack-lab-routes.js`, start the server and choose Acadia > SQL Injection > Login Authentication Bypass. Inspect Network > `/api/lab/run` > Response. The recovery journal must be configured as in the original project. Do not test against production or non-consenting accounts.

---

*Source: `CLEANUP_NOTES.md`*

# Cleanup notes

Removed from this distributed ZIP:
- `node_modules/` (install again with `npm ci`): generated dependencies, not your source.
- `.env` (contains local credentials/secrets): keep your existing `.env` in your original folder; DO NOT share it.
- `check-db.mjs`, `check-locks.js`, `test-db.js`: standalone diagnostic scripts not referenced by the package start command or application source.

Kept:
- All app pages, frontend JavaScript/CSS, Express routes, AI service, SQL schema/migrations, lab scripts, package files, and setup documentation.
- `setup-lab.js` and `create-admin.js` because they may be needed for manual setup.
- `colleague-rework.js` because it may be needed for manual setup, even though a similarly named frontend file exists.

This is a conservative packaging cleanup, not a refactor. No runtime application logic was intentionally changed.
The PostgreSQL database was not modified.
Your original project remains untouched.

## Install
1. Back up your current project folder and PostgreSQL database.
2. Extract to a NEW folder, not over the existing one.
3. Copy your original local `.env` into the new folder (do not share it).
4. Run `npm ci` in the new project folder.
5. Run `npm start` and verify School, Banking, Attack Lab, MFA, evidence, and Restore Original.

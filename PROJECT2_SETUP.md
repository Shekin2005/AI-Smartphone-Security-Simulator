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

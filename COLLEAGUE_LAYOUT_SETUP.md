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

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

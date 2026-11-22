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

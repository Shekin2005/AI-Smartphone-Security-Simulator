# Batch 1 — implementation status (20 planned focuses)

This is an **incremental code update**, not a claim that all 20 attacks are complete.

## New executable test

1. **Login Authentication Bypass** — makes one real HTTP POST to the original Acadia `/api/auth/login` with a bounded SQL-style username probe. No new users or training data. Reports rejected attempts as `blocked`, not `successful`. A 2xx response is flagged for investigation, not proof of full session bypass.

## Remaining 19 focuses

The original project handlers and their existing checks are preserved. Most still perform partial read-only checks or return inconclusive / not implemented; they are **not** verified exploits. They require focus-specific implementation and testing before being called complete.

## Testing

Run `node --check attack-lab-routes.js`, start the server and choose Acadia > SQL Injection > Login Authentication Bypass. Inspect Network > `/api/lab/run` > Response. The recovery journal must be configured as in the original project. Do not test against production or non-consenting accounts.

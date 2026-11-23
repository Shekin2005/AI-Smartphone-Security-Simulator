#!/usr/bin/env node
// ==================================================
// CREATE / RESET A SCAN ACCOUNT
// ==================================================
// Strix cannot get past this simulator's login on its own, because
// MFA is mandatory and the code changes every 30 seconds. This script
// provisions a normal account with a TOTP secret we know, so the
// scanner can compute valid codes itself during a scan.
//
// It writes the secret encrypted exactly the way server.js stores it:
//   key         = Buffer.from(TOTP_ENCRYPTION_KEY, "hex")   (32 bytes)
//   stored      = base64( iv[12] || authTag[16] || ciphertext )
// TOTP_ENCRYPTION_KEY must therefore match the running server.
//
// Usage:
//   node create-scan-account.js --app bank   --username scan-bank    --password "..."
//   node create-scan-account.js --app acadia --username scan-student --password "..."
//
// Idempotent: re-running resets the password, re-issues the TOTP
// secret and clears last_totp_step so the next scan can sign in.
// ==================================================

import "dotenv/config";
import pg from "pg";
import argon2 from "argon2";
import speakeasy from "speakeasy";
import {
  randomBytes,
  createCipheriv
} from "node:crypto";

const REQUIRED = [
  "DATABASE_URL",
  "TOTP_ENCRYPTION_KEY"
];

for (const name of REQUIRED) {
  if (!process.env[name]) {
    console.error(`[SETUP] Missing ${name} in .env`);
    process.exit(1);
  }
}

const RAW_KEY = process.env.TOTP_ENCRYPTION_KEY;

if (!/^[0-9a-f]{64}$/i.test(RAW_KEY)) {
  console.error(
    "[SETUP] TOTP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)"
  );
  process.exit(1);
}

const KEY = Buffer.from(RAW_KEY, "hex");

// Mirrors encrypt() in server.js byte for byte.
function encrypt(value) {
  const iv = randomBytes(12);

  const cipher = createCipheriv("aes-256-gcm", KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final()
  ]);

  return Buffer.concat([
    iv,
    cipher.getAuthTag(),
    encrypted
  ]).toString("base64");
}

// --------------------------------------------------
// Argument parsing
// --------------------------------------------------

function parseArgs(argv) {
  const out = {};

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith("--")) {
      continue;
    }

    const name = token.slice(2);
    const next = argv[i + 1];

    if (next && !next.startsWith("--")) {
      out[name] = next;
      i += 1;
    } else {
      out[name] = "true";
    }
  }

  return out;
}

const args = parseArgs(process.argv.slice(2));

const APP = (args.app || "").toLowerCase();
const USERNAME = (args.username || "").toLowerCase();
const PASSWORD = args.password;
const ROLE_ARG = (args.role || "").toLowerCase();

function usage(message) {
  if (message) {
    console.error(`\n[SETUP] ${message}\n`);
  }

  console.error(
    [
      "Usage:",
      "  node create-scan-account.js --app bank   --username scan-bank    --password \"ScanLab!2026pass\"",
      "  node create-scan-account.js --app acadia --username scan-student --password \"ScanLab!2026pass\"",
      "",
      "Options:",
      "  --app       bank | acadia        (required)",
      "  --username  3-40 chars [a-zA-Z0-9._-]",
      "  --password  plaintext, hashed with argon2id before storage",
      "  --role      acadia only: student (default) | admin",
      "  --reset-balance  bank only: reset chequing to $2500.00",
      ""
    ].join("\n")
  );

  process.exit(1);
}

if (!["bank", "acadia"].includes(APP)) {
  usage("--app must be bank or acadia");
}

if (!/^[a-zA-Z0-9._-]{3,40}$/.test(USERNAME)) {
  usage("--username must be 3-40 characters of [a-zA-Z0-9._-]");
}

if (typeof PASSWORD !== "string" || PASSWORD.length < 8) {
  usage("--password must be at least 8 characters");
}

// bank accounts are always bank_user in the schema; acadia is student/admin
const ROLE =
  APP === "bank"
    ? "bank_user"
    : ["student", "admin"].includes(ROLE_ARG)
      ? ROLE_ARG
      : "student";

// --------------------------------------------------
// Provision
// --------------------------------------------------

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000
});

async function main() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const secret = speakeasy.generateSecret({
      name: `Scan Account ${APP}`,
      issuer: "Smartphone Simulator",
      length: 20
    });

    const base32 = secret.base32;

    const hash = await argon2.hash(PASSWORD, {
      type: argon2.argon2id
    });

    // Upsert. Resetting last_totp_step to -1 is what lets the next
    // scan's first computed TOTP be accepted instead of being judged
    // "already used".
    const upsert = await client.query(
      `INSERT INTO users
         (app, username, password_hash, role, totp_secret,
          totp_enabled, failed_attempts, locked_until, last_totp_step)
       VALUES ($1,$2,$3,$4,$5,TRUE,0,NULL,-1)
       ON CONFLICT (app, username)
       DO UPDATE SET
         password_hash   = EXCLUDED.password_hash,
         role            = EXCLUDED.role,
         totp_secret     = EXCLUDED.totp_secret,
         totp_enabled    = TRUE,
         failed_attempts = 0,
         locked_until    = NULL,
         last_totp_step  = -1
       RETURNING id, role`,
      [
        APP,
        USERNAME,
        hash,
        ROLE,
        encrypt(base32)
      ]
    );

    const userId = upsert.rows[0].id;
    const role = upsert.rows[0].role;

    if (APP === "bank") {
      const resetBalance = args["reset-balance"] === "true";

      // The schema requires one chequing and one savings row.
      await client.query(
        `INSERT INTO bank_accounts (user_id, kind, balance_cents)
         VALUES ($1,'chequing',$2), ($1,'savings',0)
         ON CONFLICT (user_id, kind) DO NOTHING`,
        [userId, resetBalance ? 250000 : 150000]
      );

      if (resetBalance) {
        await client.query(
          `UPDATE bank_accounts
              SET balance_cents = 250000
            WHERE user_id = $1 AND kind = 'chequing'`,
          [userId]
        );
      }
    }

    if (APP === "acadia") {
      await client.query(
        `INSERT INTO student_profiles
           (user_id, display_name, program, year_of_study, tuition_cents)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (user_id) DO NOTHING`,
        [
          userId,
          "Scan Student",
          "BSc Computer Science",
          2,
          425000
        ]
      );

      // A little timetable data so the agent has something to explore.
      const existing = await client.query(
        `SELECT 1 FROM student_courses WHERE user_id = $1 LIMIT 1`,
        [userId]
      );

      if (!existing.rowCount) {
        await client.query(
          `INSERT INTO student_courses (user_id, code, title, term, grade)
           VALUES
             ($1,'COMP 2003','Data Structures','Fall 2026','B+'),
             ($1,'COMP 3113','Network Security','Fall 2026','A-'),
             ($1,'MATH 1213','Linear Algebra','Winter 2026', NULL)`,
          [userId]
        );
      }
    }

    await client.query("COMMIT");

    // The base32 secret is printed because the console asks for it.
    // It grants no access on its own — the password is still required.
    console.log("");
    console.log("==============================");
    console.log(" SCAN ACCOUNT READY");
    console.log("==============================");
    console.log(` app          : ${APP}`);
    console.log(` username     : ${USERNAME}`);
    console.log(` password     : ${PASSWORD}`);
    console.log(` role         : ${role}`);
    console.log(` user id      : ${userId}`);
    console.log(` totpSecret   : ${base32}`);
    console.log("");
    console.log(" Paste username, password and totpSecret into the");
    console.log(" AI Defender scan console.");
    console.log("==============================");
    console.log("");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch(async error => {
    console.error(`\n[SETUP] Failed: ${error.message}\n`);
    await pool.end().catch(() => {});
    process.exit(1);
  });

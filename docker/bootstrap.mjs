#!/usr/bin/env node
// ==================================================
// CONTAINER BOOTSTRAP
// ==================================================
// Runs once per container start, before the server. It does the three
// things that a fresh clone otherwise fails on:
//
//   1. Waits for PostgreSQL to accept connections.
//   2. Applies schema.sql (and the migration files) so the tables exist.
//   3. Seeds the lab accounts the pentest tools log in as, but only when
//      the users table is empty, so a restart never overwrites your data.
//
// Everything here is idempotent. Set SKIP_BOOTSTRAP=1 to bypass it.
// ==================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import argon2 from "argon2";
import { randomBytes, createCipheriv } from "node:crypto";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(HERE, "..");

const DB_URL = process.env.DATABASE_URL;
const SEED = String(process.env.SEED_DEMO_ACCOUNTS || "true") !== "false";
const TOTP_KEY_HEX = process.env.TOTP_ENCRYPTION_KEY || "";

const log = (...a) => console.log("[bootstrap]", ...a);

if (!DB_URL) {
  console.error("[bootstrap] DATABASE_URL is not set. Refusing to start.");
  process.exit(1);
}

if (!/^[0-9a-f]{64}$/i.test(TOTP_KEY_HEX)) {
  console.error("[bootstrap] TOTP_ENCRYPTION_KEY must be 64 hex characters (32 bytes).");
  console.error("[bootstrap] Generate one with: openssl rand -hex 32");
  process.exit(1);
}

const KEY = Buffer.from(TOTP_KEY_HEX, "hex");

// Mirrors encrypt() in server.js byte for byte:
//   stored = base64( iv[12] || authTag[16] || ciphertext )
function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --------------------------------------------------
// 1. Wait for the database
// --------------------------------------------------

async function waitForDatabase(pool, attempts = 60) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await pool.query("SELECT 1");
      log(`database reachable after ${i} attempt(s)`);
      return true;
    } catch (error) {
      if (i === attempts) {
        console.error(`[bootstrap] gave up waiting for the database: ${error.message}`);
        return false;
      }
      if (i === 1) log("waiting for database to accept connections...");
      await sleep(2000);
    }
  }
  return false;
}

// --------------------------------------------------
// 2. Apply the schema
// --------------------------------------------------

// schema.sql first, then any other .sql in the project root. Each file is
// executed on its own and a failure is logged rather than fatal, because some
// migrations assume tables that only exist after later ones.
function sqlFiles() {
  const files = [{ name: "schema.sql", path: path.join(APP_DIR, "schema.sql") }];

  for (const entry of fs.readdirSync(APP_DIR).sort()) {
    if (!entry.endsWith(".sql") || entry === "schema.sql") continue;
    files.push({ name: entry, path: path.join(APP_DIR, entry) });
  }

  return files.filter(f => fs.existsSync(f.path));
}

async function applySchema(pool) {
  const files = sqlFiles();
  if (!files.length) {
    log("no .sql files found in the image; skipping schema");
    return;
  }

  let applied = 0;
  const failed = [];

  for (const file of files) {
    const sql = fs.readFileSync(file.path, "utf8");
    try {
      await pool.query(sql);
      applied += 1;
    } catch (error) {
      failed.push(`${file.name}: ${error.message.split("\n")[0]}`);
    }
  }

  log(`schema: ${applied}/${files.length} file(s) applied`);
  for (const f of failed) log(`  skipped ${f}`);

  const check = await pool.query(
    "SELECT to_regclass('public.users') IS NOT NULL AS present"
  );
  if (!check.rows[0].present) {
    console.error("[bootstrap] the users table does not exist after applying schema.sql.");
    return false;
  }
  return true;
}

// --------------------------------------------------
// 3. Seed the lab accounts
// --------------------------------------------------

// The TOTP secrets are fixed rather than random, because tools/pentest-suite.mjs
// and tools/ai-agent.mjs ship with these exact values as their defaults. Random
// secrets would produce accounts the tools could not log into on a fresh
// install, which is the opposite of what a one-command setup should give you.
// They are public by design: this is a teaching lab, and every one of them is
// already written in the repository and in the documentation.
const DEMO = [
  {
    app: "bank",
    username: process.env.PENTEST_BANK_USER || "scan-bank",
    password: process.env.PENTEST_BANK_PASS || "ScanLab!2026pass",
    totp: process.env.PENTEST_BANK_TOTP || "OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI",
    role: "bank_user",
    label: "bank scan account",
  },
  {
    app: "acadia",
    username: process.env.PENTEST_SCHOOL_USER || "scan-student",
    password: process.env.PENTEST_SCHOOL_PASS || "ScanLab!2026pass",
    totp: process.env.PENTEST_SCHOOL_TOTP || "NAWFGQ2TKBTW2PSUJVDSCKLTH5KG4ZLC",
    role: "student",
    label: "school scan account",
  },
  {
    app: "acadia",
    username: "professor",
    password: "Acadia-Admin-2026!",
    totp: "IYZUKTCLOFJCKQKVLVLHEQC3PFDWKMDQ",
    role: "admin",
    label: "school administrator",
  },
];

async function createUser(client, spec) {
  const base32 = spec.totp;
  const hash = await argon2.hash(spec.password, { type: argon2.argon2id });

  const res = await client.query(
    `INSERT INTO users
       (app, username, password_hash, role, totp_secret,
        totp_enabled, failed_attempts, locked_until, last_totp_step)
     VALUES ($1,$2,$3,$4,$5,TRUE,0,NULL,-1)
     ON CONFLICT (app, username) DO NOTHING
     RETURNING id`,
    [spec.app, spec.username, hash, spec.role, encrypt(base32)]
  );

  if (!res.rowCount) return null;

  const userId = res.rows[0].id;

  if (spec.app === "bank") {
    await client.query(
      `INSERT INTO bank_accounts (user_id, kind, balance_cents)
       VALUES ($1,'chequing',150000), ($1,'savings',0)
       ON CONFLICT (user_id, kind) DO NOTHING`,
      [userId]
    );
  }

  // Every bank user also needs a student profile, because that is the table the
  // tuition endpoint reads. Without one the IDOR finding has nothing to leak.
  if (spec.app === "bank" || spec.role === "student") {
    await client.query(
      `INSERT INTO student_profiles
         (user_id, display_name, program, year_of_study, tuition_cents)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, "Scan Student", "BSc Computer Science", 2, 425000]
    );
  }

  if (spec.role === "student") {
    await client.query(
      `INSERT INTO student_courses (user_id, code, title, term, grade)
       VALUES ($1,'COMP 2003','Data Structures','Fall 2026','B+'),
              ($1,'COMP 3113','Network Security','Fall 2026','A-')
       ON CONFLICT DO NOTHING`,
      [userId]
    );
  }

  return { userId, base32 };
}

async function seedDemoAccounts(pool) {
  const count = await pool.query("SELECT count(*)::int AS n FROM users");
  if (count.rows[0].n > 0) {
    log(`accounts: ${count.rows[0].n} already present, not seeding`);
    return;
  }

  log("accounts: users table is empty, seeding lab accounts");

  const client = await pool.connect();
  const created = [];

  try {
    await client.query("BEGIN");

    for (const spec of DEMO) {
      const result = await createUser(client, spec);
      if (result) {
        created.push({ ...spec, secret: result.base32 });
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`[bootstrap] seeding failed: ${error.message}`);
    client.release();
    return;
  }

  client.release();

  if (!created.length) {
    log("accounts: nothing to create");
    return;
  }

  // Printed once, on a brand-new database, because the TOTP secret cannot be
  // recovered from the database afterwards: it is stored encrypted.
  console.log("");
  console.log("==============================");
  console.log(" LAB ACCOUNTS CREATED");
  console.log("==============================");
  for (const a of created) {
    console.log(` ${a.label}`);
    console.log(`   app          : ${a.app}`);
    console.log(`   username     : ${a.username}`);
    console.log(`   password     : ${a.password}`);
    console.log(`   role         : ${a.role}`);
    console.log(`   totpSecret   : ${a.secret}`);
    console.log("");
  }
  console.log(" Save these now. The TOTP secrets are stored encrypted");
  console.log(" and cannot be printed again.");
  console.log("==============================");
  console.log("");
}

// --------------------------------------------------

async function main() {
  const pool = new pg.Pool({
    connectionString: DB_URL,
    connectionTimeoutMillis: 5000,
    statement_timeout: 30000,
  });

  try {
    if (!(await waitForDatabase(pool))) process.exit(1);
    if (!(await applySchema(pool))) process.exit(1);
    if (SEED) await seedDemoAccounts(pool);

    if (process.env.SESSION_SECRET === "dev-only-session-secret-change-before-use") {
      log("WARNING: SESSION_SECRET is the built-in development value.");
      log("         Set a real one before exposing this to a network.");
    }

    log("ready");
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch(error => {
  console.error(`[bootstrap] fatal: ${error.message}`);
  process.exit(1);
});

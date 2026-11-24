// ==================================================
// PROVISION DEMO ACCOUNTS FOR UI SCREENSHOTS
// ==================================================
// Creates two accounts with a FIXED TOTP secret so that headless
// screenshots can sign in without a human reading a code.
//
//   node make-demo-accounts.mjs
//
// Additive only: it never resets an existing scan account. Re-running
// re-issues the same two demo users.
// ==================================================

import "dotenv/config";
import pg from "pg";
import argon2 from "argon2";
import { randomBytes, createCipheriv } from "node:crypto";

const KEY = Buffer.from(process.env.TOTP_ENCRYPTION_KEY, "hex");

function encrypt(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

const PASSWORD = "DemoShots!2026";

const ACCOUNTS = [
  { app: "bank", username: "demo.bank", secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" },
  { app: "acadia", username: "demo.student", secret: "KRUGS4ZANFZSAYJAKRUGS4ZANFZSAYJA" }
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

for (const a of ACCOUNTS) {
  const hash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const r = await pool.query(
    `INSERT INTO users
       (app, username, password_hash, role, totp_secret,
        totp_enabled, failed_attempts, locked_until, last_totp_step)
     VALUES ($1,$2,$3,$4,$5,TRUE,0,NULL,-1)
     ON CONFLICT (app, username)
     DO UPDATE SET password_hash=EXCLUDED.password_hash,
                   totp_secret=EXCLUDED.totp_secret,
                   totp_enabled=TRUE,
                   failed_attempts=0,
                   locked_until=NULL,
                   last_totp_step=-1
     RETURNING id, role`,
    [a.app, a.username, hash, a.app === "bank" ? "bank_user" : "student", encrypt(a.secret)]
  );
  const id = r.rows[0].id;

  if (a.app === "bank") {
    await pool.query(
      `INSERT INTO bank_accounts (user_id, kind, balance_cents)
       VALUES ($1,'chequing',248750), ($1,'savings',120000)
       ON CONFLICT (user_id, kind) DO NOTHING`,
      [id]
    );
  } else {
    await pool.query(
      `INSERT INTO student_profiles (user_id, display_name, program, year_of_study, tuition_cents)
       VALUES ($1,'Shekin David Raj','BSc Computer Science',3,425000)
       ON CONFLICT (user_id) DO NOTHING`,
      [id]
    );
    const ex = await pool.query(`SELECT 1 FROM student_courses WHERE user_id=$1 LIMIT 1`, [id]);
    if (!ex.rowCount) {
      await pool.query(
        `INSERT INTO student_courses (user_id, code, title, term, grade)
         VALUES ($1,'COMP 3123','Computer Security','Fall 2026','A'),
                ($1,'COMP 3113','Network Security','Fall 2026','A-'),
                ($1,'COMP 2003','Data Structures','Winter 2026','B+')`,
        [id]
      );
    }
  }
  console.log(`${a.app}\t${a.username}\tid=${id}`);
}

await pool.end();
console.log("demo accounts ready");

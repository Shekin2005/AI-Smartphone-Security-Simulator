
"use strict";

import "dotenv/config";
import pg from "pg";
import argon2 from "argon2";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

const rl = createInterface({
  input: stdin,
  output: stdout
});

try {
  const username = (
    await rl.question("Administrator username: ")
  ).trim().toLowerCase();

  const password = await rl.question(
    "Administrator password (12-128 characters): "
  );

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    throw new Error("Invalid username");
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error(
      "Password must contain 12-128 characters"
    );
  }

  const hash = await argon2.hash(password, {
    type: argon2.argon2id
  });

  await pool.query(
    `INSERT INTO users
       (app, username, password_hash, role)
     VALUES ('acadia', $1, $2, 'admin')`,
    [username, hash]
  );

  console.log("Administrator account created successfully.");
  console.log("Next: Sign in and configure authenticator MFA.");

} catch (error) {
  if (error.code === "23505") {
    console.error("Username already exists for Acadia.");
  } else {
    console.error(error.message);
  }
} finally {
  rl.close();
  await pool.end();
}

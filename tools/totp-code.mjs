#!/usr/bin/env node
// ==================================================
// TOTP CODE HELPER (demo convenience)
// ==================================================
// The lab accounts use real TOTP. During a recording there is no time to open an
// authenticator app and retype a code, so this prints the current one.
//
//   node tools/totp-code.mjs <base32-secret>
//   node tools/totp-code.mjs OFLS6MD3GNEVKNRSHEYEW6DYLVIWSXRI
//
// Prints the code and how many seconds it stays valid. The secret is not stored
// anywhere by this script - pass it in.
// ==================================================

import { createHmac } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input) {
  let bits = "";

  for (const char of input.replace(/=+$/, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error(`Not a base32 character: ${char}`);
    }

    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];

  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return Buffer.from(bytes);
}

function code(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / 30);
  const message = Buffer.alloc(8);

  message.writeUInt32BE(Math.floor(counter / 2 ** 32), 0);
  message.writeUInt32BE(counter % 2 ** 32, 4);

  const hmac = createHmac("sha1", base32Decode(secret)).update(message).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1e6;

  return String(value).padStart(6, "0");
}

const secret = process.argv[2];

if (!secret) {
  console.error("usage: node tools/totp-code.mjs <base32-secret>");
  process.exit(1);
}

const secondsLeft = 30 - (Math.floor(Date.now() / 1000) % 30);
const now = code(secret);

console.log(now);
console.error(`(valid for ${secondsLeft}s; next: ${code(secret, Date.now() + secondsLeft * 1000)})`);

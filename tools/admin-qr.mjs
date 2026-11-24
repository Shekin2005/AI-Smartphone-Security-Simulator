// ==================================================
// RENDER A TOTP ENROLMENT QR CODE
// ==================================================
// Turns a base32 TOTP secret into an otpauth:// QR code, so an
// administrator can add the account to any authenticator app by
// scanning instead of typing 32 characters correctly.
//
// Usage:
//   node tools/admin-qr.mjs <base32-secret> <account-label> [outfile]
//
// Example:
//   node tools/admin-qr.mjs JBSWY3DPEHPK3PXP professor admin-totp-qr.png
//
// No secret is stored in this file; it is passed on the command line.
// ==================================================

import QRCode from "qrcode";

const [secret, account = "administrator", out = "admin-totp-qr.png"] =
  process.argv.slice(2);

if (!secret || !/^[A-Z2-7]+=*$/i.test(secret)) {
  console.error("Usage: node tools/admin-qr.mjs <base32-secret> <account-label> [outfile]");
  process.exit(1);
}

const ISSUER = "Smartphone Simulator";

const uri =
  `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(account)}` +
  `?secret=${secret.toUpperCase()}` +
  `&issuer=${encodeURIComponent(ISSUER)}` +
  `&algorithm=SHA1&digits=6&period=30`;

await QRCode.toFile(out, uri, { width: 720, margin: 2, errorCorrectionLevel: "M" });

console.log("otpauth URI:", uri);
console.log("written:", out);

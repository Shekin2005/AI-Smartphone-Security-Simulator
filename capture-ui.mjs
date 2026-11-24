// ==================================================
// CAPTURE UI SCREENSHOTS FOR THE SLIDES
// ==================================================
//   node capture-ui.mjs
//
// Signs in through the real phone UI (passcode 1234, password, TOTP)
// using two demo accounts, then saves screenshots of the banking
// dashboard, the tuition lookup, the student app and the attack lab.
// Each capture logs the visible screen and heading so the image can be
// verified without opening it.
// ==================================================

import puppeteer from "puppeteer-core";
import speakeasy from "speakeasy";
import { mkdirSync } from "node:fs";

const URL = "https://shekin.tail97139a.ts.net/";
const OUT = "docs/screens";
const PASSCODE = "1234";
const PASSWORD = "DemoShots!2026";

const BANK = { user: "demo.bank", secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" };
const STUDENT = { user: "demo.student", secret: "KRUGS4ZANFZSAYJAKRUGS4ZANFZSAYJA" };

mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const code = secret => speakeasy.totp({ secret, encoding: "base32" });

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 940, deviceScaleFactor: 2 });

async function state() {
  return page.evaluate(() => {
    const shown = [...document.querySelectorAll(".screen")].filter(
      s => s.offsetParent !== null
    ).map(s => s.id);
    const panels = [...document.querySelectorAll(".auth-panel, .content-panel")]
      .filter(p => p.offsetParent !== null)
      .map(p => p.id || p.className)
      .slice(0, 4);
    const h = [...document.querySelectorAll("h1,h2")]
      .filter(n => n.offsetParent !== null)
      .map(n => n.textContent.trim())
      .slice(0, 2);
    return { shown, panels, headings: h };
  });
}

const shot = async (name) => {
  await sleep(800);
  const s = await state();
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`saved ${name}  screen=${s.shown.join(",")}  heading=${s.headings.join(" / ")}`);
};

const click = async (sel) => {
  const el = await page.$(sel);
  if (!el) { console.log("  (missing)", sel); return false; }
  try { await el.click(); } catch {
    await page.evaluate(s => document.querySelector(s)?.click(), sel);
  }
  await sleep(600);
  return true;
};

async function boot() {
  await page.goto(URL, { waitUntil: "networkidle2" });
  await sleep(1200);
  await click("#power-button");
  await sleep(500);
  await click("#unlock-button");
  await sleep(600);
  for (const d of PASSCODE) {
    const b = await page.$(`button[data-digit="${d}"]`);
    if (b) await b.click();
    await sleep(180);
  }
  await sleep(1500);
}

async function type(sel, text) {
  await page.click(sel, { clickCount: 3 });
  await page.type(sel, text, { delay: 25 });
}

// --- 1. Home screen -------------------------------------------------------
await boot();
await shot("00-home");

// --- 2. Banking -----------------------------------------------------------
await click('button[data-open="banking"]');
await sleep(1400);
await page.waitForSelector("#bank-username", { visible: true, timeout: 15000 });
await type("#bank-username", BANK.user);
await type("#bank-password", PASSWORD);
await click('[data-login="bank"]');
await sleep(2200);
await page.waitForSelector("#bank-otp-input", { visible: true, timeout: 20000 });
await type("#bank-otp-input", code(BANK.secret));
await click('[data-verify="bank"]');
await sleep(3500);
await shot("01-banking-dashboard");

// --- 3. Tuition lookup, showing the object-level authorisation flaw -------
await click('[data-bank-panel="tuition"]');
await sleep(900);
const idInput = await page.$("#tuition-student-id, #bank-tuition-id, #tuition-id");
if (idInput) {
  await idInput.click({ clickCount: 3 });
  await idInput.type("AC00000034", { delay: 30 });
  await click("#tuition-lookup");
  await sleep(2200);
}
await shot("02-banking-tuition");

// --- 4. Student app -------------------------------------------------------
await boot();
await click('button[data-open="university"]');
await sleep(1400);
await click("#acadia-student-choice");
await sleep(900);
await page.waitForSelector("#acadia-username", { visible: true, timeout: 15000 });
await type("#acadia-username", STUDENT.user);
await type("#acadia-password", PASSWORD);
await click('[data-login="acadia"]');
await sleep(2200);
await page.waitForSelector("#acadia-otp-input", { visible: true, timeout: 20000 });
await type("#acadia-otp-input", code(STUDENT.secret));
await click('[data-verify="acadia"]');
await sleep(3500);
await shot("03-acadia-dashboard");

// --- 5. Attack lab --------------------------------------------------------
await boot();
await click('button[data-open="attack"]');
await sleep(2500);
await shot("04-attack-lab");

// --- 6. AI pentest console ------------------------------------------------
await boot();
await click('button[data-open="defender"]');
await sleep(2500);
await shot("05-ai-pentest");

await browser.close();
console.log("done");

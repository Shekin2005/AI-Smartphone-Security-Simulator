// Captures the tuition panel after a lookup for a student that the
// signed-in demo.bank user has no relationship with. Prints the
// feedback text so the disclosure can be confirmed without the image.
import puppeteer from "puppeteer-core";
import speakeasy from "speakeasy";

const URL = "https://shekin.tail97139a.ts.net/";
const PASSCODE = "1234";
const PASSWORD = "DemoShots!2026";
const BANK = { user: "demo.bank", secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP" };
const TARGET = "AC00000036";

const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 940, deviceScaleFactor: 2 });

await page.goto(URL, { waitUntil: "networkidle2" });
await sleep(1200);
await page.click("#power-button");
await sleep(500);
await page.click("#unlock-button");
await sleep(600);
for (const d of PASSCODE) {
  const b = await page.$(`button[data-digit="${d}"]`);
  if (b) await b.click();
  await sleep(180);
}
await sleep(1200);

await page.click('button[data-open="banking"]');
await sleep(1400);
await page.click("#bank-username", { clickCount: 3 });
await page.type("#bank-username", BANK.user, { delay: 25 });
await page.click("#bank-password", { clickCount: 3 });
await page.type("#bank-password", PASSWORD, { delay: 25 });
await page.click('[data-login="bank"]');
await sleep(2200);

await page.waitForSelector("#bank-otp-input", { visible: true, timeout: 20000 });
await page.click("#bank-otp-input", { clickCount: 3 });
await page.type("#bank-otp-input", speakeasy.totp({ secret: BANK.secret, encoding: "base32" }), { delay: 30 });
await page.click('[data-verify="bank"]');
await sleep(3500);

await page.click('[data-bank-panel="tuition"]');
await sleep(900);
await page.click("#tuition-student-id", { clickCount: 3 });
await page.type("#tuition-student-id", TARGET, { delay: 30 });
await page.click("#tuition-lookup");
await sleep(2500);

const info = await page.$eval("#tuition-student-info", n => n.textContent.trim());
console.log("own bank user:", BANK.user);
console.log("lookup target:", TARGET);
console.log("panel feedback:", JSON.stringify(info));

await page.screenshot({ path: "docs/screens/02-banking-tuition.png" });
console.log("saved 02-banking-tuition");

await browser.close();

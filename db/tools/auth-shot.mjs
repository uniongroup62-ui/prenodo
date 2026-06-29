// Authenticated visual-diff: log in to both apps via the browser, capture the
// same authenticated page, and pixel-diff Next vs PHP.
//   OUT_DIR=... node db/tools/auth-shot.mjs <nextPath> <phpPath> <name>
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const [nextPath, phpPath, name] = process.argv.slice(2);
const OUT = process.env.OUT_DIR || ".";
const W = 1440, H = 900;
const browser = await chromium.launch();

async function shoot(base, target, mode) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  if (mode === "next-api") {
    // deterministic login: set the session cookie via the JSON API (shared ctx cookies)
    await ctx.request.post(`${base}/api/manage/auth/login`, {
      data: { slug: "centroesteticoelite", email: "info@artebrand.it", password: "iosono98" },
    });
  } else {
    // PHP form login
    await page.goto(`${base}/manage/login`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.fill('input[name="login_slug"]', "centroesteticoelite");
    await page.fill('input[name="login_email"]', "info@artebrand.it");
    await page.fill('input[name="password"]', "iosono98");
    await Promise.all([
      page.waitForNavigation({ timeout: 45000 }).catch(() => {}),
      page.click('.auth-submit, button[type="submit"]'),
    ]);
    await page.waitForTimeout(1000);
  }
  await page.goto(`${base}${target}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.addStyleTag({ content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}" }).catch(() => {});
  await page.waitForTimeout(3000);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
  await ctx.close();
  return buf;
}

const a = PNG.sync.read(await shoot("http://localhost", phpPath, "php-form"));
const b = PNG.sync.read(await shoot("http://localhost:3000", nextPath, "next-api"));
const diff = new PNG({ width: W, height: H });
const mismatch = pixelmatch(a.data, b.data, diff.data, W, H, { threshold: 0.12 });
fs.writeFileSync(`${OUT}/${name}.php.png`, PNG.sync.write(a));
fs.writeFileSync(`${OUT}/${name}.next.png`, PNG.sync.write(b));
fs.writeFileSync(`${OUT}/${name}.diff.png`, PNG.sync.write(diff));
console.log(`${name}: ${mismatch} px differ = ${(mismatch / (W * H) * 100).toFixed(2)}%`);
await browser.close();

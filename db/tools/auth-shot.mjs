// Authenticated screenshots: log in via the browser, then capture a page.
//   OUT_DIR=... node db/tools/auth-shot.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const OUT = process.env.OUT_DIR || ".";
const W = 1440, H = 900;
const browser = await chromium.launch();

async function shoot(base, loginPath, target, out) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(`${base}${loginPath}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.fill('input[name="login_slug"]', "centroesteticoelite");
  await page.fill('input[name="login_email"]', "info@artebrand.it");
  await page.fill('input[name="password"]', "iosono98");
  await Promise.all([
    page.waitForNavigation({ timeout: 45000 }).catch(() => {}),
    page.click('.auth-submit, button[type="submit"]'),
  ]);
  await page.waitForTimeout(1500);
  await page.goto(`${base}${target}`, { waitUntil: "networkidle", timeout: 45000 });
  await page.addStyleTag({ content: "*{animation:none!important;transition:none!important}" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${out}`, clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`saved ${out} (${base}${target})`);
  await ctx.close();
}

await shoot("http://localhost:3000", "/manage/login", "/centroesteticoelite/shell-preview", "shell.next.png");
await shoot("http://localhost", "/manage/login", "/centroesteticoelite/index.php?page=dashboard", "shell.php.png");
await browser.close();

// Pixel-diff a Next page against the legacy PHP page.
//   OUT_DIR=... node db/tools/visual-diff.mjs <phpUrl> <nextUrl> <name> [WxH]
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "node:fs";

const [phpUrl, nextUrl, name, size] = process.argv.slice(2);
const OUT = process.env.OUT_DIR || ".";
const [W, H] = (size || "1440x900").split("x").map(Number);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const page = await ctx.newPage();

async function shot(url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.addStyleTag({ content: "*{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.waitForTimeout(400);
  return await page.screenshot({ clip: { x: 0, y: 0, width: W, height: H } });
}

const a = PNG.sync.read(await shot(phpUrl));
const b = PNG.sync.read(await shot(nextUrl));
const { width, height } = a;
const diff = new PNG({ width, height });
const mismatch = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.12 });
const pct = (mismatch / (width * height)) * 100;
fs.writeFileSync(`${OUT}/${name}.php.png`, PNG.sync.write(a));
fs.writeFileSync(`${OUT}/${name}.next.png`, PNG.sync.write(b));
fs.writeFileSync(`${OUT}/${name}.diff.png`, PNG.sync.write(diff));
console.log(`${name}: ${mismatch} px differ = ${pct.toFixed(2)}%  (php=${phpUrl} next=${nextUrl})`);
console.log(`saved ${OUT}/${name}.{php,next,diff}.png`);
await browser.close();

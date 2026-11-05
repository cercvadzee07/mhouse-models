// QA helper: render pages in a local Edge/Chrome and save screenshots + console errors.
// Usage: node scripts/screenshot.mjs <outDir> <width>x<height> <url> [url…]
// Env: BROWSER_PATH to override the browser executable; FULL=1 for full-page shots; SCROLL=px to scroll first.
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [outDir, size, ...urls] = process.argv.slice(2);
const [width, height] = size.split("x").map(Number);
mkdirSync(outDir, { recursive: true });

const executablePath =
  process.env.BROWSER_PATH ?? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const browser = await chromium.launch({
  executablePath,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });

for (const [i, url] of urls.entries()) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  const res = await page.goto(url, { waitUntil: "networkidle", timeout: 90_000 }).catch((e) => ({ status: () => `ERR ${e.message}` }));
  await page.waitForTimeout(Number(process.env.WAIT ?? 3500));
  if (process.env.SCROLL) {
    await page.evaluate((y) => window.scrollTo(0, Number(y)), process.env.SCROLL);
    await page.waitForTimeout(1800);
  }
  const file = join(outDir, `${String(i).padStart(2, "0")}-${width}.png`);
  await page.screenshot({ path: file, fullPage: process.env.FULL === "1" });
  if (process.env.STEPS) {
    // Scroll through the page one viewport at a time so scroll-triggered reveals run.
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    let step = 1;
    for (let y = height; y < total && step <= Number(process.env.STEPS); y += height, step++) {
      await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
      await page.waitForTimeout(1600);
      await page.screenshot({ path: join(outDir, `${String(i).padStart(2, "0")}-${width}-s${String(step).padStart(2, "0")}.png`) });
    }
  }
  console.log(JSON.stringify({ url, status: res?.status?.(), file, title: await page.title(), errors: errors.slice(0, 8) }));
  await page.close();
}
await browser.close();

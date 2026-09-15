#!/usr/bin/env node
// Renders poster.webp (1200×1200) and og.png (1200×630) for a product by screenshotting the real
// viewer in poster mode. Requires the app to be running (default http://localhost:3000).
//   node pipeline/poster.mjs orca [--url http://localhost:3210] [--version 1]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { OUT_DIR, log } from "./lib.mjs";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
const opt = (name, def) => (args.includes(name) ? args[args.indexOf(name) + 1] : def);
if (!slug) {
  console.error("usage: node pipeline/poster.mjs <slug> [--url http://localhost:3000] [--version N]");
  process.exit(1);
}
const url = opt("--url", "http://localhost:3000");
const version = Number(opt("--version", "1"));
const outDir = path.join(OUT_DIR, slug, `v${version}`);
if (!fs.existsSync(outDir)) {
  console.error(`No pipeline output at ${outDir} — run the pipeline first.`);
  process.exit(1);
}

const browser = await chromium.launch({
  channel: process.env.POSTER_BROWSER ?? "msedge",
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1200 }, deviceScaleFactor: 1 });
  await page.goto(`${url}/embed/${slug}?poster=1`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-loaded="true"]', { timeout: 60_000 });
  await page.waitForTimeout(800); // let the contact shadow + env map settle
  const png = await page.screenshot({ omitBackground: true, type: "png" });

  // Poster: transparent product on the catalogue's light surface.
  await sharp(png).flatten({ background: "#f4f4f4" }).webp({ quality: 86 }).toFile(path.join(outDir, "poster.webp"));
  log("poster", "poster.webp 1200×1200");

  // OG image: centred on a white canvas with generous margins.
  const product = await sharp(png).resize(560, 560, { fit: "inside" }).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: "#ffffff" } })
    .composite([{ input: product, gravity: "centre" }])
    .png()
    .toFile(path.join(outDir, "og.png"));
  log("poster", "og.png 1200×630");
} finally {
  await browser.close();
}

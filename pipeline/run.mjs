#!/usr/bin/env node
// BOSQ model pipeline — usage: npm run pipeline -- <slug> [--version N]
//
//   models-src/<slug>/<slug>.glb  (preferred: Blender export with PBR materials)
//   models-src/<slug>/*.obj       (fallback: converted with obj2gltf)
//   models-src/<slug>/product.json  hand-written product metadata (name, variants, …)
//
//   → public/models/<slug>/v<N>/{<slug>.glb, <slug>.lod1.glb, manifest.json}
//
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  BUDGETS,
  OUT_DIR,
  ROOT,
  SRC_DIR,
  WORK_DIR,
  bounds,
  countTriangles,
  createIO,
  ensureDir,
  fileSize,
  fmtMB,
  log,
  optimise,
} from "./lib.mjs";

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
if (!slug) {
  console.error("usage: npm run pipeline -- <slug> [--version N]");
  process.exit(1);
}
const versionArg = args.indexOf("--version");
const version = versionArg >= 0 ? Number(args[versionArg + 1]) : 1;

const srcDir = path.join(SRC_DIR, slug);
const workDir = ensureDir(path.join(WORK_DIR, slug));
const outDir = ensureDir(path.join(OUT_DIR, slug, `v${version}`));
const productJsonPath = path.join(srcDir, "product.json");

if (!fs.existsSync(srcDir)) {
  console.error(`No source folder at ${srcDir}`);
  process.exit(1);
}
const product = fs.existsSync(productJsonPath)
  ? JSON.parse(fs.readFileSync(productJsonPath, "utf8"))
  : {};

console.log(`\nBOSQ pipeline · ${slug} · v${version}\n`);

// 1. Source → raw GLB -------------------------------------------------------
const rawGlb = path.join(workDir, "raw.glb");
const blenderGlb = fs
  .readdirSync(srcDir)
  .find((f) => f.toLowerCase().endsWith(".glb"));
const obj = fs.readdirSync(srcDir).find((f) => f.toLowerCase().endsWith(".obj"));

if (blenderGlb) {
  log("source", `using Blender export ${blenderGlb}`);
  fs.copyFileSync(path.join(srcDir, blenderGlb), rawGlb);
} else if (obj) {
  log("source", `converting ${obj} with obj2gltf`);
  const bin = path.join(ROOT, "node_modules", "obj2gltf", "bin", "obj2gltf.js");
  execFileSync(process.execPath, [bin, "-i", path.join(srcDir, obj), "-o", rawGlb, "--metallicRoughness"], {
    stdio: "inherit",
  });
} else {
  console.error("No .glb or .obj found in", srcDir);
  process.exit(1);
}

// 2. Optimise tiers ---------------------------------------------------------
const io = await createIO();
const rawDoc = await io.read(rawGlb);
const rawTris = countTriangles(rawDoc);
const rawBounds = bounds(rawDoc);
log("source", `${rawTris.toLocaleString()} triangles, ${fmtMB(fileSize(rawGlb))}`);
log(
  "source",
  `bounds W ${rawBounds.size[0].toFixed(3)} × H ${rawBounds.size[1].toFixed(3)} × D ${rawBounds.size[2].toFixed(3)} m`,
);

// Pick simplification ratios that land inside the budget with headroom.
const targetRatio = (budget) => Math.min(1, (budget * 0.9) / rawTris);

const tiers = [
  { key: "high", file: `${slug}.glb`, budget: BUDGETS.high, ratio: targetRatio(BUDGETS.high.maxTriangles), error: 0.0008 },
  { key: "low", file: `${slug}.lod1.glb`, budget: BUDGETS.low, ratio: targetRatio(BUDGETS.low.maxTriangles), error: 0.002 },
];

const stats = {};
for (const tier of tiers) {
  console.log(`\n· ${tier.key} tier`);
  const doc = await io.read(rawGlb);
  const { after } = await optimise(doc, {
    ratio: tier.ratio,
    error: tier.error,
    textureSize: tier.budget.textureSize,
  });
  const outPath = path.join(outDir, tier.file);
  await io.write(outPath, doc);
  const bytes = fileSize(outPath);
  const overTris = after > tier.budget.maxTriangles;
  const overBytes = bytes > tier.budget.maxBytes;
  log("write", `${tier.file} — ${fmtMB(bytes)}, ${after.toLocaleString()} tris ${overTris || overBytes ? "⚠ OVER BUDGET" : "✓ within budget"}`);
  stats[tier.key] = { triangles: after, sizeBytes: bytes, file: tier.file };
  if (overTris || overBytes) process.exitCode = 2;
}

// 3. Manifest ---------------------------------------------------------------
const base = `/models/${slug}/v${version}`;
const manifest = {
  slug,
  version,
  name: product.name ?? { en: slug },
  description: product.description ?? {},
  category: product.category ?? "chairs",
  model: {
    high: `${base}/${stats.high.file}`,
    low: `${base}/${stats.low.file}`,
    usdz: product.usdz ? `${base}/${slug}.usdz` : null,
  },
  poster: product.poster ?? `${base}/poster.webp`,
  og: fs.existsSync(path.join(outDir, "og.png")) ? `${base}/og.png` : null,
  bounds: {
    w: +rawBounds.size[0].toFixed(3),
    d: +rawBounds.size[2].toFixed(3),
    h: +rawBounds.size[1].toFixed(3),
    center: rawBounds.min.map((v, i) => +((v + rawBounds.max[i]) / 2).toFixed(3)),
  },
  dimensionsLabel: product.dimensionsLabel ?? null,
  camera: product.camera ?? { position: [1.8, 1.2, 2.2], target: [0, 0.65, 0], fov: 32 },
  materials: product.materials ?? {},
  variants: product.variants ?? [],
  hotspots: product.hotspots ?? [],
  stats: { source: { triangles: rawTris, sizeBytes: fileSize(rawGlb) }, ...stats },
  productUrl: product.productUrl ?? null,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
log("write", "manifest.json");

// 4. Placeholder poster from the source thumbnail — only until `npm run poster` renders the real one.
const poster = fs.readdirSync(srcDir).find((f) => /^(poster|thumbnail)\.(webp|png|jpg)$/i.test(f));
const posterOut = path.join(outDir, "poster.webp");
if (poster && !product.poster && !fs.existsSync(posterOut)) {
  const { default: sharp } = await import("sharp");
  await sharp(path.join(srcDir, poster)).resize(1200, 1200, { fit: "inside" }).webp({ quality: 82 }).toFile(posterOut);
  log("write", "poster.webp (from source thumbnail)");
}

console.log(`\nDone → ${path.relative(process.cwd(), outDir)}\n`);

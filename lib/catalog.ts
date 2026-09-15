// Catalogue access. Phase 1 reads data/catalog.json + the manifests the pipeline wrote
// into public/models. Phase 3 swaps the body of these two functions for backend.bosq.ae.
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import type { ProductManifest } from "./manifest";

interface CatalogEntry {
  slug: string;
  version: number;
  published: boolean;
}

const ROOT = process.cwd();
const catalogPath = path.join(ROOT, "data", "catalog.json");

async function readCatalog(): Promise<CatalogEntry[]> {
  const raw = await fs.readFile(catalogPath, "utf8");
  return JSON.parse(raw) as CatalogEntry[];
}

async function readManifest(slug: string, version: number): Promise<ProductManifest | null> {
  const p = path.join(ROOT, "public", "models", slug, `v${version}`, "manifest.json");
  try {
    const raw = await fs.readFile(p, "utf8");
    const manifest = JSON.parse(raw) as ProductManifest;
    const base = process.env.MODELS_BASE_URL; // e.g. https://models.bosq.ae — when set, models live off-site
    if (base) {
      const rebase = (u: string | null) => (u && u.startsWith("/models/") ? base + u.slice("/models".length) : u);
      manifest.model.high = rebase(manifest.model.high)!;
      manifest.model.low = rebase(manifest.model.low)!;
      manifest.model.usdz = rebase(manifest.model.usdz);
      manifest.poster = rebase(manifest.poster)!;
      manifest.og = rebase(manifest.og);
    }
    return manifest;
  } catch {
    return null;
  }
}

export async function listProducts(): Promise<ProductManifest[]> {
  const entries = (await readCatalog()).filter((e) => e.published);
  const manifests = await Promise.all(entries.map((e) => readManifest(e.slug, e.version)));
  return manifests.filter((m): m is ProductManifest => m !== null);
}

export async function getProduct(slug: string): Promise<ProductManifest | null> {
  const entry = (await readCatalog()).find((e) => e.slug === slug);
  if (!entry) return null;
  return readManifest(entry.slug, entry.version);
}

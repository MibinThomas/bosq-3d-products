// Shared helpers for the BOSQ model pipeline.
import { NodeIO, PropertyType } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  flatten,
  join,
  meshopt,
  prune,
  quantize,
  reorder,
  simplify,
  textureCompress,
  weld,
} from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const SRC_DIR = path.join(ROOT, "models-src");
export const WORK_DIR = path.join(ROOT, ".pipeline-work");
export const OUT_DIR = path.join(ROOT, "public", "models");

// Budgets from docs/IMPLEMENTATION_PLAN.md §5.2 — the pipeline fails a build that exceeds them.
export const BUDGETS = {
  high: { maxBytes: 3 * 1024 * 1024, maxTriangles: 150_000, textureSize: 2048 },
  low: { maxBytes: 1 * 1024 * 1024, maxTriangles: 50_000, textureSize: 1024 },
};

export async function createIO() {
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  return new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
}

export function log(step, msg) {
  console.log(`  [${step}] ${msg}`);
}

export function countTriangles(doc) {
  let tris = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const n = idx ? idx.getCount() : prim.getAttribute("POSITION").getCount();
      tris += n / 3;
    }
  }
  return Math.round(tris);
}

export function bounds(doc) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      const pMin = pos.getMin([]);
      const pMax = pos.getMax([]);
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], pMin[i]);
        max[i] = Math.max(max[i], pMax[i]);
      }
    }
  }
  return { min, max, size: max.map((v, i) => v - min[i]) };
}

/**
 * Optimise a glTF document in place for a given tier.
 * @param {import('@gltf-transform/core').Document} doc
 * @param {{ratio:number, error:number, textureSize:number, level?:'medium'|'high'}} opts
 */
export async function optimise(doc, opts) {
  const { ratio, error, textureSize, level = "high" } = opts;
  const before = countTriangles(doc);

  await doc.transform(
    // Never dedup materials: untextured sources have identical materials, but variants
    // target them by name (Set1 = upholstery, Set2 = mesh, Set3 = frame).
    dedup({ propertyTypes: [PropertyType.ACCESSOR, PropertyType.MESH, PropertyType.TEXTURE] }),
    // Keep UVs even when no texture references them yet — textures arrive later.
    prune({ keepAttributes: true, keepLeaves: false }),
    flatten(),
    join({ keepNamed: true }), // keep material-named primitives separate (variants target them)
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error, lockBorder: false }),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      resize: [textureSize, textureSize],
      quality: 85,
    }),
    reorder({ encoder: MeshoptEncoder }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }),
    meshopt({ encoder: MeshoptEncoder, level }),
  );

  const after = countTriangles(doc);
  log("simplify", `${before.toLocaleString()} → ${after.toLocaleString()} triangles (ratio ${ratio})`);
  return { before, after };
}

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
  return p;
}

export function fileSize(p) {
  return fs.statSync(p).size;
}

export function fmtMB(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Split a material's triangles into a new material by position, so parts an artist merged into one
 * slot (base star + arms, gas lift + castors, lever + frame) can be coloured separately.
 * A triangle moves to `into` when every vertex satisfies all given tests:
 *   minY / maxY        height range in metres (aliases: aboveY = minY, belowY = maxY)
 *   minX / maxX / minZ / maxZ   bounding box in metres (model space)
 *   minRadius / maxRadius   horizontal distance from the model's centre axis, in metres
 *   minNormalY         face must point upward at least this much (0.3 = top surfaces only)
 * @param {import('@gltf-transform/core').Document} doc
 * @param {{material:string, into:string, minY?:number, maxY?:number, aboveY?:number, belowY?:number, minX?:number, maxX?:number, minZ?:number, maxZ?:number, minRadius?:number, maxRadius?:number, minNormalY?:number}[]} splits
 */
export function splitMaterialsByHeight(doc, splits) {
  const root = doc.getRoot();
  const { min, max } = bounds(doc);
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  for (const split of splits) {
    const { material, into, minNormalY, minRadius, maxRadius, minX, maxX, minZ, maxZ } = split;
    const minY = split.minY ?? split.aboveY;
    const maxY = split.maxY ?? split.belowY;
    const target = root.listMaterials().find((m) => m.getName() === material);
    if (!target) {
      log("split", `material ${material} not found — skipped`);
      continue;
    }
    const newMat = target.clone().setName(into);
    let moved = 0;
    const passes = (v) => {
      if (minY !== undefined && v[1] < minY) return false;
      if (maxY !== undefined && v[1] > maxY) return false;
      if (minX !== undefined && v[0] < minX) return false;
      if (maxX !== undefined && v[0] > maxX) return false;
      if (minZ !== undefined && v[2] < minZ) return false;
      if (maxZ !== undefined && v[2] > maxZ) return false;
      if (minRadius !== undefined || maxRadius !== undefined) {
        const r = Math.hypot(v[0] - cx, v[2] - cz);
        if (minRadius !== undefined && r < minRadius) return false;
        if (maxRadius !== undefined && r > maxRadius) return false;
      }
      return true;
    };
    for (const mesh of root.listMeshes()) {
      for (const prim of mesh.listPrimitives()) {
        if (prim.getMaterial() !== target) continue;
        const pos = prim.getAttribute("POSITION");
        const idx = prim.getIndices();
        const arr = idx.getArray();
        const moving = [];
        const staying = [];
        const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
        for (let i = 0; i < arr.length; i += 3) {
          pos.getElement(arr[i], a); pos.getElement(arr[i + 1], b); pos.getElement(arr[i + 2], c);
          let move = passes(a) && passes(b) && passes(c);
          if (move && minNormalY !== undefined) {
            // Face normal from winding: (b - a) × (c - a); keep only faces tilted upward enough.
            const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
            const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2];
            const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
            const len = Math.hypot(nx, ny, nz) || 1;
            if (ny / len < minNormalY) move = false;
          }
          (move ? moving : staying).push(arr[i], arr[i + 1], arr[i + 2]);
        }
        if (moving.length === 0) continue;
        const newIdx = doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(moving)).setBuffer(idx.getBuffer());
        const newPrim = doc.createPrimitive().setMode(prim.getMode()).setMaterial(newMat).setIndices(newIdx);
        for (const sem of prim.listSemantics()) newPrim.setAttribute(sem, prim.getAttribute(sem));
        idx.setArray(new Uint32Array(staying));
        mesh.addPrimitive(newPrim);
        moved += moving.length / 3;
      }
    }
    const rule = [
      minY !== undefined && `y ≥ ${minY}`, maxY !== undefined && `y ≤ ${maxY}`,
      minX !== undefined && `x ≥ ${minX}`, maxX !== undefined && `x ≤ ${maxX}`,
      minZ !== undefined && `z ≥ ${minZ}`, maxZ !== undefined && `z ≤ ${maxZ}`,
      minRadius !== undefined && `r ≥ ${minRadius}`, maxRadius !== undefined && `r ≤ ${maxRadius}`,
      minNormalY !== undefined && `facing up ≥ ${minNormalY}`,
    ].filter(Boolean).join(", ");
    log("split", `${material} → ${into}: ${moved.toLocaleString()} triangles (${rule})`);
  }
}

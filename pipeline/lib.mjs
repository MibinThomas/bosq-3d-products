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

/**
 * Two-tone castor wheels: for every connected component of `material` below `maxY`, find the wheel
 * axle (axis of least spread) and move the outer `tyreFraction` of the radius to `into`, leaving
 * the hub in the original material.
 * @param {import('@gltf-transform/core').Document} doc
 * @param {{material:string, into:string, maxY?:number, tyreFraction?:number}} opts
 */
export function splitWheelTyres(doc, { material, into, maxY = 0.1, tyreFraction = 0.78 }) {
  const root = doc.getRoot();
  const target = root.listMaterials().find((m) => m.getName() === material);
  if (!target) {
    log("tyres", `material ${material} not found — skipped`);
    return;
  }
  const tyreMat = target.clone().setName(into);
  let moved = 0;
  for (const mesh of root.listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMaterial() !== target) continue;
      const pos = prim.getAttribute("POSITION");
      const idx = prim.getIndices();
      const arr = idx.getArray();
      const n = pos.getCount();
      // Union-find over welded positions → connected components.
      const key = new Map();
      const id = new Int32Array(n);
      const v = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        pos.getElement(i, v);
        const k = `${v[0].toFixed(4)},${v[1].toFixed(4)},${v[2].toFixed(4)}`;
        if (!key.has(k)) key.set(k, i);
        id[i] = key.get(k);
      }
      const parent = new Int32Array(n);
      for (let i = 0; i < n; i++) parent[i] = i;
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
      for (let i = 0; i < arr.length; i += 3) { unite(id[arr[i]], id[arr[i + 1]]); unite(id[arr[i]], id[arr[i + 2]]); }
      // Per component: centroid, covariance → axle (smallest-variance axis), max in-plane radius.
      const comps = new Map();
      for (let i = 0; i < n; i++) {
        pos.getElement(i, v);
        const r = find(id[i]);
        let c = comps.get(r);
        if (!c) { c = { pts: [], maxY: -Infinity }; comps.set(r, c); }
        c.pts.push([v[0], v[1], v[2]]);
        c.maxY = Math.max(c.maxY, v[1]);
      }
      const isTyre = new Uint8Array(n);
      for (const c of comps.values()) {
        if (c.maxY > maxY || c.pts.length < 50) continue;
        const m = [0, 0, 0];
        for (const p of c.pts) { m[0] += p[0]; m[1] += p[1]; m[2] += p[2]; }
        m[0] /= c.pts.length; m[1] /= c.pts.length; m[2] /= c.pts.length;
        const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        for (const p of c.pts) {
          const d = [p[0] - m[0], p[1] - m[1], p[2] - m[2]];
          for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += d[a] * d[b];
        }
        // Smallest eigenvector via power iteration on (trace·I − C).
        const tr = C[0][0] + C[1][1] + C[2][2];
        const M = C.map((row, a) => row.map((x, b) => (a === b ? tr : 0) - x));
        let ax = [0.3, 0.5, 0.8];
        for (let it = 0; it < 60; it++) {
          const y = [0, 1, 2].map((a) => M[a][0] * ax[0] + M[a][1] * ax[1] + M[a][2] * ax[2]);
          const len = Math.hypot(...y) || 1;
          ax = y.map((x) => x / len);
        }
        c.axle = ax; c.centre = m;
        let rMax = 0;
        c.r = c.pts.map((p) => {
          const d = [p[0] - m[0], p[1] - m[1], p[2] - m[2]];
          const along = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2];
          const r = Math.hypot(d[0] - along * ax[0], d[1] - along * ax[1], d[2] - along * ax[2]);
          rMax = Math.max(rMax, r);
          return r;
        });
        c.rMax = rMax;
      }
      // Mark vertices on the tyre.
      const cursor = new Map();
      for (let i = 0; i < n; i++) {
        const c = comps.get(find(id[i]));
        if (!c || !c.r) continue;
        const k = cursor.get(c) ?? 0;
        cursor.set(c, k + 1);
        if (c.r[k] >= c.rMax * tyreFraction) isTyre[i] = 1;
      }
      const moving = [];
      const staying = [];
      for (let i = 0; i < arr.length; i += 3) {
        const t = isTyre[arr[i]] && isTyre[arr[i + 1]] && isTyre[arr[i + 2]];
        (t ? moving : staying).push(arr[i], arr[i + 1], arr[i + 2]);
      }
      if (moving.length === 0) continue;
      const newIdx = doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(moving)).setBuffer(idx.getBuffer());
      const newPrim = doc.createPrimitive().setMode(prim.getMode()).setMaterial(tyreMat).setIndices(newIdx);
      for (const sem of prim.listSemantics()) newPrim.setAttribute(sem, prim.getAttribute(sem));
      idx.setArray(new Uint32Array(staying));
      mesh.addPrimitive(newPrim);
      moved += moving.length / 3;
    }
  }
  log("tyres", `${material} → ${into}: ${moved.toLocaleString()} triangles (outer ${Math.round((1 - tyreFraction) * 100)}% of wheel radius)`);
}

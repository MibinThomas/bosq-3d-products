"use client";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, DoubleSide, FrontSide, Mesh, MeshStandardMaterial, type Object3D } from "three";
import type { MaterialOverride, MaterialRole, ProductManifest } from "@/lib/manifest";
import { useViewer } from "@/lib/store";
import { clearPatternProjection, fabricMap, meshAlphaMap, meshShadeMap, projectPatternInWorldSpace } from "./textures";

/**
 * Base PBR look per material role. Procedural surface patterns stand in for baked texture sets;
 * a material that already carries its own maps keeps them and only receives roughness/metalness.
 */
const ROLE_DEFAULTS: Record<MaterialRole, MaterialOverride> = {
  upholstery: { color: "#4B5563", roughness: 0.9, metalness: 0 },
  mesh: { color: "#4B5563", roughness: 0.7, metalness: 0 },
  frame: { color: "#F8F8F8", roughness: 0.45, metalness: 0 }, // white nylon (BOSQ Orca)
  base: { color: "#BEC1C5", roughness: 0.4, metalness: 0.25 }, // grey nylon / aluminium base star, lumbar ribs
  hardware: { color: "#1C1C1E", roughness: 0.35, metalness: 0.4 }, // black gas lift, mechanism, castor tyres
  polished: { color: "#D9DCE0", roughness: 0.18, metalness: 0.45 }, // shiny light-grey armrest pads
  steel: { color: "#C8CBCF", roughness: 0.25, metalness: 0.95 }, // gas-lift piston
  tyre: { color: "#74777C", roughness: 0.75, metalness: 0 }, // castor tread — darker grey than the hub
  plastic: { color: "#1F2124", roughness: 0.6, metalness: 0 }, // black nylon (height-adjust lever)
  wood: { color: "#8B6A4A", roughness: 0.6, metalness: 0 },
  glass: { color: "#DDE6EE", roughness: 0.05, metalness: 0 },
  other: { color: "#9CA3AF", roughness: 0.6, metalness: 0 },
};

/** Distinct colours for the material-identification debug mode (`/embed/<slug>?debug=materials`). */
export const DEBUG_PALETTE = ["#E6194B", "#3CB44B", "#4363D8", "#F58231", "#911EB4", "#42D4F4", "#F032E6", "#BFEF45", "#FABED4", "#469990"];

interface ModelProps {
  url: string;
  manifest: ProductManifest;
}

export function Model({ url, manifest }: ModelProps) {
  // Meshopt-compressed GLB — drei wires up the MeshoptDecoder; Draco is not used.
  const { scene } = useGLTF(url, false, true);
  const sku = useViewer((s) => s.sku);
  const debugMaterials = useViewer((s) => s.debugMaterials);
  const setLoaded = useViewer((s) => s.setLoaded);
  const invalidate = useThree((s) => s.invalidate);

  // Map GLB material name → role once.
  const roleOf = useMemo(() => {
    const map = new Map<string, MaterialRole>();
    for (const [name, def] of Object.entries(manifest.materials)) map.set(name, def.role);
    return (name: string): MaterialRole => map.get(name) ?? "other";
  }, [manifest.materials]);

  // Apply base look + variant overrides whenever the SKU changes.
  useEffect(() => {
    const variant = manifest.variants.find((v) => v.sku === sku) ?? manifest.variants[0];
    const order = Object.keys(manifest.materials); // legend order in the debug overlay
    const hasBakedTextures = (m: MeshStandardMaterial) => Boolean(m.map && m.map.image && !(m.map.image instanceof HTMLCanvasElement));

    scene.traverse((obj: Object3D) => {
      if (!(obj instanceof Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!(mat instanceof MeshStandardMaterial)) continue;

        if (debugMaterials) {
          const i = order.indexOf(mat.name);
          mat.map = null;
          mat.alphaMap = null;
          mat.transparent = false;
          mat.alphaTest = 0;
          mat.color = new Color(i >= 0 ? DEBUG_PALETTE[i % DEBUG_PALETTE.length] : "#999999");
          mat.roughness = 0.7;
          mat.metalness = 0;
          mat.needsUpdate = true;
          continue;
        }

        const role = roleOf(mat.name);
        const base = ROLE_DEFAULTS[role];
        const override = variant?.materials[role] ?? variant?.materials[mat.name];
        const merged: MaterialOverride = { ...base, ...override };
        const baked = hasBakedTextures(mat);

        if (merged.color) mat.color = new Color(merged.color);
        if (merged.roughness !== undefined && !mat.roughnessMap) mat.roughness = merged.roughness;
        if (merged.metalness !== undefined && !mat.metalnessMap) mat.metalness = merged.metalness;

        // Procedural surface patterns (skipped when the GLB ships real texture maps).
        if (!baked) {
          if (role === "mesh" && !merged.solid) {
            mat.map = meshShadeMap();
            mat.alphaMap = meshAlphaMap();
            // Blended, not alpha-tested: the ~2 mm weave is sub-pixel at normal viewing distance, and
            // blending averages it to a semi-transparent panel (like real mesh) instead of collapsing
            // to solid or vanishing at the alpha-test threshold. Near-zero alpha is still discarded and
            // depth is written so the panel sorts cleanly against the frame and seat.
            mat.alphaTest = 0.05;
            mat.transparent = true;
            mat.depthWrite = true;
            mat.side = DoubleSide;
            projectPatternInWorldSpace(mat, 60);
          } else if (role === "upholstery" || (role === "mesh" && merged.solid)) {
            mat.map = fabricMap();
            mat.alphaMap = null;
            mat.alphaTest = 0;
            mat.transparent = false;
            // The back panel is a single surface: keep it double-sided so it reads as fabric from behind too.
            mat.side = role === "mesh" ? DoubleSide : FrontSide;
            projectPatternInWorldSpace(mat, 24);
          } else {
            clearPatternProjection(mat);
            mat.map = null;
            mat.alphaMap = null;
            mat.alphaTest = 0;
            mat.transparent = false;
            mat.side = FrontSide;
          }
        }

        mat.envMapIntensity = role === "polished" || role === "steel" ? 1.3 : role === "frame" || role === "base" ? 0.9 : 0.75;
        mat.needsUpdate = true;
      }
      obj.castShadow = false;
      obj.receiveShadow = false;
    });
    invalidate();
  }, [scene, sku, manifest.variants, manifest.materials, roleOf, invalidate, debugMaterials]);

  useEffect(() => {
    setLoaded(true);
    invalidate();
    return () => setLoaded(false);
  }, [scene, setLoaded, invalidate]);

  return <primitive object={scene} />;
}

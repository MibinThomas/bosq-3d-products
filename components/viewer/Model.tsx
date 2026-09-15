"use client";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, Mesh, MeshStandardMaterial, type Object3D } from "three";
import type { MaterialOverride, MaterialRole, ProductManifest } from "@/lib/manifest";
import { useViewer } from "@/lib/store";

/**
 * Base PBR look per material role, used when the source has no textures yet
 * (or as the fallback underneath variant overrides).
 */
const ROLE_DEFAULTS: Record<MaterialRole, MaterialOverride> = {
  upholstery: { color: "#4B5563", roughness: 0.92, metalness: 0 },
  mesh: { color: "#25272B", roughness: 0.78, metalness: 0 },
  frame: { color: "#C2C6CC", roughness: 0.32, metalness: 0.9 },
  plastic: { color: "#1F2124", roughness: 0.55, metalness: 0 },
  wood: { color: "#8B6A4A", roughness: 0.6, metalness: 0 },
  glass: { color: "#DDE6EE", roughness: 0.05, metalness: 0 },
  other: { color: "#9CA3AF", roughness: 0.6, metalness: 0 },
};

interface ModelProps {
  url: string;
  manifest: ProductManifest;
}

export function Model({ url, manifest }: ModelProps) {
  // Meshopt-compressed GLB — drei wires up the MeshoptDecoder; Draco is not used.
  const { scene } = useGLTF(url, false, true);
  const sku = useViewer((s) => s.sku);
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
    scene.traverse((obj: Object3D) => {
      if (!(obj instanceof Mesh)) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!(mat instanceof MeshStandardMaterial)) continue;
        const role = roleOf(mat.name);
        const base = ROLE_DEFAULTS[role];
        const override = variant?.materials[role] ?? variant?.materials[mat.name];
        const merged = { ...base, ...override };
        // Only tint untextured materials — textured ones keep their base colour map.
        if (!mat.map && merged.color) mat.color = new Color(merged.color);
        if (merged.roughness !== undefined && !mat.roughnessMap) mat.roughness = merged.roughness;
        if (merged.metalness !== undefined && !mat.metalnessMap) mat.metalness = merged.metalness;
        mat.envMapIntensity = role === "frame" ? 1.2 : 0.8;
        mat.needsUpdate = true;
      }
      obj.castShadow = false;
      obj.receiveShadow = false;
    });
    invalidate();
  }, [scene, sku, manifest.variants, roleOf, invalidate]);

  useEffect(() => {
    setLoaded(true);
    invalidate();
    return () => setLoaded(false);
  }, [scene, setLoaded, invalidate]);

  return <primitive object={scene} />;
}

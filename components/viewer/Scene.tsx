"use client";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, ContactShadows, Environment, Lightformer, PerformanceMonitor, Preload } from "@react-three/drei";
import { Suspense, useState } from "react";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
import type { ProductManifest } from "@/lib/manifest";
import { useViewer } from "@/lib/store";
import { Model } from "./Model";
import { Controls } from "./Controls";
import { DimensionsOverlay } from "./DimensionsOverlay";

interface SceneProps {
  manifest: ProductManifest;
  onContextLost: () => void;
}

/**
 * The WebGL scene. Rendered on demand only (frameloop="demand") — an idle chair costs nothing.
 * Lighting is a procedural studio built from Lightformers so no HDRI download is needed.
 */
export function Scene({ manifest, onContextLost }: SceneProps) {
  const tier = useViewer((s) => s.tier);
  const showDimensions = useViewer((s) => s.showDimensions);
  // PerformanceMonitor can degrade the tier at runtime; the device tier is the ceiling.
  const [degraded, setDegraded] = useState(false);
  const quality: "high" | "low" = degraded ? "low" : tier;

  const modelUrl = tier === "high" ? manifest.model.high : manifest.model.low;
  const { position, fov } = manifest.camera;

  return (
    <Canvas
      frameloop="demand"
      shadows={false}
      dpr={quality === "high" ? [1, 1.75] : [1, 1.25]}
      camera={{ position, fov, near: 0.05, far: 50 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
        outputColorSpace: SRGBColorSpace,
      }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (e) => {
          e.preventDefault();
          onContextLost();
        });
      }}
      style={{ touchAction: "none" }}
    >
      <PerformanceMonitor
        onDecline={() => setDegraded(true)}
        onIncline={() => setDegraded(false)}
        flipflops={2}
      />
      <AdaptiveDpr pixelated={false} />

      {/* Procedural studio: one large soft top light, two cooler side panels, a warm fill. */}
      <Environment resolution={256} frames={1}>
        <group rotation={[-Math.PI / 3, 0, 0]}>
          <Lightformer intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={[10, 10, 1]} />
          <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={[10, 2, 1]} />
          <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={[10, 2, 1]} />
          <Lightformer intensity={0.6} rotation-y={Math.PI} position={[0, 1, 8]} scale={[6, 3, 1]} color="#ffe6c8" />
        </group>
      </Environment>
      <directionalLight position={[3, 5, 2]} intensity={0.8} />
      <ambientLight intensity={0.15} />

      <Suspense fallback={null}>
        <Model url={modelUrl} manifest={manifest} />
        <Preload all />
      </Suspense>

      <ContactShadows
        position={[manifest.bounds.center[0], 0.001, manifest.bounds.center[2]]}
        opacity={quality === "high" ? 0.55 : 0.4}
        scale={Math.max(manifest.bounds.w, manifest.bounds.d) * 2.6}
        blur={2.2}
        far={manifest.bounds.h}
        resolution={quality === "high" ? 512 : 256}
        frames={1}
      />

      {showDimensions && <DimensionsOverlay bounds={manifest.bounds} />}

      <Controls manifest={manifest} />
    </Canvas>
  );
}

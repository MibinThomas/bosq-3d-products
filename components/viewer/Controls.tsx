"use client";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { ProductManifest } from "@/lib/manifest";
import { useViewer } from "@/lib/store";

/**
 * Orbit controls tuned for furniture: no going under the floor, sensible zoom range
 * derived from the product's size, gentle auto-rotate until the first interaction.
 * The preset camera in the manifest assumes a landscape/square frame; in a narrow
 * portrait viewport the camera backs off so the whole product stays in shot.
 */
export function Controls({ manifest }: { manifest: ProductManifest }) {
  const ref = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const autoRotate = useViewer((s) => s.autoRotate);
  const stopAutoRotate = useViewer((s) => s.stopAutoRotate);
  const resetToken = useViewer((s) => s.resetToken);

  const extent = Math.max(manifest.bounds.w, manifest.bounds.h, manifest.bounds.d);
  const [tx, ty, tz] = manifest.camera.target;
  const [px, py, pz] = manifest.camera.position;
  const aspect = size.width / Math.max(1, size.height);

  // Frame the product: preset position, pushed back when the frame is narrower than it is tall.
  useEffect(() => {
    const target = new Vector3(tx, ty, tz);
    const offset = new Vector3(px, py, pz).sub(target);
    const factor = aspect < 1 ? Math.min(1.9, 1 / aspect) : 1;
    camera.position.copy(target).add(offset.multiplyScalar(factor));
    ref.current?.target.copy(target);
    ref.current?.update();
    invalidate();
  }, [resetToken, aspect, camera, px, py, pz, tx, ty, tz, invalidate]);

  return (
    <OrbitControls
      ref={ref}
      target={[tx, ty, tz]}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.8}
      enablePan={false}
      minDistance={extent * 0.9}
      maxDistance={extent * 4}
      minPolarAngle={0.15}
      maxPolarAngle={Math.PI / 2 - 0.02} // never below the floor
      autoRotate={autoRotate}
      autoRotateSpeed={0.6}
      onStart={stopAutoRotate}
      makeDefault
    />
  );
}

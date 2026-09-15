"use client";
import { Html, Line } from "@react-three/drei";
import type { ProductManifest } from "@/lib/manifest";

type Bounds = ProductManifest["bounds"];
type V3 = [number, number, number];

const LINE = "#F17423";
const TICK = 0.03;

function DimLine({ from, to, label, tick }: { from: V3; to: V3; label: string; tick: V3 }) {
  const mid: V3 = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
  const tickFrom = (p: V3): V3 => [p[0] - tick[0] * TICK, p[1] - tick[1] * TICK, p[2] - tick[2] * TICK];
  const tickTo = (p: V3): V3 => [p[0] + tick[0] * TICK, p[1] + tick[1] * TICK, p[2] + tick[2] * TICK];
  return (
    <group>
      <Line points={[from, to]} color={LINE} lineWidth={1.5} />
      <Line points={[tickFrom(from), tickTo(from)]} color={LINE} lineWidth={1.5} />
      <Line points={[tickFrom(to), tickTo(to)]} color={LINE} lineWidth={1.5} />
      <Html position={mid} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <span className="rounded bg-[#F17423] px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums whitespace-nowrap text-white shadow-sm">
          {label}
        </span>
      </Html>
    </group>
  );
}

const cm = (m: number) => `${Math.round(m * 100)} cm`;

/** Width, depth and height lines drawn just outside the product's bounding box. */
export function DimensionsOverlay({ bounds }: { bounds: Bounds }) {
  const [cx, , cz] = bounds.center;
  const gap = 0.08;
  const minX = cx - bounds.w / 2;
  const maxX = cx + bounds.w / 2;
  const minZ = cz - bounds.d / 2;
  const maxZ = cz + bounds.d / 2;
  const top = bounds.h;

  return (
    <group>
      {/* Width — along the front edge, on the floor */}
      <DimLine from={[minX, 0.002, maxZ + gap]} to={[maxX, 0.002, maxZ + gap]} label={cm(bounds.w)} tick={[0, 0, 1]} />
      {/* Depth — along the right edge, on the floor */}
      <DimLine from={[maxX + gap, 0.002, minZ]} to={[maxX + gap, 0.002, maxZ]} label={cm(bounds.d)} tick={[1, 0, 0]} />
      {/* Height — front-right vertical */}
      <DimLine from={[maxX + gap, 0, maxZ + gap]} to={[maxX + gap, top, maxZ + gap]} label={cm(bounds.h)} tick={[1, 0, 1]} />
    </group>
  );
}

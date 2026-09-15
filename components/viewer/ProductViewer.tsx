"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import type { Locale, ProductManifest } from "@/lib/manifest";
import { getDict } from "@/lib/i18n";
import { detectTier } from "@/lib/device";
import { useViewer } from "@/lib/store";
import { ViewerToolbar } from "@/components/ui/ViewerToolbar";
import { LoadingPoster } from "@/components/ui/LoadingPoster";
import { DEBUG_PALETTE } from "./Model";

// The WebGL scene is client-only and lazy: the poster paints first, the canvas hydrates after.
const Scene = dynamic(() => import("./Scene").then((m) => m.Scene), { ssr: false });

interface ProductViewerProps {
  manifest: ProductManifest;
  locale: Locale;
  initialSku?: string;
  /** Embedded inside bosq.ae — hides the header and talks to the parent via postMessage. */
  embed?: boolean;
  /** Pipeline poster render: no UI, no auto-rotate, transparent ground, `data-loaded` when ready. */
  poster?: boolean;
  /** Colour-code GLB materials and show a legend — for mapping material slots to roles. */
  debugMaterials?: boolean;
  className?: string;
}

export function ProductViewer({ manifest, locale, initialSku, embed = false, poster = false, debugMaterials = false, className = "" }: ProductViewerProps) {
  const dict = getDict(locale);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [contextLost, setContextLost] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const loaded = useViewer((s) => s.loaded);
  const setSku = useViewer((s) => s.setSku);
  const setTier = useViewer((s) => s.setTier);
  const sku = useViewer((s) => s.sku);
  const stopAutoRotate = useViewer((s) => s.stopAutoRotate);
  const setDebugMaterials = useViewer((s) => s.setDebugMaterials);

  useEffect(() => {
    setDebugMaterials(debugMaterials);
    return () => setDebugMaterials(false);
  }, [debugMaterials, setDebugMaterials]);
  const { progress } = useProgress();

  useEffect(() => {
    if (poster) stopAutoRotate();
  }, [poster, stopAutoRotate]);

  // Tier + initial variant, decided before the scene mounts.
  useEffect(() => {
    setTier(detectTier());
    setSku(initialSku ?? manifest.variants[0]?.sku ?? "");
  }, [initialSku, manifest.variants, setSku, setTier]);

  // Fullscreen tracking
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  const reloadScene = useCallback(() => {
    setContextLost(false);
    setSceneKey((k) => k + 1);
  }, []);

  // postMessage bridge — only when embedded in bosq.ae.
  useEffect(() => {
    if (!embed || typeof window === "undefined" || window.parent === window) return;
    const post = (msg: Record<string, unknown>) => window.parent.postMessage({ source: "bosq3d", ...msg }, "*");
    post({ type: "bosq3d:ready", slug: manifest.slug });
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; sku?: string } | undefined;
      if (data?.type === "bosq3d:setVariant" && data.sku) setSku(data.sku);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embed, manifest.slug, setSku]);

  useEffect(() => {
    if (!embed || typeof window === "undefined" || window.parent === window || !sku) return;
    window.parent.postMessage({ source: "bosq3d", type: "bosq3d:variant", sku }, "*");
  }, [embed, sku]);

  return (
    <div
      ref={wrapRef}
      className={`relative isolate aspect-square w-full overflow-hidden select-none sm:aspect-[4/3] ${poster ? "bg-transparent" : "bg-[#F4F4F4]"} ${fullscreen ? "aspect-auto! h-dvh" : ""} ${className}`}
      dir="ltr"
      data-loaded={loaded ? "true" : "false"}
    >
      {/* Poster: painted by the server, cross-fades out once the model is on screen. */}
      {!poster && (
        <LoadingPoster
          src={manifest.poster}
          alt={manifest.name[locale] ?? manifest.name.en}
          progress={progress}
          visible={!loaded}
          label={dict.loading}
        />
      )}

      {!contextLost && (
        <div className="absolute inset-0">
          <Scene key={sceneKey} manifest={manifest} onContextLost={() => setContextLost(true)} />
        </div>
      )}

      {contextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/80 p-6 text-center text-sm text-gray-700 backdrop-blur-sm">
          <p>{dict.contextLost}</p>
          <button type="button" onClick={reloadScene} className="rounded-md bg-[#F17423] px-4 py-2 font-medium text-white hover:bg-[#D9631A]">
            {dict.reload}
          </button>
        </div>
      )}

      {!poster && <ViewerToolbar manifest={manifest} locale={locale} fullscreen={fullscreen} onFullscreen={toggleFullscreen} />}

      {debugMaterials && (
        <ol className="absolute top-3 left-3 z-20 space-y-1 rounded bg-white/90 p-2 font-mono text-[11px] shadow-sm">
          {Object.keys(manifest.materials).map((name, i) => (
            <li key={name} className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: DEBUG_PALETTE[i % DEBUG_PALETTE.length] }} />
              {name} <span className="text-gray-400">{manifest.materials[name].role}</span>
            </li>
          ))}
        </ol>
      )}

      {loaded && !poster && (
        <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/70 px-3 py-1 text-[11px] text-gray-600 backdrop-blur-sm">
          {dict.dragToRotate}
        </p>
      )}
    </div>
  );
}

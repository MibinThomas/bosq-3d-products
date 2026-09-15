"use client";
import type { Locale, ProductManifest } from "@/lib/manifest";
import { getDict } from "@/lib/i18n";
import { useViewer } from "@/lib/store";
import { ArButton } from "./ArButton";

interface ViewerToolbarProps {
  manifest: ProductManifest;
  locale: Locale;
  fullscreen: boolean;
  onFullscreen: () => void;
}

const btn =
  "inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-gray-700 shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition hover:bg-white hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F17423] disabled:opacity-40";

export function ViewerToolbar({ manifest, locale, fullscreen, onFullscreen }: ViewerToolbarProps) {
  const dict = getDict(locale);
  const sku = useViewer((s) => s.sku);
  const setSku = useViewer((s) => s.setSku);
  const showDimensions = useViewer((s) => s.showDimensions);
  const toggleDimensions = useViewer((s) => s.toggleDimensions);
  const reset = useViewer((s) => s.reset);
  const loaded = useViewer((s) => s.loaded);

  return (
    <>
      {/* Right rail: view actions */}
      <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
        <button type="button" className={btn} onClick={reset} title={dict.reset} aria-label={dict.reset} disabled={!loaded}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" />
          </svg>
        </button>
        <button
          type="button"
          className={`${btn} ${showDimensions ? "bg-[#F17423]! text-white!" : ""}`}
          onClick={toggleDimensions}
          title={dict.dimensions}
          aria-label={dict.dimensions}
          aria-pressed={showDimensions}
          disabled={!loaded}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17h18M3 14v6M21 14v6M7 17v-2M11 17v-3M15 17v-2" /><path d="M6 4h12v6H6z" />
          </svg>
        </button>
        <button type="button" className={btn} onClick={onFullscreen} title={fullscreen ? dict.exitFullscreen : dict.fullscreen} aria-label={fullscreen ? dict.exitFullscreen : dict.fullscreen}>
          {fullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 3v6H3M15 3v6h6M9 21v-6H3M15 21v-6h6" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
            </svg>
          )}
        </button>
        <ArButton manifest={manifest} label={dict.viewInAR} className={btn} />
      </div>

      {/* Bottom-left: colour swatches */}
      {manifest.variants.length > 1 && (
        <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-full bg-white/85 px-2.5 py-1.5 shadow-sm ring-1 ring-black/5 backdrop-blur-sm" role="radiogroup" aria-label={dict.colour}>
          {manifest.variants.map((v) => {
            const active = v.sku === sku;
            return (
              <button
                key={v.sku}
                type="button"
                role="radio"
                aria-checked={active}
                title={v.label}
                aria-label={v.label}
                onClick={() => setSku(v.sku)}
                className={`h-6 w-6 rounded-full ring-2 ring-offset-2 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F17423] ${active ? "ring-[#F17423]" : "ring-transparent hover:ring-gray-300"}`}
                style={{ backgroundColor: v.swatch }}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

"use client";
import { useMemo, useSyncExternalStore } from "react";
import type { ProductManifest } from "@/lib/manifest";
import { isAndroid, isIOS } from "@/lib/device";

interface ArButtonProps {
  manifest: ProductManifest;
  label: string;
  className?: string;
}

type Platform = "ios" | "android" | "none";
const noop = () => () => {};
const platformSnapshot = (): Platform => (isIOS() ? "ios" : isAndroid() ? "android" : "none");
const serverSnapshot = (): Platform => "none";

/**
 * Native AR: iOS AR Quick Look needs a USDZ (rel="ar"); Android Scene Viewer takes the GLB via an intent URL.
 * Rendered only where the device supports it and the asset exists.
 */
export function ArButton({ manifest, label, className = "" }: ArButtonProps) {
  const platform = useSyncExternalStore(noop, platformSnapshot, serverSnapshot);

  const href = useMemo(() => {
    if (platform === "none") return null;
    const abs = (u: string) => new URL(u, window.location.origin).toString();
    if (platform === "ios") return manifest.model.usdz ? abs(manifest.model.usdz) : null;
    const file = abs(manifest.model.high);
    const fallback = encodeURIComponent(window.location.href);
    return (
      `intent://arvr.google.com/scene-viewer/1.0?file=${encodeURIComponent(file)}&mode=ar_preferred&title=${encodeURIComponent(manifest.name.en)}` +
      `#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=${fallback};end;`
    );
  }, [platform, manifest]);

  if (!href) return null;
  const ios = platform === "ios";

  return (
    <a href={href} rel={ios ? "ar" : undefined} className={className} title={label} aria-label={label}>
      {/* Quick Look requires an <img> as the first child of a rel="ar" link */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {ios && <img src={manifest.poster} alt="" className="hidden" />}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" />
      </svg>
    </a>
  );
}

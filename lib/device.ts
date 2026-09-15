// Client-side device tiering — decides which model file to request *before* loading anything.
export type Tier = "high" | "low";

interface NavigatorExtras extends Navigator {
  deviceMemory?: number;
  connection?: { effectiveType?: string; saveData?: boolean };
}

export function detectTier(): Tier {
  if (typeof window === "undefined") return "high";
  const nav = navigator as NavigatorExtras;

  if (nav.connection?.saveData) return "low";
  if (nav.connection?.effectiveType && /(^|[^4])[23]g$/.test(nav.connection.effectiveType)) return "low";
  if (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) return "low";
  if (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 2) return "low";

  // Low-end GPUs report themselves through the WebGL renderer string.
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? String(gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    if (/Mali-4|Mali-T[0-6]|Adreno \(TM\) [1-4]|PowerVR SGX|SwiftShader/i.test(renderer)) return "low";
  } catch {
    /* ignore */
  }
  return "high";
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

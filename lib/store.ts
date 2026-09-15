"use client";
import { create } from "zustand";
import type { Tier } from "./device";

interface ViewerState {
  sku: string | null;
  showDimensions: boolean;
  autoRotate: boolean;
  tier: Tier;
  loaded: boolean;
  resetToken: number;
  /** Colour-codes each GLB material so artists can map slots to roles. */
  debugMaterials: boolean;
  setSku: (sku: string) => void;
  toggleDimensions: () => void;
  stopAutoRotate: () => void;
  setTier: (tier: Tier) => void;
  setLoaded: (v: boolean) => void;
  reset: () => void;
  setDebugMaterials: (v: boolean) => void;
}

export const useViewer = create<ViewerState>((set) => ({
  sku: null,
  showDimensions: false,
  autoRotate: true,
  tier: "high",
  loaded: false,
  resetToken: 0,
  debugMaterials: false,
  setSku: (sku) => set({ sku }),
  toggleDimensions: () => set((s) => ({ showDimensions: !s.showDimensions })),
  stopAutoRotate: () => set({ autoRotate: false }),
  setTier: (tier) => set({ tier }),
  setLoaded: (loaded) => set({ loaded }),
  reset: () => set((s) => ({ resetToken: s.resetToken + 1, autoRotate: true })),
  setDebugMaterials: (debugMaterials) => set({ debugMaterials }),
}));

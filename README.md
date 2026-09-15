# BOSQ 3D Products

Interactive 3D product viewer for [bosq.ae](https://bosq.ae) — a standalone Next.js app that turns OBJ/GLB models into fast, premium in-browser 3D, embeddable on bosq.ae product pages. The full plan lives in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Stack

Next.js 16 (App Router) · React 19 · three.js · @react-three/fiber 9 · @react-three/drei · Tailwind CSS 4 · zustand · gltf-transform · obj2gltf · Vercel

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 → /en
```

Routes:

| Route | Purpose |
|---|---|
| `/en`, `/ar` | Catalogue |
| `/en/products/orca?sku=ORC-HB-BLACK` | Full product page (SEO shell + viewer) |
| `/embed/orca?sku=…&lang=en` | Chrome-less viewer for the bosq.ae iframe (`noindex`) |
| `/api/products/orca` | Product manifest JSON |

## Adding a product

1. Create `models-src/<slug>/` with either a Blender-exported `<slug>.glb` (preferred — PBR materials, named material slots) or the raw `.obj` + `.mtl` + textures.
2. Add `models-src/<slug>/product.json` — name (en/ar), category, dimensions label, camera preset, material roles, colour variants, bosq.ae product URL. See `models-src/orca/product.json`.
3. Run the pipeline:
   ```bash
   npm run pipeline -- <slug>            # → public/models/<slug>/v1/{<slug>.glb, <slug>.lod1.glb, manifest.json}
   npm run build && npm start            # poster rendering needs the app running
   npm run poster -- <slug> --url http://localhost:3000
   ```
   The pipeline fails (exit 2) if a tier exceeds its budget: desktop ≤ 3 MB / 150k triangles, mobile ≤ 1 MB / 50k.
4. Add `{ "slug": "<slug>", "version": 1, "published": true }` to `data/catalog.json`.

Re-running the pipeline for a changed model: bump `--version 2` so cached `v1` files are never overwritten.

### Material roles

Variants target materials by **role**, not by export name, so artists can name slots however they like:

```json
"materials": { "Set1.002": { "role": "upholstery" }, "Set2.002": { "role": "mesh" }, "Set3.002": { "role": "frame" } },
"variants":  [{ "sku": "ORC-HB-BLACK", "color": "black", "label": "Black", "swatch": "#1E1F22", "materials": { "upholstery": { "color": "#1E1F22" } } }]
```

Untextured materials get a sensible PBR base per role (`components/viewer/Model.tsx`); textured materials keep their maps and only receive roughness/metalness overrides.

## Embedding on bosq.ae

```tsx
<iframe src="https://3d.bosq.ae/embed/orca?sku=ORC-HB-BLACK&lang=en" allow="xr-spatial-tracking; fullscreen" loading="lazy" title="3D viewer" />
```

The embed posts `{ source: "bosq3d", type: "bosq3d:ready" | "bosq3d:variant", sku }` to the parent and accepts `{ type: "bosq3d:setVariant", sku }`. Only `bosq.ae` origins may frame it (`frame-ancestors` in `next.config.ts`).

## Brand

Tokens sampled from bosq.ae live in `app/globals.css` (accent `#F17423`, ink `#282828`, surfaces `#F9F9F9`/`#F4F4F4`). bosq.ae uses the licensed **Hero New** typeface; Figtree stands in until the woff2 files are added — see `lib/fonts.ts`.

## Deployment

Vercel project → `3d.bosq.ae`. Environment:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin for sitemap/OG (`https://3d.bosq.ae`) |
| `MODELS_BASE_URL` | Optional — when models move to R2/CDN (`https://models.bosq.ae`), manifests are rebased automatically |

Model folders under `public/models/<slug>/v<N>/` are served with `Cache-Control: immutable`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run pipeline -- <slug>` | Convert + optimise a product (`pipeline/run.mjs`) |
| `npm run poster -- <slug>` | Render `poster.webp` + `og.png` from the live viewer (`pipeline/poster.mjs`, uses installed Edge/Chrome via playwright-core) |

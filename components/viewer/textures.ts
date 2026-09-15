"use client";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type MeshStandardMaterial, type Texture } from "three";

/**
 * Procedural surface textures used until (or alongside) baked texture sets.
 * They are tiny (256²), generated once, and tiled via UV repeat.
 */
const cache = new Map<string, Texture>();

function canvas(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  draw(ctx, size);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Breathable mesh: fine horizontal threads with open gaps between them.
 * White = solid thread, black = hole. Used as alphaMap with alphaTest so the gaps are real cut-outs.
 */
export function meshAlphaMap(repeat = 48): Texture {
  const key = `meshAlpha:${repeat}`;
  if (cache.has(key)) return cache.get(key)!;
  const tex = canvas(64, (ctx, s) => {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#fff";
    // 4 threads per tile, each ~60 % of its pitch, with a thin vertical warp thread.
    const pitch = s / 4;
    for (let i = 0; i < 4; i++) ctx.fillRect(0, i * pitch, s, pitch * 0.72);
    for (let i = 0; i < 4; i++) ctx.fillRect(i * pitch, 0, pitch * 0.22, s);
  });
  tex.repeat.set(repeat, repeat);
  cache.set(key, tex);
  return tex;
}

/** Thread shading for the mesh: threads slightly lighter on top, darker beneath — gives the ribbed look. */
export function meshShadeMap(repeat = 48): Texture {
  const key = `meshShade:${repeat}`;
  if (cache.has(key)) return cache.get(key)!;
  const tex = canvas(64, (ctx, s) => {
    const pitch = s / 4;
    for (let i = 0; i < 4; i++) {
      const g = ctx.createLinearGradient(0, i * pitch, 0, i * pitch + pitch * 0.72);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.55, "#f2f2f2");
      g.addColorStop(1, "#d4d4d4");
      ctx.fillStyle = g;
      ctx.fillRect(0, i * pitch, s, pitch);
    }
  });
  tex.colorSpace = SRGBColorSpace;
  tex.repeat.set(repeat, repeat);
  cache.set(key, tex);
  return tex;
}

/** Fabric: soft random weave noise, multiplied under the upholstery colour. */
export function fabricMap(repeat = 24): Texture {
  const key = `fabric:${repeat}`;
  if (cache.has(key)) return cache.get(key)!;
  const tex = canvas(128, (ctx, s) => {
    ctx.fillStyle = "#f0f0f0";
    ctx.fillRect(0, 0, s, s);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < s; y += 2) {
      for (let x = 0; x < s; x += 2) {
        const v = 228 + Math.floor(rnd() * 27);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    // faint twill diagonal
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    for (let i = -s; i < s * 2; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + s, s);
      ctx.stroke();
    }
  });
  tex.colorSpace = SRGBColorSpace;
  tex.repeat.set(repeat, repeat);
  cache.set(key, tex);
  return tex;
}

/**
 * Samples `map` and `alphaMap` in world space instead of UV space so the weave stays a level,
 * evenly-spaced pattern on any geometry — auto-generated UVs from OBJ exports are usually distorted.
 * `tilesPerMetre` sets the thread pitch (48 tiles × 4 threads ≈ 5 mm per thread).
 */
export function projectPatternInWorldSpace(mat: MeshStandardMaterial, tilesPerMetre = 48): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPatternScale = { value: tilesPerMetre };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPatternPos;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvPatternPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPatternPos;\nuniform float uPatternScale;")
      .replace(
        "#include <map_fragment>",
        `#ifdef USE_MAP
  vec2 patternUv = vec2((vPatternPos.x + vPatternPos.z) * uPatternScale, vPatternPos.y * uPatternScale);
  diffuseColor *= texture2D(map, patternUv);
#endif`,
      )
      .replace(
        "#include <alphamap_fragment>",
        `#ifdef USE_ALPHAMAP
  diffuseColor.a *= texture2D(alphaMap, vec2((vPatternPos.x + vPatternPos.z) * uPatternScale, vPatternPos.y * uPatternScale)).g;
#endif`,
      );
  };
  mat.customProgramCacheKey = () => `bosq-worldpattern-${tilesPerMetre}`;
}

/** Undo projectPatternInWorldSpace (e.g. when a variant switches the mesh to solid fabric). */
export function clearPatternProjection(mat: MeshStandardMaterial): void {
  mat.onBeforeCompile = () => {};
  mat.customProgramCacheKey = () => "";
}

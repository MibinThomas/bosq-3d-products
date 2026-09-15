import type { NextConfig } from "next";

// Domains allowed to iframe the /embed route — bosq.ae plus local dev.
const FRAME_ANCESTORS = ["'self'", "https://bosq.ae", "https://*.bosq.ae", "http://localhost:*"].join(" ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // three.js + drei are large ESM packages; let Next tree-shake their sub-modules.
  experimental: { optimizePackageImports: ["three", "@react-three/drei"] },
  async redirects() {
    return [{ source: "/", destination: "/en", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [
          { key: "Content-Security-Policy", value: `frame-ancestors ${FRAME_ANCESTORS}` },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // Versioned model folders never change — cache forever.
        source: "/models/:slug/v:version/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;

import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://3d.bosq.ae";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/embed/", "/api/"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}

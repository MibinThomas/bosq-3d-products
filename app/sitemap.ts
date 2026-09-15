import type { MetadataRoute } from "next";
import { listProducts } from "@/lib/catalog";
import { locales } from "@/lib/i18n";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://3d.bosq.ae";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await listProducts();
  const entries: MetadataRoute.Sitemap = locales.map((l) => ({ url: `${SITE}/${l}`, changeFrequency: "weekly" }));
  for (const p of products) {
    for (const l of locales) {
      entries.push({ url: `${SITE}/${l}/products/${p.slug}`, lastModified: p.generatedAt, changeFrequency: "monthly" });
    }
  }
  return entries;
}

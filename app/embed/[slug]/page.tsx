import { notFound } from "next/navigation";
import { getProduct } from "@/lib/catalog";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { ProductViewer } from "@/components/viewer/ProductViewer";

export const revalidate = 3600;

// https://3d.bosq.ae/embed/orca?sku=ORC-HB-APPLE-GREEN&lang=en
export default async function EmbedPage({ params, searchParams }: PageProps<"/embed/[slug]">) {
  const { slug } = await params;
  const { sku, lang, poster, debug } = await searchParams;
  const product = await getProduct(slug);
  if (!product) notFound();
  const locale = typeof lang === "string" && isLocale(lang) ? lang : defaultLocale;

  return (
    <ProductViewer
      manifest={product}
      locale={locale}
      initialSku={typeof sku === "string" ? sku : undefined}
      embed
      poster={poster === "1"}
      debugMaterials={debug === "materials"}
      className="aspect-auto! h-dvh"
    />
  );
}

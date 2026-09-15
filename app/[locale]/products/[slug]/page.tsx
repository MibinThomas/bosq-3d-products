import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, listProducts } from "@/lib/catalog";
import { getDict, isLocale, locales } from "@/lib/i18n";
import { t } from "@/lib/manifest";
import { ProductViewer } from "@/components/viewer/ProductViewer";

export const revalidate = 3600;

export async function generateStaticParams() {
  const products = await listProducts();
  return locales.flatMap((locale) => products.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/products/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await getProduct(slug);
  if (!product) return {};
  const name = t(product.name, locale);
  return {
    title: name,
    description: t(product.description, locale) || `${name} — interactive 3D view.`,
    // The viewer never competes with the real product page on bosq.ae.
    alternates: {
      canonical: product.productUrl ?? `/${locale}/products/${slug}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}/products/${slug}`])),
    },
    openGraph: {
      title: name,
      images: product.og ? [{ url: product.og, width: 1200, height: 630 }] : [{ url: product.poster, width: 1200, height: 1200 }],
    },
  };
}

export default async function ProductPage({ params, searchParams }: PageProps<"/[locale]/products/[slug]">) {
  const { locale, slug } = await params;
  const { sku } = await searchParams;
  if (!isLocale(locale)) notFound();
  const product = await getProduct(slug);
  if (!product) notFound();
  const dict = getDict(locale);
  const name = t(product.name, locale);
  const description = t(product.description, locale);
  const initialSku = typeof sku === "string" ? sku : undefined;
  const activeVariant = product.variants.find((v) => v.sku === initialSku) ?? product.variants[0];
  const dimensions =
    product.dimensionsLabel ??
    `W${Math.round(product.bounds.w * 100)} × D${Math.round(product.bounds.d * 100)} × H${Math.round(product.bounds.h * 100)} cm`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    image: product.poster,
    brand: { "@type": "Brand", name: "BOSQ" },
    sku: activeVariant?.sku,
    url: product.productUrl ?? undefined,
    subjectOf: {
      "@type": "3DModel",
      name,
      encoding: [{ "@type": "MediaObject", contentUrl: product.model.high, encodingFormat: "model/gltf-binary" }],
    },
  };

  const enquiry = `mailto:sales@bosq.ae?subject=${encodeURIComponent(`Enquiry: ${name}${activeVariant ? ` (${activeVariant.sku})` : ""}`)}`;

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:px-8 sm:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-2 text-[11px] font-light tracking-[0.08em] text-muted uppercase">
        <Link href={`/${locale}`} className="hover:text-accent">{dict.allProducts}</Link>
        <span aria-hidden="true">/</span>
        <span className="text-ink">{name}</span>
      </nav>

      <article className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <ProductViewer manifest={product} locale={locale} initialSku={initialSku} className="rounded-[6px] ring-1 ring-line" />

        <aside className="flex flex-col gap-6">
          <div>
            <p className="text-[11px] font-light tracking-[0.14em] text-accent uppercase">{product.category}</p>
            <h1 className="mt-2 text-[28px] leading-tight font-medium tracking-tight text-balance text-ink sm:text-[32px]">{name}</h1>
            {description && <p className="mt-4 text-[15px] leading-relaxed text-ink/75">{description}</p>}
          </div>

          <dl className="divide-y divide-line border-y border-line text-[13px]">
            <div className="grid grid-cols-[120px_1fr] gap-4 py-3">
              <dt className="font-light tracking-[0.08em] text-muted uppercase">{dict.dimensions}</dt>
              <dd className="tabular-nums">{dimensions}</dd>
            </div>
            {activeVariant && (
              <div className="grid grid-cols-[120px_1fr] gap-4 py-3">
                <dt className="font-light tracking-[0.08em] text-muted uppercase">SKU</dt>
                <dd className="font-mono text-[12px]">{activeVariant.sku}</dd>
              </div>
            )}
            {product.variants.length > 0 && (
              <div className="grid grid-cols-[120px_1fr] gap-4 py-3">
                <dt className="font-light tracking-[0.08em] text-muted uppercase">{dict.colour}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  {product.variants.map((v) => (
                    <Link
                      key={v.sku}
                      href={`/${locale}/products/${slug}?sku=${v.sku}`}
                      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[12px] transition hover:border-accent ${v.sku === activeVariant?.sku ? "border-ink" : "border-line"}`}
                    >
                      <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ backgroundColor: v.swatch }} />
                      {v.label}
                    </Link>
                  ))}
                </dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap gap-3">
            {product.productUrl && (
              <a href={product.productUrl} className="btn btn-dark" rel="noreferrer">
                {dict.viewOnBosq}
              </a>
            )}
            <a href={enquiry} className="btn btn-light">
              {dict.enquire}
            </a>
          </div>

          <ul className="grid grid-cols-3 gap-3 text-center text-[11px] font-light tracking-[0.06em] text-muted uppercase">
            <li className="rounded-[4px] bg-surface px-2 py-3"><span className="block text-[15px] font-normal text-ink normal-case tracking-normal">360°</span>{dict.rotate}</li>
            <li className="rounded-[4px] bg-surface px-2 py-3"><span className="block text-[15px] font-normal text-ink normal-case tracking-normal">1:1</span>{dict.trueScale}</li>
            <li className="rounded-[4px] bg-surface px-2 py-3"><span className="block text-[15px] font-normal text-ink normal-case tracking-normal">AR</span>{dict.onMobile}</li>
          </ul>

          <p className="text-[11px] text-muted tabular-nums">
            {product.stats.high.triangles.toLocaleString()} {dict.triangles} · {(product.stats.high.sizeBytes / 1024 / 1024).toFixed(2)} MB
          </p>
        </aside>
      </article>
    </div>
  );
}

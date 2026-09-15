import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listProducts } from "@/lib/catalog";
import { getDict, isLocale } from "@/lib/i18n";
import { t } from "@/lib/manifest";

export const revalidate = 3600;

export default async function CataloguePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  const products = await listProducts();

  return (
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="max-w-xl">
        <p className="text-[11px] font-light tracking-[0.14em] text-accent uppercase">{dict.exploreIn3D}</p>
        <h1 className="mt-2 text-[32px] leading-tight font-medium tracking-tight text-balance sm:text-[40px]">{dict.catalogueTitle}</h1>
        <p className="mt-3 text-[15px] text-ink/70">{dict.catalogueIntro}</p>
      </div>

      <ul className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((p) => (
          <li key={p.slug} className="group">
            <Link href={`/${locale}/products/${p.slug}`} className="block rounded-[6px] bg-surface p-3 transition hover:shadow-[0_10px_30px_-12px_rgba(40,40,40,0.25)]">
              <div className="relative aspect-square overflow-hidden rounded-[4px] bg-surface-2">
                <Image src={p.poster} alt={t(p.name, locale)} fill sizes="(min-width:1280px) 300px, (min-width:640px) 45vw, 90vw" className="object-contain p-6 transition duration-300 group-hover:scale-[1.04]" />
                <span className="absolute top-3 left-3 rounded-[4px] bg-white/90 px-2 py-1 text-[10px] font-light tracking-[0.1em] text-ink uppercase">3D</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-1 pt-3 pb-1">
                <div>
                  <p className="text-[10px] font-light tracking-[0.12em] text-muted uppercase">{p.category}</p>
                  <p className="mt-0.5 text-[14px] font-normal text-ink">{t(p.name, locale)}</p>
                </div>
                <span className="shrink-0 text-[11px] font-light tracking-[0.08em] text-accent uppercase">{dict.viewIn3D}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

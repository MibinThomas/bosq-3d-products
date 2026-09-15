import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import "../globals.css";
import { arabic, brand } from "@/lib/fonts";
import { getDict, isLocale, locales } from "@/lib/i18n";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://3d.bosq.ae";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "BOSQ 3D", template: "%s · BOSQ 3D" },
  description: "Explore BOSQ office furniture in interactive 3D.",
  icons: { icon: "/logo/bosq-logo.webp" },
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDict(locale);
  const other = locale === "en" ? "ar" : "en";

  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} className={`${brand.variable} ${arabic.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-paper">
        <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur-sm">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
            <Link href={`/${locale}`} className="block w-[110px] shrink-0 sm:w-[130px] xl:w-[150px]" aria-label="BOSQ">
              <Image src="/logo/bosq-logo.webp" alt="BOSQ — ergonomic living" width={1772} height={572} priority className="block h-auto w-full" />
            </Link>
            <nav className="flex items-center gap-5 text-[12px] font-light tracking-[0.08em] text-ink uppercase sm:gap-8">
              <Link href={`/${locale}`} className="transition hover:text-accent">
                {dict.allProducts}
              </Link>
              <a href="https://bosq.ae" className="hidden transition hover:text-accent sm:inline" rel="noreferrer">
                bosq.ae
              </a>
              <Link href={`/${other}`} hrefLang={other} className="rounded-[4px] border border-line px-2.5 py-1 text-[11px] normal-case transition hover:border-accent hover:text-accent">
                {locale === "en" ? "العربية" : "English"}
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line bg-surface">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-5 py-6 text-[11px] font-light tracking-[0.06em] text-muted uppercase sm:flex-row sm:items-center sm:px-8">
            <span>© {new Date().getFullYear()} BOSQ · Ayn Musk for Furniture Co. L.L.C. · Dubai</span>
            <span className="flex gap-5">
              <a href="https://bosq.ae/en/products" className="hover:text-accent" rel="noreferrer">Shop</a>
              <a href="https://bosq.ae/en/customization" className="hover:text-accent" rel="noreferrer">Customization</a>
              <a href="mailto:sales@bosq.ae" className="hover:text-accent">sales@bosq.ae</a>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

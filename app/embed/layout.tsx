import type { Metadata } from "next";
import "../globals.css";
import { arabic, brand } from "@/lib/fonts";

// Chrome-less root layout for the iframe embed on bosq.ae.
export const metadata: Metadata = {
  title: "BOSQ 3D",
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: LayoutProps<"/embed">) {
  return (
    <html lang="en" className={`${brand.variable} ${arabic.variable} h-full`}>
      <body className="h-full overflow-hidden bg-transparent">{children}</body>
    </html>
  );
}

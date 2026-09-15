// Brand typography.
// bosq.ae uses "Hero New" (licensed) for Latin and Cairo for Arabic. Hero New is not on Google Fonts,
// so Figtree — the closest open geometric sans — stands in. To use the real brand face, drop the
// licensed woff2 files into public/fonts/hero-new/ and swap `brand` for the localFont block below.
import { Cairo, Figtree } from "next/font/google";
// import localFont from "next/font/local";

export const brand = Figtree({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// export const brand = localFont({
//   variable: "--font-brand",
//   display: "swap",
//   src: [
//     { path: "../public/fonts/hero-new/HeroNew-Light.woff2", weight: "300" },
//     { path: "../public/fonts/hero-new/HeroNew-Regular.woff2", weight: "400" },
//     { path: "../public/fonts/hero-new/HeroNew-Medium.woff2", weight: "500" },
//     { path: "../public/fonts/hero-new/HeroNew-SemiBold.woff2", weight: "600" },
//   ],
// });

export const arabic = Cairo({
  variable: "--font-arabic",
  subsets: ["arabic", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

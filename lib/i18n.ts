import type { Locale } from "./manifest";

export const locales: Locale[] = ["en", "ar"];
export const defaultLocale: Locale = "en";

export function isLocale(value: string): value is Locale {
  return (locales as string[]).includes(value);
}

const dict = {
  en: {
    viewIn3D: "View in 3D",
    dragToRotate: "Drag to rotate · Scroll to zoom",
    loading: "Loading 3D model",
    reset: "Reset view",
    fullscreen: "Fullscreen",
    exitFullscreen: "Exit fullscreen",
    dimensions: "Dimensions",
    colour: "Colour",
    viewInAR: "View in your space",
    reload: "Reload 3D view",
    contextLost: "The 3D view stopped. Reload to try again.",
    viewOnBosq: "View on bosq.ae",
    allProducts: "All products",
    catalogueTitle: "BOSQ in 3D",
    catalogueIntro: "Explore BOSQ furniture from every angle.",
    triangles: "triangles",
    enquire: "Enquire now",
    rotate: "Rotate",
    trueScale: "True scale",
    onMobile: "On mobile",
    exploreIn3D: "Explore in 3D",
  },
  ar: {
    viewIn3D: "عرض ثلاثي الأبعاد",
    dragToRotate: "اسحب للتدوير · مرّر للتكبير",
    loading: "جارٍ تحميل النموذج ثلاثي الأبعاد",
    reset: "إعادة الضبط",
    fullscreen: "ملء الشاشة",
    exitFullscreen: "إنهاء ملء الشاشة",
    dimensions: "الأبعاد",
    colour: "اللون",
    viewInAR: "شاهده في مساحتك",
    reload: "إعادة تحميل العرض",
    contextLost: "توقف العرض ثلاثي الأبعاد. أعد التحميل للمحاولة مجددًا.",
    viewOnBosq: "عرض على bosq.ae",
    allProducts: "جميع المنتجات",
    catalogueTitle: "BOSQ بتقنية ثلاثية الأبعاد",
    catalogueIntro: "استكشف أثاث BOSQ من كل الزوايا.",
    triangles: "مثلث",
    enquire: "استفسر الآن",
    rotate: "تدوير",
    trueScale: "حجم حقيقي",
    onMobile: "على الجوال",
    exploreIn3D: "استكشف بتقنية ثلاثية الأبعاد",
  },
} satisfies Record<Locale, Record<string, string>>;

export type Dict = Record<keyof (typeof dict)["en"], string>;

export function getDict(locale: Locale): Dict {
  return dict[locale];
}

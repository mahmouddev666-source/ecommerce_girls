export interface ThemeDefinition {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  previewColor: string;
  secondaryColor: string;
  fontHeading: string;
  fontBody: string;
  cardRadius: string;
  buttonRadius: string;
  isPremium?: boolean;
  accentBadge?: string;
  accentBadgeAr?: string;
}

export const STORE_THEMES: Record<string, ThemeDefinition> = {
  casper_simple: {
    id: "casper_simple",
    nameAr: "كاسبر سيمبل (الافتراضي)",
    nameEn: "Casper Simple (Default)",
    descriptionAr: "تصميم أنيق، مينيمالي راقٍ يناسب الأزياء الفاخرة والعصرية.",
    descriptionEn: "Refined minimalist editorial design with warm earth tones.",
    previewColor: "#171717",
    secondaryColor: "#e8e6dc",
    fontHeading: "Playfair Display, Georgia, serif",
    fontBody: "system-ui, sans-serif",
    cardRadius: "4px",
    buttonRadius: "4px",
    isPremium: false,
  },
  casper_luxury: {
    id: "casper_luxury",
    nameAr: "كاسبر لاكجري (فاخر)",
    nameEn: "Casper Luxury",
    descriptionAr: "طابع ملكي راقٍ بخلفيات عميقة ولمسات ذهبية فخمة لعرض القطع المميزة.",
    descriptionEn: "High-end luxury aesthetic with deep contrasts and champagne accents.",
    previewColor: "#1c221e",
    secondaryColor: "#d4af37",
    fontHeading: "Cinzel, serif",
    fontBody: "system-ui, sans-serif",
    cardRadius: "2px",
    buttonRadius: "2px",
    isPremium: true,
    accentBadge: "PRO",
    accentBadgeAr: "باقة النخبة",
  },
  casper_black_friday: {
    id: "casper_black_friday",
    nameAr: "كاسبر بلاك فرايداي (مواسم وتخفيضات)",
    nameEn: "Casper Black Friday",
    descriptionAr: "طابع حماسي عالي التباين مصمم لزيادة معدل التحويل والمبيعات في مواسم العروض.",
    descriptionEn: "High-contrast promotional theme optimized for sales & flash discounts.",
    previewColor: "#0f0f0f",
    secondaryColor: "#e63946",
    fontHeading: "Montserrat, sans-serif",
    fontBody: "system-ui, sans-serif",
    cardRadius: "8px",
    buttonRadius: "6px",
    isPremium: true,
    accentBadge: "PRO",
    accentBadgeAr: "باقة العروض",
  },
  casper_new_year: {
    id: "casper_new_year",
    nameAr: "كاسبر نيو يير (احتفالي وأعياد)",
    nameEn: "Casper New Year",
    descriptionAr: "أجواء احتفالية منعشة مع لمسات دافئة وتدرجات مميزة للمجموعات الموسمية.",
    descriptionEn: "Festive celebration theme with crisp accents and seasonal charm.",
    previewColor: "#1e293b",
    secondaryColor: "#38bdf8",
    fontHeading: "Cormorant Garamond, serif",
    fontBody: "system-ui, sans-serif",
    cardRadius: "12px",
    buttonRadius: "9999px",
    isPremium: true,
    accentBadge: "PRO",
    accentBadgeAr: "باقة المواسم",
  },
};

export const DEFAULT_THEME_ID = "casper_simple";

// A simple generator / validator for unlock license keys
// Key format: THEME-XXXX-YYYY (e.g. LUX-8821-PRO)
export function verifyThemeKey(themeId: string, inputKey: string): boolean {
  const cleanKey = inputKey.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleanKey) return false;
  
  // Universal master keys / algorithms for easy offline activation by you:
  if (cleanKey === "CASPER-VIP-2026" || cleanKey === "UNLOCK-ALL-THEMES") {
    return true;
  }
  
  if (themeId === "casper_luxury" && (cleanKey.startsWith("LUX-") || cleanKey === "CASPER-LUXURY-PRO")) {
    return true;
  }
  if (themeId === "casper_black_friday" && (cleanKey.startsWith("BF-") || cleanKey === "CASPER-BF-SALE")) {
    return true;
  }
  if (themeId === "casper_new_year" && (cleanKey.startsWith("NY-") || cleanKey === "CASPER-NEWYEAR-2026")) {
    return true;
  }
  
  return false;
}

export const LOCALES = ["en", "es", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "horizon_locale";

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value);

export const localeDir = (locale: Locale): "ltr" | "rtl" =>
  locale === "ar" ? "rtl" : "ltr";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ar: "العربية",
};

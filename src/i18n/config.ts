/**
 * Internationalization Configuration
 *
 * This file configures the i18n system for the GRC application.
 *
 * EXCEL-DRIVEN TRANSLATION MODEL:
 * - Single source of truth: /i18n/translations.xlsx
 * - English phrases are the canonical keys (phrase-based, not dot-notation)
 * - Generated locale files: /locales/en.json, /locales/ar.json, /locales/lv.json
 *
 * SUPPORTED LANGUAGES:
 * - English (en) - Default, LTR
 * - Arabic (ar) - RTL layout
 * - Latvian (lv) - LTR
 *
 * RTL HANDLING:
 * - Arabic requires full RTL layout
 * - <html dir="rtl"> and <body dir="rtl"> are set automatically
 * - All directional CSS must use logical properties (start/end vs left/right)
 *
 * USAGE:
 * - Use t("Exact English Phrase") in components
 * - Never hardcode UI text
 * - Add new translations to the Excel file, then run: npm run i18n:generate
 */

// Supported locales
export const locales = ['en', 'ar', 'lv'] as const;
export type Locale = (typeof locales)[number];

// Default locale (fallback)
export const defaultLocale: Locale = 'en';

// Locale display names (in their native language)
export const localeNames: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  lv: 'Latviešu',
};

// Locale country codes for flags
export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  ar: '🇶🇦',
  lv: '🇱🇻',
};

// Full locale identifiers for date/number formatting
export const localeIdentifiers: Record<Locale, string> = {
  en: 'en-US',
  ar: 'ar-QA',
  lv: 'lv-LV',
};

// RTL locales
export const rtlLocales: Locale[] = ['ar'];

/**
 * Check if a locale uses RTL layout
 */
export function isRTL(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}

/**
 * Get the text direction for a locale
 */
export function getDirection(locale: Locale): 'ltr' | 'rtl' {
  return isRTL(locale) ? 'rtl' : 'ltr';
}

/**
 * Validate that a string is a valid locale
 */
export function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

/**
 * Get locale from browser preferences
 */
export function getBrowserLocale(): Locale | null {
  if (typeof window === 'undefined') return null;

  const browserLang = navigator.language.split('-')[0];
  if (isValidLocale(browserLang)) {
    return browserLang;
  }

  // Check all browser languages
  for (const lang of navigator.languages) {
    const code = lang.split('-')[0];
    if (isValidLocale(code)) {
      return code;
    }
  }

  return null;
}

/**
 * Cookie name for storing locale preference
 */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

/**
 * LocalStorage key for storing locale preference
 */
export const LOCALE_STORAGE_KEY = 'locale';

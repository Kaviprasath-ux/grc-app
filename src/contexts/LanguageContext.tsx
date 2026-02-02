"use client";

/**
 * Language Context Provider
 *
 * EXCEL-DRIVEN TRANSLATION MODEL:
 * This context provides internationalization using phrase-based keys.
 * - Single source of truth: /i18n/translations.xlsx
 * - English phrases ARE the keys (e.g., t("Save"), t("Dashboard"))
 * - Generated locale files: /locales/en.json, /locales/ar.json, /locales/lv.json
 *
 * LANGUAGE RESOLUTION PRIORITY:
 * 1. User preference (stored in localStorage/cookie)
 * 2. Tenant/organization default (from session)
 * 3. Browser language
 * 4. Fallback to English
 *
 * RTL HANDLING:
 * - Arabic requires full RTL layout
 * - <html dir="rtl"> and <body dir="rtl"> are set automatically
 * - All components should use logical CSS properties (start/end vs left/right)
 *
 * USAGE:
 * ```tsx
 * const { t } = useLanguage();
 * return <button>{t("Save")}</button>;
 * ```
 *
 * MISSING TRANSLATIONS:
 * - Development: Throws error (to catch missing translations early)
 * - Production: Falls back to English phrase
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Locale,
  defaultLocale,
  isRTL,
  getDirection,
  isValidLocale,
  getBrowserLocale,
  LOCALE_STORAGE_KEY,
  locales,
  localeNames,
  localeFlags,
} from "@/i18n/config";

// Type for messages (phrase-based keys)
type Messages = Record<string, string>;

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  direction: "ltr" | "rtl";
  isRTL: boolean;
  t: (phrase: string) => string;
  locales: readonly Locale[];
  localeNames: Record<Locale, string>;
  localeFlags: Record<Locale, string>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Cache for loaded messages
const messagesCache: Partial<Record<Locale, Messages>> = {};

/**
 * Load messages for a locale from generated JSON files
 */
async function loadMessages(locale: Locale): Promise<Messages> {
  // Return from cache if available
  if (messagesCache[locale]) {
    return messagesCache[locale]!;
  }

  try {
    // Dynamic import of locale file
    const messages = await import(`../../locales/${locale}.json`);
    messagesCache[locale] = messages.default || messages;
    return messagesCache[locale]!;
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error);
    // Fall back to English
    if (locale !== "en") {
      return loadMessages("en");
    }
    return {};
  }
}

/**
 * Resolve the initial locale based on priority:
 * 1. User preference (localStorage)
 * 2. Browser language
 * 3. Default (English)
 */
function resolveInitialLocale(): Locale {
  if (typeof window === "undefined") return defaultLocale;

  // 1. Check localStorage
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored && isValidLocale(stored)) {
    return stored;
  }

  // 2. Check browser language
  const browserLocale = getBrowserLocale();
  if (browserLocale) {
    return browserLocale;
  }

  // 3. Fall back to default
  return defaultLocale;
}

interface LanguageProviderProps {
  children: React.ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const { data: session } = useSession();
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [messages, setMessages] = useState<Messages>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize locale on mount
  useEffect(() => {
    if (isInitialized) return;

    const initialLocale = resolveInitialLocale();
    setLocaleState(initialLocale);
    setIsInitialized(true);
  }, [isInitialized]);

  // Check for tenant/organization default locale from session
  useEffect(() => {
    if (!session?.user) return;

    // If user has a language preference in their profile, use it
    const userLanguage = (session.user as { language?: string }).language;
    if (userLanguage && isValidLocale(userLanguage)) {
      setLocaleState(userLanguage);
    }
  }, [session]);

  // Load messages when locale changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const loadedMessages = await loadMessages(locale);
      if (!cancelled) {
        setMessages(loadedMessages);
        setIsLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [locale]);

  // Update document direction and lang when locale changes
  useEffect(() => {
    const direction = getDirection(locale);

    // Set both dir and lang on html element
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", locale);

    // Also set on body for full RTL support
    document.body.setAttribute("dir", direction);
  }, [locale]);

  // Set locale and persist to localStorage
  const setLocale = useCallback((newLocale: Locale) => {
    if (!isValidLocale(newLocale)) {
      console.warn(`Invalid locale: ${newLocale}`);
      return;
    }

    setLocaleState(newLocale);
    localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);

    // Set cookie for SSR
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // Update document attributes immediately
    const direction = getDirection(newLocale);
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", newLocale);
    document.body.setAttribute("dir", direction);
  }, []);

  /**
   * Translation function
   * Uses English phrase as the key
   *
   * @param phrase - The English phrase to translate
   * @returns The translated phrase, or the English phrase as fallback
   */
  const t = useCallback(
    (phrase: string): string => {
      // If messages not loaded yet, return the phrase
      if (!messages || Object.keys(messages).length === 0) {
        return phrase;
      }

      const translation = messages[phrase];

      if (translation) {
        return translation;
      }

      // Handle missing translation
      if (process.env.NODE_ENV === "development") {
        console.warn(`Missing translation for: "${phrase}" in locale: ${locale}`);
        // In development, we warn but don't throw to avoid breaking the UI
      }

      // Fall back to the English phrase
      return phrase;
    },
    [messages, locale]
  );

  const value = useMemo<LanguageContextType>(
    () => ({
      locale,
      setLocale,
      direction: getDirection(locale),
      isRTL: isRTL(locale),
      t,
      locales,
      localeNames,
      localeFlags,
      isLoading,
    }),
    [locale, setLocale, t, isLoading]
  );

  // Show loading state while initializing
  if (!isInitialized || (isLoading && Object.keys(messages).length === 0)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-secondary">
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access language context
 * Must be used within a LanguageProvider
 */
export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

/**
 * Safe hook that returns defaults if used outside provider
 * Useful for components that may be rendered outside the provider
 */
export function useLanguageSafe(): LanguageContextType {
  const context = useContext(LanguageContext);

  const fallbackT = useCallback((phrase: string) => phrase, []);

  return context || {
    locale: defaultLocale,
    setLocale: () => {},
    direction: "ltr" as const,
    isRTL: false,
    t: fallbackT,
    locales,
    localeNames,
    localeFlags,
    isLoading: false,
  };
}

/**
 * Server-side translation function
 * For use in API routes and server components
 *
 * @param phrase - The English phrase to translate
 * @param locale - The target locale
 * @returns The translated phrase
 */
export async function serverTranslate(phrase: string, locale: Locale = "en"): Promise<string> {
  const messages = await loadMessages(locale);
  return messages[phrase] || phrase;
}

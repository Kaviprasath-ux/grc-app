"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { NextIntlClientProvider } from "next-intl";
import { Locale, defaultLocale, isRTL, getDirection } from "@/i18n/config";

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  direction: "ltr" | "rtl";
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Import messages dynamically
const loadMessages = async (locale: Locale) => {
  try {
    const messages = await import(`@/messages/${locale}.json`);
    return messages.default;
  } catch {
    // Fallback to English if locale file not found
    const messages = await import(`@/messages/en.json`);
    return messages.default;
  }
};

interface LanguageProviderProps {
  children: React.ReactNode;
  initialLocale?: Locale;
}

export function LanguageProvider({ children, initialLocale }: LanguageProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale);
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load messages when locale changes
  useEffect(() => {
    const loadLocaleMessages = async () => {
      setIsLoading(true);
      const loadedMessages = await loadMessages(locale);
      setMessages(loadedMessages);
      setIsLoading(false);
    };

    loadLocaleMessages();
  }, [locale]);

  // Update document direction when locale changes
  useEffect(() => {
    const direction = getDirection(locale);
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", locale);
  }, [locale]);

  // Load saved locale from localStorage on mount
  useEffect(() => {
    const savedLocale = localStorage.getItem("locale") as Locale | null;
    if (savedLocale && (savedLocale === "en" || savedLocale === "ar")) {
      setLocaleState(savedLocale);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);

    // Update document attributes immediately
    const direction = getDirection(newLocale);
    document.documentElement.setAttribute("dir", direction);
    document.documentElement.setAttribute("lang", newLocale);
  }, []);

  const value: LanguageContextType = {
    locale,
    setLocale,
    direction: getDirection(locale),
    isRTL: isRTL(locale),
  };

  if (isLoading || !messages) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
          <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <LanguageContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

// Export a hook that's safe to use outside LanguageProvider (returns defaults)
export function useLanguageSafe() {
  const context = useContext(LanguageContext);
  return context || {
    locale: defaultLocale,
    setLocale: () => {},
    direction: "ltr" as const,
    isRTL: false,
  };
}

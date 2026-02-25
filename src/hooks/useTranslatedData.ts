"use client";

/**
 * useTranslatedData / useTranslatedRecord / triggerTranslation
 *
 * Frontend hooks for dynamic data translation.
 *
 * - Fetches translations for ALL locales (including "en") because records
 *   may have been entered in any language. The translation API returns
 *   empty results when no translations exist for a given locale.
 * - In-memory cache with 5-min TTL to avoid redundant requests
 * - AbortController cleanup on unmount
 *
 * Usage (list page):
 *   const { data: translatedRisks, isLoading } = useTranslatedData(risks, { modelName: 'Risk' });
 *
 * Usage (detail page):
 *   const { data: translatedRisk, isLoading } = useTranslatedRecord(risk, { modelName: 'Risk' });
 *
 * Usage (after create/edit):
 *   triggerTranslation('Risk', risk.id, { name: risk.name, description: risk.description });
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

// ==================== TYPES ====================

interface TranslatedDataOptions {
  /** Prisma model name, e.g. "Risk", "Control", "Framework" */
  modelName: string;
  /** Field name on each record that holds the ID. Default: "id" */
  idField?: string;
}

interface TranslatedDataResult<T> {
  /** Data with translated fields overlaid (or original if locale is en) */
  data: T;
  /** True while fetching translations */
  isLoading: boolean;
}

// ==================== CACHE ====================

interface CacheEntry {
  translations: Record<string, Record<string, string>>;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const translationCache = new Map<string, CacheEntry>();

function getCacheKey(modelName: string, locale: string, recordIds: string[]): string {
  // Sort IDs for consistent cache key regardless of data order
  const sortedIds = [...recordIds].sort();
  return `${modelName}:${locale}:${sortedIds.join(",")}`;
}

function getCached(key: string): Record<string, Record<string, string>> | null {
  const entry = translationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    translationCache.delete(key);
    return null;
  }
  return entry.translations;
}

function setCache(key: string, translations: Record<string, Record<string, string>>): void {
  translationCache.set(key, { translations, timestamp: Date.now() });

  // Evict old entries if cache grows too large
  if (translationCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of translationCache) {
      if (now - v.timestamp > CACHE_TTL) {
        translationCache.delete(k);
      }
    }
  }
}

/**
 * Clear all cached translations. Call this when the user switches language
 * or when you know translations have been refreshed.
 */
export function clearTranslationCache(): void {
  translationCache.clear();
}

// ==================== HOOKS ====================

/**
 * Hook for list pages — translates an array of records.
 *
 * Returns the original array with translated fields overlaid when locale != "en".
 * Zero API calls when locale is "en".
 */
export function useTranslatedData<T extends object>(
  data: T[] | undefined | null,
  options: TranslatedDataOptions
): TranslatedDataResult<T[]> {
  const { locale } = useLanguage();
  const { modelName, idField = "id" } = options;
  const [translatedData, setTranslatedData] = useState<T[]>(data ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Use a ref so the effect body always reads the latest data
  // without needing `data` itself as a dependency (avoids infinite loops
  // when the parent passes a new array reference each render).
  const dataRef = useRef(data);
  dataRef.current = data;

  // Stable key derived from record content — changes when records change (IDs or values)
  const dataKey = useMemo(() => {
    if (!data || data.length === 0) return "";
    try {
      return JSON.stringify(data);
    } catch {
      // Fallback for non-serializable data
      return data
        .map((item) => (item as Record<string, unknown>)[idField])
        .join(",");
    }
  }, [data, idField]);

  useEffect(() => {
    const currentData = dataRef.current;

    // No translation needed for empty data or missing model name
    if (!currentData || currentData.length === 0 || !modelName) {
      setTranslatedData(currentData ?? []);
      setIsLoading(false);
      return;
    }

    const recordIds = currentData
      .map((item) => (item as Record<string, unknown>)[idField] as string)
      .filter(Boolean);

    if (recordIds.length === 0) {
      setTranslatedData(currentData);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cacheKey = getCacheKey(modelName, locale, recordIds);
    const cached = getCached(cacheKey);
    if (cached) {
      setTranslatedData(overlayTranslations(currentData, cached, idField));
      setIsLoading(false);
      return;
    }

    // Abort previous request if still in-flight
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    // Immediately show fresh (untranslated) data while translations load
    setTranslatedData(currentData);

    fetch("/api/translations/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelName, recordIds, locale }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Translation fetch failed: ${res.status}`);
        return res.json();
      })
      .then((result: { translations: Record<string, Record<string, string>> }) => {
        if (controller.signal.aborted) return;

        const translations = result.translations ?? {};
        setTranslatedData(overlayTranslations(dataRef.current ?? [], translations, idField));
        setIsLoading(false);
        setCache(cacheKey, translations);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch bulk translations:", err);
        // On error, show original data
        setTranslatedData(dataRef.current ?? []);
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [dataKey, locale, modelName, idField]);

  return { data: translatedData, isLoading };
}

/**
 * Hook for detail pages — translates a single record.
 *
 * Returns the original record with translated fields overlaid when locale != "en".
 * Returns null if input is null/undefined.
 */
export function useTranslatedRecord<T extends object>(
  record: T | null | undefined,
  options: TranslatedDataOptions
): TranslatedDataResult<T | null> {
  const { locale } = useLanguage();
  const { modelName, idField = "id" } = options;
  const [translatedRecord, setTranslatedRecord] = useState<T | null>(record ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Use a ref to avoid infinite loops from object reference changes
  const recordRef = useRef(record);
  recordRef.current = record;

  // Stable key from record content — changes when record values change
  const recordKey = useMemo(() => {
    if (!record) return "";
    try {
      return JSON.stringify(record);
    } catch {
      return String((record as Record<string, unknown>)[idField] ?? "");
    }
  }, [record, idField]);

  useEffect(() => {
    const currentRecord = recordRef.current;

    if (!currentRecord || !modelName) {
      setTranslatedRecord(currentRecord ?? null);
      setIsLoading(false);
      return;
    }

    const recordId = (currentRecord as Record<string, unknown>)[idField] as string;
    if (!recordId) {
      setTranslatedRecord(currentRecord);
      setIsLoading(false);
      return;
    }

    // Check cache (reuse bulk cache format for consistency)
    const cacheKey = getCacheKey(modelName, locale, [recordId]);
    const cached = getCached(cacheKey);
    if (cached && cached[recordId]) {
      setTranslatedRecord(overlaySingleRecord(currentRecord, cached[recordId]));
      setIsLoading(false);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    // Immediately show fresh (untranslated) record while translations load
    setTranslatedRecord(currentRecord);

    fetch(`/api/translations/${modelName}/${recordId}?locale=${locale}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Translation fetch failed: ${res.status}`);
        return res.json();
      })
      .then((result: { translations: Record<string, string> }) => {
        if (controller.signal.aborted) return;

        const translations = result.translations ?? {};
        setTranslatedRecord(overlaySingleRecord(recordRef.current!, translations));
        setIsLoading(false);
        setCache(cacheKey, { [recordId]: translations });
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Failed to fetch record translations:", err);
        setTranslatedRecord(recordRef.current ?? null);
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [recordKey, locale, modelName, idField]);

  return { data: translatedRecord, isLoading };
}

// ==================== TRIGGER (fire-and-forget) ====================

/**
 * Trigger translation for a record after create or edit.
 * Fire-and-forget — does not block UI.
 *
 * Automatically detects the current UI locale from localStorage and passes
 * it as `sourceLocale` so the backend knows which language the user typed in.
 * This ensures translations are generated for ALL other languages including English.
 *
 * @param modelName - e.g. "Risk", "Control"
 * @param recordId - ID of the created/edited record
 * @param fields - { fieldName: value } of the fields that were saved
 */
export function triggerTranslation(
  modelName: string,
  recordId: string,
  fields: Record<string, string | null | undefined>
): void {
  // Clean out null/undefined values
  const cleanFields: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value && value.trim()) {
      cleanFields[key] = value;
    }
  }

  if (Object.keys(cleanFields).length === 0) return;

  // Auto-detect the current UI locale (the language the user is typing in)
  const sourceLocale = (typeof window !== "undefined" && localStorage.getItem("locale")) || "en";

  // Invalidate cache entries for this record across all locales
  for (const [key] of translationCache) {
    if (key.startsWith(`${modelName}:`) && key.includes(recordId)) {
      translationCache.delete(key);
    }
  }

  // Fire-and-forget POST
  fetch("/api/translations/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelName, recordId, fields: cleanFields, sourceLocale }),
  }).catch((err) => {
    console.error("Failed to trigger translation:", err);
  });
}

// ==================== OVERLAY HELPERS ====================

/**
 * Overlay translated fields onto an array of records.
 * Only replaces fields that have translations — other fields stay as-is.
 */
function overlayTranslations<T extends object>(
  data: T[],
  translations: Record<string, Record<string, string>>,
  idField: string
): T[] {
  if (!translations || Object.keys(translations).length === 0) return data;

  return data.map((item) => {
    const recordId = (item as Record<string, unknown>)[idField] as string;
    const recordTranslations = translations[recordId];
    if (!recordTranslations) return item;
    return overlaySingleRecord(item, recordTranslations);
  });
}

/**
 * Overlay translated fields onto a single record.
 */
function overlaySingleRecord<T extends object>(
  record: T,
  translations: Record<string, string>
): T {
  if (!translations || Object.keys(translations).length === 0) return record;

  const result = { ...record };
  for (const [fieldName, translatedText] of Object.entries(translations)) {
    if (translatedText && fieldName in result) {
      (result as Record<string, unknown>)[fieldName] = translatedText;
    }
  }
  return result;
}

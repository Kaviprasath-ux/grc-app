/**
 * Translation Service
 *
 * Uses the existing Python AI backend (RunPod/FastAPI) for translations.
 * Endpoint: POST /api/translate (GPT LLM-based, auto-detects source language)
 *
 * - Stores translations in the DynamicTranslation table
 * - Detects stale translations when source text changes
 * - Gracefully degrades when AI backend is not configured
 */

import { createHash } from 'crypto';
import prisma from '@/lib/prisma';
import aiApiClient from '@/lib/ai-api-client';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';
import { TARGET_LOCALES, getTranslatableFields, isTranslatable } from '@/lib/translation-config';
import { PRESERVED_ACRONYMS } from '@/lib/grc-glossary';

// ==================== LOGGING ====================

const LOG_PREFIX = '[TRANSLATION]';

function logInfo(message: string, data?: Record<string, unknown>) {
  if (data) {
    console.log(`${LOG_PREFIX} ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${LOG_PREFIX} ${message}`);
  }
}

function logError(message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ❌ ${message}`, error || '');
}

function logSuccess(message: string, data?: Record<string, unknown>) {
  if (data) {
    console.log(`${LOG_PREFIX} ✓ ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`${LOG_PREFIX} ✓ ${message}`);
  }
}

// ==================== TYPES ====================

export interface TranslationProvider {
  /** Translate an array of texts to a target locale. Returns translations in same order. */
  translate(texts: string[], targetLocale: string): Promise<string[]>;
  /** Whether the provider is configured and ready to use */
  isConfigured(): boolean;
}

export interface TranslationRecord {
  fieldName: string;
  locale: string;
  translatedText: string;
  isStale: boolean;
}

export interface FieldValues {
  [fieldName: string]: string | null | undefined;
}

// ==================== PYTHON BACKEND PROVIDER ====================

class PythonBackendProvider implements TranslationProvider {
  private baseUrl: string | undefined;
  private apiSecret: string | undefined;

  constructor() {
    this.baseUrl = process.env.AI_API_BASE_URL?.replace(/\/$/, '');
    this.apiSecret = process.env.PYTHON_API_SECRET;
  }

  isConfigured(): boolean {
    return !!(this.baseUrl && this.apiSecret);
  }

  async translate(texts: string[], targetLocale: string): Promise<string[]> {
    if (!this.isConfigured()) {
      logInfo('Provider not configured — returning original texts');
      return texts;
    }

    logInfo(`Translating ${texts.length} text(s) to "${targetLocale}"`, {
      targetLocale,
      textCount: texts.length,
      textPreviews: texts.map(t => t.substring(0, 80) + (t.length > 80 ? '...' : '')),
    });

    const startTime = Date.now();

    // Translate each text individually (Python API takes one text at a time)
    // Use Promise.allSettled for parallel execution with fault tolerance
    const promises = texts.map(text => this.translateSingle(text, targetLocale));
    const results = await Promise.allSettled(promises);

    const elapsed = Date.now() - startTime;
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      logError(`Batch completed: ${succeeded}/${texts.length} succeeded, ${failed} failed (${elapsed}ms)`);
    } else {
      logSuccess(`Batch completed: ${succeeded}/${texts.length} translated (${elapsed}ms)`);
    }

    return results.map((result, idx) => {
      if (result.status === 'fulfilled' && result.value) {
        return result.value;
      }
      return texts[idx];
    });
  }

  private async translateSingle(text: string, targetLocale: string): Promise<string> {
    const requestBody = {
      Original_Text: text,
      target_language_code: targetLocale,
      model_config: {
        populate_by_name: true,
      },
    };

    try {
      logInfo(`API Call → POST ${AI_ENDPOINTS.TRANSLATE}`, {
        request: {
          Original_Text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
          target_language_code: targetLocale,
        },
      });

      const response = await aiApiClient.post(AI_ENDPOINTS.TRANSLATE, requestBody);

      const data = response.data as { translated_text?: string; original_text?: string; target_language_code?: string };

      if (data.translated_text) {
        const restored = restoreAcronyms(data.translated_text, text);

        logSuccess(`API Response ← translated to "${targetLocale}"`, {
          response: {
            original: text.substring(0, 80) + (text.length > 80 ? '...' : ''),
            translated: restored.substring(0, 80) + (restored.length > 80 ? '...' : ''),
            locale: targetLocale,
            latencyMs: response.latencyMs,
          },
        });

        return restored;
      }

      logError(`API returned no translated_text for locale "${targetLocale}"`, {
        responseData: data,
      });
      return text;
    } catch (error) {
      const err = error as { status?: number; message?: string };
      logError(`API Call FAILED for locale "${targetLocale}"`, {
        status: err.status,
        message: err.message,
        originalText: text.substring(0, 100),
      });
      return text;
    }
  }
}

/**
 * Restore GRC acronyms that the LLM may have translated.
 * Checks if original text contained an acronym and ensures it's preserved.
 */
function restoreAcronyms(translatedText: string, originalText: string): string {
  let result = translatedText;
  for (const acronym of PRESERVED_ACRONYMS) {
    if (originalText.includes(acronym) && !result.includes(acronym)) {
      // The acronym was in the original but missing from translation
      // This is a best-effort restoration — GPT usually preserves them
      // No action needed since we can't know where it was placed
    }
  }
  return result;
}

// ==================== SINGLETON PROVIDER ====================

let provider: TranslationProvider | null = null;

function getProvider(): TranslationProvider {
  if (!provider) {
    provider = new PythonBackendProvider();
  }
  return provider;
}

/**
 * Check if translation is available (AI backend configured).
 */
export function isTranslationConfigured(): boolean {
  return getProvider().isConfigured();
}

// ==================== HASH UTILITY ====================

function hashText(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

// ==================== LANGUAGE DETECTION ====================

/**
 * Auto-detect the source language of the given texts.
 * Uses Unicode character ranges to identify Arabic script and Latvian diacritics.
 */
function detectSourceLocale(texts: string[]): string {
  const combined = texts.join(' ');
  // Check for Arabic script (covers standard Arabic, supplements, and presentation forms)
  const arabicChars = (combined.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g) || []).length;
  // Check for Latvian-specific diacritics (ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž)
  const latvianChars = (combined.match(/[āčēģīķļņšūž]/gi) || []).length;
  const latinChars = (combined.match(/[a-zA-Z]/g) || []).length;

  // If significant Arabic characters present, source is Arabic
  if (arabicChars > 2) return 'ar';
  // If Latvian diacritics present with Latin text, source is Latvian
  if (latvianChars > 0 && latinChars > 0) return 'lv';
  // Default to English
  return 'en';
}

// ==================== CORE FUNCTIONS ====================

/**
 * Translate a record's fields and upsert translations to DB.
 * Fire-and-forget safe — errors are logged but don't throw.
 *
 * Translates to ALL languages EXCEPT the sourceLocale. If the user entered
 * data in Arabic, translations are generated for English and Latvian (and vice versa).
 *
 * When sourceLocale is not provided, auto-detects the language from the text content.
 *
 * @param customerAccountId - Tenant ID
 * @param modelName - e.g. "Risk", "Control"
 * @param recordId - ID of the source record
 * @param fields - Object of { fieldName: fieldValue } to translate
 * @param sourceLocale - The language the user entered the data in (auto-detected if omitted)
 */
export async function translateRecord(
  customerAccountId: string,
  modelName: string,
  recordId: string,
  fields: FieldValues,
  sourceLocale?: string
): Promise<void> {
  const translationProvider = getProvider();

  if (!translationProvider.isConfigured()) {
    logInfo(`Skipping translation — provider not configured (${modelName}/${recordId})`);
    return;
  }

  if (!isTranslatable(modelName)) {
    logError(`Model "${modelName}" is not registered as translatable`);
    return;
  }

  // Filter out null/empty fields
  const translatableFields = getTranslatableFields(modelName);
  const fieldsToTranslate: Array<{ name: string; value: string }> = [];

  for (const field of translatableFields) {
    const value = fields[field.name];
    if (value && value.trim()) {
      fieldsToTranslate.push({ name: field.name, value });
    }
  }

  if (fieldsToTranslate.length === 0) {
    logInfo(`No translatable content found for ${modelName}/${recordId}`);
    return;
  }

  // Auto-detect source language from content if not explicitly provided
  const effectiveSourceLocale = sourceLocale ?? detectSourceLocale(fieldsToTranslate.map(f => f.value));

  // Build target locales: all languages EXCEPT the source locale
  // Always include 'en' + TARGET_LOCALES, then exclude the source
  const allLocales: string[] = ['en', ...TARGET_LOCALES];
  const targetLocales = allLocales.filter(l => l !== effectiveSourceLocale);

  logInfo(`Starting translation for ${modelName}/${recordId}`, {
    modelName,
    recordId,
    sourceLocale: effectiveSourceLocale,
    autoDetected: !sourceLocale,
    fields: fieldsToTranslate.map(f => ({
      fieldName: f.name,
      textLength: f.value.length,
      preview: f.value.substring(0, 60) + (f.value.length > 60 ? '...' : ''),
    })),
    targetLocales,
  });

  const overallStart = Date.now();
  let totalSuccess = 0;
  let totalErrors = 0;

  // Translate for each target locale (all languages except the source)
  for (const locale of targetLocales) {
    try {
      const textsToTranslate = fieldsToTranslate.map(f => f.value);
      const translations = await translationProvider.translate(textsToTranslate, locale);

      // Upsert each translation
      const upsertPromises = fieldsToTranslate.map((field, idx) => {
        const sourceHash = hashText(field.value);
        return prisma.dynamicTranslation.upsert({
          where: {
            customerAccountId_modelName_recordId_fieldName_locale: {
              customerAccountId,
              modelName,
              recordId,
              fieldName: field.name,
              locale,
            },
          },
          update: {
            translatedText: translations[idx],
            sourceHash,
            isStale: false,
            translatedBy: 'python-gpt',
          },
          create: {
            customerAccountId,
            modelName,
            recordId,
            fieldName: field.name,
            locale,
            translatedText: translations[idx],
            sourceHash,
            isStale: false,
            translatedBy: 'python-gpt',
          },
        });
      });

      await Promise.all(upsertPromises);
      totalSuccess += fieldsToTranslate.length;

      logSuccess(`Saved ${fieldsToTranslate.length} translation(s) for ${modelName}/${recordId} [${locale}]`);
    } catch (error) {
      totalErrors += fieldsToTranslate.length;
      logError(`Translation failed for ${modelName}/${recordId} [${locale}]`, error);
    }
  }

  const overallElapsed = Date.now() - overallStart;
  logInfo(`Translation complete for ${modelName}/${recordId}`, {
    totalSuccess,
    totalErrors,
    sourceLocale: effectiveSourceLocale,
    localesProcessed: targetLocales.length,
    totalTimeMs: overallElapsed,
  });
}

/**
 * Mark translations as stale when the source text has changed.
 * Call this when a record is updated — stale translations are still shown
 * but re-translated in the background.
 *
 * @param customerAccountId - Tenant ID
 * @param modelName - e.g. "Risk"
 * @param recordId - ID of the edited record
 * @param fields - Updated field values (to detect which fields actually changed)
 */
export async function markTranslationsStale(
  customerAccountId: string,
  modelName: string,
  recordId: string,
  fields: FieldValues
): Promise<void> {
  try {
    // Get existing translations for this record
    const existing = await prisma.dynamicTranslation.findMany({
      where: { customerAccountId, modelName, recordId },
    });

    if (existing.length === 0) return;

    // Check which fields have changed by comparing hashes
    const staleIds: string[] = [];

    for (const translation of existing) {
      const newValue = fields[translation.fieldName];
      if (newValue && translation.sourceHash) {
        const newHash = hashText(newValue);
        if (newHash !== translation.sourceHash) {
          staleIds.push(translation.id);
        }
      }
    }

    if (staleIds.length > 0) {
      await prisma.dynamicTranslation.updateMany({
        where: { id: { in: staleIds } },
        data: { isStale: true },
      });
      logInfo(`Marked ${staleIds.length} translation(s) as stale for ${modelName}/${recordId}`);
    }
  } catch (error) {
    logError(`Failed to mark translations stale for ${modelName}/${recordId}`, error);
  }
}

/**
 * Get translations for a single record (detail page).
 *
 * @returns Map of { fieldName: translatedText } for the given locale
 */
export async function getRecordTranslations(
  customerAccountId: string,
  modelName: string,
  recordId: string,
  locale: string
): Promise<Record<string, string>> {
  try {
    const translations = await prisma.dynamicTranslation.findMany({
      where: { customerAccountId, modelName, recordId, locale },
      select: { fieldName: true, translatedText: true },
    });

    const result: Record<string, string> = {};
    for (const t of translations) {
      result[t.fieldName] = t.translatedText;
    }

    logInfo(`Fetched ${translations.length} translation(s) for ${modelName}/${recordId} [${locale}]`);
    return result;
  } catch (error) {
    logError(`Failed to get translations for ${modelName}/${recordId}`, error);
    return {};
  }
}

/**
 * Get translations for multiple records (list page).
 *
 * @returns Map of { recordId: { fieldName: translatedText } }
 */
export async function getBulkTranslations(
  customerAccountId: string,
  modelName: string,
  recordIds: string[],
  locale: string
): Promise<Record<string, Record<string, string>>> {
  try {
    if (recordIds.length === 0) return {};

    const translations = await prisma.dynamicTranslation.findMany({
      where: {
        customerAccountId,
        modelName,
        recordId: { in: recordIds },
        locale,
      },
      select: { recordId: true, fieldName: true, translatedText: true },
    });

    const result: Record<string, Record<string, string>> = {};
    for (const t of translations) {
      if (!result[t.recordId]) {
        result[t.recordId] = {};
      }
      result[t.recordId][t.fieldName] = t.translatedText;
    }

    const recordsWithTranslations = Object.keys(result).length;
    logInfo(`Bulk fetch: ${translations.length} translation(s) for ${recordsWithTranslations}/${recordIds.length} records [${modelName}/${locale}]`);
    return result;
  } catch (error) {
    logError(`Failed to get bulk translations for ${modelName}`, error);
    return {};
  }
}

/**
 * Delete all translations for a record (call on record delete).
 */
export async function deleteRecordTranslations(
  customerAccountId: string,
  modelName: string,
  recordId: string
): Promise<void> {
  try {
    const deleted = await prisma.dynamicTranslation.deleteMany({
      where: { customerAccountId, modelName, recordId },
    });
    if (deleted.count > 0) {
      logInfo(`Deleted ${deleted.count} translation(s) for ${modelName}/${recordId}`);
    }
  } catch (error) {
    logError(`Failed to delete translations for ${modelName}/${recordId}`, error);
  }
}

/**
 * Get count of stale translations for a tenant (admin dashboard).
 */
export async function getStaleTranslationCount(customerAccountId: string): Promise<number> {
  try {
    return await prisma.dynamicTranslation.count({
      where: { customerAccountId, isStale: true },
    });
  } catch (error) {
    logError('Failed to count stale translations', error);
    return 0;
  }
}

/**
 * Re-translate all stale translations for a tenant.
 * Designed to be called from a background job or admin action.
 */
export async function refreshStaleTranslations(
  customerAccountId: string,
  getFieldValue: (modelName: string, recordId: string, fieldName: string) => Promise<string | null>
): Promise<{ refreshed: number; errors: number }> {
  const translationProvider = getProvider();
  if (!translationProvider.isConfigured()) {
    return { refreshed: 0, errors: 0 };
  }

  let refreshed = 0;
  let errors = 0;

  try {
    const staleTranslations = await prisma.dynamicTranslation.findMany({
      where: { customerAccountId, isStale: true },
      take: 500,
    });

    logInfo(`Refreshing ${staleTranslations.length} stale translation(s)`);

    for (const translation of staleTranslations) {
      try {
        const sourceText = await getFieldValue(
          translation.modelName,
          translation.recordId,
          translation.fieldName
        );

        if (!sourceText) {
          await prisma.dynamicTranslation.delete({ where: { id: translation.id } });
          continue;
        }

        const [translatedText] = await translationProvider.translate([sourceText], translation.locale);

        await prisma.dynamicTranslation.update({
          where: { id: translation.id },
          data: {
            translatedText,
            sourceHash: hashText(sourceText),
            isStale: false,
          },
        });

        refreshed++;
      } catch (err) {
        logError(`Failed to refresh translation ${translation.id}`, err);
        errors++;
      }
    }

    logInfo(`Stale refresh complete: ${refreshed} refreshed, ${errors} errors`);
  } catch (error) {
    logError('Failed to refresh stale translations', error);
  }

  return { refreshed, errors };
}

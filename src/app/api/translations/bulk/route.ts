/**
 * POST /api/translations/bulk
 *
 * Get translations for multiple records (list pages).
 * Body: { modelName: string, recordIds: string[], locale: string }
 *
 * Returns { translations: { [recordId]: { [fieldName]: translatedText } }, pendingCount: number }
 *
 * Works for ALL locales including "en" — records may have been entered
 * in any language, so English translations may exist in the DB.
 *
 * Auto-translate: If some records have no translations stored yet,
 * or if stored translations are invalid (wrong language), they are
 * auto-translated in the BACKGROUND (non-blocking). The response
 * returns immediately with existing translations plus a pendingCount
 * so the client can retry after a delay.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { getBulkTranslations, translateRecord, isTranslationConfigured } from '@/lib/translation-service';
import { isTranslatable, getTranslatableFields } from '@/lib/translation-config';
import prisma from '@/lib/prisma';

/**
 * Check if a translation contains obviously WRONG script for the target locale.
 * Only flags translations that contain script from a clearly wrong language
 * (e.g. Chinese/Japanese/Korean text when translating to Arabic).
 * Does NOT require target script to be present — proper nouns like "Dom2"
 * correctly stay in Latin script even for Arabic translations.
 */
function hasWrongScript(text: string, locale: string): boolean {
  if (!text || text.trim().length === 0) return false;

  const hasCJK = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(text);

  // Arabic locale should never contain CJK characters
  if (locale === 'ar' && hasCJK) return true;

  // Latvian locale should never contain CJK or Arabic characters
  if (locale === 'lv') {
    const hasArabic = /[\u0600-\u06FF]/.test(text);
    if (hasCJK || hasArabic) return true;
  }

  return false;
}

/**
 * Background auto-translate: fetches source records and translates them.
 * Runs fire-and-forget — does NOT block the API response.
 */
async function backgroundAutoTranslate(
  customerAccountId: string,
  modelName: string,
  idsNeedingTranslation: string[]
): Promise<void> {
  try {
    const fields = getTranslatableFields(modelName);
    if (fields.length === 0) return;

    // Build select clause
    const select: Record<string, boolean> = { id: true };
    for (const field of fields) {
      select[field.name] = true;
    }

    // Dynamically query the model
    const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    const prismaModel = (prisma as unknown as Record<string, unknown>)[modelKey] as {
      findMany?: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
    } | undefined;

    if (!prismaModel?.findMany) return;

    const records = await prismaModel.findMany({
      where: { id: { in: idsNeedingTranslation } },
      select,
    });
    console.log(`[BULK-TRANSLATE-BG] Found ${records.length} source records for ${modelName}, translating in background...`);

    // Translate each record sequentially to avoid overwhelming the API
    for (const record of records) {
      const fieldValues: Record<string, string | null | undefined> = {};
      for (const field of fields) {
        fieldValues[field.name] = record[field.name] as string | null | undefined;
      }
      try {
        await translateRecord(customerAccountId, modelName, record.id as string, fieldValues);
      } catch (err) {
        console.error(`[BULK-TRANSLATE-BG] Auto-translate failed for ${modelName}/${record.id}:`, err);
      }
    }
    console.log(`[BULK-TRANSLATE-BG] Background translation complete for ${modelName}: ${records.length} records`);
  } catch (err) {
    console.error(`[BULK-TRANSLATE-BG] Background auto-translate failed for ${modelName}:`, err);
  }
}

export const POST = withAuthOnly(async (req: NextRequest, _context, session) => {
  try {
    const body = await req.json();
    const { modelName, recordIds, locale } = body;

    // Validate required fields
    if (!modelName || !recordIds || !locale) {
      return NextResponse.json(
        { error: 'Missing required fields: modelName, recordIds, locale' },
        { status: 400 }
      );
    }

    if (!isTranslatable(modelName)) {
      return NextResponse.json(
        { error: `Model "${modelName}" is not registered as translatable` },
        { status: 400 }
      );
    }

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json({ translations: {}, pendingCount: 0 });
    }

    // Cap at 500 records per request to prevent abuse
    if (recordIds.length > 500) {
      return NextResponse.json(
        { error: 'Too many recordIds. Maximum 500 per request.' },
        { status: 400 }
      );
    }

    if (!session.customerAccountId) {
      return NextResponse.json(
        { error: 'User has no customer account' },
        { status: 400 }
      );
    }

    const translations = await getBulkTranslations(
      session.customerAccountId,
      modelName,
      recordIds,
      locale
    );

    // Find records that need (re-)translation:
    // 1. Records with no translations at all
    // 2. Records with invalid translations (wrong language, e.g. Chinese for Arabic)
    const idsNeedingTranslation: string[] = [];
    for (const id of recordIds) {
      if (!translations[id]) {
        idsNeedingTranslation.push(id);
      } else {
        // Check if any stored translation is invalid for this locale
        const fields = translations[id];
        const hasInvalid = Object.values(fields).some(text => hasWrongScript(text, locale));
        if (hasInvalid) {
          // Delete bad translations so they get re-created
          await prisma.dynamicTranslation.deleteMany({
            where: {
              customerAccountId: session.customerAccountId,
              modelName,
              recordId: id,
              locale,
            },
          });
          // Remove from current results so client knows it's pending
          delete translations[id];
          idsNeedingTranslation.push(id);
        }
      }
    }

    const pendingCount = idsNeedingTranslation.length;

    console.log(`[BULK-TRANSLATE] ${modelName} [${locale}]: ${recordIds.length} requested, ${Object.keys(translations).length} cached, ${pendingCount} pending`);

    // Fire-and-forget background auto-translate for missing records
    // This does NOT block the response — translations will be available on next fetch
    if (pendingCount > 0 && isTranslationConfigured()) {
      void backgroundAutoTranslate(
        session.customerAccountId,
        modelName,
        idsNeedingTranslation
      );
    }

    // Return immediately with existing translations + pending count
    return NextResponse.json({ translations, pendingCount });
  } catch (error) {
    console.error('Bulk translations error:', error);
    return NextResponse.json(
      { error: 'Failed to get bulk translations' },
      { status: 500 }
    );
  }
});

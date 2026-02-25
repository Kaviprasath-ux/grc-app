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
 * Read-only: This endpoint only returns existing translations.
 * Translations are created/updated when records are created or edited
 * (via POST /api/translations/translate).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { getBulkTranslations } from '@/lib/translation-service';
import { isTranslatable } from '@/lib/translation-config';
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

    // Clean up invalid translations (wrong script for locale)
    for (const id of recordIds) {
      if (translations[id]) {
        const fields = translations[id];
        const hasInvalid = Object.values(fields).some(text => hasWrongScript(text, locale));
        if (hasInvalid) {
          // Delete bad translations so they don't keep showing
          await prisma.dynamicTranslation.deleteMany({
            where: {
              customerAccountId: session.customerAccountId,
              modelName,
              recordId: id,
              locale,
            },
          });
          delete translations[id];
        }
      }
    }

    console.log(`[BULK-TRANSLATE] ${modelName} [${locale}]: ${recordIds.length} requested, ${Object.keys(translations).length} cached`);

    return NextResponse.json({ translations, pendingCount: 0 });
  } catch (error) {
    console.error('Bulk translations error:', error);
    return NextResponse.json(
      { error: 'Failed to get bulk translations' },
      { status: 500 }
    );
  }
});

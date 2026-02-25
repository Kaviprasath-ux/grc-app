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
 * This endpoint only READS existing translations — it does NOT trigger
 * new translations. Translations are created only when records are
 * explicitly created or edited (via translateRecord in API handlers
 * and triggerTranslation on the frontend).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { getBulkTranslations } from '@/lib/translation-service';
import { isTranslatable } from '@/lib/translation-config';

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

    // Return existing translations only — no background auto-translate
    return NextResponse.json({ translations, pendingCount: 0 });
  } catch (error) {
    console.error('Bulk translations error:', error);
    return NextResponse.json(
      { error: 'Failed to get bulk translations' },
      { status: 500 }
    );
  }
});

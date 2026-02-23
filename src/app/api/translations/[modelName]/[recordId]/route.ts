/**
 * GET /api/translations/[modelName]/[recordId]?locale=ar
 *
 * Get translations for a single record (detail pages).
 * Returns { fieldName: translatedText } for the requested locale.
 *
 * Works for ALL locales including "en" — records may have been entered
 * in any language, so English translations may exist in the DB.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { getRecordTranslations } from '@/lib/translation-service';
import { isTranslatable } from '@/lib/translation-config';

interface RouteContext {
  params: Promise<{ modelName: string; recordId: string }>;
}

export const GET = withAuthOnly(async (req: NextRequest, context: RouteContext, session) => {
  try {
    const { modelName, recordId } = await context.params;
    const locale = req.nextUrl.searchParams.get('locale');

    if (!locale) {
      return NextResponse.json(
        { error: 'Missing required query parameter: locale' },
        { status: 400 }
      );
    }

    if (!isTranslatable(modelName)) {
      return NextResponse.json(
        { error: `Model "${modelName}" is not registered as translatable` },
        { status: 400 }
      );
    }

    if (!session.customerAccountId) {
      return NextResponse.json(
        { error: 'User has no customer account' },
        { status: 400 }
      );
    }

    const translations = await getRecordTranslations(
      session.customerAccountId,
      modelName,
      recordId,
      locale
    );

    return NextResponse.json({ translations });
  } catch (error) {
    console.error('Get record translations error:', error);
    return NextResponse.json(
      { error: 'Failed to get translations' },
      { status: 500 }
    );
  }
});

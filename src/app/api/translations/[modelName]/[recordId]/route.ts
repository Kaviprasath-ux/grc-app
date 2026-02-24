/**
 * GET /api/translations/[modelName]/[recordId]?locale=ar
 *
 * Get translations for a single record (detail pages).
 * Returns { fieldName: translatedText } for the requested locale.
 *
 * Works for ALL locales including "en" — records may have been entered
 * in any language, so English translations may exist in the DB.
 *
 * Auto-translate: If no translations exist yet, fires a background
 * translation and returns pendingCount=1 so the client can retry.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { getRecordTranslations, translateRecord, isTranslationConfigured } from '@/lib/translation-service';
import { isTranslatable, getTranslatableFields } from '@/lib/translation-config';
import prisma from '@/lib/prisma';

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

    const hasTranslations = Object.keys(translations).length > 0;

    // Auto-translate if no translations exist
    if (!hasTranslations && isTranslationConfigured()) {
      const fields = getTranslatableFields(modelName);
      if (fields.length > 0) {
        const select: Record<string, boolean> = { id: true };
        for (const field of fields) {
          select[field.name] = true;
        }

        const modelKey = modelName.charAt(0).toLowerCase() + modelName.slice(1);
        const prismaModel = (prisma as unknown as Record<string, unknown>)[modelKey] as {
          findUnique?: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
        } | undefined;

        if (prismaModel?.findUnique) {
          const record = await prismaModel.findUnique({ where: { id: recordId }, select });
          if (record) {
            const fieldValues: Record<string, string | null | undefined> = {};
            for (const field of fields) {
              fieldValues[field.name] = record[field.name] as string | null | undefined;
            }
            // Fire-and-forget background translate
            void translateRecord(session.customerAccountId, modelName, recordId, fieldValues).catch(err => {
              console.error(`[SINGLE-TRANSLATE-BG] Auto-translate failed for ${modelName}/${recordId}:`, err);
            });
          }
        }
      }
    }

    return NextResponse.json({
      translations,
      pendingCount: hasTranslations ? 0 : 1,
    });
  } catch (error) {
    console.error('Get record translations error:', error);
    return NextResponse.json(
      { error: 'Failed to get translations' },
      { status: 500 }
    );
  }
});

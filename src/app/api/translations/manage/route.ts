/**
 * GET /api/translations/manage
 *
 * Two modes:
 * 1. Default: List DynamicTranslation records with optional filtering (existing behavior).
 * 2. source=true: Query ALL source records for a given modelName, then left-join
 *    with existing DynamicTranslation records to show translated + untranslated rows.
 *    Requires: modelName, locale. Optional: search, status (translated|not_translated).
 *
 * POST /api/translations/manage  — Upsert a translation (create or update)
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getTenantFilter } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { TRANSLATABLE_MODELS } from '@/lib/translation-config';

/**
 * Convert PascalCase model name to camelCase Prisma model key.
 */
function toPrismaModelKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/**
 * Batch-fetch original texts for a set of translations.
 * Groups by modelName+recordId to minimize DB queries.
 * Returns a map: "modelName:recordId:fieldName" → original text
 */
async function batchGetOriginalTexts(
  translations: { modelName: string; recordId: string; fieldName: string }[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  // Group by modelName+recordId (deduplicate)
  const grouped = new Map<string, Set<string>>();
  for (const t of translations) {
    const key = `${t.modelName}:${t.recordId}`;
    if (!grouped.has(key)) grouped.set(key, new Set());
    grouped.get(key)!.add(t.fieldName);
  }

  // Fetch per unique modelName+recordId
  const promises: Promise<void>[] = [];

  for (const [key] of grouped) {
    const [modelName, recordId] = key.split(':');
    const modelConfig = TRANSLATABLE_MODELS.find(m => m.modelName === modelName);
    if (!modelConfig) continue;

    const modelKey = toPrismaModelKey(modelName);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const prismaModel = (prisma as any)[modelKey];
    if (!prismaModel || typeof prismaModel.findUnique !== 'function') continue;

    const selectFields: Record<string, boolean> = {};
    for (const field of modelConfig.fields) {
      selectFields[field.name] = true;
    }

    promises.push(
      prismaModel
        .findUnique({ where: { id: recordId }, select: selectFields })
        .then((record: Record<string, unknown> | null) => {
          if (!record) return;
          for (const field of modelConfig.fields) {
            const val = record[field.name];
            if (typeof val === 'string') {
              result.set(`${modelName}:${recordId}:${field.name}`, val);
            }
          }
        })
        .catch(() => {
          // Silently skip failed lookups
        })
    );
  }

  await Promise.allSettled(promises);
  return result;
}

/**
 * Source mode: query ALL records from the source model, then left-join
 * with DynamicTranslation to show translated + untranslated rows.
 */
async function handleSourceMode(
  modelName: string,
  locale: string,
  tenantFilter: { customerAccountId?: string },
  search?: string,
  status?: string
) {
  const modelConfig = TRANSLATABLE_MODELS.find(m => m.modelName === modelName);
  if (!modelConfig) {
    return NextResponse.json({ error: `Model "${modelName}" is not translatable` }, { status: 400 });
  }

  const modelKey = toPrismaModelKey(modelName);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaModel = (prisma as any)[modelKey];
  if (!prismaModel || typeof prismaModel.findMany !== 'function') {
    return NextResponse.json({ error: `Model "${modelName}" not found in Prisma` }, { status: 400 });
  }

  // Build select: id + all translatable fields
  const selectFields: Record<string, boolean> = { id: true };
  for (const field of modelConfig.fields) {
    selectFields[field.name] = true;
  }

  // Build where clause for the source model
  const sourceWhere: Record<string, unknown> = {};
  if (tenantFilter.customerAccountId) {
    sourceWhere.customerAccountId = tenantFilter.customerAccountId;
  }

  // Fetch source records (limit to 1000)
  const sourceRecords: Record<string, unknown>[] = await prismaModel.findMany({
    where: sourceWhere,
    select: selectFields,
    take: 1000,
    orderBy: { id: 'asc' },
  });

  if (sourceRecords.length === 0) {
    return NextResponse.json([]);
  }

  // Fetch existing translations for these record IDs
  const recordIds = sourceRecords.map(r => r.id as string);
  const existingTranslations = await prisma.dynamicTranslation.findMany({
    where: {
      ...tenantFilter,
      modelName,
      locale,
      recordId: { in: recordIds },
    },
  });

  // Build lookup: "recordId:fieldName" → translation record
  const translationMap = new Map<string, typeof existingTranslations[number]>();
  for (const t of existingTranslations) {
    translationMap.set(`${t.recordId}:${t.fieldName}`, t);
  }

  // Build flat result array: one row per record × field
  interface SourceRow {
    id: string; // translationId or synthetic "new:recordId:fieldName"
    modelName: string;
    recordId: string;
    fieldName: string;
    locale: string;
    originalText: string | null;
    translatedText: string | null;
    translatedBy: string | null;
    isStale: boolean;
    updatedAt: string | null;
    isNew: boolean; // true if no DynamicTranslation exists yet
  }

  const rows: SourceRow[] = [];

  for (const record of sourceRecords) {
    const recordId = record.id as string;
    for (const field of modelConfig.fields) {
      const originalText = typeof record[field.name] === 'string' ? (record[field.name] as string) : null;
      if (!originalText) continue; // skip empty fields

      const existing = translationMap.get(`${recordId}:${field.name}`);

      // Apply search filter on original text
      if (search && !originalText.toLowerCase().includes(search.toLowerCase())) {
        // Also check translated text if it exists
        if (!existing?.translatedText?.toLowerCase().includes(search.toLowerCase())) {
          continue;
        }
      }

      const isTranslated = !!existing;

      // Apply status filter
      if (status === 'translated' && !isTranslated) continue;
      if (status === 'not_translated' && isTranslated) continue;

      rows.push({
        id: existing?.id || `new:${recordId}:${field.name}`,
        modelName,
        recordId,
        fieldName: field.name,
        locale,
        originalText,
        translatedText: existing?.translatedText || null,
        translatedBy: existing?.translatedBy || null,
        isStale: existing?.isStale || false,
        updatedAt: existing?.updatedAt?.toISOString() || null,
        isNew: !existing,
      });
    }
  }

  return NextResponse.json(rows);
}

export const GET = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const { searchParams } = new URL(req.url);
      const modelName = searchParams.get('modelName') || undefined;
      const locale = searchParams.get('locale') || undefined;
      const search = searchParams.get('search') || undefined;
      const source = searchParams.get('source') === 'true';
      const status = searchParams.get('status') || undefined;

      const tenantFilter = getTenantFilter(session);

      // Source mode: query all source records + left-join translations
      if (source) {
        if (!modelName || !locale) {
          return NextResponse.json(
            { error: 'modelName and locale are required when source=true' },
            { status: 400 }
          );
        }
        return handleSourceMode(modelName, locale, tenantFilter, search, status);
      }

      // Default mode: query DynamicTranslation table directly
      const where: Record<string, unknown> = {
        ...tenantFilter,
      };

      if (modelName) {
        where.modelName = modelName;
      }
      if (locale) {
        where.locale = locale;
      }
      if (search) {
        where.OR = [
          { translatedText: { contains: search, mode: 'insensitive' } },
          { recordId: { contains: search, mode: 'insensitive' } },
          { fieldName: { contains: search, mode: 'insensitive' } },
        ];
      }

      const translations = await prisma.dynamicTranslation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: 500,
      });

      // Batch-fetch original texts
      const originalTexts = await batchGetOriginalTexts(translations);

      // Attach originalText to each record
      const enriched = translations.map(t => ({
        ...t,
        originalText: originalTexts.get(`${t.modelName}:${t.recordId}:${t.fieldName}`) || null,
      }));

      return NextResponse.json(enriched);
    } catch (error) {
      console.error('Error fetching translations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch translations' },
        { status: 500 }
      );
    }
  },
  { resource: 'organization.settings', action: 'view' }
);

/**
 * POST /api/translations/manage — Upsert a translation
 * Body: { modelName, recordId, fieldName, locale, translatedText }
 */
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const body = await req.json();
      const { modelName, recordId, fieldName, locale, translatedText } = body;

      if (!modelName || !recordId || !fieldName || !locale) {
        return NextResponse.json(
          { error: 'modelName, recordId, fieldName, and locale are required' },
          { status: 400 }
        );
      }
      if (typeof translatedText !== 'string' || !translatedText.trim()) {
        return NextResponse.json(
          { error: 'translatedText is required' },
          { status: 400 }
        );
      }

      // Validate model is translatable
      const modelConfig = TRANSLATABLE_MODELS.find(m => m.modelName === modelName);
      if (!modelConfig) {
        return NextResponse.json({ error: `Model "${modelName}" is not translatable` }, { status: 400 });
      }

      const customerAccountId = session.customerAccountId;
      if (!customerAccountId) {
        return NextResponse.json({ error: 'No customer account' }, { status: 403 });
      }

      const result = await prisma.dynamicTranslation.upsert({
        where: {
          customerAccountId_modelName_recordId_fieldName_locale: {
            customerAccountId,
            modelName,
            recordId,
            fieldName,
            locale,
          },
        },
        update: {
          translatedText: translatedText.trim(),
          translatedBy: 'manual',
          isStale: false,
        },
        create: {
          customerAccountId,
          modelName,
          recordId,
          fieldName,
          locale,
          translatedText: translatedText.trim(),
          translatedBy: 'manual',
          isStale: false,
        },
      });

      return NextResponse.json(result);
    } catch (error) {
      console.error('Error upserting translation:', error);
      return NextResponse.json(
        { error: 'Failed to save translation' },
        { status: 500 }
      );
    }
  },
  { resource: 'organization.settings', action: 'edit' }
);

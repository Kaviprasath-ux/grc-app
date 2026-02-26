/**
 * GET /api/translations/manage/[id]  — Fetch single translation + original source text
 * PATCH /api/translations/manage/[id] — Update translatedText, set translatedBy: "manual"
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, validateTenantAccess } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { TRANSLATABLE_MODELS } from '@/lib/translation-config';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Convert PascalCase model name to camelCase Prisma model key.
 * e.g. "RiskCategory" → "riskCategory", "Risk" → "risk"
 */
function toPrismaModelKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

/**
 * Try to fetch the original source text for a translation record.
 * Returns a map of fieldName → original text, or empty object on failure.
 */
async function getOriginalText(
  modelName: string,
  recordId: string
): Promise<Record<string, string>> {
  const modelConfig = TRANSLATABLE_MODELS.find(m => m.modelName === modelName);
  if (!modelConfig) return {};

  const modelKey = toPrismaModelKey(modelName);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaModel = (prisma as any)[modelKey];
  if (!prismaModel || typeof prismaModel.findUnique !== 'function') return {};

  try {
    const selectFields: Record<string, boolean> = {};
    for (const field of modelConfig.fields) {
      selectFields[field.name] = true;
    }

    const record = await prismaModel.findUnique({
      where: { id: recordId },
      select: selectFields,
    });

    if (!record) return {};

    const result: Record<string, string> = {};
    for (const field of modelConfig.fields) {
      const val = record[field.name];
      if (typeof val === 'string') {
        result[field.name] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export const GET = withAuth(
  async (_req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;

      const translation = await prisma.dynamicTranslation.findUnique({
        where: { id },
      });

      if (!translation) {
        return NextResponse.json({ error: 'Translation not found' }, { status: 404 });
      }

      if (!validateTenantAccess(session, translation.customerAccountId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Fetch original source text
      const originalTexts = await getOriginalText(translation.modelName, translation.recordId);

      return NextResponse.json({
        ...translation,
        originalText: originalTexts[translation.fieldName] || null,
      });
    } catch (error) {
      console.error('Error fetching translation:', error);
      return NextResponse.json({ error: 'Failed to fetch translation' }, { status: 500 });
    }
  },
  { resource: 'organization.settings', action: 'view' }
);

export const PATCH = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const body = await req.json();
      const { translatedText } = body;

      if (typeof translatedText !== 'string' || !translatedText.trim()) {
        return NextResponse.json({ error: 'translatedText is required' }, { status: 400 });
      }

      // Check record exists and tenant access
      const existing = await prisma.dynamicTranslation.findUnique({
        where: { id },
      });

      if (!existing) {
        return NextResponse.json({ error: 'Translation not found' }, { status: 404 });
      }

      if (!validateTenantAccess(session, existing.customerAccountId)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      const updated = await prisma.dynamicTranslation.update({
        where: { id },
        data: {
          translatedText: translatedText.trim(),
          translatedBy: 'manual',
          isStale: false,
        },
      });

      return NextResponse.json(updated);
    } catch (error) {
      console.error('Error updating translation:', error);
      return NextResponse.json({ error: 'Failed to update translation' }, { status: 500 });
    }
  },
  { resource: 'organization.settings', action: 'edit' }
);

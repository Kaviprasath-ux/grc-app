/**
 * POST /api/translations/migrate
 *
 * Bulk translate existing data for a tenant (admin only).
 * Translates records that don't have translations yet, sorted by priority.
 *
 * Body: { modelName?: string, batchSize?: number }
 * - modelName: Optional — translate only this model. If omitted, translates all.
 * - batchSize: Optional — max records per model (default 50).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import prisma from '@/lib/prisma';
import { translateRecord, isTranslationConfigured } from '@/lib/translation-service';
import {
  TRANSLATABLE_MODELS,
  TARGET_LOCALES,
  getTranslatableFields,
} from '@/lib/translation-config';

export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      if (!isTranslationConfigured()) {
        return NextResponse.json(
          { error: 'Translation service is not configured. Set AZURE_TRANSLATOR_KEY and AZURE_TRANSLATOR_REGION.' },
          { status: 503 }
        );
      }

      if (!session.customerAccountId) {
        return NextResponse.json(
          { error: 'User has no customer account' },
          { status: 400 }
        );
      }

      const body = await req.json().catch(() => ({}));
      const filterModel = body.modelName as string | undefined;
      const batchSize = Math.min(body.batchSize || 50, 200);

      const models = filterModel
        ? TRANSLATABLE_MODELS.filter(m => m.modelName === filterModel)
        : [...TRANSLATABLE_MODELS].sort((a, b) => a.priority - b.priority);

      if (filterModel && models.length === 0) {
        return NextResponse.json(
          { error: `Model "${filterModel}" is not registered as translatable` },
          { status: 400 }
        );
      }

      const results: Array<{ modelName: string; translated: number; skipped: number; errors: number }> = [];

      for (const model of models) {
        let translated = 0;
        let skipped = 0;
        let errors = 0;

        try {
          // Dynamically query the model to get records
          const modelLower = model.modelName.charAt(0).toLowerCase() + model.modelName.slice(1);
          const prismaModel = (prisma as Record<string, unknown>)[modelLower] as {
            findMany: (args: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
          } | undefined;

          if (!prismaModel?.findMany) {
            console.warn(`Prisma model "${modelLower}" not found, skipping`);
            continue;
          }

          // Build select clause for id + translatable fields
          const fields = getTranslatableFields(model.modelName);
          const select: Record<string, boolean> = { id: true };
          for (const field of fields) {
            select[field.name] = true;
          }

          const records = await prismaModel.findMany({
            where: { customerAccountId: session.customerAccountId },
            select,
            take: batchSize,
          });

          for (const record of records) {
            const recordId = record.id as string;

            // Check if translations already exist for this record
            const existingCount = await prisma.dynamicTranslation.count({
              where: {
                customerAccountId: session.customerAccountId,
                modelName: model.modelName,
                recordId,
                locale: TARGET_LOCALES[0], // Check first locale as proxy
              },
            });

            if (existingCount > 0) {
              skipped++;
              continue;
            }

            // Build field values
            const fieldValues: Record<string, string> = {};
            for (const field of fields) {
              const value = record[field.name];
              if (typeof value === 'string' && value.trim()) {
                fieldValues[field.name] = value;
              }
            }

            if (Object.keys(fieldValues).length === 0) {
              skipped++;
              continue;
            }

            try {
              await translateRecord(
                session.customerAccountId,
                model.modelName,
                recordId,
                fieldValues
              );
              translated++;
            } catch {
              errors++;
            }
          }
        } catch (err) {
          console.error(`Migration failed for model ${model.modelName}:`, err);
          errors++;
        }

        results.push({ modelName: model.modelName, translated, skipped, errors });
      }

      const totalTranslated = results.reduce((sum, r) => sum + r.translated, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);

      return NextResponse.json({
        success: true,
        summary: {
          totalTranslated,
          totalErrors,
          models: results,
        },
      });
    } catch (error) {
      console.error('Migration error:', error);
      return NextResponse.json(
        { error: 'Failed to run translation migration' },
        { status: 500 }
      );
    }
  },
  { resource: 'admin.settings', action: 'edit' }
);

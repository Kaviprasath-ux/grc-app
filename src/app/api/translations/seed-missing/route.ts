/**
 * POST /api/translations/seed-missing
 *
 * One-time utility to trigger translations for existing records that
 * don't have any translations stored yet.  Useful after enabling the
 * "translate-on-save-only" mode so that pre-existing data gets translated.
 *
 * Body (optional): { modelNames?: string[] }
 *   - If provided, only seeds the listed models.
 *   - Otherwise seeds all registered models.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { translateRecord, isTranslationConfigured } from '@/lib/translation-service';
import { TRANSLATABLE_MODELS, getTranslatableFields } from '@/lib/translation-config';

// Prisma model accessor map — maps modelName to the prisma delegate
function getPrismaDelegate(modelName: string) {
  const map: Record<string, unknown> = {
    User: prisma.user,
    Department: prisma.department,
    Process: prisma.process,
    AuditType: prisma.auditType,
    AuditCategory: prisma.auditCategory,
    AuditScoringRange: prisma.auditScoringRange,
    AuditNatureOfControl: prisma.auditNatureOfControl,
    AuditPeriodicity: prisma.auditPeriodicity,
    AuditRiskFactor: prisma.auditRiskFactor,
    AuditProbability: prisma.auditProbability,
    AuditImpact: prisma.auditImpact,
    AuditEngagement: prisma.auditEngagement,
    AuditableEntity: prisma.auditableEntity,
    InternalAuditRisk: prisma.internalAuditRisk,
    InternalAuditFinding: prisma.internalAuditFinding,
    InternalAuditCAPA: prisma.internalAuditCAPA,
    AuditReport: prisma.auditReport,
    FieldworkEvidenceRequest: prisma.fieldworkEvidenceRequest,
  };
  return map[modelName] as { findMany: (args: Record<string, unknown>) => Promise<Record<string, unknown>[]> } | undefined;
}

export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      if (!isTranslationConfigured()) {
        return NextResponse.json({ error: 'Translation provider not configured' }, { status: 400 });
      }

      const customerAccountId = session.customerAccountId;
      if (!customerAccountId) {
        return NextResponse.json({ error: 'No customer account' }, { status: 400 });
      }

      const body = await req.json().catch(() => ({}));
      const requestedModels: string[] | undefined = body.modelNames;

      // Determine which models to process
      const modelsToProcess = requestedModels
        ? TRANSLATABLE_MODELS.filter(m => requestedModels.includes(m.modelName))
        : TRANSLATABLE_MODELS;

      const results: Record<string, { total: number; translated: number; skipped: number; errors: number }> = {};

      for (const model of modelsToProcess) {
        const delegate = getPrismaDelegate(model.modelName);
        if (!delegate) {
          results[model.modelName] = { total: 0, translated: 0, skipped: 0, errors: 0 };
          continue;
        }

        const fields = getTranslatableFields(model.modelName);
        if (fields.length === 0) continue;

        // Build select to get id + translatable fields
        const select: Record<string, boolean> = { id: true };
        for (const f of fields) {
          select[f.name] = true;
        }

        // Fetch all records for this tenant
        let records: Record<string, unknown>[];
        try {
          // Some models don't have customerAccountId — try with filter first, fallback without
          records = await delegate.findMany({
            where: { customerAccountId },
            select,
            take: 500,
          });
        } catch {
          try {
            records = await delegate.findMany({ select, take: 500 });
          } catch {
            results[model.modelName] = { total: 0, translated: 0, skipped: 0, errors: 0 };
            continue;
          }
        }

        let translated = 0;
        let skipped = 0;
        let errors = 0;

        for (const record of records) {
          const recordId = record.id as string;

          // Check if translations already exist for this record
          const existingCount = await prisma.dynamicTranslation.count({
            where: { customerAccountId, modelName: model.modelName, recordId },
          });

          if (existingCount > 0) {
            skipped++;
            continue;
          }

          // Build fields map
          const fieldValues: Record<string, string> = {};
          for (const f of fields) {
            const val = record[f.name];
            if (val && typeof val === 'string' && val.trim()) {
              fieldValues[f.name] = val;
            }
          }

          if (Object.keys(fieldValues).length === 0) {
            skipped++;
            continue;
          }

          // Trigger translation (fire-and-forget with small delay to avoid overwhelming)
          try {
            void translateRecord(customerAccountId, model.modelName, recordId, fieldValues);
            translated++;
            // Small delay between translations to not overwhelm the API
            await new Promise(resolve => setTimeout(resolve, 200));
          } catch {
            errors++;
          }
        }

        results[model.modelName] = {
          total: records.length,
          translated,
          skipped,
          errors,
        };
      }

      return NextResponse.json({
        message: 'Translation seeding triggered',
        results,
      });
    } catch (error) {
      console.error('Seed translations error:', error);
      return NextResponse.json({ error: 'Failed to seed translations' }, { status: 500 });
    }
  },
  { resource: 'audit.settings', action: 'edit' }
);

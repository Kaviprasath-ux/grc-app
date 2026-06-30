/**
 * Bulk Translation Script for Operational/Strategic Plan Data
 *
 * Backfills Arabic/Latvian translations for existing Operational Plan rows that
 * pre-date dynamic-translation support. The Operational Plan pages (list +
 * detail) read these from the DynamicTranslation table; new create/edit flows
 * already trigger translations automatically, so this script is only needed
 * once for data created before the feature shipped.
 *
 * Models covered:
 *   - AuditStrategicPlan       (title)            — shown as the plan header/breadcrumb
 *   - AuditStrategicPlanItem   (title, auditType, notes)        — operational-plan LIST rows
 *   - AuditOperationalPlanItem (title, auditType, auditCategory, notes) — detail-page audit rows
 *
 * USAGE:
 *   npx tsx scripts/bulk-translate-operational-plan.ts
 *
 * OPTIONS:
 *   --model=AuditStrategicPlanItem   Translate only a specific model
 *   --force                          Re-translate even if translations exist
 *   --batch=20                       Records per batch (default: 20)
 *   --dry-run                        Show what would be translated without calling the API
 *
 * ENVIRONMENT:
 *   Requires AI_API_BASE_URL and PYTHON_API_SECRET to be set (reads from .env)
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ==================== CONFIG ====================

const TARGET_LOCALES = ['ar', 'lv'] as const;

interface ModelConfig {
  modelName: string;
  fields: string[];
  /** Fetch records for one customer account (with id + translatable fields selected). */
  fetch: (accountId: string) => Promise<Array<Record<string, unknown>>>;
}

const MODELS_TO_TRANSLATE: ModelConfig[] = [
  {
    modelName: 'AuditStrategicPlan',
    fields: ['title'],
    fetch: (accountId) =>
      prisma.auditStrategicPlan.findMany({
        where: { customerAccountId: accountId },
        select: { id: true, title: true },
      }),
  },
  {
    // No direct customerAccountId column — scope via the parent strategic plan.
    modelName: 'AuditStrategicPlanItem',
    fields: ['title', 'auditType', 'notes'],
    fetch: (accountId) =>
      prisma.auditStrategicPlanItem.findMany({
        where: { strategicPlan: { customerAccountId: accountId } },
        select: { id: true, title: true, auditType: true, notes: true },
      }),
  },
  {
    // No direct customerAccountId column — scope via the parent operational plan.
    modelName: 'AuditOperationalPlanItem',
    fields: ['title', 'auditType', 'auditCategory', 'notes'],
    fetch: (accountId) =>
      prisma.auditOperationalPlanItem.findMany({
        where: { operationalPlan: { customerAccountId: accountId } },
        select: { id: true, title: true, auditType: true, auditCategory: true, notes: true },
      }),
  },
];

// ==================== TRANSLATION API ====================

const AI_BASE_URL = process.env.AI_API_BASE_URL?.replace(/\/$/, '');
const API_SECRET = process.env.PYTHON_API_SECRET;

async function translateText(text: string, targetLocale: string): Promise<string> {
  if (!AI_BASE_URL || !API_SECRET) {
    throw new Error('AI_API_BASE_URL and PYTHON_API_SECRET must be set');
  }

  const response = await fetch(`${AI_BASE_URL}/api/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_SECRET,
    },
    body: JSON.stringify({
      Original_Text: text,
      target_language_code: targetLocale,
      model_config: { populate_by_name: true },
    }),
  });

  if (!response.ok) {
    throw new Error(`Translation API returned ${response.status}: ${await response.text()}`);
  }

  const data = (await response.json()) as { translated_text?: string };
  return data.translated_text || text;
}

function hashText(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

// ==================== MAIN ====================

async function main() {
  const args = process.argv.slice(2);
  const filterModel = args.find((a) => a.startsWith('--model='))?.split('=')[1];
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');
  const batchSize = parseInt(args.find((a) => a.startsWith('--batch='))?.split('=')[1] || '20', 10);

  console.log('\n=== Bulk Translation: Operational/Strategic Plans ===\n');
  console.log(`  API URL:    ${AI_BASE_URL || '(not set)'}`);
  console.log(`  API Secret: ${API_SECRET ? '***' + API_SECRET.slice(-4) : '(not set)'}`);
  console.log(`  Force:      ${force}`);
  console.log(`  Dry Run:    ${dryRun}`);
  console.log(`  Batch Size: ${batchSize}`);
  console.log(`  Filter:     ${filterModel || 'all models'}`);
  console.log();

  if (!dryRun && (!AI_BASE_URL || !API_SECRET)) {
    console.error('ERROR: AI_API_BASE_URL and PYTHON_API_SECRET environment variables are required.');
    console.error('Set them in your .env file or export them before running this script.');
    process.exit(1);
  }

  const accounts = await prisma.customerAccount.findMany({ select: { id: true, name: true } });
  console.log(`Found ${accounts.length} customer account(s)\n`);

  const models = filterModel
    ? MODELS_TO_TRANSLATE.filter((m) => m.modelName === filterModel)
    : MODELS_TO_TRANSLATE;

  if (filterModel && models.length === 0) {
    console.error(
      `ERROR: Unknown model "${filterModel}". Available: ${MODELS_TO_TRANSLATE.map((m) => m.modelName).join(', ')}`
    );
    process.exit(1);
  }

  let totalTranslated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const account of accounts) {
    console.log(`\n--- Account: ${account.name} (${account.id}) ---\n`);

    for (const model of models) {
      console.log(`  Model: ${model.modelName}`);

      const records = await model.fetch(account.id);
      console.log(`    Found ${records.length} record(s)`);

      let modelTranslated = 0;
      let modelSkipped = 0;
      let modelErrors = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);

        for (const record of batch) {
          const recordId = record.id as string;

          // Collect non-empty field values
          const fieldValues: Array<{ name: string; value: string }> = [];
          for (const field of model.fields) {
            const value = record[field];
            if (typeof value === 'string' && value.trim()) {
              fieldValues.push({ name: field, value: value.trim() });
            }
          }

          if (fieldValues.length === 0) {
            modelSkipped++;
            continue;
          }

          // Skip records that already have translations (unless --force)
          if (!force) {
            const existingCount = await prisma.dynamicTranslation.count({
              where: {
                customerAccountId: account.id,
                modelName: model.modelName,
                recordId,
                locale: TARGET_LOCALES[0],
              },
            });
            if (existingCount > 0) {
              modelSkipped++;
              continue;
            }
          }

          const preview =
            fieldValues[0].value.substring(0, 50) + (fieldValues[0].value.length > 50 ? '...' : '');

          if (dryRun) {
            console.log(`    [DRY RUN] Would translate ${model.modelName}/${recordId}: "${preview}"`);
            modelTranslated++;
            continue;
          }

          for (const locale of TARGET_LOCALES) {
            try {
              for (const field of fieldValues) {
                const translated = await translateText(field.value, locale);
                const sourceHash = hashText(field.value);

                await prisma.dynamicTranslation.upsert({
                  where: {
                    customerAccountId_modelName_recordId_fieldName_locale: {
                      customerAccountId: account.id,
                      modelName: model.modelName,
                      recordId,
                      fieldName: field.name,
                      locale,
                    },
                  },
                  update: {
                    translatedText: translated,
                    sourceHash,
                    isStale: false,
                    translatedBy: 'bulk-script',
                  },
                  create: {
                    customerAccountId: account.id,
                    modelName: model.modelName,
                    recordId,
                    fieldName: field.name,
                    locale,
                    translatedText: translated,
                    sourceHash,
                    isStale: false,
                    translatedBy: 'bulk-script',
                  },
                });
              }
              console.log(`    ✓ ${model.modelName}/${recordId} → ${locale}: "${preview}"`);
            } catch (error) {
              const err = error as Error;
              console.error(`    ✗ ${model.modelName}/${recordId} → ${locale}: ${err.message}`);
              modelErrors++;
            }
          }

          modelTranslated++;
          // Small delay between records to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }

      console.log(`    Summary: ${modelTranslated} translated, ${modelSkipped} skipped, ${modelErrors} errors\n`);
      totalTranslated += modelTranslated;
      totalSkipped += modelSkipped;
      totalErrors += modelErrors;
    }
  }

  console.log('\n=== DONE ===');
  console.log(`  Total Translated: ${totalTranslated}`);
  console.log(`  Total Skipped:    ${totalSkipped}`);
  console.log(`  Total Errors:     ${totalErrors}`);
  console.log();

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await prisma.$disconnect();
  process.exit(1);
});

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import { isTranslationConfigured, translateTexts } from '@/lib/translation-service';
import { extractTexts, applyTranslations } from '@/lib/charter-translator';
import type { CharterBlock } from '@/lib/charter-parser';
import { TARGET_LOCALES } from '@/lib/translation-config';

const MODEL_NAME = 'AuditCharter';
const FIELD_NAME = 'content';

// POST /api/internal-audit/audit-charter/translate
// Body: { locale: "ar" | "lv" }
// Returns: { content: CharterBlock[] }
export const POST = withAuth(
  async (req: NextRequest, _ctx, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const { locale } = (await req.json()) as { locale: string };

      if (!locale || locale === 'en') {
        return NextResponse.json({ error: 'Locale required (not en)' }, { status: 400 });
      }
      if (!(TARGET_LOCALES as readonly string[]).includes(locale)) {
        return NextResponse.json({ error: `Unsupported locale: ${locale}` }, { status: 400 });
      }

      const charter = await prisma.auditCharter.findUnique({
        where: { customerAccountId },
        select: { id: true, content: true },
      });

      if (!charter) {
        return NextResponse.json({ error: 'Charter not found' }, { status: 404 });
      }

      const blocks = (charter.content as unknown as CharterBlock[]) ?? [];

      // ── Check cache ──────────────────────────────────────────────────────────
      const cached = await prisma.dynamicTranslation.findUnique({
        where: {
          customerAccountId_modelName_recordId_fieldName_locale: {
            customerAccountId,
            modelName: MODEL_NAME,
            recordId: charter.id,
            fieldName: FIELD_NAME,
            locale,
          },
        },
        select: { translatedText: true, isStale: true },
      });

      if (cached && !cached.isStale) {
        // Invalidate cache if it contains error placeholders or no target-language characters
        const hasArabic = locale === 'ar' && /[؀-ۿ]/.test(cached.translatedText);
        const hasLatvian = locale === 'lv' && /[āčēģīķļņšūž]/i.test(cached.translatedText);
        const isBadCache =
          cached.translatedText.includes('Please provide the text') ||
          (locale === 'ar' && !hasArabic) ||
          (locale === 'lv' && !hasLatvian);
        if (!isBadCache) {
          return NextResponse.json({
            content: JSON.parse(cached.translatedText) as CharterBlock[],
            fromCache: true,
          });
        }
        console.log(`[AuditCharter translate] cache invalid for locale=${locale}, re-translating`);
      }

      // ── Translate ────────────────────────────────────────────────────────────
      const originals = extractTexts(blocks);

      let translatedBlocks: CharterBlock[];

      if (originals.length === 0 || !isTranslationConfigured()) {
        console.log(`[AuditCharter translate] skipping — ${originals.length} texts, configured=${isTranslationConfigured()}`);
        translatedBlocks = blocks;
      } else {
        console.log(`[AuditCharter translate] translating ${originals.length} segments to ${locale}`);
        const translated = await translateTexts(originals, locale);
        const map = new Map<string, string>(originals.map((o, i) => [o, translated[i] ?? o]));
        translatedBlocks = applyTranslations(blocks, map);
        console.log(`[AuditCharter translate] done`);
      }

      const translatedJson = JSON.stringify(translatedBlocks);

      // ── Skip caching if translation didn't produce target-language chars ──────
      const hasTargetChars =
        (locale === 'ar' && /[؀-ۿ]/.test(translatedJson)) ||
        (locale === 'lv' && /[āčēģīķļņšūž]/i.test(translatedJson));
      if (!hasTargetChars) {
        console.warn(`[AuditCharter translate] no target-language chars detected — skipping cache`);
        return NextResponse.json({ content: translatedBlocks, fromCache: false });
      }

      // ── Cache result ─────────────────────────────────────────────────────────
      await prisma.dynamicTranslation.upsert({
        where: {
          customerAccountId_modelName_recordId_fieldName_locale: {
            customerAccountId,
            modelName: MODEL_NAME,
            recordId: charter.id,
            fieldName: FIELD_NAME,
            locale,
          },
        },
        update: { translatedText: translatedJson, isStale: false },
        create: {
          customerAccountId,
          modelName: MODEL_NAME,
          recordId: charter.id,
          fieldName: FIELD_NAME,
          locale,
          translatedText: translatedJson,
          translatedBy: 'azure',
        },
      });

      return NextResponse.json({ content: translatedBlocks, fromCache: false });
    } catch (err) {
      console.error('POST /api/internal-audit/audit-charter/translate:', err);
      return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
    }
  },
  { resource: 'audit.charter', action: 'view' }
);

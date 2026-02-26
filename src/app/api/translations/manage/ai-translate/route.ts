/**
 * POST /api/translations/manage/ai-translate
 *
 * Synchronously translate a single text using the AI backend.
 * Returns the translated text immediately (not fire-and-forget).
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { translateSingleText, isTranslationConfigured } from '@/lib/translation-service';

export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const { text, targetLocale } = body;

      if (typeof text !== 'string' || !text.trim()) {
        return NextResponse.json({ error: 'text is required' }, { status: 400 });
      }
      if (typeof targetLocale !== 'string' || !targetLocale.trim()) {
        return NextResponse.json({ error: 'targetLocale is required' }, { status: 400 });
      }

      if (!isTranslationConfigured()) {
        return NextResponse.json(
          { error: 'AI translation is not configured on this server' },
          { status: 503 }
        );
      }

      const translatedText = await translateSingleText(text.trim(), targetLocale.trim());

      return NextResponse.json({ translatedText });
    } catch (error) {
      console.error('Error in AI translate:', error);
      return NextResponse.json(
        { error: 'AI translation failed' },
        { status: 500 }
      );
    }
  },
  { resource: 'organization.settings', action: 'edit' }
);

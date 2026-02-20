/**
 * POST /api/translations/translate
 *
 * Trigger translation for a single record (fire-and-forget).
 * Called after creating or editing a record.
 *
 * Body: { modelName: string, recordId: string, fields: { [fieldName]: value } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuthOnly } from '@/lib/api-auth';
import { translateRecord, markTranslationsStale } from '@/lib/translation-service';
import { isTranslatable } from '@/lib/translation-config';

export const POST = withAuthOnly(async (req: NextRequest, _context, session) => {
  try {
    const body = await req.json();
    const { modelName, recordId, fields } = body;

    // Validate required fields
    if (!modelName || !recordId || !fields) {
      return NextResponse.json(
        { error: 'Missing required fields: modelName, recordId, fields' },
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

    // Mark existing translations as stale first (for edits)
    await markTranslationsStale(session.customerAccountId, modelName, recordId, fields);

    // Fire-and-forget: translate in background, don't block response
    // Using void to explicitly ignore the promise
    void translateRecord(session.customerAccountId, modelName, recordId, fields);

    return NextResponse.json({ success: true, message: 'Translation triggered' });
  } catch (error) {
    console.error('Translation trigger error:', error);
    return NextResponse.json(
      { error: 'Failed to trigger translation' },
      { status: 500 }
    );
  }
});

import { NextRequest, NextResponse } from 'next/server';
import { handleInboundMessage } from '@/lib/support/channels';

/**
 * Microsoft Teams inbound webhook (item 15). Public endpoint.
 *
 * Accepts a simplified shape { from, name, text, conversationId } and also
 * parses a Bot Framework activity leniently. Security: requires
 * `x-verify-token` matching TEAMS_VERIFY_TOKEN when that env var is set.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.TEAMS_VERIFY_TOKEN;
  if (expected && req.headers.get('x-verify-token') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  let from = body.from as string | undefined;
  let name = body.name as string | undefined;
  let text = body.text as string | undefined;
  let conversationId = body.conversationId as string | undefined;

  // Bot Framework activity shape
  if (!from || !text) {
    if (body?.type === 'message') {
      from = body?.from?.id || from;
      name = body?.from?.name || name;
      text = body?.text || text;
      conversationId = body?.conversation?.id || conversationId;
    }
  }

  if (!from || !text) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await handleInboundMessage({
    channel: 'Teams',
    from,
    fromName: name ?? null,
    text,
    externalRef: conversationId ?? null,
  });

  return NextResponse.json({ ok: true, ticket: result });
}

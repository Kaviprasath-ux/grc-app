import { NextRequest, NextResponse } from 'next/server';
import { handleInboundMessage } from '@/lib/support/channels';

/**
 * WhatsApp inbound webhook (item 15). Public endpoint.
 *
 * GET  — provider verification handshake (Meta style: echoes hub.challenge when
 *        hub.verify_token matches WHATSAPP_VERIFY_TOKEN).
 * POST — inbound message. Accepts a simplified shape { from, name, text,
 *        messageId } and also parses Meta's webhook structure leniently.
 *
 * Security: if WHATSAPP_VERIFY_TOKEN is set, POST requires it via the
 * `x-verify-token` header (lightweight guard; production should also validate
 * the provider signature).
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && expected && token === expected) {
    return new NextResponse(challenge || '', { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(req: NextRequest) {
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;
  if (expected && req.headers.get('x-verify-token') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  // Normalize: simplified shape first, then Meta webhook structure.
  let from = body.from as string | undefined;
  let name = body.name as string | undefined;
  let text = body.text as string | undefined;
  let messageId = body.messageId as string | undefined;

  if (!from || !text) {
    try {
      const value = body?.entry?.[0]?.changes?.[0]?.value;
      const message = value?.messages?.[0];
      if (message) {
        from = message.from;
        text = message.text?.body;
        messageId = message.id;
        name = value?.contacts?.[0]?.profile?.name;
      }
    } catch {
      /* ignore malformed payloads */
    }
  }

  if (!from || !text) {
    // Acknowledge so the provider doesn't retry; nothing actionable.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await handleInboundMessage({
    channel: 'WhatsApp',
    from,
    fromName: name ?? null,
    text,
    externalRef: messageId ?? null,
  });

  return NextResponse.json({ ok: true, ticket: result });
}

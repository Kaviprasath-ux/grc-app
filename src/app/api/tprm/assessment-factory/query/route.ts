import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';

/**
 * POST /api/tprm/assessment-factory/query
 * Proxies to Python backend POST /api/query
 * Body: { question: string, assessment_id: string }
 * The customer_id is injected server-side from session.
 */
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json({ error: 'Server misconfiguration: missing API secret' }, { status: 500 });
      }

      const body = await req.json();
      const { question, assessment_id } = body as { question: string; assessment_id: string };

      if (!question || !assessment_id) {
        return NextResponse.json({ error: 'Missing required fields: question, assessment_id' }, { status: 400 });
      }

      const url = getExternalApiUrl('PYTHON_BACKEND', '/api/query');
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', auth: secret },
        body: JSON.stringify({
          question,
          assessment_id,
          customer_id: customerAccountId,
        }),
      });

      const resText = await res.text();

      if (!res.ok) {
        let errBody: Record<string, unknown> = { error: 'Query failed' };
        try { errBody = JSON.parse(resText); } catch { errBody.error = resText; }
        return NextResponse.json(errBody, { status: res.status });
      }

      let data: unknown;
      try { data = JSON.parse(resText); } catch {
        return NextResponse.json({ error: 'Invalid JSON response' }, { status: 502 });
      }

      return NextResponse.json(data);
    } catch (error) {
      console.error('[Assessment Factory Query] Error:', error);
      return NextResponse.json({ error: 'Failed to query AI' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessment-factory', action: 'create' }
);

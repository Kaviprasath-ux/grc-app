import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import prisma from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/internal-audit/fieldwork/[id]/simple-query
 * Proxies to RunPod POST /api/simple_query (AI Review query after ingest).
 * Request: { question: string; customer_id?: string; context_status?: boolean }
 */
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      let body: { question?: string; customer_id?: string; context_status?: boolean };
      try {
        body = (await req.json()) as typeof body;
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        );
      }

      const question = typeof body.question === 'string' ? body.question.trim() : '';
      if (!question) {
        return NextResponse.json(
          { error: 'question is required' },
          { status: 400 }
        );
      }

      const engagement = await prisma.auditEngagement.findUnique({
        where: { id: engagementId },
      });

      if (!engagement) {
        return NextResponse.json(
          { error: 'Engagement not found' },
          { status: 404 }
        );
      }

      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: missing API secret' },
          { status: 500 }
        );
      }

      const customerId = body.customer_id ?? engagement.id;
      const contextStatus = body.context_status !== false;

      const payload = {
        question,
        customer_id: customerId,
        context_status: contextStatus,
      };
      console.log(payload);

      const url = getExternalApiUrl('PYTHON_BACKEND', '/api/simple_query');
      console.log('[RunPod simple_query] POST /api/internal-audit/fieldwork/[id]/simple-query received');
      console.log('[RunPod simple_query] engagementId=' + engagementId + ', question=' + question.slice(0, 80) + '...');
      console.log('[RunPod simple_query] Calling RunPod POST ' + url);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          auth: secret,
        },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      console.log('[RunPod simple_query] RunPod response status: ' + res.status);
      console.log('[RunPod simple_query] RunPod response body: ' + resText.slice(0, 500) + (resText.length > 500 ? '...' : ''));

      if (!res.ok) {
        let errBody: { error?: string; detail?: unknown } = { error: 'Simple query failed' };
        try {
          const j = JSON.parse(resText);
          if (j.detail) errBody.detail = j.detail;
          else if (j.error) errBody.error = j.error;
        } catch {
          errBody.error = resText || errBody.error;
        }
        return NextResponse.json(errBody, { status: res.status });
      }

      let data: unknown;
      try {
        data = JSON.parse(resText);
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from RunPod' },
          { status: 502 }
        );
      }

      return NextResponse.json(data);
    } catch (error) {
      console.error('[RunPod simple_query] Error:', error);
      return NextResponse.json(
        { error: 'Failed to run simple query' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS, getEndpointName } from '@/lib/ai-endpoints';
import prisma from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Safely stringify any value for logging
 */
function safeJsonStringify(value: unknown, indent: number = 2): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
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

      // Use customerAccountId for tenant isolation (must match what was used in ingest)
      const customerId = body.customer_id ?? engagement.customerAccountId;
      const contextStatus = body.context_status !== false;

      const payload = {
        question,
        customer_id: customerId,
        context_status: contextStatus,
      };

      const url = getExternalApiUrl('PYTHON_BACKEND', AI_ENDPOINTS.SIMPLE_QUERY);
      const requestId = generateRequestId();
      const endpointName = getEndpointName(AI_ENDPOINTS.SIMPLE_QUERY);
      const startTime = Date.now();

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[AI API REQUEST] ${endpointName}`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[${requestId}] Calling: POST ${AI_ENDPOINTS.SIMPLE_QUERY}`);
      console.log(`[${requestId}] Full URL: ${url}`);
      console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
      console.log(`[${requestId}] Payload:`);
      console.log(safeJsonStringify(payload, 2));
      console.log(`${'─'.repeat(80)}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          auth: secret,
        },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      const latency = Date.now() - startTime;

      console.log(`${'─'.repeat(80)}`);
      console.log(`[AI API RESPONSE] ${endpointName}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`[${requestId}] Status: ${res.status} ${res.statusText}`);
      console.log(`[${requestId}] Latency: ${latency}ms`);
      console.log(`[${requestId}] Response Size: ${resText.length} bytes`);
      console.log(`[${requestId}] Response:`);
      console.log(resText.slice(0, 1000) + (resText.length > 1000 ? '...(truncated)' : ''));
      console.log(`${'═'.repeat(80)}\n`);

      if (!res.ok) {
        const errBody: { error?: string; detail?: unknown } = { error: 'Simple query failed' };
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
      console.error(`\n${'═'.repeat(80)}`);
      console.error(`[SIMPLE QUERY ERROR]`);
      console.error(`${'═'.repeat(80)}`);
      console.error('[Simple Query] ❌ ERROR:', error);
      console.error(`${'═'.repeat(80)}\n`);
      return NextResponse.json(
        { error: 'Failed to run simple query' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

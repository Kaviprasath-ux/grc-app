import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS, getEndpointName } from '@/lib/ai-endpoints';

interface RouteContext {
  params: Promise<{ id: string; jobId: string }>;
}

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * GET /api/internal-audit/fieldwork/[id]/audit-ingest/status/[jobId]
 * Proxies to RunPod GET /api/audit_ingest_status/{job_id}.
 */
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId, jobId } = await context.params;

      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: missing API secret' },
          { status: 500 }
        );
      }

      const endpoint = `${AI_ENDPOINTS.AUDIT_INGEST_STATUS}/${encodeURIComponent(jobId)}`;
      const url = getExternalApiUrl('PYTHON_BACKEND', endpoint);
      const requestId = generateRequestId();
      const endpointName = getEndpointName(AI_ENDPOINTS.AUDIT_INGEST_STATUS);
      const startTime = Date.now();

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[AI API REQUEST] ${endpointName}`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[${requestId}] Calling: GET ${endpoint}`);
      console.log(`[${requestId}] Engagement ID: ${engagementId}`);
      console.log(`[${requestId}] Job ID: ${jobId}`);
      console.log(`${'─'.repeat(80)}`);

      const res = await fetch(url, {
        method: 'GET',
        headers: { auth: secret },
      });

      const resText = await res.text();
      const latency = Date.now() - startTime;

      console.log(`${'─'.repeat(80)}`);
      console.log(`[AI API RESPONSE] ${endpointName}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`[${requestId}] Status: ${res.status} ${res.statusText}`);
      console.log(`[${requestId}] Latency: ${latency}ms`);
      console.log(`[${requestId}] Response:`);
      console.log(resText);
      console.log(`${'═'.repeat(80)}\n`);

      if (!res.ok) {
        const errBody: { error?: string; detail?: unknown } = { error: 'Audit ingest status check failed' };
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
      console.error(`[AUDIT INGEST STATUS ERROR]`);
      console.error(`${'═'.repeat(80)}`);
      console.error('[Audit Ingest Status] ❌ ERROR:', error);
      console.error(`${'═'.repeat(80)}\n`);
      return NextResponse.json(
        { error: 'Failed to get audit ingest status' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

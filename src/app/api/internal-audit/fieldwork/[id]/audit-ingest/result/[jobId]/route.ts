import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';

interface RouteContext {
  params: Promise<{ id: string; jobId: string }>;
}

/**
 * GET /api/internal-audit/fieldwork/[id]/audit-ingest/result/[jobId]
 * Proxies to RunPod GET /api/simple_ingest_result/{job_id}.
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

      const url = getExternalApiUrl('PYTHON_BACKEND', '/api/simple_ingest_result/' + encodeURIComponent(jobId));
      console.log('[RunPod simple_ingest_result] GET engagementId=' + engagementId + ', jobId=' + jobId + ', url=' + url);

      const res = await fetch(url, {
        method: 'GET',
        headers: { auth: secret },
      });

      const resText = await res.text();
      console.log('[RunPod simple_ingest_result] RunPod response status: ' + res.status + ', body: ' + resText);

      if (!res.ok) {
        let errBody: { error?: string; detail?: unknown } = { error: 'Simple ingest result fetch failed' };
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
      console.error('[RunPod simple_ingest_result] Error:', error);
      return NextResponse.json(
        { error: 'Failed to get simple ingest result' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

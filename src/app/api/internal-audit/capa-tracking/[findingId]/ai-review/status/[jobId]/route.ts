import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';

interface RouteContext {
  params: Promise<{ findingId: string; jobId: string }>;
}

/**
 * GET /api/internal-audit/capa-tracking/[findingId]/ai-review/status/[jobId]
 *
 * Proxies to RunPod GET /api/audit_ingest_status/{job_id}
 * Returns job status: queued, processing, completed, error
 */
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { findingId, jobId } = await context.params;

      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: missing API secret' },
          { status: 500 }
        );
      }

      const url = getExternalApiUrl(
        'PYTHON_BACKEND',
        `/api/audit_ingest_status/${encodeURIComponent(jobId)}`
      );

      console.log(
        `[CAPA AI Status] GET findingId=${findingId}, jobId=${jobId}, url=${url}`
      );

      const res = await fetch(url, {
        method: 'GET',
        headers: { auth: secret },
      });

      const resText = await res.text();
      console.log(
        `[CAPA AI Status] RunPod response status: ${res.status}, body: ${resText}`
      );

      if (!res.ok) {
        let errBody: { error?: string; detail?: unknown } = {
          error: 'Audit ingest status check failed',
        };
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
      console.error('[CAPA AI Status] Error:', error);
      return NextResponse.json(
        { error: 'Failed to get audit ingest status' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

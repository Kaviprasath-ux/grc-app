import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/tprm/assessment-factory/result/[jobId]
 * Proxies to RunPod GET /api/factory_ingest_result/{job_id}
 */
export const GET = withAuth(
  async (_req: NextRequest, context: RouteContext) => {
    try {
      const { jobId } = await context.params;
      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json({ error: 'Server misconfiguration: missing API secret' }, { status: 500 });
      }

      const url = getExternalApiUrl('PYTHON_BACKEND', `/api/factory_ingest_result/${encodeURIComponent(jobId)}`);
      const res = await fetch(url, { method: 'GET', headers: { auth: secret } });
      const resText = await res.text();

      if (!res.ok) {
        let errBody: Record<string, unknown> = { error: 'Result fetch failed' };
        try { errBody = JSON.parse(resText); } catch { errBody.error = resText; }
        return NextResponse.json(errBody, { status: res.status });
      }

      let data: unknown;
      try { data = JSON.parse(resText); } catch {
        return NextResponse.json({ error: 'Invalid JSON response' }, { status: 502 });
      }

      return NextResponse.json(data);
    } catch (error) {
      console.error('[Assessment Factory Result] Error:', error);
      return NextResponse.json({ error: 'Failed to get job result' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessment-factory', action: 'view' }
);

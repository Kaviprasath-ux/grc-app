import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';

/**
 * POST /api/tprm/assessment-factory
 * Proxies to RunPod POST /api/factory_ingest
 * Sends customer_id, assessment_id, and files (template + artifacts)
 */
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    try {
      const customerAccountId = getCustomerAccountId(session);
      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json({ error: 'Server misconfiguration: missing API secret' }, { status: 500 });
      }

      const incoming = await req.formData();

      // Build FormData for RunPod
      const formData = new FormData();
      formData.append('customer_id', customerAccountId);
      formData.append('assessment_id', incoming.get('assessment_id') as string || crypto.randomUUID());

      // Forward all files — read as buffer and re-create to ensure filename is preserved
      const files = incoming.getAll('files');
      for (const file of files) {
        if (file instanceof File) {
          const buffer = await file.arrayBuffer();
          const blob = new Blob([buffer], { type: file.type || 'application/octet-stream' });
          formData.append('files', blob, file.name);
        }
      }

      const url = getExternalApiUrl('PYTHON_BACKEND', '/api/factory_ingest');
      console.log(`[Assessment Factory] POST customer=${customerAccountId}, files=${files.length}, url=${url}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: { auth: secret },
        body: formData,
      });

      const resText = await res.text();
      console.log(`[Assessment Factory] RunPod response status: ${res.status}, body: ${resText}`);

      if (!res.ok) {
        let errBody: Record<string, unknown> = { error: 'Factory ingest failed' };
        try { errBody = JSON.parse(resText); } catch { errBody.error = resText; }
        return NextResponse.json(errBody, { status: res.status });
      }

      let data: unknown;
      try { data = JSON.parse(resText); } catch {
        return NextResponse.json({ error: 'Invalid JSON response from AI service' }, { status: 502 });
      }

      return NextResponse.json(data);
    } catch (error) {
      console.error('[Assessment Factory] Error:', error);
      return NextResponse.json({ error: 'Failed to start assessment factory job' }, { status: 500 });
    }
  },
  { resource: 'tprm.asr-assessment-factory', action: 'create' }
);

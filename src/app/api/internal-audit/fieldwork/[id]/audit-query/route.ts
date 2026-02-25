import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import prisma from '@/lib/prisma';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/internal-audit/fieldwork/[id]/audit-query
 * Proxies to RunPod POST /api/audit_query (AI Review query after ingest).
 * Used for Fieldwork → Evidence Request → AI Review.
 * Request: { question: string; customer_id?: string; audit_id?: string; artifact_id?: string }
 */
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      let body: { question?: string; customer_id?: string; audit_id?: string; artifact_id?: string };
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
      const auditId = body.audit_id ?? engagement.auditId;
      const artifactId = body.artifact_id ?? engagementId;

      const payload = {
        question,
        customer_id: customerId,
        audit_id: auditId,
        artifact_id: artifactId,
      };

      const url = getExternalApiUrl('PYTHON_BACKEND', '/api/audit_query');
      console.log('[RunPod audit_query] POST /api/internal-audit/fieldwork/[id]/audit-query received');
      console.log('[RunPod audit_query] engagementId=' + engagementId + ', customerId=' + customerId + ', auditId=' + auditId);
      console.log('[RunPod audit_query] question=' + question.slice(0, 80) + '...');
      console.log('[RunPod audit_query] Calling RunPod POST ' + url);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          auth: secret,
        },
        body: JSON.stringify(payload),
      });

      const resText = await res.text();
      console.log('[RunPod audit_query] RunPod response status: ' + res.status);
      console.log('[RunPod audit_query] RunPod response body: ' + resText.slice(0, 500) + (resText.length > 500 ? '...' : ''));

      if (!res.ok) {
        let errBody: { error?: string; detail?: unknown } = { error: 'Audit query failed' };
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
      console.error('[RunPod audit_query] Error:', error);
      return NextResponse.json(
        { error: 'Failed to run audit query' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

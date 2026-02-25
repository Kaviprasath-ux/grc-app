import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

function getBaseUrl(req: NextRequest): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/+$/, '');
  const origin = req.nextUrl?.origin;
  if (origin) return origin;
  return process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`.replace(/\/+$/, '')
    : 'http://localhost:3000';
}

function extractReviewFromQueryResponse(data: unknown): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return 'AI review completed.';
  const o = data as Record<string, unknown>;
  const keys = ['answer', 'result', 'response', 'text', 'output', 'review', 'message', 'verdict', 'note'];
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const first = Object.values(o).find((v) => typeof v === 'string' && (v as string).trim());
  if (typeof first === 'string') return first.trim();
  return JSON.stringify(data, null, 2);
}

/**
 * POST /api/internal-audit/fieldwork/[id]/ai-review
 * AI Review flow: audit_ingest via audit-ingest (then poll status/result) -> audit_query.
 * Returns RunPod audit_query response as review.
 */
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      let body: { evidenceRequestIds?: string[]; question?: string };
      try {
        body = (await req.json()) as { evidenceRequestIds?: string[]; question?: string };
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        );
      }

      const evidenceRequestIds = body.evidenceRequestIds;
      if (!evidenceRequestIds || !Array.isArray(evidenceRequestIds) || evidenceRequestIds.length === 0) {
        return NextResponse.json(
          { error: 'No evidence request IDs provided' },
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

      const evidenceRequests = await prisma.fieldworkEvidenceRequest.findMany({
        where: {
          id: { in: evidenceRequestIds },
          engagementId,
        },
        include: {
          attachments: {
            select: { id: true, fileName: true, fileType: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (evidenceRequests.length === 0) {
        return NextResponse.json(
          { error: 'No valid evidence requests found' },
          { status: 404 }
        );
      }

      const totalAttachments = evidenceRequests.reduce((acc, er) => acc + er.attachments.length, 0);
      console.log('[AI Review] evidenceRequestIds=' + JSON.stringify(evidenceRequestIds) + ', requests=' + evidenceRequests.length + ', totalAttachments=' + totalAttachments);
      evidenceRequests.forEach((er) => {
        console.log('[AI Review] request ' + er.id + ' "' + er.title + '": ' + er.attachments.length + ' attachment(s)');
      });
      if (totalAttachments === 0) {
        return NextResponse.json(
          { error: 'Selected evidence requests have no attachments. Add files before running AI Review.' },
          { status: 400 }
        );
      }

      const base = getBaseUrl(req);
      const cookie = req.headers.get('cookie') || '';

      console.log('[AI Review] Starting ingest -> audit_query flow, engagementId=' + engagementId + ', evidenceRequests=' + evidenceRequests.length);

      const ingestRes = await fetch(`${base}/api/internal-audit/fieldwork/${engagementId}/audit-ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ evidenceRequestIds }),
      });

      if (!ingestRes.ok) {
        const err = (await ingestRes.json().catch(() => ({}))) as { error?: string };
        console.error('[AI Review] Ingest failed:', ingestRes.status, err);
        return NextResponse.json(
          { error: err.error || 'Audit ingest failed' },
          { status: ingestRes.status >= 400 ? ingestRes.status : 502 }
        );
      }

      const ingestData = (await ingestRes.json()) as { job_id?: string };
      const jobId = ingestData.job_id;
      if (!jobId || typeof jobId !== 'string') {
        return NextResponse.json(
          { error: 'Ingest response missing job_id' },
          { status: 502 }
        );
      }

      console.log('[AI Review] Ingest job_id=' + jobId + ', polling status...');

      const statusUrl = `${base}/api/internal-audit/fieldwork/${engagementId}/audit-ingest/status/${encodeURIComponent(jobId)}`;
      const resultUrl = `${base}/api/internal-audit/fieldwork/${engagementId}/audit-ingest/result/${encodeURIComponent(jobId)}`;
      const startedAt = Date.now();
      let status: string = 'queued';

      while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
        const statusRes = await fetch(statusUrl, { headers: { cookie } });
        if (!statusRes.ok) {
          const err = (await statusRes.json().catch(() => ({}))) as { error?: string };
          return NextResponse.json(
            { error: err.error || 'Ingest status check failed' },
            { status: statusRes.status >= 400 ? statusRes.status : 502 }
          );
        }
        const statusPayload = (await statusRes.json()) as { status?: string; error?: string };
        status = (statusPayload.status || '').toLowerCase();

        if (status === 'completed') break;
        if (status === 'error' || status === 'failed') {
          return NextResponse.json(
            { error: statusPayload.error || 'Ingest job failed' },
            { status: 502 }
          );
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      if (status !== 'completed') {
        return NextResponse.json(
          { error: 'Ingest timed out. Try again later.' },
          { status: 504 }
        );
      }

      const resultRes = await fetch(resultUrl, { headers: { cookie } });
      if (!resultRes.ok) {
        const err = (await resultRes.json().catch(() => ({}))) as { error?: string };
        return NextResponse.json(
          { error: err.error || 'Ingest result fetch failed' },
          { status: resultRes.status >= 400 ? resultRes.status : 502 }
        );
      }
      await resultRes.json();

      const titles = evidenceRequests.map((er) => er.title).filter(Boolean);
      const descriptions = evidenceRequests.map((er) => er.description).filter(Boolean);
      const question =
        typeof body.question === 'string' && body.question.trim()
          ? body.question.trim()
          : [titles.join('; '), descriptions.join(' | ')].filter(Boolean).join(' ') || 'Review evidence';

      console.log('[AI Review] Ingest completed, calling audit_query...');

      const queryRes = await fetch(`${base}/api/internal-audit/fieldwork/${engagementId}/audit-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          question,
          // Use customerAccountId for tenant isolation (must match what was used in ingest)
          customer_id: engagement.customerAccountId,
          audit_id: engagement.auditId,
          artifact_id: engagementId,
        }),
      });

      if (!queryRes.ok) {
        const err = (await queryRes.json().catch(() => ({}))) as { error?: string };
        console.error('[AI Review] Audit query failed:', queryRes.status, err);
        return NextResponse.json(
          { error: err.error || 'AI query failed' },
          { status: queryRes.status >= 400 ? queryRes.status : 502 }
        );
      }

      const queryData = (await queryRes.json()) as Record<string, unknown>;
      const review = extractReviewFromQueryResponse(queryData);
      const answer = (typeof queryData?.answer === 'string' ? queryData.answer : review) || '';
      const apiStatus = (typeof queryData?.status === 'string' ? queryData.status : null) || '';

      // Persist answer and status to each evidence request
      if (answer || apiStatus) {
        for (const er of evidenceRequests) {
          await prisma.fieldworkEvidenceRequest.update({
            where: { id: er.id },
            data: {
              aiReviewStatus: apiStatus || null,
              aiReviewComment: answer || null,
            },
          });
        }
      }

      console.log('[AI Review] Success, returning review to client');

      return NextResponse.json({
        review,
        answer,
        status: apiStatus,
        score: queryData?.score,
        uuid: queryData?.uuid,
        reviewedCount: evidenceRequests.length,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[AI Review] Error:', error);
      return NextResponse.json(
        { error: 'Failed to generate AI review' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

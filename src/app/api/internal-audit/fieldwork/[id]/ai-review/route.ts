import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Resolve stored filePath (e.g. /uploads/fieldwork/.../file.pdf) to absolute disk path.
 */
function resolveDiskPath(att: { filePath: string }): string {
  const p = (att.filePath || '').replace(/^\/+/, '');
  if (path.isAbsolute(p)) return p;
  return path.join(process.cwd(), p || 'uploads');
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
 * AI Review flow: Calls RunPod directly using AI_API_BASE_URL
 * 1. Reads files from disk
 * 2. Calls RunPod /api/audit_ingest
 * 3. Polls RunPod /api/audit_ingest_status/{job_id}
 * 4. Gets result from RunPod /api/audit_ingest_result/{job_id}
 * 5. Calls RunPod /api/audit_query
 * Returns RunPod audit_query response as review.
 */
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      let body: { evidenceRequestIds?: string[]; question?: string; target_language?: string };
      try {
        body = (await req.json()) as { evidenceRequestIds?: string[]; question?: string; target_language?: string };
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

      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: missing API secret' },
          { status: 500 }
        );
      }

      const evidenceRequests = await prisma.fieldworkEvidenceRequest.findMany({
        where: {
          id: { in: evidenceRequestIds },
          engagementId,
        },
        include: {
          attachments: {
            select: { id: true, fileName: true, fileType: true, filePath: true },
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

      const allAttachments = evidenceRequests.flatMap((er) =>
        er.attachments.map((a) => ({ ...a, evidenceRequestId: er.id }))
      );

      console.log('[AI Review] evidenceRequestIds=' + JSON.stringify(evidenceRequestIds) + ', requests=' + evidenceRequests.length + ', totalAttachments=' + allAttachments.length);
      evidenceRequests.forEach((er) => {
        console.log('[AI Review] request ' + er.id + ' "' + er.title + '": ' + er.attachments.length + ' attachment(s)');
      });

      if (allAttachments.length === 0) {
        return NextResponse.json(
          { error: 'Selected evidence requests have no attachments. Add files before running AI Review.' },
          { status: 400 }
        );
      }

      // Build FormData with files for audit_ingest
      const form = new FormData();
      const customerId = engagement.customerAccountId;
      const auditId = engagement.auditId;
      const artifactId = engagementId;
      const documentId = evidenceRequestIds[0];

      form.append('customer_id', customerId);
      form.append('audit_id', auditId);
      form.append('doc_type', 'fieldwork_evidence');
      form.append('artifact_id', artifactId);
      form.append('document_id', documentId);

      let appended = 0;
      const missing: string[] = [];
      for (const att of allAttachments) {
        const diskPath = resolveDiskPath(att);
        if (!existsSync(diskPath)) {
          missing.push(diskPath);
          console.warn('[AI Review] File not found, skipping: ' + diskPath);
          continue;
        }
        const buf = await readFile(diskPath);
        form.append('files', new Blob([buf]), att.fileName || `file-${att.id}`);
        appended++;
      }

      if (missing.length) {
        console.log('[AI Review] Missing files (' + missing.length + '): ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? '...' : ''));
      }

      if (appended === 0) {
        return NextResponse.json(
          { error: 'No attachment files could be read from disk. The auditee needs to upload files to the evidence requests first.' },
          { status: 400 }
        );
      }

      // Step 1: Call RunPod audit_ingest directly
      const ingestUrl = getExternalApiUrl('PYTHON_BACKEND', '/api/audit_ingest');
      console.log('[AI Review] Starting ingest -> audit_query flow, engagementId=' + engagementId);
      console.log('[AI Review] Calling RunPod POST ' + ingestUrl + ' with ' + appended + ' file(s)');

      const ingestRes = await fetch(ingestUrl, {
        method: 'POST',
        headers: { auth: secret },
        body: form,
      });

      const ingestText = await ingestRes.text();
      console.log('[AI Review] RunPod audit_ingest response status: ' + ingestRes.status);
      console.log('[AI Review] RunPod audit_ingest response body: ' + ingestText);

      if (!ingestRes.ok) {
        let errBody: { error?: string } = { error: 'Audit ingest failed' };
        try {
          const j = JSON.parse(ingestText);
          if (j.error) errBody.error = j.error;
          else if (j.detail) errBody.error = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
        } catch {
          errBody.error = ingestText || errBody.error;
        }
        return NextResponse.json(errBody, { status: ingestRes.status });
      }

      let ingestData: { job_id?: string };
      try {
        ingestData = JSON.parse(ingestText) as { job_id?: string };
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from RunPod audit_ingest' },
          { status: 502 }
        );
      }

      const jobId = ingestData.job_id;
      if (!jobId || typeof jobId !== 'string') {
        return NextResponse.json(
          { error: 'RunPod response missing job_id' },
          { status: 502 }
        );
      }

      console.log('[AI Review] Ingest job_id=' + jobId + ', polling status...');

      // Step 2: Poll RunPod audit_ingest_status directly
      const startedAt = Date.now();
      let status: string = 'queued';

      while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
        const statusUrl = getExternalApiUrl('PYTHON_BACKEND', '/api/audit_ingest_status/' + encodeURIComponent(jobId));
        const statusRes = await fetch(statusUrl, {
          method: 'GET',
          headers: { auth: secret },
        });

        const statusText = await statusRes.text();
        if (!statusRes.ok) {
          let errBody: { error?: string } = { error: 'Ingest status check failed' };
          try {
            const j = JSON.parse(statusText);
            if (j.error) errBody.error = j.error;
          } catch {
            errBody.error = statusText || errBody.error;
          }
          return NextResponse.json(errBody, { status: statusRes.status });
        }

        let statusPayload: { status?: string; error?: string };
        try {
          statusPayload = JSON.parse(statusText) as { status?: string; error?: string };
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON from RunPod status endpoint' },
            { status: 502 }
          );
        }

        status = (statusPayload.status || '').toLowerCase();
        console.log('[AI Review] Poll status: ' + status);

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

      // Step 3: Get result from RunPod audit_ingest_result
      const resultUrl = getExternalApiUrl('PYTHON_BACKEND', '/api/audit_ingest_result/' + encodeURIComponent(jobId));
      const resultRes = await fetch(resultUrl, {
        method: 'GET',
        headers: { auth: secret },
      });

      if (!resultRes.ok) {
        const resultText = await resultRes.text();
        let errBody: { error?: string } = { error: 'Ingest result fetch failed' };
        try {
          const j = JSON.parse(resultText);
          if (j.error) errBody.error = j.error;
        } catch {
          errBody.error = resultText || errBody.error;
        }
        return NextResponse.json(errBody, { status: resultRes.status });
      }

      // Step 4: Call RunPod audit_query directly
      const titles = evidenceRequests.map((er) => er.title).filter(Boolean);
      const descriptions = evidenceRequests.map((er) => er.description).filter(Boolean);
      const question =
        typeof body.question === 'string' && body.question.trim()
          ? body.question.trim()
          : [titles.join('; '), descriptions.join(' | ')].filter(Boolean).join(' ') || 'Review evidence';

      // Get target language from request body or cookie (defaults to 'en')
      const targetLanguage = body.target_language || req.cookies.get('NEXT_LOCALE')?.value || 'en';

      console.log('[AI Review] Ingest completed, calling audit_query...');
      console.log('[AI Review] Target language:', targetLanguage);

      const queryUrl = getExternalApiUrl('PYTHON_BACKEND', '/api/audit_query');
      const queryPayload = {
        question,
        customer_id: customerId,
        audit_id: auditId,
        artifact_id: artifactId,
        target_language: targetLanguage,
      };

      console.log('[AI Review] Calling RunPod POST ' + queryUrl);
      console.log('[AI Review] question=' + question.slice(0, 80) + (question.length > 80 ? '...' : ''));

      const queryRes = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          auth: secret,
        },
        body: JSON.stringify(queryPayload),
      });

      const queryText = await queryRes.text();
      console.log('[AI Review] RunPod audit_query response status: ' + queryRes.status);
      console.log('[AI Review] RunPod audit_query response body: ' + queryText.slice(0, 500) + (queryText.length > 500 ? '...' : ''));

      if (!queryRes.ok) {
        let errBody: { error?: string } = { error: 'AI query failed' };
        try {
          const j = JSON.parse(queryText);
          if (j.error) errBody.error = j.error;
          else if (j.detail) errBody.error = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail);
        } catch {
          errBody.error = queryText || errBody.error;
        }
        return NextResponse.json(errBody, { status: queryRes.status });
      }

      let queryData: Record<string, unknown>;
      try {
        queryData = JSON.parse(queryText) as Record<string, unknown>;
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from RunPod audit_query' },
          { status: 502 }
        );
      }

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

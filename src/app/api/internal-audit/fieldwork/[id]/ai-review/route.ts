import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS, getEndpointName } from '@/lib/ai-endpoints';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Generate unique request ID for correlation
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Format FormData for logging as JSON-like object
 */
function formatFormDataForLog(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  formData.forEach((value, key) => {
    if (value instanceof Blob) {
      result[key] = { type: 'File', size: `${value.size} bytes` };
    } else {
      result[key] = value;
    }
  });
  return result;
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

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[AI REVIEW] Fieldwork Evidence Review`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[AI Review] Engagement ID: ${engagementId}`);
      console.log(`[AI Review] Customer ID: ${engagement.customerAccountId}`);
      console.log(`[AI Review] Evidence Request IDs: ${JSON.stringify(evidenceRequestIds)}`);
      console.log(`[AI Review] Requests Found: ${evidenceRequests.length}, Total Attachments: ${allAttachments.length}`);
      evidenceRequests.forEach((er) => {
        console.log(`[AI Review]   → Request ${er.id} "${er.title}": ${er.attachments.length} attachment(s)`);
      });
      console.log(`${'─'.repeat(80)}`);

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
      const ingestUrl = getExternalApiUrl('PYTHON_BACKEND', AI_ENDPOINTS.AUDIT_INGEST);
      const ingestRequestId = generateRequestId();
      const ingestEndpointName = getEndpointName(AI_ENDPOINTS.AUDIT_INGEST);
      const ingestStartTime = Date.now();

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[AI API REQUEST] ${ingestEndpointName}`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[${ingestRequestId}] Calling: POST ${AI_ENDPOINTS.AUDIT_INGEST}`);
      console.log(`[${ingestRequestId}] Full URL: ${ingestUrl}`);
      console.log(`[${ingestRequestId}] Timestamp: ${new Date().toISOString()}`);
      console.log(`[${ingestRequestId}] Payload:`);
      console.log(safeJsonStringify(formatFormDataForLog(form), 2));
      console.log(`${'─'.repeat(80)}`);

      const ingestRes = await fetch(ingestUrl, {
        method: 'POST',
        headers: { auth: secret },
        body: form,
      });

      const ingestText = await ingestRes.text();
      const ingestLatency = Date.now() - ingestStartTime;

      console.log(`${'─'.repeat(80)}`);
      console.log(`[AI API RESPONSE] ${ingestEndpointName}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`[${ingestRequestId}] Status: ${ingestRes.status} ${ingestRes.statusText}`);
      console.log(`[${ingestRequestId}] Latency: ${ingestLatency}ms`);
      console.log(`[${ingestRequestId}] Response:`);
      console.log(ingestText);
      console.log(`${'═'.repeat(80)}\n`);

      if (!ingestRes.ok) {
        const errBody: { error?: string } = { error: 'Audit ingest failed' };
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

      console.log(`[AI Review] Ingest job_id=${jobId}, polling status...`);

      // Step 2: Poll RunPod audit_ingest_status directly
      const startedAt = Date.now();
      let status: string = 'queued';
      let pollCount = 0;

      while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
        pollCount++;
        const statusEndpoint = `${AI_ENDPOINTS.AUDIT_INGEST_STATUS}/${encodeURIComponent(jobId)}`;
        const statusUrl = getExternalApiUrl('PYTHON_BACKEND', statusEndpoint);
        const statusRes = await fetch(statusUrl, {
          method: 'GET',
          headers: { auth: secret },
        });

        const statusText = await statusRes.text();
        console.log(`[AI Review] Poll #${pollCount}: GET ${statusEndpoint} → ${statusRes.status} ${statusText.slice(0, 100)}`);

        if (!statusRes.ok) {
          const errBody: { error?: string } = { error: 'Ingest status check failed' };
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

        if (status === 'completed') break;
        if (status === 'error' || status === 'failed') {
          console.error(`[AI Review] ❌ Ingest job failed: ${statusPayload.error}`);
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
        const errBody: { error?: string } = { error: 'Ingest result fetch failed' };
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

      // Step 4: Call RunPod audit_query
      const queryUrl = getExternalApiUrl('PYTHON_BACKEND', AI_ENDPOINTS.AUDIT_QUERY);
      const queryRequestId = generateRequestId();
      const queryEndpointName = getEndpointName(AI_ENDPOINTS.AUDIT_QUERY);
      const queryStartTime = Date.now();

      const queryPayload = {
        question,
        customer_id: customerId,
        audit_id: auditId,
        artifact_id: artifactId,
        target_language: targetLanguage,
      };

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[AI API REQUEST] ${queryEndpointName}`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[${queryRequestId}] Calling: POST ${AI_ENDPOINTS.AUDIT_QUERY}`);
      console.log(`[${queryRequestId}] Full URL: ${queryUrl}`);
      console.log(`[${queryRequestId}] Timestamp: ${new Date().toISOString()}`);
      console.log(`[${queryRequestId}] Payload:`);
      console.log(safeJsonStringify(queryPayload, 2));
      console.log(`${'─'.repeat(80)}`);

      const queryRes = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          auth: secret,
        },
        body: JSON.stringify(queryPayload),
      });

      const queryText = await queryRes.text();
      const queryLatency = Date.now() - queryStartTime;

      console.log(`${'─'.repeat(80)}`);
      console.log(`[AI API RESPONSE] ${queryEndpointName}`);
      console.log(`${'─'.repeat(80)}`);
      console.log(`[${queryRequestId}] Status: ${queryRes.status} ${queryRes.statusText}`);
      console.log(`[${queryRequestId}] Latency: ${queryLatency}ms`);
      console.log(`[${queryRequestId}] Response Size: ${queryText.length} bytes`);
      console.log(`[${queryRequestId}] Response:`);
      console.log(queryText.slice(0, 1000) + (queryText.length > 1000 ? '...(truncated)' : ''));
      console.log(`${'═'.repeat(80)}\n`);

      if (!queryRes.ok) {
        const errBody: { error?: string } = { error: 'AI query failed' };
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

      console.log(`[AI Review] ✓ SUCCESS - Review completed for ${evidenceRequests.length} evidence request(s)`);

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
      console.error(`\n${'═'.repeat(80)}`);
      console.error(`[AI REVIEW ERROR]`);
      console.error(`${'═'.repeat(80)}`);
      console.error('[AI Review] ❌ ERROR:', error);
      console.error(`${'═'.repeat(80)}\n`);
      return NextResponse.json(
        { error: 'Failed to generate AI review' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

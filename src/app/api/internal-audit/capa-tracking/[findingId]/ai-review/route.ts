import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, validateTenantAccess, forbidden } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS, getEndpointName } from '@/lib/ai-endpoints';
import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

interface RouteContext {
  params: Promise<{ findingId: string }>;
}

// Polling configuration
const POLL_INTERVAL_MS = 2000; // 2 seconds
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
 * Resolve stored filePath to absolute disk path
 */
function resolveDiskPath(filePath: string): string {
  const p = (filePath || '').replace(/^\/+/, '');
  if (path.isAbsolute(p)) return p;
  // On Vercel, files are stored in /tmp/uploads
  const baseDir = process.env.VERCEL ? '/tmp' : process.cwd();
  return path.join(baseDir, p || 'uploads');
}

/**
 * Build a contextual question for CAPA evidence review based on finding details
 */
function buildReviewQuestion(finding: {
  finding: string;
  criteria?: string | null;
  condition?: string | null;
  recommendation?: string | null;
}): string {
  const parts: string[] = [];

  // Add finding context
  if (finding.finding) {
    parts.push(`Finding: ${finding.finding}`);
  }

  // Add criteria if available
  if (finding.criteria) {
    parts.push(`Expected criteria: ${finding.criteria}`);
  }

  // Add recommendation if available
  if (finding.recommendation) {
    parts.push(`Recommendation: ${finding.recommendation}`);
  }

  // Build the question
  const context = parts.length > 0 ? parts.join('. ') + '. ' : '';
  return `${context}Does the uploaded evidence adequately address this audit finding? Evaluate if the corrective action documentation is satisfactory and complete.`;
}

/**
 * POST /api/internal-audit/capa-tracking/[findingId]/ai-review
 *
 * Orchestrates the full AI review flow for CAPA tracking:
 * 1. Get finding with attachments
 * 2. Call RunPod POST /api/audit_ingest to ingest documents
 * 3. Poll GET /api/audit_ingest_status until completed
 * 4. Get result from GET /api/audit_ingest_result
 * 5. If ingest successful (result.status=true), call POST /api/audit_query for AI review
 * 6. Update finding with AI review status from query response
 */
export const POST = withAuth(
  async (_req: NextRequest, context: RouteContext, session) => {
    try {
      const { findingId } = await context.params;

      console.log(`[CAPA AI Review] Starting AI review for finding ${findingId}`);

      // Get finding with attachments and engagement
      const finding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
        include: {
          attachments: {
            select: {
              id: true,
              fileName: true,
              filePath: true,
              fileType: true,
              fileSize: true,
            },
          },
          engagement: {
            select: {
              id: true,
              auditId: true,
            },
          },
        },
      });

      if (!finding) {
        return NextResponse.json(
          { error: 'Finding not found' },
          { status: 404 }
        );
      }

      // Validate tenant access
      if (!validateTenantAccess(session, finding.customerAccountId)) {
        return forbidden('Access denied to this finding');
      }

      // Check for attachments
      if (finding.attachments.length === 0) {
        return NextResponse.json(
          { error: 'Finding has no attachments. Upload files before running AI Review.' },
          { status: 400 }
        );
      }

      // Check API secret
      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: missing API secret' },
          { status: 500 }
        );
      }

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[CAPA AI REVIEW] CAPA Finding Evidence Review`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[CAPA AI Review] Finding ID: ${findingId}`);
      console.log(`[CAPA AI Review] Customer ID: ${finding.customerAccountId}`);
      console.log(`[CAPA AI Review] Attachments: ${finding.attachments.length}`);
      console.log(`${'─'.repeat(80)}`);

      // ==================== STEP 1: INGEST ====================
      // Build FormData for RunPod audit_ingest
      const form = new FormData();
      form.append('customer_id', finding.customerAccountId);
      form.append('audit_id', finding.engagement?.auditId || finding.engagementId);
      form.append('doc_type', 'capa_evidence');
      form.append('artifact_id', finding.id);
      form.append('document_id', finding.findingId);

      // Read and append files
      let appended = 0;
      for (const att of finding.attachments) {
        const diskPath = resolveDiskPath(att.filePath);
        if (!existsSync(diskPath)) {
          console.warn(`[CAPA AI Review] File not found, skipping: ${diskPath}`);
          continue;
        }
        const buf = await readFile(diskPath);
        form.append('files', new Blob([buf]), att.fileName || `file-${att.id}`);
        appended++;
      }

      if (appended === 0) {
        return NextResponse.json(
          { error: 'No attachment files could be read from disk.' },
          { status: 400 }
        );
      }

      // Call RunPod audit_ingest
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
        console.error(`[CAPA AI Review] ❌ Ingest failed: ${ingestRes.status}`);
        return NextResponse.json(
          { error: 'AI ingest failed: ' + ingestText },
          { status: 502 }
        );
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

      if (!jobId) {
        return NextResponse.json(
          { error: 'Ingest response missing job_id' },
          { status: 502 }
        );
      }

      console.log(`[CAPA AI Review] Ingest job_id=${jobId}, polling status...`);

      // ==================== STEP 2: POLL STATUS ====================
      const startedAt = Date.now();
      let status = 'queued';
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
        console.log(`[CAPA AI Review] Poll #${pollCount}: GET ${statusEndpoint} → ${statusRes.status} ${statusText.slice(0, 100)}`);

        if (!statusRes.ok) {
          console.error(`[CAPA AI Review] ❌ Status check failed: ${statusRes.status}`);
          return NextResponse.json(
            { error: 'Status check failed: ' + statusText },
            { status: 502 }
          );
        }

        let statusPayload: { status?: string; error?: string };
        try {
          statusPayload = JSON.parse(statusText) as { status?: string; error?: string };
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON from status endpoint' },
            { status: 502 }
          );
        }
        status = (statusPayload.status || '').toLowerCase();

        if (status === 'completed') break;
        if (status === 'error' || status === 'failed') {
          console.error(`[CAPA AI Review] ❌ Ingest job failed: ${statusPayload.error}`);
          return NextResponse.json(
            { error: statusPayload.error || 'AI ingest job failed' },
            { status: 502 }
          );
        }

        // Wait before next poll
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      if (status !== 'completed') {
        return NextResponse.json(
          { error: 'AI review timed out. Please try again later.' },
          { status: 504 }
        );
      }

      // ==================== STEP 3: GET INGEST RESULT ====================
      const resultEndpoint = `${AI_ENDPOINTS.AUDIT_INGEST_RESULT}/${encodeURIComponent(jobId)}`;
      const resultUrl = getExternalApiUrl('PYTHON_BACKEND', resultEndpoint);

      console.log(`[CAPA AI Review] Step 3: Fetching ingest result: GET ${resultEndpoint}`);

      const resultRes = await fetch(resultUrl, {
        method: 'GET',
        headers: { auth: secret },
      });

      if (!resultRes.ok) {
        const errText = await resultRes.text();
        console.error(`[CAPA AI Review] Result fetch failed: ${resultRes.status}`);
        return NextResponse.json(
          { error: 'Failed to fetch AI result: ' + errText },
          { status: 502 }
        );
      }

      const resultData = (await resultRes.json()) as {
        job_id?: string;
        status?: string;
        result?: {
          status?: boolean;
          successful_files?: number;
          total_files?: number;
          messages?: string[];
        };
      };

      console.log(`[CAPA AI Review] Ingest result:`, JSON.stringify(resultData).slice(0, 500));

      // Check if ingest was successful
      const ingestSuccess = resultData.result?.status === true;
      if (!ingestSuccess) {
        const errorMsg = resultData.result?.messages?.join(' ') || 'Document ingestion failed';
        console.error(`[CAPA AI Review] Ingest not successful: ${errorMsg}`);

        // Update finding with failed status
        await prisma.internalAuditFinding.update({
          where: { id: findingId },
          data: {
            aiReviewStatus: 'Unsatisfactory',
            aiReviewDescription: `Document processing failed: ${errorMsg}`,
            aiReviewedAt: new Date(),
            aiReviewApproved: false,
            aiApprovedAt: null,
            aiApprovedBy: null,
          },
        });

        return NextResponse.json({
          success: false,
          error: errorMsg,
          aiReviewStatus: 'Unsatisfactory',
        });
      }

      // ==================== STEP 4: CALL AUDIT QUERY ====================
      const queryUrl = getExternalApiUrl('PYTHON_BACKEND', AI_ENDPOINTS.AUDIT_QUERY);
      const queryRequestId = generateRequestId();
      const queryEndpointName = getEndpointName(AI_ENDPOINTS.AUDIT_QUERY);
      const queryStartTime = Date.now();

      const question = buildReviewQuestion({
        finding: finding.finding,
        criteria: finding.criteria,
        condition: finding.condition,
        recommendation: finding.recommendation,
      });

      const queryPayload = {
        question,
        customer_id: finding.customerAccountId,
        audit_id: finding.engagement?.auditId || finding.engagementId,
        artifact_id: finding.id,
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
        console.error(`[CAPA AI Review] ❌ Query failed: ${queryRes.status}`);
        return NextResponse.json(
          { error: 'AI query failed: ' + queryText },
          { status: 502 }
        );
      }

      let queryData: {
        status_code?: number;
        question?: string;
        answer?: string;
        score?: number;
        status?: string;
        uuid?: string;
      };
      try {
        queryData = JSON.parse(queryText);
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from RunPod audit_query' },
          { status: 502 }
        );
      }

      // ==================== STEP 5: DETERMINE STATUS FROM QUERY ====================
      // Extract status from query response
      const queryStatus = (queryData.status || '').toLowerCase();
      const reviewStatus: 'Satisfactory' | 'Unsatisfactory' =
        queryStatus === 'satisfactory' ? 'Satisfactory' : 'Unsatisfactory';

      // Extract description from answer
      const description = queryData.answer || 'AI review completed.';

      console.log(`[CAPA AI Review] Step 5: Review status: ${reviewStatus}, score: ${queryData.score}`);

      // ==================== STEP 6: UPDATE FINDING ====================
      const updatedFinding = await prisma.internalAuditFinding.update({
        where: { id: findingId },
        data: {
          aiReviewStatus: reviewStatus,
          aiReviewDescription: description,
          aiReviewedAt: new Date(),
          // Reset approval fields since this is a new review
          aiReviewApproved: false,
          aiApprovedAt: null,
          aiApprovedBy: null,
        },
      });

      console.log(`[CAPA AI Review] ✓ SUCCESS - Finding ${findingId} updated with AI review: ${reviewStatus}`);

      return NextResponse.json({
        success: true,
        findingId: updatedFinding.id,
        aiReviewStatus: updatedFinding.aiReviewStatus,
        aiReviewDescription: updatedFinding.aiReviewDescription,
        aiReviewedAt: updatedFinding.aiReviewedAt?.toISOString(),
        score: queryData.score,
        uuid: queryData.uuid,
        jobId,
      });
    } catch (error) {
      console.error(`\n${'═'.repeat(80)}`);
      console.error(`[CAPA AI REVIEW ERROR]`);
      console.error(`${'═'.repeat(80)}`);
      console.error('[CAPA AI Review] ❌ ERROR:', error);
      console.error(`${'═'.repeat(80)}\n`);
      return NextResponse.json(
        { error: 'Failed to generate AI review' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

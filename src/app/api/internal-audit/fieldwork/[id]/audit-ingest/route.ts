import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import prisma from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS, getEndpointName } from '@/lib/ai-endpoints';

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

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Resolve stored filePath (e.g. /uploads/fieldwork/.../file.pdf) to absolute disk path.
 */
function resolveDiskPath(att: { filePath: string }): string {
  const p = (att.filePath || '').replace(/^\/+/, '');
  if (path.isAbsolute(p)) return p;
  return path.join(process.cwd(), p || 'uploads');
}

/**
 * POST /api/internal-audit/fieldwork/[id]/audit-ingest
 * Accepts evidenceRequestIds, loads attachments from disk, calls RunPod POST /api/audit_ingest, returns job_id.
 * audit_ingest expects multipart/form-data: customer_id, audit_id, doc_type, artifact_id, files (all required).
 * This aligns with audit_query which queries by customer_id, audit_id, artifact_id.
 */
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { id: engagementId } = await context.params;

      let body: { evidenceRequestIds?: string[] };
      try {
        body = (await req.json()) as { evidenceRequestIds?: string[] };
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        );
      }

      const evidenceRequestIds = body.evidenceRequestIds;
      if (!evidenceRequestIds || !Array.isArray(evidenceRequestIds) || evidenceRequestIds.length === 0) {
        return NextResponse.json(
          { error: 'evidenceRequestIds (array) is required' },
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
            select: {
              id: true,
              fileName: true,
              filePath: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (evidenceRequests.length === 0) {
        return NextResponse.json(
          { error: 'No valid evidence requests found for this engagement' },
          { status: 404 }
        );
      }

      const allAttachments = evidenceRequests.flatMap((er) =>
        er.attachments.map((a) => ({ ...a, evidenceRequestId: er.id }))
      );

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[AUDIT INGEST] Fieldwork Evidence Ingest`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[Audit Ingest] Engagement ID: ${engagementId}`);
      console.log(`[Audit Ingest] Customer ID: ${engagement.customerAccountId}`);
      console.log(`[Audit Ingest] Evidence Request IDs: ${JSON.stringify(evidenceRequestIds)}`);
      console.log(`[Audit Ingest] Requests Found: ${evidenceRequests.length}, Total Attachments: ${allAttachments.length}`);
      evidenceRequests.forEach((er) => {
        console.log(`[Audit Ingest]   → Request ${er.id} "${er.title}": ${er.attachments.length} attachment(s)`);
      });
      console.log(`${'─'.repeat(80)}`);

      if (allAttachments.length === 0) {
        return NextResponse.json(
          { error: 'Selected evidence requests have no attachments. Add files before running AI Review.' },
          { status: 400 }
        );
      }

      const form = new FormData();
      // Use customerAccountId for proper tenant isolation, audit_id for audit context
      const customerId = engagement.customerAccountId;
      const auditId = engagement.auditId;
      const artifactId = engagementId; // Use engagement ID as artifact for grouping
      // Use first evidence request ID as document_id (required by RunPod)
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
          console.warn('[RunPod audit_ingest] File not found, skipping: ' + diskPath);
          continue;
        }
        const buf = await readFile(diskPath);
        form.append('files', new Blob([buf]), att.fileName || `file-${att.id}`);
        appended++;
      }

      if (missing.length) {
        console.log('[RunPod audit_ingest] Missing files (' + missing.length + '): ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? '...' : ''));
      }

      if (appended === 0) {
        return NextResponse.json(
          { error: 'No attachment files could be read from disk. Upload files to the evidence requests first, or check that files exist under uploads/fieldwork/{engagementId}/evidence.' },
          { status: 400 }
        );
      }

      const url = getExternalApiUrl('PYTHON_BACKEND', AI_ENDPOINTS.AUDIT_INGEST);
      const requestId = generateRequestId();
      const endpointName = getEndpointName(AI_ENDPOINTS.AUDIT_INGEST);
      const startTime = Date.now();

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[AI API REQUEST] ${endpointName}`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[${requestId}] Calling: POST ${AI_ENDPOINTS.AUDIT_INGEST}`);
      console.log(`[${requestId}] Full URL: ${url}`);
      console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
      console.log(`[${requestId}] Payload:`);
      console.log(safeJsonStringify(formatFormDataForLog(form), 2));
      console.log(`${'─'.repeat(80)}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: { auth: secret },
        body: form,
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
        const errBody: { error?: string; detail?: unknown } = { error: 'Audit ingest failed' };
        try {
          const j = JSON.parse(resText);
          if (j.detail) errBody.detail = j.detail;
          else if (j.error) errBody.error = j.error;
        } catch {
          errBody.error = resText || errBody.error;
        }
        return NextResponse.json(errBody, { status: res.status });
      }

      let data: { job_id?: string; [k: string]: unknown };
      try {
        data = JSON.parse(resText) as { job_id?: string };
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from RunPod' },
          { status: 502 }
        );
      }

      const jobId = data.job_id ?? (data as unknown as Record<string, string>).job_id;
      if (!jobId || typeof jobId !== 'string') {
        return NextResponse.json(
          { error: 'RunPod response missing job_id' },
          { status: 502 }
        );
      }

      console.log(`[Audit Ingest] ✓ SUCCESS - job_id=${jobId}`);
      return NextResponse.json({ job_id: jobId });
    } catch (error) {
      console.error(`\n${'═'.repeat(80)}`);
      console.error(`[AUDIT INGEST ERROR]`);
      console.error(`${'═'.repeat(80)}`);
      console.error('[Audit Ingest] ❌ ERROR:', error);
      console.error(`${'═'.repeat(80)}\n`);
      return NextResponse.json(
        { error: 'Failed to run audit ingest' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);

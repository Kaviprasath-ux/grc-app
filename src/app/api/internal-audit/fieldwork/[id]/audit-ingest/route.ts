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

      console.log(
        '[RunPod audit_ingest] evidenceRequestIds=' + JSON.stringify(evidenceRequestIds) +
        ', requests=' + evidenceRequests.length +
        ', totalAttachments=' + allAttachments.length
      );
      evidenceRequests.forEach((er) => {
        console.log('[RunPod audit_ingest] request ' + er.id + ' ("' + er.title + '"): ' + er.attachments.length + ' attachment(s)');
      });

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

      const url = getExternalApiUrl('PYTHON_BACKEND', '/api/audit_ingest');
      console.log('[RunPod audit_ingest] POST /api/internal-audit/fieldwork/[id]/audit-ingest received');
      console.log('[RunPod audit_ingest] engagementId=' + engagementId + ', customerId=' + customerId + ', auditId=' + auditId + ', documentId=' + documentId + ', files=' + appended);
      console.log('[RunPod audit_ingest] Calling RunPod ' + url);

      const res = await fetch(url, {
        method: 'POST',
        headers: { auth: secret },
        body: form,
      });

      const resText = await res.text();
      console.log('[RunPod audit_ingest] RunPod response status: ' + res.status);
      console.log('[RunPod audit_ingest] RunPod response body: ' + resText);

      if (!res.ok) {
        let errBody: { error?: string; detail?: unknown } = { error: 'Audit ingest failed' };
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

      console.log('[RunPod audit_ingest] Success, job_id=' + jobId);
      return NextResponse.json({ job_id: jobId });
    } catch (error) {
      console.error('[RunPod audit_ingest] Error:', error);
      return NextResponse.json(
        { error: 'Failed to run audit ingest' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'create' }
);

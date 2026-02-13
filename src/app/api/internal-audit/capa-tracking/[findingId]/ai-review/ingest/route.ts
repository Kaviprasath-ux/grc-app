import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { prisma } from '@/lib/prisma';
import { withAuth, validateTenantAccess, forbidden } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';

interface RouteContext {
  params: Promise<{ findingId: string }>;
}

/**
 * Resolve stored filePath (e.g. /uploads/capa-tracking/.../file.pdf) to absolute disk path.
 */
function resolveDiskPath(filePath: string): string {
  const p = (filePath || '').replace(/^\/+/, '');
  if (path.isAbsolute(p)) return p;
  // On Vercel, files are stored in /tmp/uploads
  const baseDir = process.env.VERCEL ? '/tmp' : process.cwd();
  return path.join(baseDir, p || 'uploads');
}

/**
 * POST /api/internal-audit/capa-tracking/[findingId]/ai-review/ingest
 *
 * Loads attachments from finding, calls RunPod POST /api/audit_ingest, returns job_id.
 *
 * RunPod /api/audit_ingest expects multipart/form-data:
 * - customer_id (required)
 * - audit_id (required)
 * - doc_type (required)
 * - artifact_id (required)
 * - document_id (required)
 * - files (required)
 */
export const POST = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { findingId } = await context.params;

      // Get finding with attachments and engagement
      const finding = await prisma.internalAuditFinding.findUnique({
        where: { id: findingId },
        include: {
          attachments: {
            select: {
              id: true,
              fileName: true,
              filePath: true,
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

      // Check API secret is configured
      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: missing API secret' },
          { status: 500 }
        );
      }

      // Check for attachments
      if (finding.attachments.length === 0) {
        return NextResponse.json(
          { error: 'Finding has no attachments. Upload files before running AI Review.' },
          { status: 400 }
        );
      }

      console.log(
        `[CAPA AI Ingest] findingId=${findingId}, attachments=${finding.attachments.length}`
      );

      // Build FormData for RunPod /api/audit_ingest
      const form = new FormData();
      form.append('customer_id', finding.customerAccountId);
      form.append('audit_id', finding.engagement?.auditId || finding.engagementId);
      form.append('doc_type', 'capa_evidence');
      form.append('artifact_id', finding.id);
      form.append('document_id', finding.findingId);

      // Read and append files
      let appended = 0;
      const missing: string[] = [];

      for (const att of finding.attachments) {
        const diskPath = resolveDiskPath(att.filePath);
        if (!existsSync(diskPath)) {
          missing.push(diskPath);
          console.warn(`[CAPA AI Ingest] File not found, skipping: ${diskPath}`);
          continue;
        }

        const buf = await readFile(diskPath);
        form.append('files', new Blob([buf]), att.fileName || `file-${att.id}`);
        appended++;
      }

      if (missing.length) {
        console.log(
          `[CAPA AI Ingest] Missing files (${missing.length}): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '...' : ''}`
        );
      }

      if (appended === 0) {
        return NextResponse.json(
          { error: 'No attachment files could be read from disk. Ensure files are uploaded correctly.' },
          { status: 400 }
        );
      }

      // Call RunPod /api/audit_ingest
      const url = getExternalApiUrl('PYTHON_BACKEND', '/api/audit_ingest');
      console.log(`[CAPA AI Ingest] Calling RunPod ${url}, files=${appended}`);

      const res = await fetch(url, {
        method: 'POST',
        headers: { auth: secret },
        body: form,
      });

      const resText = await res.text();
      console.log(`[CAPA AI Ingest] RunPod response status: ${res.status}`);
      console.log(`[CAPA AI Ingest] RunPod response body: ${resText}`);

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

      console.log(`[CAPA AI Ingest] Success, job_id=${jobId}`);
      return NextResponse.json({ job_id: jobId });
    } catch (error) {
      console.error('[CAPA AI Ingest] Error:', error);
      return NextResponse.json(
        { error: 'Failed to run audit ingest' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

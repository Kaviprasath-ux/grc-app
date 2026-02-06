import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';

/**
 * Resolve stored filePath (e.g. /uploads/documents/file.pdf) to absolute disk path.
 */
function resolveDiskPath(filePath: string): string {
  const p = (filePath || '').replace(/^\/+/, '');
  if (path.isAbsolute(p)) return p;
  return path.join(process.cwd(), p || 'uploads');
}

/**
 * POST /api/internal-audit/documents/ingest
 * Accepts documentIds array, loads files from disk, calls RunPod POST /api/simple_ingest, returns job_id.
 * simple_ingest expects multipart/form-data: customer_id (required), files (required).
 */
export const POST = withAuth(
  async (req: NextRequest, context, session) => {
    try {
      let body: { documentIds?: string[] };
      try {
        body = (await req.json()) as { documentIds?: string[] };
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON body' },
          { status: 400 }
        );
      }

      const documentIds = body.documentIds;
      if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
        return NextResponse.json(
          { error: 'documentIds (array) is required' },
          { status: 400 }
        );
      }

      // Get tenant filter for data isolation
      const tenantFilter = getTenantFilter(session);
      const customerAccountId = getCustomerAccountId(session);

      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: missing API secret' },
          { status: 500 }
        );
      }

      // Fetch documents with tenant isolation
      const documents = await prisma.internalAuditDocument.findMany({
        where: {
          id: { in: documentIds },
          ...tenantFilter,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (documents.length === 0) {
        return NextResponse.json(
          { error: 'No valid documents found' },
          { status: 404 }
        );
      }

      console.log(
        '[Document Ingest] documentIds=' + JSON.stringify(documentIds) +
        ', found=' + documents.length
      );

      // Build FormData
      const form = new FormData();
      // Use customerAccountId or a default identifier
      const customerId = customerAccountId || 'default';
      form.append('customer_id', customerId);

      let appended = 0;
      const missing: string[] = [];
      const processedDocs: { id: string; fileName: string }[] = [];

      for (const doc of documents) {
        const diskPath = resolveDiskPath(doc.filePath);
        if (!existsSync(diskPath)) {
          missing.push(diskPath);
          console.warn('[Document Ingest] File not found, skipping: ' + diskPath);
          continue;
        }
        const buf = await readFile(diskPath);
        form.append('files', new Blob([buf]), doc.fileName || `file-${doc.id}`);
        processedDocs.push({ id: doc.id, fileName: doc.fileName });
        appended++;
      }

      if (missing.length) {
        console.log('[Document Ingest] Missing files (' + missing.length + '): ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? '...' : ''));
      }

      if (appended === 0) {
        return NextResponse.json(
          { error: 'No document files could be read from disk.' },
          { status: 400 }
        );
      }

      const url = getExternalApiUrl('PYTHON_BACKEND', AI_ENDPOINTS.SIMPLE_INGEST);
      console.log('[Document Ingest] Calling RunPod ' + url + ', files=' + appended);

      const res = await fetch(url, {
        method: 'POST',
        headers: { auth: secret },
        body: form,
      });

      const resText = await res.text();
      console.log('[Document Ingest] RunPod response status: ' + res.status);
      console.log('[Document Ingest] RunPod response body: ' + resText);

      if (!res.ok) {
        let errBody: { error?: string; detail?: unknown } = { error: 'Simple ingest failed' };
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

      // Create ingest job records for each document
      const ingestJobs = await Promise.all(
        processedDocs.map(doc =>
          prisma.documentLibraryIngestJob.create({
            data: {
              documentId: doc.id,
              runpodJobId: jobId,
              customerId: customerId,
              status: 'queued',
            },
          })
        )
      );

      console.log('[Document Ingest] Success, job_id=' + jobId + ', created ' + ingestJobs.length + ' job records');

      return NextResponse.json({
        job_id: jobId,
        documents_count: appended,
        jobs_created: ingestJobs.length,
      });
    } catch (error) {
      console.error('[Document Ingest] Error:', error);
      return NextResponse.json(
        { error: 'Failed to run document ingest' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.documents', action: 'create' }
);

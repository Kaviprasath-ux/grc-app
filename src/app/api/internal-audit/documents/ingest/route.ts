import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, getCustomerAccountId } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS, getEndpointName } from '@/lib/ai-endpoints';
import { maybeDecryptBytes } from '@/lib/encryption';

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
 * Resolve stored filePath to absolute disk path.
 * Tries multiple locations for backward compatibility (local dev + Vercel /tmp).
 */
function resolveDiskPath(filePath: string): string | null {
  const relative = (filePath || '').replace(/^\/+/, '');
  // Candidates: process.cwd() based, /tmp based (Vercel serverless)
  const candidates = [
    path.join(process.cwd(), relative || 'uploads'),
    path.join('/tmp', relative || 'uploads'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
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

      // Fetch documents with tenant isolation (include fileData for serverless compatibility)
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

      // Use customerAccountId for proper tenant isolation
      const customerId = customerAccountId || 'document-library';

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[DOCUMENT LIBRARY INGEST] Document Ingest`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[Document Ingest] Customer ID: ${customerId}`);
      console.log(`[Document Ingest] Document IDs: ${JSON.stringify(documentIds)}`);
      console.log(`[Document Ingest] Documents Found: ${documents.length}`);
      console.log(`${'─'.repeat(80)}`);

      // Build FormData
      const form = new FormData();
      form.append('customer_id', customerId);

      let appended = 0;
      const missing: string[] = [];
      const processedDocs: { id: string; fileName: string }[] = [];

      for (const doc of documents) {
        let buf: Buffer | null = null;

        // 1. Try fileData from DB via raw SQL (bypasses Prisma client cache on Vercel).
        // Raw SQL bypasses the Prisma extension; decrypt manually.
        try {
          const rows = await prisma.$queryRaw<Array<{ fileData: Buffer | null }>>`
            SELECT "fileData" FROM "InternalAuditDocument" WHERE "id" = ${doc.id}
          `;
          if (rows[0]?.fileData) {
            buf = maybeDecryptBytes(Buffer.from(rows[0].fileData));
            console.log('[Document Ingest] Using fileData from DB for: ' + doc.fileName);
          }
        } catch (rawErr) {
          console.warn('[Document Ingest] Raw SQL fileData read failed:', rawErr);
        }

        // 2. Fall back to disk read (local dev or old documents without fileData)
        if (!buf) {
          const diskPath = resolveDiskPath(doc.filePath);
          if (diskPath) {
            buf = await readFile(diskPath);
            console.log('[Document Ingest] Using disk file for: ' + doc.fileName + ' at ' + diskPath);
          } else {
            missing.push(doc.filePath);
            console.warn('[Document Ingest] File not found (DB or disk), skipping: ' + doc.fileName);
            continue;
          }
        }

        form.append('files', new Blob([new Uint8Array(buf)]), doc.fileName || `file-${doc.id}`);
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
      const requestId = generateRequestId();
      const endpointName = getEndpointName(AI_ENDPOINTS.SIMPLE_INGEST);
      const startTime = Date.now();

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[AI API REQUEST] ${endpointName}`);
      console.log(`${'═'.repeat(80)}`);
      console.log(`[${requestId}] Calling: POST ${AI_ENDPOINTS.SIMPLE_INGEST}`);
      console.log(`[${requestId}] Full URL: ${url}`);
      console.log(`[${requestId}] Timestamp: ${new Date().toISOString()}`);
      console.log(`[${requestId}] Payload:`);
      console.log(safeJsonStringify(formatFormDataForLog(form), 2));
      console.log(`${'─'.repeat(80)}`);

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { auth: secret },
          body: form,
          signal: AbortSignal.timeout(120000), // 2 minute timeout
        });
      } catch (fetchError) {
        console.error(`[${requestId}] ❌ NETWORK ERROR:`, fetchError);
        console.log(`${'═'.repeat(80)}\n`);
        return NextResponse.json(
          { error: 'AI service is unreachable. Please check if the RunPod server is running.' },
          { status: 503 }
        );
      }

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
        const errBody: { error?: string; detail?: unknown } = { error: 'Simple ingest failed' };
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

      console.log(`[Document Ingest] ✓ SUCCESS - job_id=${jobId}, created ${ingestJobs.length} job records`);

      return NextResponse.json({
        job_id: jobId,
        documents_count: appended,
        jobs_created: ingestJobs.length,
        customer_id: customerId,
      });
    } catch (error) {
      console.error(`\n${'═'.repeat(80)}`);
      console.error(`[DOCUMENT INGEST ERROR]`);
      console.error(`${'═'.repeat(80)}`);
      console.error('[Document Ingest] ❌ ERROR:', error);
      console.error(`${'═'.repeat(80)}\n`);
      return NextResponse.json(
        { error: 'Failed to run document ingest' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.documents', action: 'create' }
);

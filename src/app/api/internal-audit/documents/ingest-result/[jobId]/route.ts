import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/internal-audit/documents/ingest-result/[jobId]
 * Fetches the result from RunPod GET /api/simple_ingest_result/{job_id} and stores it locally.
 */
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext) => {
    try {
      const { jobId } = await context.params;

      if (!jobId) {
        return NextResponse.json(
          { error: 'jobId is required' },
          { status: 400 }
        );
      }

      const secret = EXTERNAL_API_SECRETS.PYTHON_API_SECRET;
      if (!secret) {
        return NextResponse.json(
          { error: 'Server misconfiguration: missing API secret' },
          { status: 500 }
        );
      }

      // Find the job records in our database
      const ingestJobs = await prisma.documentLibraryIngestJob.findMany({
        where: { runpodJobId: jobId },
        include: {
          document: {
            select: { id: true, name: true, fileName: true },
          },
        },
      });

      if (ingestJobs.length === 0) {
        return NextResponse.json(
          { error: 'Ingest job not found' },
          { status: 404 }
        );
      }

      // Check if we already have the result cached
      const firstJob = ingestJobs[0];
      if (firstJob.result) {
        console.log('[Document Ingest Result] Returning cached result for jobId=' + jobId);
        return NextResponse.json({
          job_id: jobId,
          status: firstJob.status,
          result: JSON.parse(firstJob.result),
          documents: ingestJobs.map(j => ({
            id: j.document.id,
            name: j.document.name,
            fileName: j.document.fileName,
          })),
          completedAt: firstJob.completedAt,
        });
      }

      // Fetch result from RunPod
      const url = getExternalApiUrl('PYTHON_BACKEND', `${AI_ENDPOINTS.SIMPLE_INGEST_RESULT}/${encodeURIComponent(jobId)}`);
      console.log('[Document Ingest Result] GET jobId=' + jobId + ', url=' + url);

      const res = await fetch(url, {
        method: 'GET',
        headers: { auth: secret },
      });

      const resText = await res.text();
      console.log('[Document Ingest Result] RunPod response status: ' + res.status);

      if (!res.ok) {
        let errBody: { error?: string; detail?: unknown } = { error: 'Ingest result fetch failed' };
        try {
          const j = JSON.parse(resText);
          if (j.detail) errBody.detail = j.detail;
          else if (j.error) errBody.error = j.error;
        } catch {
          errBody.error = resText || errBody.error;
        }
        return NextResponse.json(errBody, { status: res.status });
      }

      let data: { [k: string]: unknown };
      try {
        data = JSON.parse(resText);
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from RunPod' },
          { status: 502 }
        );
      }

      // Store the result in all job records
      await prisma.documentLibraryIngestJob.updateMany({
        where: { runpodJobId: jobId },
        data: {
          result: JSON.stringify(data),
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log('[Document Ingest Result] Stored result for jobId=' + jobId);

      return NextResponse.json({
        job_id: jobId,
        status: 'completed',
        result: data,
        documents: ingestJobs.map(j => ({
          id: j.document.id,
          name: j.document.name,
          fileName: j.document.fileName,
        })),
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[Document Ingest Result] Error:', error);
      return NextResponse.json(
        { error: 'Failed to get ingest result' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.documents', action: 'view' }
);

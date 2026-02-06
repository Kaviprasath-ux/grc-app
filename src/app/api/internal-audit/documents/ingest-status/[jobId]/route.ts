import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/internal-audit/documents/ingest-status/[jobId]
 * Polls RunPod GET /api/simple_ingest_status/{job_id} and updates local job records.
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

      // Check if already completed or failed - return cached status
      const firstJob = ingestJobs[0];
      if (firstJob.status === 'completed' || firstJob.status === 'failed') {
        return NextResponse.json({
          job_id: jobId,
          status: firstJob.status,
          error: firstJob.error || null,
          documents: ingestJobs.map(j => ({
            id: j.document.id,
            name: j.document.name,
            fileName: j.document.fileName,
          })),
          completedAt: firstJob.completedAt,
        });
      }

      // Poll RunPod for status
      const url = getExternalApiUrl('PYTHON_BACKEND', `${AI_ENDPOINTS.SIMPLE_INGEST_STATUS}/${encodeURIComponent(jobId)}`);
      console.log('[Document Ingest Status] GET jobId=' + jobId + ', url=' + url);

      const res = await fetch(url, {
        method: 'GET',
        headers: { auth: secret },
      });

      const resText = await res.text();
      console.log('[Document Ingest Status] RunPod response status: ' + res.status + ', body: ' + resText);

      if (!res.ok) {
        let errBody: { error?: string; detail?: unknown } = { error: 'Ingest status check failed' };
        try {
          const j = JSON.parse(resText);
          if (j.detail) errBody.detail = j.detail;
          else if (j.error) errBody.error = j.error;
        } catch {
          errBody.error = resText || errBody.error;
        }
        return NextResponse.json(errBody, { status: res.status });
      }

      let data: { status?: string; error?: string; [k: string]: unknown };
      try {
        data = JSON.parse(resText);
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from RunPod' },
          { status: 502 }
        );
      }

      // Normalize status
      const newStatus = (data.status || 'queued').toLowerCase();
      const isTerminal = newStatus === 'completed' || newStatus === 'failed';

      // Update all job records with the new status
      await prisma.documentLibraryIngestJob.updateMany({
        where: { runpodJobId: jobId },
        data: {
          status: newStatus,
          error: data.error || null,
          completedAt: isTerminal ? new Date() : null,
          updatedAt: new Date(),
        },
      });

      console.log('[Document Ingest Status] Updated jobs for jobId=' + jobId + ' to status=' + newStatus);

      return NextResponse.json({
        job_id: jobId,
        status: newStatus,
        error: data.error || null,
        documents: ingestJobs.map(j => ({
          id: j.document.id,
          name: j.document.name,
          fileName: j.document.fileName,
        })),
        ...(isTerminal && { completedAt: new Date().toISOString() }),
      });
    } catch (error) {
      console.error('[Document Ingest Status] Error:', error);
      return NextResponse.json(
        { error: 'Failed to get ingest status' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.documents', action: 'view' }
);

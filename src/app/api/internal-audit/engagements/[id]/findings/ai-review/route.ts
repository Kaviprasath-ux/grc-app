import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, getTenantFilter, validateTenantAccess, forbidden } from '@/lib/api-auth';
import { EXTERNAL_API_SECRETS, getExternalApiUrl } from '@/config/external-apis';
import { AI_ENDPOINTS, getEndpointName } from '@/lib/ai-endpoints';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Polling configuration (mirrors the CAPA AI review flow)
const POLL_INTERVAL_MS = 2000; // 2 seconds
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function safeJsonStringify(value: unknown, indent = 2): string {
  try {
    return JSON.stringify(value, null, indent);
  } catch {
    return String(value);
  }
}

// ---- Types describing the external Python API response ---------------------

interface FindingsReviewOverall {
  overall_compliance_status?: string;
  overall_confidence?: number;
  total_findings?: number;
  status_breakdown?: Record<string, number>;
  evaluated_findings?: number;
  compliance_rate_excluding_insufficient?: number;
}

interface FindingsReviewFinding {
  index?: number;
  finding_title?: string;
  compliance_status?: string;
  confidence?: number;
  confidence_breakdown?: unknown;
  reasoning_summary?: string;
  evidence?: unknown;
  retrieval?: unknown;
  verification?: unknown;
}

interface FindingsReviewResult {
  uuid?: string;
  customer_id?: string;
  overall?: FindingsReviewOverall;
  findings?: FindingsReviewFinding[];
}

/**
 * GET /api/internal-audit/engagements/[id]/findings/ai-review
 *
 * Re-hydrate the last saved AI Findings Review for an engagement so the UI can
 * restore the overall summary card and per-finding verdicts after a reload.
 */
export const GET = withAuth(
  async (_req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: {
          id: true,
          aiFindingsReviewOverall: true,
          aiFindingsReviewJobId: true,
          aiFindingsReviewedAt: true,
        },
      });

      if (!engagement) {
        return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
      }

      const findings = await prisma.internalAuditFinding.findMany({
        where: { engagementId: id, ...tenantFilter },
        select: {
          id: true,
          aiFindingReview: true,
          aiFindingReviewStatus: true,
          aiFindingReviewedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      return NextResponse.json({
        overall: engagement.aiFindingsReviewOverall ?? null,
        jobId: engagement.aiFindingsReviewJobId ?? null,
        reviewedAt: engagement.aiFindingsReviewedAt?.toISOString() ?? null,
        findings: findings.map((f) => ({
          id: f.id,
          review: f.aiFindingReview ?? null,
          status: f.aiFindingReviewStatus ?? null,
          reviewedAt: f.aiFindingReviewedAt?.toISOString() ?? null,
        })),
      });
    } catch (error) {
      console.error('[Findings AI Review] GET error:', error);
      return NextResponse.json(
        { error: 'Failed to load AI findings review' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'view' }
);

/**
 * POST /api/internal-audit/engagements/[id]/findings/ai-review
 *
 * Orchestrates the external Findings Review (3-part async job):
 *   1. Build payload from this engagement's findings
 *   2. POST /api/findings_review_async            -> job_id
 *   3. Poll GET /api/findings_review_status/{job} -> until completed
 *   4. GET  /api/findings_review_result/{job}     -> { overall, findings[] }
 *   5. Persist overall (engagement) + per-finding verdict (matched by index)
 */
export const POST = withAuth(
  async (_req: NextRequest, context: RouteContext, session) => {
    try {
      const { id } = await context.params;
      const tenantFilter = getTenantFilter(session);

      // Load engagement + findings (in stable DB order — index maps back to this)
      const engagement = await prisma.auditEngagement.findFirst({
        where: { id, ...tenantFilter },
        select: { id: true, customerAccountId: true },
      });

      if (!engagement) {
        return NextResponse.json({ error: 'Engagement not found' }, { status: 404 });
      }

      if (!validateTenantAccess(session, engagement.customerAccountId)) {
        return forbidden('Access denied to this engagement');
      }

      const findings = await prisma.internalAuditFinding.findMany({
        where: { engagementId: id, ...tenantFilter },
        select: {
          id: true,
          finding: true,
          severity: true,
          status: true,
          criteria: true,
          condition: true,
          cause: true,
          effect: true,
          recommendation: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (findings.length === 0) {
        return NextResponse.json(
          { error: 'No findings to review. Add findings before running AI Review.' },
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

      // ==================== STEP 1: BUILD PAYLOAD ====================
      const payload = {
        customer_id: engagement.customerAccountId,
        findings: findings.map((f) => ({
          finding_title: f.finding,
          severity: f.severity || '',
          status: f.status || '',
          criteria: f.criteria || '',
          condition: f.condition || '',
          cause: f.cause || '',
          effect: f.effect || '',
          recommendation: f.recommendation || '',
        })),
      };

      console.log(`\n${'═'.repeat(80)}`);
      console.log(`[Findings AI Review] Engagement: ${id}`);
      console.log(`[Findings AI Review] Customer: ${engagement.customerAccountId}`);
      console.log(`[Findings AI Review] Findings: ${findings.length}`);
      console.log(`${'─'.repeat(80)}`);

      // ==================== STEP 2: SUBMIT ASYNC JOB ====================
      const submitUrl = getExternalApiUrl('PYTHON_BACKEND', AI_ENDPOINTS.FINDINGS_REVIEW);
      const submitName = getEndpointName(AI_ENDPOINTS.FINDINGS_REVIEW);
      const submitStart = Date.now();

      console.log(`[AI API REQUEST] ${submitName}`);
      console.log(`[Findings AI Review] POST ${submitUrl}`);
      console.log(safeJsonStringify(payload));

      const submitRes = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', auth: secret },
        body: JSON.stringify(payload),
      });

      const submitText = await submitRes.text();
      console.log(
        `[Findings AI Review] Submit -> ${submitRes.status} (${Date.now() - submitStart}ms): ${submitText.slice(0, 300)}`
      );

      if (!submitRes.ok) {
        return NextResponse.json(
          { error: 'AI findings review submission failed: ' + submitText },
          { status: 502 }
        );
      }

      let submitData: { job_id?: string };
      try {
        submitData = JSON.parse(submitText) as { job_id?: string };
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from findings_review_async' },
          { status: 502 }
        );
      }

      const jobId = submitData.job_id;
      if (!jobId) {
        return NextResponse.json(
          { error: 'Findings review response missing job_id' },
          { status: 502 }
        );
      }

      // ==================== STEP 3: POLL STATUS ====================
      const startedAt = Date.now();
      let status = 'queued';
      let pollCount = 0;

      while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
        pollCount++;
        const statusEndpoint = `${AI_ENDPOINTS.FINDINGS_REVIEW_STATUS}/${encodeURIComponent(jobId)}`;
        const statusUrl = getExternalApiUrl('PYTHON_BACKEND', statusEndpoint);

        const statusRes = await fetch(statusUrl, {
          method: 'GET',
          headers: { auth: secret },
        });

        const statusText = await statusRes.text();
        console.log(
          `[Findings AI Review] Poll #${pollCount}: ${statusRes.status} ${statusText.slice(0, 120)}`
        );

        if (!statusRes.ok) {
          return NextResponse.json(
            { error: 'Findings review status check failed: ' + statusText },
            { status: 502 }
          );
        }

        let statusPayload: { status?: string; error?: string };
        try {
          statusPayload = JSON.parse(statusText) as { status?: string; error?: string };
        } catch {
          return NextResponse.json(
            { error: 'Invalid JSON from findings_review_status' },
            { status: 502 }
          );
        }

        status = (statusPayload.status || '').toLowerCase();
        if (status === 'completed') break;
        if (status === 'error' || status === 'failed') {
          return NextResponse.json(
            { error: statusPayload.error || 'AI findings review job failed' },
            { status: 502 }
          );
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }

      if (status !== 'completed') {
        return NextResponse.json(
          { error: 'AI findings review timed out. Please try again later.' },
          { status: 504 }
        );
      }

      // ==================== STEP 4: FETCH RESULT ====================
      const resultEndpoint = `${AI_ENDPOINTS.FINDINGS_REVIEW_RESULT}/${encodeURIComponent(jobId)}`;
      const resultUrl = getExternalApiUrl('PYTHON_BACKEND', resultEndpoint);

      const resultRes = await fetch(resultUrl, {
        method: 'GET',
        headers: { auth: secret },
      });

      const resultText = await resultRes.text();
      if (!resultRes.ok) {
        return NextResponse.json(
          { error: 'Failed to fetch findings review result: ' + resultText },
          { status: 502 }
        );
      }

      let resultData: { result?: FindingsReviewResult };
      try {
        resultData = JSON.parse(resultText) as { result?: FindingsReviewResult };
      } catch {
        return NextResponse.json(
          { error: 'Invalid JSON response from findings_review_result' },
          { status: 502 }
        );
      }

      const result = resultData.result;
      if (!result) {
        return NextResponse.json(
          { error: 'Findings review result missing payload' },
          { status: 502 }
        );
      }

      const overall = result.overall ?? null;
      const reviewedFindings = Array.isArray(result.findings) ? result.findings : [];

      // ==================== STEP 5: PERSIST ====================
      const reviewedAt = new Date();

      // Overall roll-up on the engagement
      await prisma.auditEngagement.update({
        where: { id },
        data: {
          aiFindingsReviewOverall: (overall ?? undefined) as object | undefined,
          aiFindingsReviewJobId: jobId,
          aiFindingsReviewedAt: reviewedAt,
        },
      });

      // Per-finding verdict, matched by index (DB order == request order)
      await Promise.all(
        reviewedFindings.map((rf) => {
          const idx = typeof rf.index === 'number' ? rf.index : -1;
          const target = findings[idx];
          if (!target) return Promise.resolve();
          return prisma.internalAuditFinding.update({
            where: { id: target.id },
            data: {
              aiFindingReview: rf as unknown as object,
              aiFindingReviewStatus: rf.compliance_status || null,
              aiFindingReviewedAt: reviewedAt,
            },
          });
        })
      );

      console.log(`[Findings AI Review] ✓ Completed and persisted (job ${jobId})`);

      return NextResponse.json({
        success: true,
        jobId,
        reviewedAt: reviewedAt.toISOString(),
        overall,
        findings: reviewedFindings.map((rf) => {
          const idx = typeof rf.index === 'number' ? rf.index : -1;
          return { id: findings[idx]?.id ?? null, review: rf };
        }),
      });
    } catch (error) {
      console.error('[Findings AI Review] POST error:', error);
      return NextResponse.json(
        { error: 'Failed to run AI findings review' },
        { status: 500 }
      );
    }
  },
  { resource: 'audit.fieldwork', action: 'edit' }
);

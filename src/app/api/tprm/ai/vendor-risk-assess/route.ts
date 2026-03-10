/**
 * TPRM AI Vendor Risk Assessment API
 *
 * POST /api/tprm/ai/vendor-risk-assess
 *
 * Flow: Submit -> Poll -> Result (synchronous from client perspective)
 *
 * Request body:
 * {
 *   vendor_name: string;      // Name of the vendor to assess
 *   vendor_url: string;       // Website URL of the vendor
 *   require_realtime?: boolean; // If true, prefer real-time intelligence (default: true)
 *   min_intel?: number;       // Minimum intelligence items desired (default: 3)
 *   vendorId?: string;        // Optional: TPRM vendor ID to link the assessment
 * }
 *
 * Response: Full assessment result from the TPRM AI service
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, getCustomerAccountId } from '@/lib/api-auth';
import tprmAIClient from '@/lib/tprm-ai-client';
import { TPRM_AI_ENDPOINTS } from '@/lib/tprm-ai-endpoints';
import prisma from '@/lib/prisma';
import {
  errorResponse,
  badRequestResponse,
  pollJobStatus,
  logPreFlight,
  logPostFlight,
} from '@/lib/ai-route-helpers';

// ============================================================================
// CONFIGURATION
// ============================================================================

const POLL_INTERVAL_MS = 3000; // 3 seconds between status checks
const MAX_POLL_TIME_MS = 5 * 60 * 1000; // 5 minutes max wait

// ============================================================================
// TYPES
// ============================================================================

interface VendorRiskAssessRequest {
  vendor_name: string;
  vendor_url: string;
  require_realtime?: boolean;
  min_intel?: number;
  vendorId?: string; // Optional: Link to existing TPRM vendor
}

// ============================================================================
// POST - Submit and wait for vendor risk assessment
// ============================================================================

export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    const startTime = Date.now();
    const userId = session.id;
    const customerAccountId = getCustomerAccountId(session);

    try {
      // Parse request body
      const body = await req.json() as VendorRiskAssessRequest;

      // Validate required fields
      if (!body.vendor_name || typeof body.vendor_name !== 'string') {
        return badRequestResponse('vendor_name is required');
      }
      if (!body.vendor_url || typeof body.vendor_url !== 'string') {
        return badRequestResponse('vendor_url is required');
      }

      // Validate URL format
      try {
        new URL(body.vendor_url);
      } catch {
        return badRequestResponse('vendor_url must be a valid URL');
      }

      console.log(`[TPRM AI] ══════════════════════════════════════════════`);
      console.log(`[TPRM AI] Starting vendor risk assessment`);
      console.log(`[TPRM AI] Vendor: ${body.vendor_name}`);
      console.log(`[TPRM AI] URL: ${body.vendor_url}`);
      console.log(`[TPRM AI] User: ${userId}`);
      console.log(`[TPRM AI] ──────────────────────────────────────────────`);

      // Log pre-flight operation
      const operation = await logPreFlight({
        endpoint: TPRM_AI_ENDPOINTS.RISK_ASSESS_SUBMIT,
        method: 'POST',
        requestBody: { vendor_name: body.vendor_name, vendor_url: body.vendor_url },
        userId,
      });

      // Step 1: Submit the assessment job
      console.log(`[TPRM AI] Step 1: Submitting assessment job...`);
      const submitResponse = await tprmAIClient.submitVendorAssessment({
        vendor_name: body.vendor_name,
        vendor_url: body.vendor_url,
        require_realtime: body.require_realtime ?? true,
        min_intel: body.min_intel ?? 3,
      });

      const jobId = submitResponse.data.job_id;
      if (!jobId) {
        throw { status: 502, message: 'TPRM AI service did not return a job_id' };
      }

      console.log(`[TPRM AI] Job submitted: ${jobId}`);

      // Step 2: Poll for status until completed
      console.log(`[TPRM AI] Step 2: Polling for status...`);
      const pollResult = await pollJobStatus(jobId, {
        checkStatus: async (id) => {
          const statusRes = await tprmAIClient.getAssessmentStatus(id);
          return {
            status: statusRes.data.status || 'unknown',
            error: statusRes.data.error,
            progress: statusRes.data.progress,
          };
        },
        intervalMs: POLL_INTERVAL_MS,
        maxWaitMs: MAX_POLL_TIME_MS,
        terminalStatuses: ['completed', 'error', 'failed'],
        onStatusUpdate: (status) => {
          console.log(`[TPRM AI] Poll status: ${status.status}${status.progress ? ` (${status.progress}%)` : ''}`);
        },
      });

      if (pollResult.status === 'timeout') {
        console.error(`[TPRM AI] Assessment timed out after ${pollResult.totalTimeMs}ms`);
        return errorResponse(
          'Vendor risk assessment timed out. The assessment may still be processing. Please try again later.',
          504,
          { jobId, currentStatus: 'timeout' }
        );
      }

      if (pollResult.status === 'error') {
        console.error(`[TPRM AI] Assessment failed: ${pollResult.error}`);
        return errorResponse(
          pollResult.error || 'Vendor risk assessment failed',
          502,
          { jobId, currentStatus: 'failed' }
        );
      }

      // Step 3: Get the result
      console.log(`[TPRM AI] Step 3: Fetching assessment result...`);
      const resultResponse = await tprmAIClient.getAssessmentResult(jobId);
      const assessmentResult = resultResponse.data as Record<string, unknown>;

      const latencyMs = Date.now() - startTime;
      console.log(`[TPRM AI] ══════════════════════════════════════════════`);
      console.log(`[TPRM AI] SUCCESS - Assessment completed!`);
      console.log(`[TPRM AI] Job ID: ${jobId}`);
      console.log(`[TPRM AI] Total time: ${latencyMs}ms`);
      console.log(`[TPRM AI] Poll attempts: ${pollResult.attempts}`);
      console.log(`[TPRM AI] ══════════════════════════════════════════════`);

      // Log post-flight
      if (operation) {
        await logPostFlight(operation.id, { data: assessmentResult, status: 200 }, startTime);
      }

      // Step 4: Persist the result to database (if monitoring tables exist)
      let persistedId: string | null = null;
      try {
        persistedId = await persistAssessmentResult(
          customerAccountId,
          body.vendor_name,
          body.vendor_url,
          jobId,
          assessmentResult,
          body.vendorId
        );
        if (persistedId) {
          console.log(`[TPRM AI] Result persisted to database: ${persistedId}`);
        }
      } catch (persistErr) {
        // Don't fail the request if persistence fails
        console.error(`[TPRM AI] Failed to persist result:`, persistErr);
      }

      // Return the assessment result
      return NextResponse.json({
        success: true,
        job_id: jobId,
        vendor_name: body.vendor_name,
        vendor_url: body.vendor_url,
        latencyMs,
        pollAttempts: pollResult.attempts,
        persistedId,
        result: assessmentResult,
      });
    } catch (error: unknown) {
      const latencyMs = Date.now() - startTime;
      const err = error as { message?: string; status?: number; requestId?: string };

      console.error(`[TPRM AI] ══════════════════════════════════════════════`);
      console.error(`[TPRM AI] ERROR - Assessment failed!`);
      console.error(`[TPRM AI] Message: ${err.message}`);
      console.error(`[TPRM AI] Status: ${err.status || 500}`);
      console.error(`[TPRM AI] Latency: ${latencyMs}ms`);
      console.error(`[TPRM AI] ══════════════════════════════════════════════`);

      return errorResponse(
        'Unable to assess vendor risk. Please try again.',
        err.status || 500,
        { requestId: err.requestId }
      );
    }
  },
  { resource: 'tprm.monitoring', action: 'create' }
);

// ============================================================================
// HELPER: Persist assessment result to database
// ============================================================================

async function persistAssessmentResult(
  customerAccountId: string,
  vendorName: string,
  vendorURL: string,
  jobId: string,
  result: Record<string, unknown>,
  tprmVendorId?: string
): Promise<string | null> {
  // Extract data from AI response
  const overallScore = typeof result.overall_score === 'number' ? result.overall_score : null;
  const securityPostureScore = typeof result.security_posture_score === 'number' ? result.security_posture_score : null;
  const threatExposureScore = typeof result.threat_exposure_score === 'number' ? result.threat_exposure_score : null;
  const overallSummary = typeof result.overall_summary === 'string' ? result.overall_summary : null;
  const securityPostureSummary = typeof result.security_posture_summary === 'string' ? result.security_posture_summary : null;
  const threatExposureSummary = typeof result.threat_exposure_summary === 'string' ? result.threat_exposure_summary : null;

  // Upsert the MonitoringVendor
  let monVendor = await prisma.tPRMMonitoringVendor.findFirst({
    where: { customerAccountId, vendorURL },
  });

  if (monVendor) {
    monVendor = await prisma.tPRMMonitoringVendor.update({
      where: { id: monVendor.id },
      data: { vendorName, tprmVendorId: tprmVendorId || monVendor.tprmVendorId },
    });
  } else {
    monVendor = await prisma.tPRMMonitoringVendor.create({
      data: {
        customerAccountId,
        vendorName,
        vendorURL,
        vendorOnboarded: !!tprmVendorId,
        tprmVendorId: tprmVendorId || null,
      },
    });
  }

  // Mark previous assessments as not latest
  await prisma.tPRMMonitoringAssessment.updateMany({
    where: { monitoringVendorId: monVendor.id, isLatest: true },
    data: { isLatest: false },
  });

  // Create new assessment record
  const assessment = await prisma.tPRMMonitoringAssessment.create({
    data: {
      customerAccountId,
      monitoringVendorId: monVendor.id,
      vendorName,
      vendorURL,
      jobID: jobId,
      status: 'completed',
      overallSummary,
      overallScore,
      securityPostureScore,
      threatExposureScore,
      securityPostureSummary,
      threatExposureSummary,
      lastScan: new Date(),
      isLatest: true,
      calculatedOverallScore: overallScore,
      calculatedSecurityPosture: securityPostureScore,
      calculatedThreatExposure: threatExposureScore,
    },
  });

  // Persist KPI details if present
  const kpiDetails = result.kpi_details as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(kpiDetails)) {
    for (const kpi of kpiDetails) {
      const kpiRecord = await prisma.tPRMKPIDetail.create({
        data: {
          assessmentId: assessment.id,
          kpiName: (kpi.kpi_name as string) || (kpi.name as string) || 'Unknown',
          kpiType: kpi.kpi_type as string || null,
          securityScore: typeof kpi.security_score === 'number' ? kpi.security_score : null,
          summary: kpi.summary as string || null,
          riskScore: typeof kpi.risk_score === 'number' ? kpi.risk_score : null,
          recommendation: kpi.recommendation as string || null,
        },
      });

      // Persist key findings
      const keyFindings = kpi.key_findings as Array<{ statement?: string }> | undefined;
      if (Array.isArray(keyFindings)) {
        await prisma.tPRMKeyFinding.createMany({
          data: keyFindings
            .filter(f => f.statement)
            .map(f => ({ kpiDetailId: kpiRecord.id, statement: f.statement! })),
        });
      }

      // Persist vulnerabilities
      const vulnerabilities = kpi.vulnerabilities as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(vulnerabilities)) {
        await prisma.tPRMVulnerabilityFinding.createMany({
          data: vulnerabilities.map(v => ({
            kpiDetailId: kpiRecord.id,
            cveId: v.cve_id as string || null,
            severity: v.severity as string || null,
            affectedComponent: v.affected_component as string || null,
            description: v.description as string || null,
          })),
        });
      }
    }
  }

  // Persist recommendation if present
  const recommendation = result.recommendation as { statement?: string } | undefined;
  if (recommendation?.statement) {
    await prisma.tPRMMonitoringRecommendation.create({
      data: {
        assessmentId: assessment.id,
        statement: recommendation.statement,
      },
    });
  }

  // Persist compliance and legal info if present
  const complianceAndLegal = result.compliance_and_legal as Record<string, unknown> | undefined;
  if (complianceAndLegal) {
    const cal = await prisma.tPRMComplianceAndLegal.create({
      data: {
        assessmentId: assessment.id,
        privacyPolicyUrl: complianceAndLegal.privacy_policy_url as string || null,
        dpaUrl: complianceAndLegal.dpa_url as string || null,
      },
    });

    const laws = complianceAndLegal.laws as Array<{ law_name?: string }> | undefined;
    if (Array.isArray(laws)) {
      await prisma.tPRMLaw.createMany({
        data: laws.filter(l => l.law_name).map(l => ({ complianceId: cal.id, lawName: l.law_name! })),
      });
    }

    const certifications = complianceAndLegal.certifications as Array<{ name?: string }> | undefined;
    if (Array.isArray(certifications)) {
      await prisma.tPRMCertification.createMany({
        data: certifications.filter(c => c.name).map(c => ({ complianceId: cal.id, name: c.name! })),
      });
    }
  }

  return assessment.id;
}

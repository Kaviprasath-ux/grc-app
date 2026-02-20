import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";
import { AI_ENDPOINTS } from "@/lib/ai-endpoints";
import {
  notFoundResponse,
  badRequestResponse,
  errorResponse,
  buildEvidencePayload,
  updateEvidenceAIStatus,
  parseComplianceData,
  buildComplianceSummary,
  extractGaps,
  extractRecommendations,
} from "@/lib/ai-route-helpers";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/ai/evidence/ingest-result/[jobId]
 * Fetch ingest result from RunPod and persist to database
 *
 * RunPod Endpoints:
 * - GET /api/grc_ingest_result/{jobId} (fetch result)
 * - POST /api/grc_evidence_query (auto-triggered review)
 */
export const GET = withAuth(
  async (req: NextRequest, context: RouteContext, session) => {
    try {
      const { jobId } = await context.params;

      // Find ingest job
      const ingestJob = await prisma.evidenceAIIngestJob.findUnique({
        where: { runpodJobId: jobId },
        include: {
          evidence: {
            select: {
              id: true,
              customerAccountId: true,
            },
          },
        },
      });

      if (!ingestJob) {
        return notFoundResponse("Ingest job");
      }

      if (!validateTenantAccess(session, ingestJob.evidence.customerAccountId)) {
        return forbidden("Access denied to this evidence");
      }

      // Check if result already fetched
      const existingResult = await prisma.evidenceAIIngestResult.findUnique({
        where: { jobId: jobId },
      });

      if (existingResult) {
        return NextResponse.json({
          job_id: jobId,
          status: "completed",
          result: {
            messages: existingResult.extractedText ? JSON.parse(existingResult.extractedText) : [],
            status: true,
          },
        });
      }

      // Verify job is completed
      const jobStatus = ingestJob.status.toLowerCase();
      if (jobStatus !== "completed") {
        return badRequestResponse(`Job not completed yet. Current status: ${jobStatus}`);
      }

      // Call RunPod result endpoint via standardized aiApiClient
      let response;
      try {
        response = await aiApiClient.get(`${AI_ENDPOINTS.INGEST_RESULT}/${jobId}`);
        console.log(`[Evidence Ingest Result] RunPod Response:`, response.data);
      } catch (apiError: unknown) {
        const err = apiError as { message?: string; requestId?: string; status?: number };
        console.error(`[Evidence Ingest Result] API error:`, err);
        return errorResponse(err.message || "Failed to fetch result", err.status || 502, {
          jobId,
          currentStatus: "failed",
          requestId: err.requestId,
        });
      }

      // Response: { "job_id": "...", "status": "completed", "result": { "messages": [...], "status": true } }
      const runpodData = response.data as {
        result?: {
          messages?: unknown[];
          status?: boolean;
        };
      };

      // Store ingest result - save messages as JSON string
      const messages = runpodData.result?.messages || [];
      const ingestResult = await prisma.evidenceAIIngestResult.create({
        data: {
          evidenceId: ingestJob.evidenceId,
          jobId: jobId,
          extractedText: JSON.stringify(messages),
          embeddings: null,
          metadata: JSON.stringify({ status: runpodData.result?.status }),
          indexingStatus: runpodData.result?.status ? "success" : "failed",
        },
      });

      // Update evidence using helper
      await updateEvidenceAIStatus(ingestJob.evidenceId, {
        ingestStatus: "ingested",
        ingestedAt: new Date(),
        reviewStatus: "ready",
      });

      // Track if review was auto-triggered
      let reviewTriggered = false;

      // AUTO-TRIGGER: Call /api/grc_evidence_query when status === true
      if (runpodData.result?.status === true) {
        try {
          // Fetch full evidence with attachments (ingested files)
          const fullEvidence = await prisma.evidence.findUnique({
            where: { id: ingestJob.evidenceId },
            include: {
              attachments: {
                select: {
                  id: true,
                  fileName: true,
                  fileType: true,
                },
                orderBy: { uploadedAt: "desc" },
              },
            },
          });

          if (fullEvidence) {
            // Update status to IN_PROGRESS using helper
            await updateEvidenceAIStatus(ingestJob.evidenceId, { reviewStatus: "IN_PROGRESS" });

            // Prepare request body for /api/grc_evidence_query using helper
            // IMPORTANT: Use customerAccountId (not session.id) to match base_id from ingest
            const reviewRequestBody = buildEvidencePayload(fullEvidence, ingestJob.evidence.customerAccountId);

            // Call RunPod evidence query endpoint via standardized aiApiClient
            console.log(`[Evidence Ingest Result] AUTO-TRIGGER evidence review`);

            let reviewResponse;
            try {
              reviewResponse = await aiApiClient.post(AI_ENDPOINTS.EVIDENCE_QUERY, reviewRequestBody);
            } catch (reviewApiError: unknown) {
              const reviewErr = reviewApiError as { message?: string };
              console.error(`[Evidence Ingest Result] AUTO-TRIGGER API error:`, reviewErr);
              // Mark as failed if review API fails using helper
              await updateEvidenceAIStatus(fullEvidence.id, { reviewStatus: "FAILED" });
              throw reviewApiError; // Re-throw to be caught by outer catch
            }

            const reviewRaw = reviewResponse.data;
            console.log(`[Evidence Ingest Result] AUTO-TRIGGER review completed`);

            // Create AI operation record
            const aiOperation = await prisma.aIOperation.create({
              data: {
                endpoint: AI_ENDPOINTS.EVIDENCE_QUERY,
                method: "POST",
                requestBody: JSON.stringify(reviewRequestBody),
                responseBody: JSON.stringify(reviewRaw),
                statusCode: reviewResponse.status,
                latencyMs: reviewResponse.latencyMs,
                userId: session.id,
              },
            });

            // Define type for review items from RunPod evidence query
            interface ReviewItem {
              status_code?: number;
              question?: string;
              control_code?: string;
              answer?: string;
              score?: number | null;
              status?: string;
              uuid?: string;
              Issue?: string;
              Risk?: string;
              Severity?: string;
            }

            // Process RunPod response - handle array, governance-style, and direct formats
            let complianceSummary: string | null = null;
            let complianceScore: number | null = null;
            let gaps: unknown[] | null = null;
            let suggestions: unknown[] | null = null;
            let critique: string | null = null;
            let rawResponseArray: unknown[] | null = null;
            let recommendations: unknown[] | null = null;

            if (Array.isArray(reviewRaw)) {
              // Array response format: [{ control_code, question, answer, status, Severity, ... }]
              const reviewItems = reviewRaw as ReviewItem[];
              rawResponseArray = reviewItems;

              const nonCompliant = reviewItems.filter(
                (item) => item.status && item.status.toLowerCase() !== 'compliant'
              );
              const totalItems = reviewItems.length;
              const compliantCount = totalItems - nonCompliant.length;
              const compliancePercent = totalItems > 0 ? Math.round((compliantCount / totalItems) * 100) : 0;

              complianceScore = compliancePercent;
              critique = compliancePercent >= 80 ? 'compliant' : 'non-compliant';
              complianceSummary = `Evidence review completed. ${compliantCount}/${totalItems} controls compliant (${compliancePercent}%). ` +
                (nonCompliant.length > 0
                  ? `Non-compliant: ${nonCompliant.map(c => c.control_code || 'Unknown').join(', ')}`
                  : 'All controls are compliant.');

              gaps = nonCompliant.map((item) => ({
                issue: item.answer || `Control ${item.control_code} is ${item.status}`,
                risk: item.Risk || item.Severity || item.status,
                severity: item.Severity || 'Medium',
                status: item.status,
                controlCode: item.control_code,
              }));

              suggestions = nonCompliant.map((item) => ({
                risk: `Control ${item.control_code || 'Unknown'} is ${item.status || 'non-compliant'}`,
                severity: item.Severity || 'Medium',
                controlCode: item.control_code,
              }));

              console.log(`[Evidence Ingest Result] Array-style: ${totalItems} items, ${nonCompliant.length} non-compliant, ${compliancePercent}%`);
            } else {
              const reviewData = reviewRaw as Record<string, unknown>;

              if (reviewData.policy_compliant_data || reviewData.controls_response) {
                // Governance-style response
                const complianceData = parseComplianceData(reviewData as {
                  policy_compliant_data?: { total_controls?: number; total_compliant_controls?: number; compliant_percent?: number };
                  controls_response?: Array<{ control_code: string; status: string; answer: string; score?: number }>;
                });
                complianceSummary = buildComplianceSummary(complianceData);
                complianceScore = complianceData.compliancePercent;
                gaps = extractGaps(complianceData.controlsResponse);
                const recs = extractRecommendations(complianceData.controlsResponse);
                recommendations = recs.length > 0 ? recs : null;
                suggestions = gaps.length > 0 ? gaps.map((g) => {
                  const item = g as { control_code?: string; status?: string };
                  return {
                    risk: `Control ${item.control_code || 'Unknown'} is ${item.status || 'non-compliant'}`,
                    severity: item.status || 'non-compliant',
                  };
                }) : null;
                rawResponseArray = complianceData.controlsResponse;
                critique = complianceData.compliancePercent >= 80 ? 'compliant' : 'non-compliant';

                console.log(`[Evidence Ingest Result] Governance-style: ${complianceData.compliancePercent}% compliant, ${gaps.length} gaps`);
              } else {
                // Direct-field format
                critique = (reviewData.critique as string) || null;
                complianceSummary = (reviewData.compliance_summary as string) || null;
                complianceScore = (reviewData.compliance_score as number) || null;
                gaps = reviewData.gaps ? (reviewData.gaps as unknown[]) : null;
                suggestions = reviewData.suggestions ? (reviewData.suggestions as unknown[]) : null;

                if (!complianceSummary) {
                  const fallbackText = (reviewData.answer as string) ||
                    (reviewData.response as string) ||
                    (reviewData.message as string);
                  if (fallbackText && typeof fallbackText === 'string') {
                    complianceSummary = fallbackText;
                  }
                }

                if (Array.isArray(reviewData.evidence_response)) {
                  rawResponseArray = reviewData.evidence_response as unknown[];
                } else if (Array.isArray(reviewData.results)) {
                  rawResponseArray = reviewData.results as unknown[];
                }

                console.log(`[Evidence Ingest Result] Direct-field: critique=${critique}, score=${complianceScore}`);
              }
            }

            // Create review record with proper document ID tracking
            await prisma.evidenceAIReview.create({
              data: {
                evidenceId: fullEvidence.id,
                status: "completed",
                critique,
                complianceSummary,
                complianceScore,
                gaps: gaps && gaps.length > 0 ? JSON.stringify(gaps) : null,
                suggestions: suggestions && suggestions.length > 0 ? JSON.stringify(suggestions) : null,
                similarityScore: null,
                recommendations: recommendations && recommendations.length > 0 ? JSON.stringify(recommendations) : null,
                rawResponse: rawResponseArray && rawResponseArray.length > 0
                  ? JSON.stringify(rawResponseArray)
                  : JSON.stringify(reviewRaw),
                aiOperationId: aiOperation.id,
                // Document ID tracking for proper cleanup
                ingestJobId: jobId,
                evidenceDocumentId: fullEvidence.id,
              },
            });

            // Update evidence to COMPLETED using helper
            await updateEvidenceAIStatus(fullEvidence.id, {
              reviewStatus: "COMPLETED",
              reviewedAt: new Date(),
            });

            reviewTriggered = true;
            console.log(`[Evidence Ingest Result] AUTO-TRIGGER completed for evidence ${fullEvidence.id}`);
          }
        } catch (autoTriggerError: unknown) {
          const autoErr = autoTriggerError as { message?: string };
          console.error("[Evidence Ingest Result] AUTO-TRIGGER error:", autoErr);
          // Don't fail the ingest-result request, just log the error using helper
          await updateEvidenceAIStatus(ingestJob.evidenceId, { reviewStatus: "FAILED" });
        }
      }

      return NextResponse.json({
        job_id: jobId,
        status: "completed",
        result: {
          messages: messages,
          status: runpodData.result?.status || false,
        },
        reviewTriggered,
      });
    } catch (error: unknown) {
      const err = error as { message?: string; requestId?: string; status?: number };
      console.error("[Evidence Ingest Result] Error:", err);
      return errorResponse(err.message || "Failed to fetch ingest result", err.status || 500, {
        requestId: err.requestId,
      });
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

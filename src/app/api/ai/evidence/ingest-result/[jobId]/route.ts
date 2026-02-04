import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import aiApiClient from "@/lib/ai-api-client";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * GET /api/ai/evidence/ingest-result/[jobId]
 * Fetch ingest result from RunPod and persist to database
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
        return NextResponse.json(
          { error: "Ingest job not found" },
          { status: 404 }
        );
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
        return NextResponse.json(
          { job_id: jobId, status: jobStatus, error: `Job not completed yet` },
          { status: 400 }
        );
      }

      // Call RunPod result endpoint via standardized aiApiClient
      let response;
      try {
        response = await aiApiClient.get(`/api/grc_ingest_result/${jobId}`);
      } catch (apiError: any) {
        console.error(`[Evidence Ingest Result] API error:`, apiError);
        return NextResponse.json(
          {
            job_id: jobId,
            status: "failed",
            error: apiError.message,
            requestId: apiError.requestId
          },
          { status: apiError.status || 502 }
        );
      }

      // Response: { "job_id": "...", "status": "completed", "result": { "messages": [...], "status": true } }
      const runpodData = response.data;

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

      // Update evidence
      await prisma.evidence.update({
        where: { id: ingestJob.evidenceId },
        data: {
          aiIngestStatus: "ingested",
          aiIngestedAt: new Date(),
          aiReviewStatus: "ready",
        },
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
            // Update status to IN_PROGRESS
            await prisma.evidence.update({
              where: { id: ingestJob.evidenceId },
              data: { aiReviewStatus: "IN_PROGRESS" },
            });

            // Prepare request body for /api/grc_evidence_query
            // Use attachments (ingested files) for evidence_artifact - these match what was ingested
            const reviewRequestBody = {
              user_id: session.id,
              evidence_id: fullEvidence.id,
              doc_type: "evidence",
              evidences: [
                {
                  evidence_code: fullEvidence.evidenceCode,
                  evidence_artifact: fullEvidence.attachments
                    .map((att) => att.fileName)
                    .join(", ") || fullEvidence.evidenceCode,
                },
              ],
            };

            // Call RunPod evidence query endpoint via standardized aiApiClient
            console.log(`[Evidence Ingest Result] AUTO-TRIGGER evidence review`);

            let reviewResponse;
            try {
              reviewResponse = await aiApiClient.post("/api/grc_evidence_query", reviewRequestBody);
            } catch (reviewApiError: any) {
              console.error(`[Evidence Ingest Result] AUTO-TRIGGER API error:`, reviewApiError);
              // Mark as failed if review API fails
              await prisma.evidence.update({
                where: { id: fullEvidence.id },
                data: { aiReviewStatus: "FAILED" },
              });
              throw reviewApiError; // Re-throw to be caught by outer catch
            }

            const reviewData = reviewResponse.data;
            console.log(`[Evidence Ingest Result] AUTO-TRIGGER review completed`);

            // Create AI operation record
            const aiOperation = await prisma.aIOperation.create({
              data: {
                endpoint: "/api/grc_evidence_query",
                method: "POST",
                requestBody: JSON.stringify(reviewRequestBody),
                responseBody: JSON.stringify(reviewData),
                statusCode: reviewResponse.status,
                latencyMs: reviewResponse.latencyMs,
                userId: session.id,
              },
            });

            // Parse the API response format:
            // [{ status_code, question, control_code, answer, score, status, uuid, Issue, Risk, Severity }]
            const reviewItems = Array.isArray(reviewData) ? reviewData : [reviewData];
            const firstItem = reviewItems[0] || {};

            // Extract compliance summary from the answer
            const complianceSummary = firstItem.answer || null;

            // Extract compliance score (can be null)
            const complianceScore = firstItem.score !== null && firstItem.score !== undefined
              ? Number(firstItem.score)
              : null;

            // Define type for review item
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

            // Extract gaps from Issues
            const gaps = (reviewItems as ReviewItem[])
              .filter((item) => item.Issue)
              .map((item) => ({
                issue: item.Issue,
                risk: item.Risk,
                severity: item.Severity,
                status: item.status,
                controlCode: item.control_code,
              }));

            // Extract suggestions from Risk descriptions
            const suggestions = (reviewItems as ReviewItem[])
              .filter((item) => item.Risk)
              .map((item) => ({
                risk: item.Risk,
                severity: item.Severity,
                controlCode: item.control_code,
              }));

            // Create review record
            await prisma.evidenceAIReview.create({
              data: {
                evidenceId: fullEvidence.id,
                status: "completed",
                critique: firstItem.status || null,
                complianceSummary: complianceSummary,
                complianceScore: complianceScore,
                gaps: gaps.length > 0 ? JSON.stringify(gaps) : null,
                suggestions: suggestions.length > 0 ? JSON.stringify(suggestions) : null,
                similarityScore: null,
                recommendations: null,
                rawResponse: JSON.stringify(reviewData),
                aiOperationId: aiOperation.id,
              },
            });

            // Update evidence to COMPLETED
            await prisma.evidence.update({
              where: { id: fullEvidence.id },
              data: {
                aiReviewStatus: "COMPLETED",
                aiReviewedAt: new Date(),
              },
            });

            reviewTriggered = true;
            console.log(`[Evidence Ingest Result] AUTO-TRIGGER completed for evidence ${fullEvidence.id}`);
          }
        } catch (autoTriggerError: any) {
          console.error("[Evidence Ingest Result] AUTO-TRIGGER error:", autoTriggerError);
          // Don't fail the ingest-result request, just log the error
          await prisma.evidence.update({
            where: { id: ingestJob.evidenceId },
            data: { aiReviewStatus: "FAILED" },
          });
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
    } catch (error: any) {
      console.error("[Evidence Ingest Result] Error:", error);
      return NextResponse.json(
        {
          error: error.message || "Failed to fetch ingest result",
          details: String(error),
          requestId: error.requestId
        },
        { status: error.status || 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

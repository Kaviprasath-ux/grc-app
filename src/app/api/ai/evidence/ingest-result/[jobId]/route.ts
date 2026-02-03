import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAuth, validateTenantAccess, forbidden } from "@/lib/api-auth";
import { AI_CONFIG, getAIHeaders } from "@/lib/ai-config";

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

      // Call RunPod result endpoint
      const runpodUrl = `${AI_CONFIG.baseUrl}${AI_CONFIG.endpoints.ingestResult}/${jobId}`;
      console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestResult}/${jobId} → fetching`);

      const runpodResponse = await fetch(runpodUrl, {
        method: "GET",
        headers: getAIHeaders(),
      });

      if (!runpodResponse.ok) {
        const errorText = await runpodResponse.text();
        console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestResult}/${jobId} → ${runpodResponse.status} (error)`);
        return NextResponse.json(
          { job_id: jobId, status: "failed", error: errorText },
          { status: 502 }
        );
      }

      // Response: { "job_id": "...", "status": "completed", "result": { "messages": [...], "status": true } }
      const runpodData = await runpodResponse.json();
      console.log(`[AI] GET  ${AI_CONFIG.endpoints.ingestResult}/${jobId} → completed`, JSON.stringify(runpodData));

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
          // Fetch full evidence with linked artifacts
          const fullEvidence = await prisma.evidence.findUnique({
            where: { id: ingestJob.evidenceId },
            include: {
              linkedArtifacts: {
                include: {
                  artifact: {
                    select: {
                      artifactCode: true,
                      name: true,
                    },
                  },
                },
              },
              attachments: {
                select: { fileType: true },
                take: 1,
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
            const reviewRequestBody = {
              user_id: session.id,
              evidence_id: fullEvidence.id,
              doc_type: fullEvidence.attachments[0]?.fileType || "evidence",
              evidences: [
                {
                  evidence_code: fullEvidence.evidenceCode,
                  evidence_artifact: fullEvidence.linkedArtifacts
                    .map((la) => `${la.artifact.artifactCode}: ${la.artifact.name}`)
                    .join(", ") || "",
                },
              ],
            };

            // Call RunPod evidence query endpoint
            const reviewUrl = `${AI_CONFIG.baseUrl}${AI_CONFIG.endpoints.evidenceQuery}`;
            console.log(`[AI] AUTO-TRIGGER POST ${AI_CONFIG.endpoints.evidenceQuery}`);

            const reviewResponse = await fetch(reviewUrl, {
              method: "POST",
              headers: getAIHeaders(),
              body: JSON.stringify(reviewRequestBody),
            });

            if (reviewResponse.ok) {
              const reviewData = await reviewResponse.json();
              console.log(`[AI] AUTO-TRIGGER review response:`, JSON.stringify(reviewData));

              // Create AI operation record
              const aiOperation = await prisma.aIOperation.create({
                data: {
                  endpoint: reviewUrl,
                  method: "POST",
                  requestBody: JSON.stringify(reviewRequestBody),
                  responseBody: JSON.stringify(reviewData),
                  statusCode: reviewResponse.status,
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
              console.log(`[AI] AUTO-TRIGGER completed for evidence ${fullEvidence.id}`);
            } else {
              // Mark as failed if review API fails
              const errorText = await reviewResponse.text();
              await prisma.evidence.update({
                where: { id: fullEvidence.id },
                data: { aiReviewStatus: "FAILED" },
              });
              console.error(`[AI] AUTO-TRIGGER failed: ${errorText}`);
            }
          }
        } catch (autoTriggerError) {
          console.error("[AI] AUTO-TRIGGER error:", autoTriggerError);
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
    } catch (error) {
      console.error("Error fetching ingest result:", error);
      return NextResponse.json(
        { error: "Failed to fetch ingest result", details: String(error) },
        { status: 500 }
      );
    }
  },
  { resource: "compliance.evidence", action: "view" }
);

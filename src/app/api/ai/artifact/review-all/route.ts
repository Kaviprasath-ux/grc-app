import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, validateTenantAccess, forbidden, getCustomerAccountId } from '@/lib/api-auth';
import aiApiClient from '@/lib/ai-api-client';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';
import {
  errorResponse,
  badRequestResponse,
  createAIOperation,
  updateAIOperation,
  updateEvidenceAIStatus,
  buildVaultQueryPayload,
} from '@/lib/ai-route-helpers';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ArtifactWithEvidences {
  id: string;
  artifactCode: string;
  fileName: string;
  filePath: string;
  fileType: string | null;
  fileSize: number | null;
  updatedAt: Date;
  linkedEvidences: Array<{
    evidenceId: string;
    evidence: {
      id: string;
      evidenceCode: string;
      description: string | null;
      customerAccountId: string;
    };
  }>;
}

interface IngestResult {
  artifactId: string;
  jobId: string | null;
  documentRef: string | null;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  skippedReason?: string;
}

interface QueryResult {
  artifactId: string;
  evidenceId: string;
  evidenceCode: string;
  reviewId: string;
  answer: string | null;
  confidence: number | null;
  sources: string[] | null;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
  skippedReason?: string;
}

/**
 * Calculate MD5 hash of first 1MB of file for change detection
 */
function getFileHash(filePath: string): string {
  const buffer = Buffer.alloc(1024 * 1024); // 1MB
  const fd = fs.openSync(filePath, 'r');
  const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
  fs.closeSync(fd);
  return crypto.createHash('md5').update(buffer.slice(0, bytesRead)).digest('hex');
}

/**
 * POST /api/ai/artifact/review-all
 *
 * Comprehensive artifact AI review with SMART DETECTION:
 *
 * Smart Detection Features:
 * - Skips artifacts already ingested (unless file changed)
 * - Skips reviews that already exist (unless evidence description changed)
 * - Detects file changes via modification time and hash
 * - forceRefresh=true bypasses all checks
 *
 * Request body:
 * {
 *   artifactIds?: string[]  // Optional - if not provided, processes all artifacts with linked evidences
 *   forceRefresh?: boolean  // Optional - bypass smart detection, re-process everything
 * }
 */
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    const startTime = Date.now();
    const userId = session.id;

    try {
      let customerAccountId: string;
      try {
        customerAccountId = getCustomerAccountId(session);
      } catch {
        return forbidden('User does not have a customer account assigned');
      }

      // Parse request body
      let artifactIds: string[] | undefined;
      let forceRefresh = false;
      try {
        const body = await req.json();
        artifactIds = body.artifactIds;
        forceRefresh = body.forceRefresh === true;
      } catch {
        // No body provided - will process all artifacts
      }

      console.log(`[Artifact Review All] Starting for customer: ${customerAccountId}`);
      console.log(`[Artifact Review All] Force refresh: ${forceRefresh}`);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: Fetch artifacts with linked evidences
      // ─────────────────────────────────────────────────────────────────────
      const whereClause: { customerAccountId: string; id?: { in: string[] }; linkedEvidences?: { some: object } } = {
        customerAccountId,
        linkedEvidences: { some: {} }, // Only artifacts with at least one linked evidence
      };

      if (artifactIds && artifactIds.length > 0) {
        whereClause.id = { in: artifactIds };
      }

      const artifacts = await prisma.artifact.findMany({
        where: whereClause,
        select: {
          id: true,
          artifactCode: true,
          fileName: true,
          filePath: true,
          fileType: true,
          fileSize: true,
          updatedAt: true,
          linkedEvidences: {
            select: {
              evidenceId: true,
              evidence: {
                select: {
                  id: true,
                  evidenceCode: true,
                  description: true,
                  customerAccountId: true,
                },
              },
            },
          },
        },
      }) as ArtifactWithEvidences[];

      if (artifacts.length === 0) {
        return badRequestResponse('No artifacts with linked evidences found');
      }

      console.log(`[Artifact Review All] Found ${artifacts.length} artifacts to process`);

      // Count total evidence-artifact pairs
      const totalPairs = artifacts.reduce((sum, a) => sum + a.linkedEvidences.length, 0);
      console.log(`[Artifact Review All] Total artifact-evidence pairs: ${totalPairs}`);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1.5: Smart Detection - Fetch existing ingest jobs and reviews
      // ─────────────────────────────────────────────────────────────────────
      // Get existing completed ingest jobs for these artifacts
      const existingIngestJobs = await prisma.evidenceAIIngestJob.findMany({
        where: {
          sentDocumentId: { in: artifacts.map(a => a.id) },
          status: 'completed',
        },
        select: {
          sentDocumentId: true,
          runpodJobId: true,
          returnedDocumentId: true,
          ingestedFileName: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Create a map of artifactId -> latest ingest job
      const ingestJobMap = new Map<string, typeof existingIngestJobs[0]>();
      for (const job of existingIngestJobs) {
        if (job.sentDocumentId && !ingestJobMap.has(job.sentDocumentId)) {
          ingestJobMap.set(job.sentDocumentId, job);
        }
      }

      // Get existing reviews for all artifact-evidence pairs
      const existingReviews = await prisma.evidenceAIReview.findMany({
        where: {
          artifactId: { in: artifacts.map(a => a.id) },
          status: 'completed',
        },
        select: {
          artifactId: true,
          evidenceId: true,
          createdAt: true,
          updatedAt: true,
          complianceSummary: true,
        },
      });

      // Create a map of "artifactId:evidenceId" -> review
      const reviewMap = new Map<string, typeof existingReviews[0]>();
      for (const review of existingReviews) {
        if (review.artifactId) {
          const key = `${review.artifactId}:${review.evidenceId}`;
          reviewMap.set(key, review);
        }
      }

      console.log(`[Artifact Review All] Existing ingest jobs: ${ingestJobMap.size}`);
      console.log(`[Artifact Review All] Existing reviews: ${reviewMap.size}`);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: Validate files and detect changes
      // ─────────────────────────────────────────────────────────────────────
      const validArtifacts: ArtifactWithEvidences[] = [];
      const fileErrors: Array<{ artifactId: string; fileName: string; error: string }> = [];
      const artifactsNeedingIngest: Set<string> = new Set();
      const fileInfoMap = new Map<string, { fullPath: string; mtime: Date; hash: string }>();

      for (const artifact of artifacts) {
        const relativePath = artifact.filePath.startsWith('/')
          ? artifact.filePath.slice(1)
          : artifact.filePath;
        const fullPath = path.join(process.cwd(), relativePath);

        if (!fs.existsSync(fullPath)) {
          fileErrors.push({
            artifactId: artifact.id,
            fileName: artifact.fileName,
            error: 'File not found on server',
          });
          console.warn(`[Artifact Review All] File not found: ${artifact.fileName}`);
          continue;
        }

        validArtifacts.push(artifact);

        // Get file stats for change detection
        const stats = fs.statSync(fullPath);
        const fileHash = getFileHash(fullPath);
        fileInfoMap.set(artifact.id, { fullPath, mtime: stats.mtime, hash: fileHash });

        // Check if artifact needs ingestion
        if (forceRefresh) {
          // Force refresh - always re-ingest
          artifactsNeedingIngest.add(artifact.id);
          console.log(`[Artifact Review All] Force refresh: ${artifact.artifactCode}`);
        } else {
          const existingJob = ingestJobMap.get(artifact.id);

          if (!existingJob) {
            // No previous ingest - needs ingestion
            artifactsNeedingIngest.add(artifact.id);
            console.log(`[Artifact Review All] New artifact needs ingest: ${artifact.artifactCode}`);
          } else {
            // Check if file changed since last ingest
            const lastIngestTime = existingJob.createdAt;
            const fileModTime = stats.mtime;

            if (fileModTime > lastIngestTime) {
              // File was modified after last ingest
              artifactsNeedingIngest.add(artifact.id);
              console.log(`[Artifact Review All] File changed, re-ingest: ${artifact.artifactCode}`);
            } else {
              console.log(`[Artifact Review All] Already ingested, skip: ${artifact.artifactCode}`);
            }
          }
        }
      }

      if (validArtifacts.length === 0) {
        return errorResponse('All artifact files are missing from server', 404, {
          details: JSON.stringify(fileErrors),
        });
      }

      console.log(`[Artifact Review All] Valid artifacts: ${validArtifacts.length}/${artifacts.length}`);
      console.log(`[Artifact Review All] Artifacts needing ingest: ${artifactsNeedingIngest.size}`);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: Ingest only artifacts that need it (smart detection)
      // ─────────────────────────────────────────────────────────────────────
      const ingestResults: Map<string, IngestResult> = new Map();

      // First, add results for artifacts that don't need ingestion (reuse existing)
      for (const artifact of validArtifacts) {
        if (!artifactsNeedingIngest.has(artifact.id)) {
          const existingJob = ingestJobMap.get(artifact.id);
          if (existingJob) {
            ingestResults.set(artifact.id, {
              artifactId: artifact.id,
              jobId: existingJob.runpodJobId,
              documentRef: existingJob.returnedDocumentId,
              status: 'skipped',
              skippedReason: 'Already ingested, no file changes',
            });
          }
        }
      }

      const skippedCount = Array.from(ingestResults.values()).filter(r => r.status === 'skipped').length;
      console.log(`[Artifact Review All] Skipped (already ingested): ${skippedCount}`);

      // Now ingest only artifacts that need it
      if (artifactsNeedingIngest.size > 0) {
        console.log(`[Artifact Review All] Step 1: Ingesting ${artifactsNeedingIngest.size} artifacts...`);

        for (const artifact of validArtifacts) {
          if (!artifactsNeedingIngest.has(artifact.id)) continue;

          const fileInfo = fileInfoMap.get(artifact.id);
          if (!fileInfo) continue;

          try {
            // Read file once
            const fileBuffer = fs.readFileSync(fileInfo.fullPath);
            const blob = new Blob([fileBuffer], { type: artifact.fileType || 'application/octet-stream' });
            const file = new File([blob], artifact.fileName, { type: artifact.fileType || 'application/octet-stream' });

            // Build ingest form data
            const ingestFormData = new FormData();
            ingestFormData.append('base_id', customerAccountId);
            ingestFormData.append('doc_type', 'evidence');
            ingestFormData.append('file_code', artifact.artifactCode);
            ingestFormData.append('document_id', artifact.id);
            ingestFormData.append('files', file);

            // Log operation
            const operation = await createAIOperation({
              endpoint: AI_ENDPOINTS.INGEST,
              method: 'POST',
              requestBody: {
                base_id: customerAccountId,
                doc_type: 'evidence',
                file_code: artifact.artifactCode,
                document_id: artifact.id,
                fileName: artifact.fileName,
                fileHash: fileInfo.hash,
              },
              userId,
            });

            // Send ingest request
            const ingestResponse = await aiApiClient.post(AI_ENDPOINTS.INGEST, ingestFormData);
            const ingestData = ingestResponse.data as { job_id?: string; document_id?: string; status?: string };

            const jobId = ingestData.job_id || ingestData.document_id || artifact.id;
            const documentRef = ingestData.document_id || null;

            // Update operation
            await updateAIOperation(operation.id, {
              data: ingestData,
              status: ingestResponse.status,
              latencyMs: Date.now() - startTime,
            });

            // Create ingest job record for tracking
            await prisma.evidenceAIIngestJob.create({
              data: {
                evidenceId: artifact.linkedEvidences[0]?.evidenceId || artifact.id,
                runpodJobId: jobId,
                sentDocumentId: artifact.id,
                returnedDocumentId: documentRef,
                ingestedFileName: artifact.fileName,
                status: ingestData.status || 'queued',
              },
            });

            ingestResults.set(artifact.id, {
              artifactId: artifact.id,
              jobId,
              documentRef,
              status: 'success',
            });

            console.log(`[Artifact Review All] Ingested: ${artifact.artifactCode} (job: ${jobId})`);
          } catch (error) {
            const err = error as { message?: string };
            console.error(`[Artifact Review All] Ingest failed for ${artifact.fileName}:`, err.message);

            ingestResults.set(artifact.id, {
              artifactId: artifact.id,
              jobId: null,
              documentRef: null,
              status: 'failed',
              error: err.message,
            });
          }
        }
      } else {
        console.log(`[Artifact Review All] Step 1: All artifacts already ingested, skipping ingest phase`);
      }

      // Check how many ingests succeeded (including skipped as "success" for query purposes)
      const successfulIngests = Array.from(ingestResults.values()).filter(r => r.status === 'success');
      const newIngestCount = successfulIngests.length;
      console.log(`[Artifact Review All] New ingests: ${newIngestCount}, Reused: ${skippedCount}`);

      // If all new ingests failed but we have skipped ones, we can still proceed
      const usableIngests = Array.from(ingestResults.values()).filter(r => r.status === 'success' || r.status === 'skipped');
      if (usableIngests.length === 0) {
        return errorResponse('All artifact ingests failed', 502);
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 4: Wait for NEW ingests to complete (poll status)
      // ─────────────────────────────────────────────────────────────────────
      // Only poll for newly ingested artifacts, not skipped ones
      if (newIngestCount > 0) {
        console.log(`[Artifact Review All] Step 2: Waiting for ${newIngestCount} ingests to complete...`);

        const maxWaitTime = 180000; // 3 minutes max
        const pollInterval = 5000; // 5 seconds
        const ingestStartTime = Date.now();

        const pendingIngests = new Set(successfulIngests.map(r => r.jobId!));

        while (pendingIngests.size > 0 && Date.now() - ingestStartTime < maxWaitTime) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));

          for (const jobId of Array.from(pendingIngests)) {
            try {
              const statusResponse = await aiApiClient.get(`${AI_ENDPOINTS.INGEST_STATUS}/${jobId}`);
              const statusData = statusResponse.data as { status?: string };

              if (statusData.status === 'completed' || statusData.status === 'ingested') {
                pendingIngests.delete(jobId);
                console.log(`[Artifact Review All] Ingest completed: ${jobId}`);

                // Update job record
                await prisma.evidenceAIIngestJob.updateMany({
                  where: { runpodJobId: jobId },
                  data: { status: 'completed', completedAt: new Date() },
                });
              } else if (statusData.status === 'failed') {
                pendingIngests.delete(jobId);
                console.error(`[Artifact Review All] Ingest failed: ${jobId}`);

                // Update job record
                await prisma.evidenceAIIngestJob.updateMany({
                  where: { runpodJobId: jobId },
                  data: { status: 'failed' },
                });

                // Mark artifact as failed
                for (const [artifactId, result] of ingestResults) {
                  if (result.jobId === jobId) {
                    result.status = 'failed';
                    result.error = 'Ingest failed';
                  }
                }
              }
            } catch (pollError) {
              console.warn(`[Artifact Review All] Status poll failed for ${jobId}:`, pollError);
            }
          }

          console.log(`[Artifact Review All] Pending ingests: ${pendingIngests.size}`);
        }

        // Log timeout if any
        if (pendingIngests.size > 0) {
          console.warn(`[Artifact Review All] Ingest timeout - ${pendingIngests.size} jobs still pending`);
        }
      } else {
        console.log(`[Artifact Review All] Step 2: No new ingests, skipping poll phase`);
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 5: Run vault queries for each artifact-evidence pair (with smart skip)
      // ─────────────────────────────────────────────────────────────────────
      console.log(`[Artifact Review All] Step 3: Running vault queries...`);

      const queryResults: QueryResult[] = [];
      let queriesSkipped = 0;
      let queriesExecuted = 0;

      for (const artifact of validArtifacts) {
        const ingestResult = ingestResults.get(artifact.id);

        // Skip if ingest failed (not skipped - skipped means we can use existing)
        if (!ingestResult || ingestResult.status === 'failed') {
          for (const link of artifact.linkedEvidences) {
            queryResults.push({
              artifactId: artifact.id,
              evidenceId: link.evidenceId,
              evidenceCode: link.evidence.evidenceCode,
              reviewId: '',
              answer: null,
              confidence: null,
              sources: null,
              status: 'failed',
              error: 'Artifact ingest failed',
            });
          }
          continue;
        }

        // Process each linked evidence
        for (const link of artifact.linkedEvidences) {
          const evidence = link.evidence;

          // Validate tenant access
          if (!validateTenantAccess(session, evidence.customerAccountId)) {
            queryResults.push({
              artifactId: artifact.id,
              evidenceId: evidence.id,
              evidenceCode: evidence.evidenceCode,
              reviewId: '',
              answer: null,
              confidence: null,
              sources: null,
              status: 'failed',
              error: 'Access denied',
            });
            continue;
          }

          // Skip if no description
          if (!evidence.description) {
            queryResults.push({
              artifactId: artifact.id,
              evidenceId: evidence.id,
              evidenceCode: evidence.evidenceCode,
              reviewId: '',
              answer: null,
              confidence: null,
              sources: null,
              status: 'failed',
              error: 'Evidence has no description',
            });
            continue;
          }

          // Smart detection: Check if we can skip this query
          const reviewKey = `${artifact.id}:${evidence.id}`;
          const existingReview = reviewMap.get(reviewKey);

          // Skip if:
          // - Not force refresh
          // - Artifact was NOT re-ingested (skipped)
          // - Existing review exists
          if (!forceRefresh && ingestResult.status === 'skipped' && existingReview) {
            queryResults.push({
              artifactId: artifact.id,
              evidenceId: evidence.id,
              evidenceCode: evidence.evidenceCode,
              reviewId: existingReview.artifactId || '', // Use existing review
              answer: existingReview.complianceSummary || null,
              confidence: null,
              sources: null,
              status: 'skipped',
              skippedReason: 'Review already exists, no changes detected',
            });
            queriesSkipped++;
            console.log(`[Artifact Review All] Query skipped (existing): ${artifact.artifactCode} → ${evidence.evidenceCode}`);
            continue;
          }

          try {
            // Update evidence status
            await updateEvidenceAIStatus(evidence.id, { reviewStatus: 'IN_PROGRESS' });

            // Build vault query payload
            const vaultPayload = buildVaultQueryPayload(
              evidence.description,
              customerAccountId,
              'evidence'
            );

            // Log operation
            const operation = await createAIOperation({
              endpoint: AI_ENDPOINTS.EVIDENCE_VAULT_QUERY,
              method: 'POST',
              requestBody: vaultPayload,
              userId,
            });

            // Send vault query
            const vaultResponse = await aiApiClient.post(AI_ENDPOINTS.EVIDENCE_VAULT_QUERY, vaultPayload);
            const vaultData = vaultResponse.data as { answer?: string; sources?: string[]; confidence?: number };

            // Update operation
            await updateAIOperation(operation.id, {
              data: vaultData,
              status: vaultResponse.status,
              latencyMs: Date.now() - startTime,
            });

            // Check for existing review (artifact + evidence combo)
            const existingReviewRecord = await prisma.evidenceAIReview.findFirst({
              where: {
                evidenceId: evidence.id,
                artifactId: artifact.id,
              },
              orderBy: { createdAt: 'desc' },
            });

            // Prepare review data
            const reviewData = {
              status: 'completed',
              artifactId: artifact.id,
              ingestJobId: ingestResult.jobId,
              evidenceDocumentId: evidence.id,
              artifactDocumentId: artifact.id,
              runpodDocumentRef: ingestResult.documentRef,
              complianceSummary: vaultData.answer || 'No answer returned',
              complianceScore: vaultData.confidence ? vaultData.confidence * 100 : null,
              sources: vaultData.sources ? JSON.stringify(vaultData.sources) : null,
              gaps: null,
              suggestions: null,
              rawResponse: JSON.stringify({
                artifactId: artifact.id,
                artifactCode: artifact.artifactCode,
                evidenceId: evidence.id,
                evidenceCode: evidence.evidenceCode,
                question: evidence.description,
                response: vaultData,
                processedAt: new Date().toISOString(),
              }),
              aiOperationId: operation.id,
            };

            // Create or update review
            let reviewRecord;
            if (existingReviewRecord) {
              reviewRecord = await prisma.evidenceAIReview.update({
                where: { id: existingReviewRecord.id },
                data: reviewData,
              });
            } else {
              reviewRecord = await prisma.evidenceAIReview.create({
                data: {
                  evidenceId: evidence.id,
                  ...reviewData,
                },
              });
            }

            // Update evidence status
            await updateEvidenceAIStatus(evidence.id, {
              ingestStatus: 'INGESTED',
              reviewStatus: 'COMPLETED',
              reviewedAt: new Date(),
            });

            queryResults.push({
              artifactId: artifact.id,
              evidenceId: evidence.id,
              evidenceCode: evidence.evidenceCode,
              reviewId: reviewRecord.id,
              answer: vaultData.answer || null,
              confidence: vaultData.confidence || null,
              sources: vaultData.sources || null,
              status: 'success',
            });

            queriesExecuted++;
            console.log(`[Artifact Review All] Query success: ${artifact.artifactCode} → ${evidence.evidenceCode}`);
          } catch (queryError) {
            const err = queryError as { message?: string };
            console.error(`[Artifact Review All] Query failed: ${artifact.artifactCode} → ${evidence.evidenceCode}:`, err.message);

            // Update evidence status to failed
            await updateEvidenceAIStatus(evidence.id, { reviewStatus: 'FAILED' });

            queryResults.push({
              artifactId: artifact.id,
              evidenceId: evidence.id,
              evidenceCode: evidence.evidenceCode,
              reviewId: '',
              answer: null,
              confidence: null,
              sources: null,
              status: 'failed',
              error: err.message,
            });
          }
        }
      }

      console.log(`[Artifact Review All] Queries: ${queriesExecuted} executed, ${queriesSkipped} skipped`);

      // ─────────────────────────────────────────────────────────────────────
      // STEP 6: Build summary response
      // ─────────────────────────────────────────────────────────────────────
      const successfulQueries = queryResults.filter(r => r.status === 'success');
      const skippedQueries = queryResults.filter(r => r.status === 'skipped');
      const failedQueries = queryResults.filter(r => r.status === 'failed');

      const ingestSkipped = Array.from(ingestResults.values()).filter(r => r.status === 'skipped').length;
      const ingestSuccess = Array.from(ingestResults.values()).filter(r => r.status === 'success').length;
      const ingestFailed = Array.from(ingestResults.values()).filter(r => r.status === 'failed').length;

      const latencyMs = Date.now() - startTime;
      console.log(`[Artifact Review All] Completed in ${latencyMs}ms`);
      console.log(`[Artifact Review All] Ingests: ${ingestSuccess} new, ${ingestSkipped} reused, ${ingestFailed} failed`);
      console.log(`[Artifact Review All] Queries: ${successfulQueries.length} success, ${skippedQueries.length} skipped, ${failedQueries.length} failed`);

      return NextResponse.json({
        success: true,
        summary: {
          totalArtifacts: artifacts.length,
          processedArtifacts: validArtifacts.length,
          totalPairs: totalPairs,
          // Ingest stats
          ingestNew: ingestSuccess,
          ingestReused: ingestSkipped,
          ingestFailed: ingestFailed,
          // Query stats
          queriesExecuted: successfulQueries.length,
          queriesSkipped: skippedQueries.length,
          queriesFailed: failedQueries.length,
          // Legacy fields for backward compat
          successfulQueries: successfulQueries.length + skippedQueries.length,
          failedQueries: failedQueries.length,
          latencyMs,
          forceRefresh,
        },
        ingestResults: Array.from(ingestResults.values()),
        queryResults,
        fileErrors: fileErrors.length > 0 ? fileErrors : undefined,
      });
    } catch (error) {
      const err = error as { message?: string; status?: number };
      console.error('[Artifact Review All] Error:', err);

      return errorResponse(
        err.message || 'Failed to perform artifact review',
        err.status || 500
      );
    }
  },
  { resource: 'compliance.evidence', action: 'edit' }
);

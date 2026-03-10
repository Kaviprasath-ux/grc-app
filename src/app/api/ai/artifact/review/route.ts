import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth, validateTenantAccess, forbidden } from '@/lib/api-auth';
import aiApiClient from '@/lib/ai-api-client';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';
import {
  missingFieldResponse,
  notFoundResponse,
  badRequestResponse,
  errorResponse,
  buildVaultQueryPayload,
  createAIOperation,
  updateAIOperation,
} from '@/lib/ai-route-helpers';
import fs from 'fs';
import path from 'path';

interface RequestBody {
  artifactId: string;
}

interface ReviewResult {
  evidenceId: string;
  evidenceCode: string;
  question: string;
  answer: string | null;
  sources: string[] | null;
  confidence: number | null;
  reviewId: string;
  status: 'success' | 'failed';
  error?: string;
}

interface IngestResponse {
  job_id?: string;
  status?: string;
  document_id?: string;
}

interface IngestStatusResponse {
  status?: string;
  error?: string;
}

interface VaultQueryResponse {
  answer?: string;
  sources?: string[];
  confidence?: number;
  [key: string]: unknown;
}

/**
 * POST /api/ai/artifact/review
 *
 * AI Review for Artifact:
 * 1. Check for linked evidences
 * 2. For each evidence: ingest artifact file + vault query
 * 3. Store results in EvidenceAIReview
 * 4. Return aggregated results
 */
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    const startTime = Date.now();

    try {
      const body: RequestBody = await req.json();
      const { artifactId } = body;

      if (!artifactId) {
        return missingFieldResponse('artifactId');
      }

      // Fetch artifact with linked evidences
      const artifact = await prisma.artifact.findUnique({
        where: { id: artifactId },
        include: {
          linkedEvidences: {
            include: {
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
      });

      if (!artifact) {
        return notFoundResponse('Artifact');
      }

      // Check linked evidences exist
      if (!artifact.linkedEvidences || artifact.linkedEvidences.length === 0) {
        return badRequestResponse('No linked evidences found for this artifact. Link evidences before triggering AI review.');
      }

      // Validate tenant access using first evidence's customerAccountId
      const firstEvidence = artifact.linkedEvidences[0].evidence;
      if (!validateTenantAccess(session, firstEvidence.customerAccountId)) {
        return forbidden('Access denied to this artifact');
      }

      // Check artifact file exists on disk
      const filePath = path.join(process.cwd(), artifact.filePath);
      if (!fs.existsSync(filePath)) {
        return errorResponse(`Artifact file not found: ${artifact.fileName}`, 404);
      }

      console.log(`[Artifact Review] Starting review for artifact: ${artifact.artifactCode} (${artifact.fileName})`);
      console.log(`[Artifact Review] Found ${artifact.linkedEvidences.length} linked evidences`);

      // Read file once - reuse for all evidence loops
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: artifact.fileType || 'application/octet-stream' });

      const results: ReviewResult[] = [];

      // Process each linked evidence
      for (const link of artifact.linkedEvidences) {
        const evidence = link.evidence;
        const loopStartTime = Date.now();

        console.log(`[Artifact Review] Processing evidence: ${evidence.evidenceCode}`);

        // Validate evidence has description (required for vault query)
        if (!evidence.description) {
          console.log(`[Artifact Review] Skipping ${evidence.evidenceCode} - no description`);
          results.push({
            evidenceId: evidence.id,
            evidenceCode: evidence.evidenceCode,
            question: '',
            answer: null,
            sources: null,
            confidence: null,
            reviewId: '',
            status: 'failed',
            error: 'Evidence has no description (required for AI query)',
          });
          continue;
        }

        try {
          // ─────────────────────────────────────────────────────────────────
          // STEP 1: INGEST ARTIFACT FILE
          // ─────────────────────────────────────────────────────────────────
          console.log(`[Artifact Review] Step 1: Ingesting artifact for evidence ${evidence.evidenceCode}`);

          const file = new File([blob], artifact.fileName, {
            type: artifact.fileType || 'application/octet-stream',
          });

          const ingestFormData = new FormData();
          ingestFormData.append('base_id', evidence.customerAccountId);
          ingestFormData.append('doc_type', 'evidence');
          ingestFormData.append('file_code', evidence.evidenceCode);
          ingestFormData.append('document_id', artifact.id);
          ingestFormData.append('files', file);

          // Log ingest operation
          const ingestOperation = await createAIOperation({
            endpoint: AI_ENDPOINTS.INGEST,
            method: 'POST',
            requestBody: {
              base_id: evidence.customerAccountId,
              doc_type: 'evidence',
              file_code: evidence.evidenceCode,
              document_id: artifact.id,
              fileName: artifact.fileName,
            },
            userId: session.id,
          });

          let ingestJobId: string | null = null;

          try {
            const ingestResponse = await aiApiClient.post(AI_ENDPOINTS.INGEST, ingestFormData);
            const ingestData = ingestResponse.data as IngestResponse;

            ingestJobId = ingestData.job_id || ingestData.document_id || artifact.id;

            await updateAIOperation(ingestOperation.id, {
              data: ingestData,
              status: ingestResponse.status,
              latencyMs: Date.now() - loopStartTime,
            });

            console.log(`[Artifact Review] Ingest submitted, job_id: ${ingestJobId}, status: ${ingestData.status}`);

            // ─────────────────────────────────────────────────────────────────
            // STEP 2: WAIT FOR INGEST COMPLETION
            // ─────────────────────────────────────────────────────────────────
            if (ingestData.status === 'queued' || ingestData.status === 'processing') {
              const maxWaitTime = 120000; // 2 minutes
              const pollInterval = 3000; // 3 seconds
              const waitStart = Date.now();

              console.log(`[Artifact Review] Step 2: Waiting for ingest completion...`);

              while (Date.now() - waitStart < maxWaitTime) {
                await new Promise(resolve => setTimeout(resolve, pollInterval));

                try {
                  const statusResponse = await aiApiClient.get(`${AI_ENDPOINTS.INGEST_STATUS}/${ingestJobId}`);
                  const statusData = statusResponse.data as IngestStatusResponse;

                  console.log(`[Artifact Review] Ingest status: ${statusData.status}`);

                  if (statusData.status === 'completed') {
                    console.log(`[Artifact Review] Ingest completed`);
                    break;
                  } else if (statusData.status === 'failed') {
                    throw new Error(`Ingest failed: ${statusData.error || 'Unknown error'}`);
                  }
                } catch (pollError) {
                  console.warn(`[Artifact Review] Status poll error:`, pollError);
                }
              }
            }
          } catch (ingestError: unknown) {
            const err = ingestError as { message?: string };
            console.error(`[Artifact Review] Ingest failed for ${evidence.evidenceCode}:`, err.message);
            throw new Error(`Ingest failed: ${err.message}`);
          }

          // ─────────────────────────────────────────────────────────────────
          // STEP 3: VAULT QUERY
          // ─────────────────────────────────────────────────────────────────
          console.log(`[Artifact Review] Step 3: Vault query for evidence ${evidence.evidenceCode}`);
          console.log(`[Artifact Review] Question: ${evidence.description.substring(0, 100)}...`);

          // Build vault query payload using helper
          const vaultPayload = buildVaultQueryPayload(
            evidence.description,
            evidence.customerAccountId,
            'evidence'
          );

          // Log vault query operation
          const vaultOperation = await createAIOperation({
            endpoint: AI_ENDPOINTS.EVIDENCE_VAULT_QUERY,
            method: 'POST',
            requestBody: vaultPayload,
            userId: session.id,
          });

          let vaultData: VaultQueryResponse;

          try {
            const vaultResponse = await aiApiClient.post(AI_ENDPOINTS.EVIDENCE_VAULT_QUERY, vaultPayload);
            vaultData = vaultResponse.data as VaultQueryResponse;

            await updateAIOperation(vaultOperation.id, {
              data: vaultData,
              status: vaultResponse.status,
              latencyMs: Date.now() - loopStartTime,
            });

            console.log(`[Artifact Review] Vault query completed for ${evidence.evidenceCode}`);
          } catch (vaultError: unknown) {
            const err = vaultError as { message?: string };
            console.error(`[Artifact Review] Vault query failed for ${evidence.evidenceCode}:`, err.message);
            throw new Error(`Vault query failed: ${err.message}`);
          }

          // ─────────────────────────────────────────────────────────────────
          // STEP 4: SAVE TO EvidenceAIReview
          // ─────────────────────────────────────────────────────────────────
          console.log(`[Artifact Review] Step 4: Saving result for ${evidence.evidenceCode}`);

          // Check for existing review for this evidence+artifact combination
          const existingReview = await prisma.evidenceAIReview.findFirst({
            where: {
              evidenceId: evidence.id,
              artifactId: artifact.id,
            },
            orderBy: { createdAt: 'desc' },
          });

          const reviewData = {
            status: 'completed',
            artifactId: artifact.id,
            ingestJobId: ingestJobId,
            artifactDocumentId: artifact.id,
            complianceSummary: vaultData.answer || 'No answer returned from AI vault query',
            complianceScore: vaultData.confidence ? vaultData.confidence * 100 : null,
            sources: vaultData.sources ? JSON.stringify(vaultData.sources) : null,
            rawResponse: JSON.stringify({
              artifactId: artifact.id,
              artifactCode: artifact.artifactCode,
              artifactFileName: artifact.fileName,
              evidenceId: evidence.id,
              evidenceCode: evidence.evidenceCode,
              question: evidence.description,
              response: vaultData,
              processedAt: new Date().toISOString(),
            }),
            aiOperationId: vaultOperation.id,
          };

          let reviewRecord;
          if (existingReview) {
            reviewRecord = await prisma.evidenceAIReview.update({
              where: { id: existingReview.id },
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

          results.push({
            evidenceId: evidence.id,
            evidenceCode: evidence.evidenceCode,
            question: evidence.description,
            answer: vaultData.answer || null,
            sources: vaultData.sources || null,
            confidence: vaultData.confidence || null,
            reviewId: reviewRecord.id,
            status: 'success',
          });

          console.log(`[Artifact Review] Completed for ${evidence.evidenceCode} in ${Date.now() - loopStartTime}ms`);

        } catch (loopError: unknown) {
          const err = loopError as { message?: string };
          console.error(`[Artifact Review] Failed for ${evidence.evidenceCode}:`, err.message);

          results.push({
            evidenceId: evidence.id,
            evidenceCode: evidence.evidenceCode,
            question: evidence.description || '',
            answer: null,
            sources: null,
            confidence: null,
            reviewId: '',
            status: 'failed',
            error: 'Unable to process artifact review. Please try again.',
          });
        }
      }

      const successCount = results.filter(r => r.status === 'success').length;
      const failedCount = results.filter(r => r.status === 'failed').length;
      const latencyMs = Date.now() - startTime;

      console.log(`[Artifact Review] Completed for artifact ${artifact.artifactCode}: ${successCount} success, ${failedCount} failed in ${latencyMs}ms`);

      return NextResponse.json({
        success: successCount > 0,
        artifactId: artifact.id,
        artifactCode: artifact.artifactCode,
        artifactFileName: artifact.fileName,
        reviews: results,
        summary: {
          totalEvidences: results.length,
          successfulReviews: successCount,
          failedReviews: failedCount,
        },
        latencyMs,
      });

    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      console.error('[Artifact Review] Error:', err);

      return errorResponse(
        'Unable to process artifact review. Please try again.',
        err.status || 500
      );
    }
  },
  { resource: 'compliance.evidence', action: 'edit' }
);

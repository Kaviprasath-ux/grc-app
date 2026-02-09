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
  updateEvidenceAIStatus,
} from '@/lib/ai-route-helpers';
import fs from 'fs';
import path from 'path';

interface RequestBody {
  artifactId: string;
  evidenceId: string;
}

interface VaultQueryResponse {
  answer?: string;
  sources?: string[];
  confidence?: number;
  [key: string]: unknown;
}

/**
 * POST /api/ai/evidence/vault-query
 *
 * AI Review Artifacts flow:
 * 1. Accept artifactId + evidenceId
 * 2. Ingest ARTIFACT file to RunPod (grc_ingest)
 * 3. Query vault with evidence.description (grc_evidence_vault_query)
 * 4. Save result to EvidenceAIReview
 * 5. Update evidence AI status
 */
export const POST = withAuth(
  async (req: NextRequest, _context, session) => {
    const startTime = Date.now();

    try {
      const body: RequestBody = await req.json();
      const { artifactId, evidenceId } = body;

      // Validate inputs
      if (!artifactId) {
        return missingFieldResponse('artifactId');
      }
      if (!evidenceId) {
        return missingFieldResponse('evidenceId');
      }

      // Fetch artifact
      const artifact = await prisma.artifact.findUnique({
        where: { id: artifactId },
        select: {
          id: true,
          fileName: true,
          filePath: true,
          fileType: true,
          artifactCode: true,
          linkedEvidences: {
            where: { evidenceId },
            select: { evidenceId: true },
          },
        },
      });

      if (!artifact) {
        return notFoundResponse('Artifact');
      }

      // Fetch evidence
      const evidence = await prisma.evidence.findUnique({
        where: { id: evidenceId },
        select: {
          id: true,
          evidenceCode: true,
          description: true,
          customerAccountId: true,
        },
      });

      if (!evidence) {
        return notFoundResponse('Evidence');
      }

      // Validate tenant access
      if (!validateTenantAccess(session, evidence.customerAccountId)) {
        return forbidden('Access denied to this evidence');
      }

      // Validate artifact is linked to evidence
      if (!artifact.linkedEvidences || artifact.linkedEvidences.length === 0) {
        return badRequestResponse('Artifact is not linked to this evidence');
      }

      // Validate evidence has description (required for vault query)
      if (!evidence.description) {
        return badRequestResponse('Evidence description is required for AI vault query');
      }

      // Check if artifact file exists on disk
      const filePath = path.join(process.cwd(), artifact.filePath);
      if (!fs.existsSync(filePath)) {
        return errorResponse(`Artifact file not found: ${artifact.fileName}`, 404);
      }

      const userId = session.id;

      console.log(`[Vault Query] Starting review for artifact: ${artifact.fileName}`);
      console.log(`[Vault Query] Linked to evidence: ${evidence.evidenceCode}`);
      console.log(`[Vault Query] Question: ${evidence.description.substring(0, 100)}...`);

      // Update evidence status to IN_PROGRESS
      await updateEvidenceAIStatus(evidenceId, { reviewStatus: 'IN_PROGRESS' });

      // ─────────────────────────────────────────────────────────────────────
      // STEP 1: INGEST ARTIFACT FILE
      // ─────────────────────────────────────────────────────────────────────
      console.log(`[Vault Query] Step 1: Ingesting artifact file...`);

      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: artifact.fileType || 'application/octet-stream' });
      const file = new File([blob], artifact.fileName, { type: artifact.fileType || 'application/octet-stream' });

      const ingestFormData = new FormData();
      ingestFormData.append('base_id', evidence.customerAccountId);
      ingestFormData.append('doc_type', 'evidence');
      ingestFormData.append('file_code', evidence.evidenceCode);
      ingestFormData.append('document_id', artifactId);
      ingestFormData.append('files', file);

      // Log ingest operation
      const ingestOperation = await createAIOperation({
        endpoint: AI_ENDPOINTS.INGEST,
        method: 'POST',
        requestBody: {
          base_id: evidence.customerAccountId,
          doc_type: 'evidence',
          file_code: evidence.evidenceCode,
          document_id: artifactId,
          fileName: artifact.fileName,
        },
        userId,
      });

      let ingestJobId: string | null = null;
      let runpodDocumentRef: string | null = null;

      try {
        const ingestResponse = await aiApiClient.post(AI_ENDPOINTS.INGEST, ingestFormData);
        const ingestData = ingestResponse.data as { job_id?: string; document_id?: string; status?: string };

        ingestJobId = ingestData.job_id || ingestData.document_id || artifactId;
        // Capture RunPod's returned document_id (may differ from what we sent)
        runpodDocumentRef = ingestData.document_id || null;

        // Update ingest operation
        await updateAIOperation(ingestOperation.id, {
          data: ingestData,
          status: ingestResponse.status,
          latencyMs: Date.now() - startTime,
        });

        console.log(`[Vault Query] Ingest submitted, job_id: ${ingestJobId}, status: ${ingestData.status}`);

        // If async job, wait for completion
        if (ingestData.status === 'queued' || ingestData.status === 'processing') {
          const maxWaitTime = 120000; // 2 minutes max wait
          const pollInterval = 3000; // 3 seconds
          const startWait = Date.now();

          console.log(`[Vault Query] Waiting for ingest to complete...`);

          while (Date.now() - startWait < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            try {
              const statusResponse = await aiApiClient.get(`${AI_ENDPOINTS.INGEST_STATUS}/${ingestJobId}`);
              const statusData = statusResponse.data as { status?: string };

              console.log(`[Vault Query] Ingest status: ${statusData.status}`);

              if (statusData.status === 'completed') {
                console.log(`[Vault Query] Ingest completed`);
                break;
              } else if (statusData.status === 'failed') {
                throw new Error('Ingest failed');
              }
            } catch (pollError) {
              console.warn(`[Vault Query] Status poll error:`, pollError);
            }
          }
        }
      } catch (ingestError: unknown) {
        const err = ingestError as { message?: string };
        console.error(`[Vault Query] Ingest failed:`, err.message);

        await updateEvidenceAIStatus(evidenceId, { reviewStatus: 'FAILED' });

        return errorResponse(`Failed to ingest artifact: ${err.message}`, 502);
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 2: VAULT QUERY
      // ─────────────────────────────────────────────────────────────────────
      console.log(`[Vault Query] Step 2: Querying vault...`);

      // IMPORTANT: Use customerAccountId (not session userId) to match base_id from ingest
      // This ensures tenant isolation - query searches in the same namespace where docs were ingested
      const vaultQueryPayload = buildVaultQueryPayload(
        evidence.description,
        evidence.customerAccountId,
        'evidence'
      );

      // Log vault query operation
      const vaultOperation = await createAIOperation({
        endpoint: AI_ENDPOINTS.EVIDENCE_VAULT_QUERY,
        method: 'POST',
        requestBody: vaultQueryPayload,
        userId,
      });

      let vaultResponse: VaultQueryResponse;

      try {
        const response = await aiApiClient.post(AI_ENDPOINTS.EVIDENCE_VAULT_QUERY, vaultQueryPayload);
        vaultResponse = response.data as VaultQueryResponse;

        // Update vault operation
        await updateAIOperation(vaultOperation.id, {
          data: vaultResponse,
          status: response.status,
          latencyMs: Date.now() - startTime,
        });

        console.log(`[Vault Query] Vault query completed`);
      } catch (vaultError: unknown) {
        const err = vaultError as { message?: string };
        console.error(`[Vault Query] Vault query failed:`, err.message);

        await updateEvidenceAIStatus(evidenceId, { reviewStatus: 'FAILED' });

        return errorResponse(`Failed to query vault: ${err.message}`, 502);
      }

      // ─────────────────────────────────────────────────────────────────────
      // STEP 3: SAVE RESULT TO EvidenceAIReview
      // ─────────────────────────────────────────────────────────────────────
      console.log(`[Vault Query] Step 3: Saving result...`);

      // Check for existing review for this evidence
      const existingReview = await prisma.evidenceAIReview.findFirst({
        where: { evidenceId: evidence.id },
        orderBy: { createdAt: 'desc' },
      });

      const reviewData = {
        status: 'completed',

        // Explicit artifact reference
        artifactId: artifact.id,

        // Document ID tracking
        ingestJobId: ingestJobId,
        evidenceDocumentId: evidence.id,
        artifactDocumentId: artifactId,
        runpodDocumentRef: runpodDocumentRef,

        // DEPRECATED: keep for backward compatibility
        documentId: ingestJobId,

        complianceSummary: vaultResponse.answer || 'No answer returned from AI vault query',
        complianceScore: vaultResponse.confidence ? vaultResponse.confidence * 100 : null,
        gaps: null,

        // Sources stored in dedicated field (was previously in suggestions)
        sources: vaultResponse.sources ? JSON.stringify(vaultResponse.sources) : null,
        suggestions: null,

        rawResponse: JSON.stringify({
          artifactId: artifact.id,
          artifactFileName: artifact.fileName,
          evidenceId: evidence.id,
          evidenceCode: evidence.evidenceCode,
          question: evidence.description,
          response: vaultResponse,
          documentTracking: {
            sentArtifactDocId: artifactId,
            sentEvidenceDocId: evidence.id,
            returnedDocId: runpodDocumentRef,
            ingestJobId: ingestJobId,
          },
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

      // Update evidence AI status
      await updateEvidenceAIStatus(evidenceId, {
        ingestStatus: 'INGESTED',
        reviewStatus: 'COMPLETED',
        reviewedAt: new Date(),
      });

      const latencyMs = Date.now() - startTime;
      console.log(`[Vault Query] Completed in ${latencyMs}ms`);

      return NextResponse.json({
        success: true,
        artifactId: artifact.id,
        artifactFileName: artifact.fileName,
        evidenceId: evidence.id,
        evidenceCode: evidence.evidenceCode,
        reviewId: reviewRecord.id,
        review: {
          answer: vaultResponse.answer,
          sources: vaultResponse.sources,
          confidence: vaultResponse.confidence,
        },
        latencyMs,
      });

    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };
      console.error('[Vault Query] Error:', err);

      return errorResponse(
        err.message || 'Failed to perform vault query',
        err.status || 500
      );
    }
  },
  { resource: 'compliance.evidence', action: 'edit' }
);

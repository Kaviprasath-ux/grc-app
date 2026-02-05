/**
 * ai-delete-service.ts
 *
 * Shared service for deleting AI-processed documents from RunPod.
 * Calls the /api/grc_delete endpoint to clean up embeddings.
 */

import aiApiClient from '@/lib/ai-api-client';
import { aiAuditService } from '@/services/ai-audit-service';
import { prisma } from '@/lib/prisma';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';

// ============================================================================
// TYPES
// ============================================================================

export interface DeleteFromRunPodParams {
  baseId: string;      // customerAccountId for tenant isolation
  docType: string;     // 'evidence', 'Policy', 'Standard', 'Procedure'
  documentId: string;  // RunPod document ID
  fileName: string;    // File name or code
  userId?: string;     // For audit logging
}

export interface DeleteResult {
  documentId: string;
  status: 'deleted' | 'not_found' | 'failed';
  message?: string;
  error?: string;
}

// ============================================================================
// CORE DELETE FUNCTION
// ============================================================================

/**
 * Delete a single document from RunPod AI backend
 */
export async function deleteFromRunPod(params: DeleteFromRunPodParams): Promise<DeleteResult> {
  const { baseId, docType, documentId, fileName, userId } = params;
  const startTime = Date.now();

  console.log(`[AI Delete] Deleting ${docType} document: ${documentId} (base: ${baseId})`);

  try {
    // Log AIOperation (Request)
    const operation = await aiAuditService.logOperation({
      endpoint: AI_ENDPOINTS.DELETE,
      method: 'POST',
      requestBody: { base_id: baseId, doc_type: docType, document_id: documentId, file_name: fileName },
      userId,
    });

    // Build URLSearchParams for application/x-www-form-urlencoded
    const params_form = new URLSearchParams();
    params_form.append('base_id', baseId);
    params_form.append('doc_type', docType);
    params_form.append('document_id', documentId);
    params_form.append('file_name', fileName);

    // Call RunPod grc_delete
    const response = await aiApiClient.post(AI_ENDPOINTS.DELETE, params_form, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Parse RunPod response: { messages: string[], status: boolean }
    const runpodResponse = response.data as {
      messages?: string[];
      status?: boolean;
    };

    // Log AIOperation (Success)
    if (operation) {
      await prisma.aIOperation.update({
        where: { id: operation.id },
        data: {
          responseBody: JSON.stringify(response.data),
          statusCode: 200,
          latencyMs: Date.now() - startTime,
        },
      });
    }

    // Check RunPod status: true = deleted, false = not found (not an error)
    if (runpodResponse.status === true) {
      console.log(`[AI Delete] ✓ Successfully deleted document: ${documentId}`);
      return { documentId, status: 'deleted', message: runpodResponse.messages?.join(', ') };
    } else {
      console.log(`[AI Delete] ○ No embedding found for document: ${documentId} (${fileName})`);
      return { documentId, status: 'not_found', message: runpodResponse.messages?.join(', ') };
    }

  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };
    console.error(`[AI Delete] ✗ Failed to delete document ${documentId}:`, err.message);

    // Log AIOperation (Error)
    await aiAuditService.logOperation({
      endpoint: AI_ENDPOINTS.DELETE,
      method: 'POST',
      error: err.message || 'Delete failed',
      statusCode: err.status || 500,
      latencyMs: Date.now() - startTime,
      userId,
    });

    return { documentId, status: 'failed', error: err.message };
  }
}

// ============================================================================
// POLICY DELETE FUNCTIONS
// ============================================================================

/**
 * Delete all AI documents for a policy from RunPod
 */
export async function deleteAllForPolicy(policyId: string, userId?: string): Promise<DeleteResult[]> {
  console.log(`[AI Delete] Cleaning up all AI documents for policy: ${policyId}`);

  // Get policy details including customerAccountId and documentType (to match ingest)
  const policy = await prisma.policy.findUnique({
    where: { id: policyId },
    select: { code: true, name: true, customerAccountId: true, documentType: true },
  });

  if (!policy) {
    console.warn(`[AI Delete] Policy not found: ${policyId}`);
    return [];
  }

  // Use same docType as ingest (Policy, Standard, or Procedure)
  const docType = policy.documentType || 'Policy';

  // Find all PolicyAIReview records with documentIds
  const reviews = await prisma.policyAIReview.findMany({
    where: {
      policyId,
      documentId: { not: null },
    },
  });

  console.log(`[AI Delete] Found ${reviews.length} AI documents to delete for policy ${policy.code}`);

  const results: DeleteResult[] = [];

  // Delete each document from RunPod
  for (const review of reviews) {
    if (!review.documentId) continue;

    const result = await deleteFromRunPod({
      baseId: policy.customerAccountId, // Use customerAccountId to match ingest
      docType: docType, // Use actual documentType to match ingest
      documentId: review.documentId,
      fileName: policy.code || policy.name || 'policy-doc',
      userId,
    });

    results.push(result);
  }

  // Delete all PolicyAIReview records
  await prisma.policyAIReview.deleteMany({
    where: { policyId },
  });

  const deletedCount = results.filter(r => r.status === 'deleted').length;
  const notFoundCount = results.filter(r => r.status === 'not_found').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  console.log(`[AI Delete] Completed cleanup for policy ${policy.code}: ${deletedCount} deleted, ${notFoundCount} not found, ${failedCount} failed`);

  return results;
}

/**
 * Reset policy AI status after cleanup
 */
export async function resetPolicyAIStatus(policyId: string): Promise<void> {
  await prisma.policy.update({
    where: { id: policyId },
    data: {
      aiReviewStatus: 'Pending',
      aiReviewScore: 0,
      aiReviewJustification: null,
    },
  });
}

// ============================================================================
// EVIDENCE DELETE FUNCTIONS
// ============================================================================

/**
 * Delete all AI documents for an evidence from RunPod
 */
export async function deleteAllForEvidence(evidenceId: string, userId?: string): Promise<DeleteResult[]> {
  console.log(`[AI Delete] Cleaning up all AI documents for evidence: ${evidenceId}`);

  // Get evidence details including customerAccountId (to match ingest)
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: { evidenceCode: true, name: true, customerAccountId: true },
  });

  if (!evidence) {
    console.warn(`[AI Delete] Evidence not found: ${evidenceId}`);
    return [];
  }

  const results: DeleteResult[] = [];

  // Find all EvidenceAIReview records with documentIds
  const reviews = await prisma.evidenceAIReview.findMany({
    where: {
      evidenceId,
      documentId: { not: null },
    },
  });

  console.log(`[AI Delete] Found ${reviews.length} AI review documents for evidence ${evidence.evidenceCode}`);

  // Delete each review document from RunPod
  for (const review of reviews) {
    if (!review.documentId) continue;

    const result = await deleteFromRunPod({
      baseId: evidence.customerAccountId, // Use customerAccountId to match ingest
      docType: 'evidence',
      documentId: review.documentId,
      fileName: evidence.evidenceCode || evidence.name || 'evidence-doc',
      userId,
    });

    results.push(result);
  }

  // Also check EvidenceAIIngestJob for any job IDs that might need cleanup
  const ingestJobs = await prisma.evidenceAIIngestJob.findMany({
    where: { evidenceId },
  });

  console.log(`[AI Delete] Found ${ingestJobs.length} AI ingest jobs for evidence ${evidence.evidenceCode}`);

  // Delete ingest job documents from RunPod
  for (const job of ingestJobs) {
    if (!job.runpodJobId) continue;

    const result = await deleteFromRunPod({
      baseId: evidence.customerAccountId, // Use customerAccountId to match ingest
      docType: 'evidence',
      documentId: job.runpodJobId,
      fileName: evidence.evidenceCode || evidence.name || 'evidence-doc',
      userId,
    });

    results.push(result);
  }

  // Delete all EvidenceAIReview records
  await prisma.evidenceAIReview.deleteMany({
    where: { evidenceId },
  });

  // Delete all EvidenceAIIngestJob records
  await prisma.evidenceAIIngestJob.deleteMany({
    where: { evidenceId },
  });

  // Delete all EvidenceAIIngestResult records
  await prisma.evidenceAIIngestResult.deleteMany({
    where: { evidenceId },
  });

  const deletedCount = results.filter(r => r.status === 'deleted').length;
  const notFoundCount = results.filter(r => r.status === 'not_found').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  console.log(`[AI Delete] Completed cleanup for evidence ${evidence.evidenceCode}: ${deletedCount} deleted, ${notFoundCount} not found, ${failedCount} failed`);

  return results;
}

/**
 * Reset evidence AI status after cleanup
 */
export async function resetEvidenceAIStatus(evidenceId: string): Promise<void> {
  await prisma.evidence.update({
    where: { id: evidenceId },
    data: {
      aiIngestStatus: null,
      aiIngestedAt: null,
      aiReviewStatus: null,
      aiReviewedAt: null,
    },
  });
}

// ============================================================================
// EXPORT
// ============================================================================

export const aiDeleteService = {
  deleteFromRunPod,
  deleteAllForPolicy,
  resetPolicyAIStatus,
  deleteAllForEvidence,
  resetEvidenceAIStatus,
};

export default aiDeleteService;

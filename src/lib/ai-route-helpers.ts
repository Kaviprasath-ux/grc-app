/**
 * ai-route-helpers.ts
 *
 * Reusable utilities for AI API routes to eliminate DRY violations.
 * Contains common patterns for error handling, response formatting,
 * payload construction, database operations, and polling.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AI_POLLING, AI_ERRORS, calculateBackoff } from '@/lib/ai-config';
import { aiAuditService } from '@/services/ai-audit-service';

// ============================================================================
// TYPES
// ============================================================================

export interface AIErrorResponse {
  error: string;
  details?: string;
  requestId?: string;
  message?: string;
  jobId?: string;
  status?: string;
}

export interface AISuccessResponse {
  success: boolean;
  [key: string]: unknown;
}

export interface AIJobSubmitResponse {
  job_id: string;
  status: string;
  message?: string;
}

// ============================================================================
// ERROR RESPONSE BUILDERS
// ============================================================================

/**
 * Create a standardized error response
 */
export function errorResponse(
  message: string,
  status: number = 500,
  details?: {
    details?: string;
    requestId?: string;
    jobId?: string;
    currentStatus?: string;
  }
): NextResponse<AIErrorResponse> {
  const body: AIErrorResponse = { error: message };

  if (details?.details) body.details = details.details;
  if (details?.requestId) body.requestId = details.requestId;
  if (details?.jobId) body.jobId = details.jobId;
  if (details?.currentStatus) body.status = details.currentStatus;

  return NextResponse.json(body, { status });
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(): NextResponse<AIErrorResponse> {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

/**
 * Create not found response
 */
export function notFoundResponse(resource: string): NextResponse<AIErrorResponse> {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 });
}

/**
 * Create bad request response
 */
export function badRequestResponse(message: string): NextResponse<AIErrorResponse> {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Create validation error response for required fields
 */
export function missingFieldResponse(fieldName: string): NextResponse<AIErrorResponse> {
  return NextResponse.json({ error: `${fieldName} is required` }, { status: 400 });
}

// ============================================================================
// SUCCESS RESPONSE BUILDERS
// ============================================================================

/**
 * Create job submitted response
 */
export function jobSubmittedResponse(
  jobId: string,
  status: string = 'queued',
  additionalData?: Record<string, unknown>
): NextResponse<AIJobSubmitResponse> {
  return NextResponse.json({
    job_id: jobId,
    status,
    message: 'Job submitted successfully',
    ...additionalData,
  });
}

/**
 * Create job status response
 */
export function jobStatusResponse(
  jobId: string,
  status: string,
  additionalData?: Record<string, unknown>
): NextResponse {
  return NextResponse.json({
    job_id: jobId,
    status,
    ...additionalData,
  });
}

/**
 * Create review completed response
 */
export function reviewCompletedResponse(
  reviewId: string,
  result: unknown,
  additionalData?: Record<string, unknown>
): NextResponse<AISuccessResponse> {
  return NextResponse.json({
    success: true,
    reviewId,
    result,
    ...additionalData,
  });
}

// ============================================================================
// PAYLOAD BUILDERS
// ============================================================================

/**
 * Build evidence payload for AI queries (grc_evidence_query)
 *
 * IMPORTANT: customerAccountId must be used (not session userId) to match
 * the base_id used during ingest for proper tenant isolation.
 */
export function buildEvidencePayload(
  evidence: {
    id: string;
    evidenceCode: string;
    description?: string | null;
    attachments?: Array<{ fileName: string }>;
  },
  customerAccountId: string
): {
  user_id: string;
  evidence_id: string;
  doc_type: string;
  evidences: Array<{ evidence_code: string; evidence_description: string; evidence_artifact: string }>;
} {
  // Get artifact name from first attachment (required by RunPod API)
  const artifactName = evidence.attachments?.[0]?.fileName || '';

  return {
    user_id: customerAccountId,
    evidence_id: evidence.id,
    doc_type: 'evidence',
    evidences: [
      {
        evidence_code: evidence.evidenceCode,
        evidence_description: evidence.description || '',
        evidence_artifact: artifactName,
      },
    ],
  };
}

/**
 * Build vault query payload for grc_evidence_vault_query
 * Uses evidence description as the question
 */
export function buildVaultQueryPayload(
  question: string,
  userId: string,
  docType: string = 'evidence'
): {
  question: string;
  user_id: string;
  doc_type: string;
} {
  return {
    question,
    user_id: userId,
    doc_type: docType,
  };
}

/**
 * Build ingest FormData payload
 */
export function buildIngestFormData(params: {
  baseId: string;
  docType: string; // Supports: 'evidence', 'Policy', 'Standard', 'Procedure'
  fileCode: string;
  documentId: string;
  files: File | Blob | Array<File | Blob>;
}): FormData {
  const formData = new FormData();
  formData.append('base_id', params.baseId);
  formData.append('doc_type', params.docType);
  formData.append('file_code', params.fileCode);
  formData.append('document_id', params.documentId);

  // Support single file or multiple files
  if (Array.isArray(params.files)) {
    params.files.forEach(file => formData.append('files', file));
  } else {
    formData.append('files', params.files);
  }

  return formData;
}

/**
 * Build policy query payload
 */
export function buildPolicyQueryPayload(
  policy: {
    id: string;
    code: string | null;
    name: string;
    documentType?: string | null;
    policyControls: Array<{
      control: {
        controlCode: string;
        controlQuestion?: string | null;
        description?: string | null;
        name: string;
      };
    }>;
  },
  evidences: Array<{ evidence_code: string; evidence_artifact: string }>,
  userId: string,
  docType?: string // Optional override for document type
): {
  user_id: string;
  doc_type: string;
  policies: Array<{
    policy_name: string;
    policy_code: string;
    controls: Array<{ control_code: string; control_quetion: string }>;
    evidences: Array<{ evidence_code: string; evidence_artifact: string }>;
  }>;
} {
  const controls = policy.policyControls.map(pc => ({
    control_code: pc.control.controlCode,
    control_quetion: pc.control.controlQuestion || pc.control.description || pc.control.name,
  }));

  return {
    user_id: userId,
    doc_type: docType || policy.documentType || 'Policy', // Use provided docType, or policy's documentType, or default
    policies: [
      {
        policy_name: policy.name,
        policy_code: policy.code || policy.id,
        controls,
        evidences,
      },
    ],
  };
}

// ============================================================================
// AI OPERATION LOGGING
// ============================================================================

/**
 * Create AI operation record for request tracking
 */
export async function createAIOperation(params: {
  endpoint: string;
  method: string;
  requestBody: unknown;
  userId: string;
}): Promise<{ id: string }> {
  return prisma.aIOperation.create({
    data: {
      endpoint: params.endpoint,
      method: params.method,
      requestBody: JSON.stringify(params.requestBody),
      userId: params.userId,
    },
  });
}

/**
 * Update AI operation with response
 */
export async function updateAIOperation(
  operationId: string,
  response: {
    data: unknown;
    status: number;
    latencyMs: number;
  }
): Promise<void> {
  await prisma.aIOperation.update({
    where: { id: operationId },
    data: {
      responseBody: JSON.stringify(response.data),
      statusCode: response.status,
      latencyMs: response.latencyMs,
    },
  });
}

/**
 * Log AI operation error
 */
export async function logAIOperationError(params: {
  endpoint: string;
  method: string;
  error: string;
  statusCode: number;
  latencyMs: number;
  userId?: string;
}): Promise<void> {
  await prisma.aIOperation.create({
    data: {
      endpoint: params.endpoint,
      method: params.method,
      requestBody: null,
      responseBody: null,
      statusCode: params.statusCode,
      latencyMs: params.latencyMs,
      userId: params.userId,
      error: params.error,
    },
  });
}

// ============================================================================
// STATUS NORMALIZATION
// ============================================================================

/**
 * Normalize job status string for consistent comparison
 */
export function normalizeStatus(status: string | null | undefined): string {
  if (!status) return 'UNKNOWN';
  return status.toUpperCase().trim();
}

/**
 * Check if job is in terminal state (completed or failed)
 */
export function isTerminalStatus(status: string): boolean {
  const normalized = normalizeStatus(status);
  return normalized === 'COMPLETED' || normalized === 'FAILED';
}

/**
 * Check if ingest is complete (handles various status formats)
 */
export function isIngestComplete(status: string | null | undefined): boolean {
  const normalized = normalizeStatus(status);
  return normalized === 'INGESTED' || normalized === 'COMPLETED';
}

// ============================================================================
// DATABASE QUERY HELPERS
// ============================================================================

/**
 * Get evidence with attachments for AI processing
 */
export async function getEvidenceForAI(evidenceId: string) {
  return prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: {
      attachments: {
        select: {
          id: true,
          fileName: true,
        },
        orderBy: { uploadedAt: 'desc' },
      },
      evidenceControls: {
        include: {
          control: true,
        },
      },
    },
  });
}

/**
 * Get policy with controls for AI processing
 */
export async function getPolicyForAI(policyId: string) {
  return prisma.policy.findUnique({
    where: { id: policyId },
    include: {
      policyControls: {
        include: {
          control: {
            include: {
              evidenceControls: {
                include: {
                  evidence: {
                    include: {
                      linkedArtifacts: { include: { artifact: true } },
                      attachments: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Update evidence AI status
 */
export async function updateEvidenceAIStatus(
  evidenceId: string,
  status: {
    ingestStatus?: string;
    ingestedAt?: Date;
    reviewStatus?: string;
    reviewedAt?: Date;
  }
): Promise<void> {
  const data: Record<string, unknown> = {};
  if (status.ingestStatus !== undefined) data.aiIngestStatus = status.ingestStatus;
  if (status.ingestedAt !== undefined) data.aiIngestedAt = status.ingestedAt;
  if (status.reviewStatus !== undefined) data.aiReviewStatus = status.reviewStatus;
  if (status.reviewedAt !== undefined) data.aiReviewedAt = status.reviewedAt;

  if (Object.keys(data).length > 0) {
    await prisma.evidence.update({
      where: { id: evidenceId },
      data,
    });
  }
}

/**
 * Update policy AI status
 */
export async function updatePolicyAIStatus(
  policyId: string,
  status: {
    aiReviewStatus?: string;
    aiReviewScore?: number;
    aiReviewJustification?: string;
    status?: string;
  }
): Promise<void> {
  await prisma.policy.update({
    where: { id: policyId },
    data: status,
  });
}

// ============================================================================
// RESPONSE PARSING HELPERS
// ============================================================================

/**
 * Parse compliance data from AI response
 */
export function parseComplianceData(aiData: {
  policy_compliant_data?: {
    total_controls?: number;
    total_compliant_controls?: number;
    compliant_percent?: number;
  };
  controls_response?: Array<{
    control_code: string;
    status: string;
    answer: string;
    score?: number;
  }>;
}): {
  totalControls: number;
  compliantControls: number;
  compliancePercent: number;
  controlsResponse: Array<{
    control_code: string;
    status: string;
    answer: string;
    score?: number;
  }>;
} {
  const policyData = aiData.policy_compliant_data || {};
  return {
    totalControls: policyData.total_controls ?? 0,
    compliantControls: policyData.total_compliant_controls ?? 0,
    compliancePercent: policyData.compliant_percent ?? 0,
    controlsResponse: aiData.controls_response || [],
  };
}

/**
 * Build compliance summary from parsed data
 */
export function buildComplianceSummary(
  complianceData: ReturnType<typeof parseComplianceData>
): string {
  const { totalControls, compliantControls, compliancePercent, controlsResponse } = complianceData;

  const nonCompliantItems = controlsResponse.filter(
    c => c.status?.toLowerCase() !== 'compliant'
  );

  let summary = `Policy review completed. ${compliantControls}/${totalControls} controls compliant (${compliancePercent}%). `;

  if (nonCompliantItems.length > 0) {
    summary += `Non-compliant: ${nonCompliantItems.map(c => c.control_code).join(', ')}`;
  } else {
    summary += 'All controls are compliant.';
  }

  return summary;
}

/**
 * Extract gaps from AI response
 */
export function extractGaps(
  controlsResponse: Array<{
    control_code: string;
    status: string;
    answer: string;
    score?: number;
  }>
): Array<{
  control_code: string;
  status: string;
  answer: string;
  score?: number;
}> {
  return controlsResponse.filter(c => c.status?.toLowerCase() !== 'compliant');
}

/**
 * Extract recommendations from AI response
 */
export function extractRecommendations(
  controlsResponse: Array<{
    control_code: string;
    answer: string;
  }>
): Array<{
  control_code: string;
  recommendation: string;
}> {
  return controlsResponse
    .filter(c => c.answer && c.answer !== 'No relevant results found.')
    .map(c => ({
      control_code: c.control_code,
      recommendation: c.answer,
    }));
}

// ============================================================================
// AI STATUS CONSTANTS
// ============================================================================

/**
 * AI Job Status constants - used for async job tracking
 */
export const AI_JOB_STATUS = {
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type AIJobStatus = typeof AI_JOB_STATUS[keyof typeof AI_JOB_STATUS];

/**
 * AI Entity Status constants - used for evidence/policy AI fields
 */
export const AI_ENTITY_STATUS = {
  // Ingest statuses
  NOT_STARTED: 'NOT_STARTED',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  INGESTED: 'INGESTED',

  // Review statuses
  NOT_READY: 'NOT_READY',
  READY: 'ready',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',

  // Policy-specific statuses
  PENDING: 'Pending',
} as const;

export type AIEntityStatus = typeof AI_ENTITY_STATUS[keyof typeof AI_ENTITY_STATUS];

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate required fields in request body
 * Returns the first missing field name, or null if all present
 */
export function validateRequiredFields(
  body: Record<string, unknown>,
  fields: string[]
): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return field;
    }
  }
  return null;
}

/**
 * Validate and return missing field response if any required field is missing
 */
export function validateAndRespond(
  body: Record<string, unknown>,
  fields: string[]
): NextResponse<AIErrorResponse> | null {
  const missingField = validateRequiredFields(body, fields);
  if (missingField) {
    return missingFieldResponse(missingField);
  }
  return null;
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export interface AIRouteErrorContext {
  route: string;
  startTime: number;
  endpoint?: string;
  userId?: string;
}

/**
 * Standardized error handler for AI routes
 * Logs the error and returns a consistent error response
 */
export function handleAIRouteError(
  error: unknown,
  context: AIRouteErrorContext
): NextResponse<AIErrorResponse> {
  const latencyMs = Date.now() - context.startTime;
  const err = error as {
    message?: string;
    status?: number;
    rawResponse?: string;
    data?: unknown;
    requestId?: string;
  };

  console.error(`[${context.route}] Error after ${latencyMs}ms:`, err.message);

  // Build details string
  let details: string | undefined;
  if (err.rawResponse) {
    details = err.rawResponse.substring(0, 200);
  } else if (err.data) {
    details = typeof err.data === 'string' ? err.data.substring(0, 200) : JSON.stringify(err.data).substring(0, 200);
  }

  return errorResponse(
    err.message || `Failed to process ${context.route}`,
    err.status || 500,
    {
      details,
      requestId: err.requestId,
    }
  );
}

/**
 * Standardized error handler WITH audit logging
 * Use this in catch blocks to ensure consistent logging and response
 */
export async function handleAIRouteErrorWithAudit(
  error: unknown,
  context: AIRouteErrorContext & { endpoint: string; requestBody?: unknown }
): Promise<NextResponse<AIErrorResponse>> {
  const latencyMs = Date.now() - context.startTime;
  const err = error as {
    message?: string;
    status?: number;
    rawResponse?: string;
    data?: unknown;
    requestId?: string;
  };

  console.error(`[${context.route}] Error after ${latencyMs}ms:`, err.message);

  // Log to audit service
  await aiAuditService.logOperation({
    endpoint: context.endpoint,
    method: 'POST',
    requestBody: context.requestBody,
    error: err.message || 'Unknown error',
    statusCode: err.status || 500,
    latencyMs,
    userId: context.userId,
  });

  // Build details string
  let details: string | undefined;
  if (err.rawResponse) {
    details = err.rawResponse.substring(0, 200);
  } else if (err.data) {
    details = typeof err.data === 'string' ? err.data.substring(0, 200) : JSON.stringify(err.data).substring(0, 200);
  }

  return errorResponse(
    err.message || `Failed to process ${context.route}`,
    err.status || 500,
    {
      details,
      requestId: err.requestId,
    }
  );
}

// ============================================================================
// POLLING UTILITIES
// ============================================================================

export interface PollingConfig {
  /** Function to check job status - should return status string */
  checkStatus: (jobId: string) => Promise<{ status: string; error?: string; progress?: number }>;
  /** Function to get final result when completed */
  getResult?: (jobId: string) => Promise<unknown>;
  /** Callback for status updates */
  onStatusUpdate?: (status: { status: string; progress?: number }) => void;
  /** Polling interval in ms (default: AI_POLLING.DEFAULT_INTERVAL_MS) */
  intervalMs?: number;
  /** Maximum wait time in ms (default: AI_POLLING.DEFAULT_MAX_WAIT_MS) */
  maxWaitMs?: number;
  /** Use exponential backoff on errors (default: false) */
  useBackoff?: boolean;
  /** Terminal statuses that stop polling (default: ['completed', 'error', 'failed']) */
  terminalStatuses?: string[];
}

export interface PollingResult<T = unknown> {
  status: 'completed' | 'error' | 'timeout';
  result?: T;
  error?: string;
  attempts: number;
  totalTimeMs: number;
}

/**
 * Unified polling function for AI jobs
 * Handles status checking, backoff, timeout, and result fetching
 */
export async function pollJobStatus<T = unknown>(
  jobId: string,
  config: PollingConfig
): Promise<PollingResult<T>> {
  const {
    checkStatus,
    getResult,
    onStatusUpdate,
    intervalMs = AI_POLLING.DEFAULT_INTERVAL_MS,
    maxWaitMs = AI_POLLING.DEFAULT_MAX_WAIT_MS,
    useBackoff = false,
    terminalStatuses = ['completed', 'error', 'failed'],
  } = config;

  const startTime = Date.now();
  let attempts = 0;
  let currentInterval = intervalMs;
  let consecutive404s = 0;

  while (Date.now() - startTime < maxWaitMs) {
    attempts++;

    try {
      const statusResult = await checkStatus(jobId);
      consecutive404s = 0; // Reset on successful request

      // Notify callback
      if (onStatusUpdate) {
        onStatusUpdate(statusResult);
      }

      const normalizedStatus = statusResult.status?.toLowerCase();

      // Check for terminal status
      if (terminalStatuses.includes(normalizedStatus)) {
        if (normalizedStatus === 'completed') {
          // Fetch result if getResult provided
          const result = getResult ? await getResult(jobId) : undefined;
          return {
            status: 'completed',
            result: result as T,
            attempts,
            totalTimeMs: Date.now() - startTime,
          };
        } else {
          // Error or failed
          return {
            status: 'error',
            error: statusResult.error || `Job ${normalizedStatus}`,
            attempts,
            totalTimeMs: Date.now() - startTime,
          };
        }
      }

      // Reset interval on success if using backoff
      if (useBackoff) {
        currentInterval = intervalMs;
      }
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };

      if (err.status === 404) {
        consecutive404s++;
        if (consecutive404s >= AI_POLLING.MAX_CONSECUTIVE_404S) {
          return {
            status: 'error',
            error: AI_ERRORS.JOB_NOT_FOUND,
            attempts,
            totalTimeMs: Date.now() - startTime,
          };
        }
        // Increase interval on 404
        if (useBackoff) {
          currentInterval = calculateBackoff(currentInterval);
        }
      } else if (err.status === 500 || err.status === 502 || err.status === 503) {
        // Transient error - increase interval and retry
        if (useBackoff) {
          currentInterval = calculateBackoff(currentInterval);
        }
      } else {
        // Non-retryable error
        return {
          status: 'error',
          error: err.message || 'Unknown error during polling',
          attempts,
          totalTimeMs: Date.now() - startTime,
        };
      }
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, currentInterval));
  }

  // Timeout
  return {
    status: 'timeout',
    error: AI_ERRORS.POLLING_TIMEOUT,
    attempts,
    totalTimeMs: Date.now() - startTime,
  };
}

/**
 * Simple linear polling (no backoff) - for most common use cases
 */
export async function pollUntilComplete<T = unknown>(
  jobId: string,
  checkStatus: (jobId: string) => Promise<{ status: string; error?: string }>,
  getResult?: (jobId: string) => Promise<T>,
  options?: {
    intervalMs?: number;
    maxWaitMs?: number;
    onStatusUpdate?: (status: { status: string }) => void;
  }
): Promise<PollingResult<T>> {
  return pollJobStatus<T>(jobId, {
    checkStatus,
    getResult,
    onStatusUpdate: options?.onStatusUpdate,
    intervalMs: options?.intervalMs,
    maxWaitMs: options?.maxWaitMs,
    useBackoff: false,
  });
}

// ============================================================================
// PRE/POST FLIGHT LOGGING HELPERS
// ============================================================================

/**
 * Log pre-flight operation and return operation ID for post-flight update
 */
export async function logPreFlight(params: {
  endpoint: string;
  method?: string;
  requestBody?: unknown;
  userId?: string;
}): Promise<{ id: string } | null> {
  try {
    return await aiAuditService.logOperation({
      endpoint: params.endpoint,
      method: params.method || 'POST',
      requestBody: params.requestBody,
      userId: params.userId,
    });
  } catch (err) {
    console.error('[AI Audit] Failed to log pre-flight:', err);
    return null;
  }
}

/**
 * Update operation with post-flight response data
 */
export async function logPostFlight(
  operationId: string,
  response: {
    data: unknown;
    status: number;
  },
  startTime: number
): Promise<void> {
  try {
    await prisma.aIOperation.update({
      where: { id: operationId },
      data: {
        responseBody: JSON.stringify(response.data),
        statusCode: response.status,
        latencyMs: Date.now() - startTime,
      },
    });
  } catch (err) {
    console.error('[AI Audit] Failed to log post-flight:', err);
  }
}

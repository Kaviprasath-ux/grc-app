/**
 * tprm-ai-evaluation.ts
 *
 * Core async AI evaluation logic for TPRM assessments.
 * After AM submits an assessment, this service:
 * 1. Ingests uploaded documents to AI backend
 * 2. Evaluates each question based on response + AI validation config
 * 3. Stores AI results (poScore, poStatus, poAnswer, etc.) per response
 */

import prisma from '@/lib/prisma';
import { AI_ENDPOINTS } from '@/lib/ai-endpoints';
import { notificationService } from '@/lib/notification-service';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.AI_API_BASE_URL?.replace(/\/$/, '');
const API_SECRET = process.env.PYTHON_API_SECRET;

// Image file extensions that are handled via /api/image endpoint
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']);

interface EvaluationContext {
  assessmentId: string;
  customerAccountId: string;
  customerCode: string;
  vendorCode: string;
  engagementId: string;
}

interface QuestionMeta {
  id: string;
  questionText: string;
  verifaiPrompt: string | null;
  validateThroughAI: boolean;
  issue: string | null;
  risk: string | null;
  recommendation: string | null;
  severity: string | null;
  domainName: string | null;
}

interface ResponseWithQuestion {
  id: string;
  questionId: string;
  response: string | null;
  artifactUrl: string | null;
  artifactName: string | null;
  questionMeta: QuestionMeta;
}

/**
 * Check if a file is an image based on extension
 */
function isImageFile(filename: string | null): boolean {
  if (!filename) return false;
  const ext = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Normalize AI status to Title Case (e.g., "unsatisfactory" → "Unsatisfactory")
 */
function normalizeStatus(status: string): string {
  const s = status.toLowerCase().trim();
  if (s === 'satisfactory') return 'Satisfactory';
  if (s === 'unsatisfactory') return 'Unsatisfactory';
  if (s === 'not_applicable' || s === 'not applicable') return 'Not_Applicable';
  // Return as-is with first letter capitalized
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Make an authenticated request to the AI backend
 */
async function aiRequest(
  endpoint: string,
  options: RequestInit,
  ctx: EvaluationContext,
  logDetails: { domainName?: string; questionNo?: string; questionTitle?: string; documentName?: string }
): Promise<{ data: Record<string, unknown>; status: number }> {
  const url = `${BASE_URL}${endpoint}`;

  if (!BASE_URL) {
    throw new Error('AI_API_BASE_URL is not configured');
  }

  const headers: Record<string, string> = {
    'auth': API_SECRET || '',
    'accept': 'application/json',
  };

  // Don't set Content-Type for FormData
  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  // Merge custom headers
  const customHeaders = options.headers as Record<string, string> | undefined;
  if (customHeaders) {
    for (const [key, value] of Object.entries(customHeaders)) {
      if (isFormData && key.toLowerCase() === 'content-type') continue;
      headers[key] = value;
    }
  }

  const startTime = Date.now();

  console.log(`[TPRM-AI] ${options.method || 'GET'} ${endpoint}`);

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const latency = Date.now() - startTime;
  const responseText = await response.text();

  let data: Record<string, unknown> = {};
  let parseFailed = false;
  try {
    data = JSON.parse(responseText);
  } catch {
    parseFailed = true;
    console.error(`[TPRM-AI] Non-JSON response from ${endpoint}: ${responseText.substring(0, 200)}`);
  }

  console.log(`[TPRM-AI] ${endpoint} => ${response.status} (${latency}ms)`);

  if (!response.ok) {
    throw new Error(`AI API ${endpoint} returned ${response.status}: ${JSON.stringify(data)}`);
  }

  // A 200 that isn't parseable JSON used to sail past this check with
  // data={}, which the per-question handler happily read as a
  // Satisfactory verdict. Treat it as an error so evaluateResponse's
  // catch fires and the response is marked Failed.
  if (parseFailed) {
    throw new Error(`AI API ${endpoint} returned 200 with non-JSON body (${responseText.length} bytes)`);
  }

  return { data, status: response.status };
}

/**
 * Update assessment AI evaluation status
 */
async function updateAIStatus(
  assessmentId: string,
  status: string,
  error?: string
) {
  const data: Record<string, unknown> = {
    aiEvaluationStatus: status,
  };

  if (status === 'Ingesting' || status === 'Pending') {
    data.aiEvaluationStarted = new Date();
    data.aiEvaluationCompleted = null;
    data.aiEvaluationError = null;
  } else if (status === 'Completed' || status === 'Failed') {
    data.aiEvaluationCompleted = new Date();
    if (error) data.aiEvaluationError = error;
  }

  await prisma.tPRMAssessment.update({
    where: { id: assessmentId },
    data,
  });

  // On terminal failure, notify the AM (in-app + email) so they can
  // retry from their Active tab. Every failure path — bad AI verdict,
  // non-JSON body, ingest fail/timeout — funnels through this single
  // status update, so wiring the notification here covers all of them.
  // Never throws: notification failure must not break the eval run.
  if (status === 'Failed') {
    void notifyAMOfAIFailure(assessmentId, error).catch(err => {
      console.error(`[TPRM-AI] Failed to notify AM of AI failure for ${assessmentId}:`, err);
    });
  }
}

/**
 * Find the AM(s) attached to this assessment's vendor and send the
 * AI-failed notification. The notification service handles both the
 * in-app inbox row and the email through its default channels.
 *
 * Recipients: every user whose email matches one of the vendor's
 * `accountManagerEmail` entries (the onboarding form stores AMs as a
 * semicolon-separated string). Falls back silently if none can be
 * resolved — the assessment record still carries aiEvaluationStatus
 * and aiEvaluationError for the AM to discover on next login.
 */
async function notifyAMOfAIFailure(assessmentId: string, error?: string): Promise<void> {
  const assessment = await prisma.tPRMAssessment.findUnique({
    where: { id: assessmentId },
    select: {
      id: true,
      customerAccountId: true,
      assessmentCode: true,
      initiatedById: true,
      vendor: { select: { name: true, accountManagerEmail: true } },
    },
  });
  if (!assessment) return;

  const emails = String(assessment.vendor?.accountManagerEmail || '')
    .split(';')
    .map(e => e.trim())
    .filter(Boolean);
  if (emails.length === 0) return;

  const users = await prisma.user.findMany({
    where: {
      customerAccountId: assessment.customerAccountId,
      email: { in: emails, mode: 'insensitive' },
    },
    select: { id: true },
  });
  if (users.length === 0) return;

  // Actor is the BO who initiated the assessment when known, so the
  // notification's actor column reads like "Business Owner Finance
  // triggered this workflow whose AI just failed" — the AM isn't the
  // actor and would get filtered out by the sendBulk actor-guard.
  const actorId = assessment.initiatedById || users[0].id;

  await Promise.all(
    users.map(u =>
      notificationService.notifyTPRMAssessmentAIFailed({
        customerAccountId: assessment.customerAccountId,
        actorId,
        recipientId: u.id,
        assessmentId: assessment.id,
        assessmentCode: assessment.assessmentCode,
        vendorName: assessment.vendor?.name || '',
        error,
      }).catch(err => {
        console.error(`[TPRM-AI] AI-failed notification to user ${u.id} failed:`, err);
      })
    )
  );
}

/**
 * Write a line to the assessment's activity log. Never throws — a logging
 * failure must not take down an evaluation run.
 */
async function logToAssessment(ctx: EvaluationContext, logMessage: string): Promise<void> {
  await prisma.tPRMAssessmentLog.create({
    data: {
      customerAccountId: ctx.customerAccountId,
      assessmentId: ctx.assessmentId,
      logDate: new Date(),
      logMessage,
    },
  }).catch(() => {});
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// How long to wait for the backend to finish indexing before giving up and
// letting the query phase run anyway. Ingest of a handful of documents
// completes in well under a minute; the ceiling is a stuck-job backstop.
const INGEST_POLL_INTERVAL_MS = 5_000;
const INGEST_POLL_TIMEOUT_MS = 5 * 60_000;

/**
 * Ingest non-image artifacts for the assessment and WAIT for the backend to
 * finish indexing them.
 *
 * `/api/ingest` is asynchronous: the POST returns `{ job_id, status: 'queued' }`
 * as soon as the upload is accepted, and the documents only become retrievable
 * once the background job completes. This function previously returned at that
 * point, so the query phase started against an index that was still empty —
 * every question came back "No relevant results found." and was scored
 * Unsatisfactory regardless of the evidence attached.
 *
 * The per-file outcome also lives in the job *result*, not the POST response: a
 * file the backend cannot parse still yields HTTP 200 on the POST but a
 * `"Failed to process file: X. Error: ..."` message with `status: false` later.
 * Those failures are now surfaced on the assessment's activity log so the
 * assessor can tell "the evidence was never read" apart from "the evidence was
 * read and found wanting".
 */
async function ingestDocuments(
  responsesWithFiles: ResponseWithQuestion[],
  ctx: EvaluationContext
): Promise<void> {
  // Collect non-image files
  const filesToIngest: { filePath: string; fileName: string }[] = [];
  const missingFiles: string[] = [];

  for (const resp of responsesWithFiles) {
    if (!resp.artifactUrl || !resp.artifactName) continue;
    if (isImageFile(resp.artifactName)) continue; // Images handled in query phase

    // artifactUrl is a relative path like /uploads/tprm/...
    const absolutePath = path.join(process.cwd(), resp.artifactUrl.replace(/^\//, ''));
    if (fs.existsSync(absolutePath)) {
      filesToIngest.push({ filePath: absolutePath, fileName: resp.artifactName });
    } else {
      console.warn(`[TPRM-AI] File not found: ${absolutePath}`);
      missingFiles.push(resp.artifactName);
    }
  }

  // A missing upload used to be a console-only warning, which made an empty
  // index indistinguishable from a genuinely unsatisfactory answer.
  if (missingFiles.length > 0) {
    await logToAssessment(
      ctx,
      `AI evaluation: ${missingFiles.length} uploaded document(s) could not be read and were not sent for analysis — ${missingFiles.join(', ')}`
    );
  }

  if (filesToIngest.length === 0) {
    console.log('[TPRM-AI] No non-image documents to ingest, skipping ingest phase');
    return;
  }

  // Build FormData for ingest
  const formData = new FormData();
  formData.append('customer_id', ctx.customerCode);
  formData.append('vendor_id', ctx.vendorCode);
  formData.append('engagement_id', ctx.engagementId);
  formData.append('assessment_id', ctx.assessmentId);

  for (const file of filesToIngest) {
    const buffer = fs.readFileSync(file.filePath);
    const blob = new Blob([buffer]);
    formData.append('files', blob, file.fileName);
  }

  const submitted = await aiRequest(
    AI_ENDPOINTS.TPRM_INGEST,
    { method: 'POST', body: formData },
    ctx,
    { documentName: filesToIngest.map(f => f.fileName).join(', ') }
  );

  const jobId = String(submitted.data.job_id || '');
  if (!jobId) {
    // Older/synchronous backend paths do exist, but the failure mode
    // we've been burned by is: ingest returned 200 with an unusable
    // body (no job_id, no synchronous result), the code continued
    // to evaluateResponse for every question, /api/query had no
    // indexed evidence, and the backend replied with generic
    // Satisfactory verdicts. Throw so the whole run is marked Failed
    // by runAIEvaluation's catch — this routes back to the AM via
    // the Failed-AI failsafe with a Retry button rather than
    // fabricating compliance.
    throw new Error('AI ingest did not return a job_id — cannot proceed without indexed evidence');
  }

  // --- Wait for the background indexing job to finish ---
  const deadline = Date.now() + INGEST_POLL_TIMEOUT_MS;
  let jobStatus = String(submitted.data.status || 'queued').toLowerCase();

  while (jobStatus !== 'completed' && jobStatus !== 'failed' && Date.now() < deadline) {
    await sleep(INGEST_POLL_INTERVAL_MS);
    const poll = await aiRequest(
      `${AI_ENDPOINTS.TPRM_INGEST_STATUS}/${jobId}`,
      { method: 'GET' },
      ctx,
      {}
    );
    jobStatus = String(poll.data.status || '').toLowerCase();
    if (jobStatus === 'failed' && poll.data.error) {
      console.error(`[TPRM-AI] Ingest job ${jobId} failed: ${String(poll.data.error)}`);
    }
  }

  if (jobStatus !== 'completed' && jobStatus !== 'failed') {
    console.warn(`[TPRM-AI] Ingest job ${jobId} still '${jobStatus}' after timeout — aborting`);
    await logToAssessment(
      ctx,
      `AI evaluation: document indexing did not finish in time — the run has been marked Failed. Retry from the AM's inbox.`
    );
    // Same reasoning as the missing-job_id branch: continuing here
    // would send every question to /api/query with no indexed
    // evidence and land on empty-verdict-defaulted-to-Satisfactory.
    // Better to Fail the run cleanly so the failsafe routes it back.
    throw new Error(`AI ingest job ${jobId} did not complete before timeout (last status: ${jobStatus})`);
  }

  // --- Read the per-file outcome ---
  const resultRes = await aiRequest(
    `${AI_ENDPOINTS.TPRM_INGEST_RESULT}/${jobId}`,
    { method: 'GET' },
    ctx,
    {}
  );

  const result = resultRes.data.result as { messages?: unknown; status?: unknown } | undefined;
  const messages = Array.isArray(result?.messages) ? result!.messages.map(String) : [];
  const failures = messages.filter(m => /^failed to process/i.test(m.trim()));

  console.log(`[TPRM-AI] Ingest job ${jobId} ${jobStatus} — ${messages.length} message(s), ${failures.length} failure(s)`);

  if (failures.length > 0) {
    await logToAssessment(
      ctx,
      `AI evaluation: ${failures.length} document(s) could not be processed by the AI engine and were excluded from the analysis — ${failures.join(' | ')}`
    );
  } else if (result?.status === false || jobStatus === 'failed') {
    await logToAssessment(
      ctx,
      `AI evaluation: document indexing reported a failure — run marked Failed. Retry from the AM's inbox.${messages.length ? ` (${messages.join(' | ')})` : ''}`
    );
    // Whole-job ingest failure means zero indexed evidence. Same
    // reasoning as the no-job_id and timeout branches: don't fall
    // through to /api/query with an empty index — it lands on
    // empty-verdict-defaulted-to-Satisfactory.
    throw new Error(`AI ingest job ${jobId} reported failure`);
  }
}

/**
 * Copy an AI backend verdict onto the response update payload.
 *
 * `/api/image` and `/api/query` return the same shape, so both paths share this.
 * Handles the two issue/risk/recommendation encodings the backend can emit
 * (nested `issue_risk_recommendation` object, or flat keys) and falls back to
 * the master question's template values when the AI marks a question
 * unsatisfactory without supplying its own detail.
 */
function applyAIResult(
  updateData: Record<string, unknown>,
  aiData: Record<string, unknown>,
  questionMeta: QuestionMeta
): void {
  const rawStatus = String(aiData.status || '').trim();
  const rawAnswer = String(aiData.answer || aiData.response || '').trim();

  // Historically this branch defaulted a missing status to
  // 'Satisfactory' and a missing score to 0 — which meant an AI
  // backend that returned {} (or lost a network call and produced no
  // usable body) landed on the response as a compliant verdict with
  // zero confidence and no explanation. Yogesh's ticket:
  //   'AI Doesn't seem to be working... no summary, confidence level,
  //    and none of the question came out as unsat.'
  // If the backend returned an empty verdict on both fronts (no
  // status AND no answer), treat the question as an evaluation
  // failure rather than a fake pass, so the assessor sees Failed
  // instead of an unearned Satisfactory.
  if (!rawStatus && !rawAnswer) {
    console.warn(`[TPRM-AI] Empty AI verdict for question ${questionMeta.id} — marking Failed`);
    updateData.poStatus = 'Failed';
    updateData.poAnswer = 'AI evaluation returned an empty response for this question. Please retry the AI run.';
    updateData.poScore = null;
    updateData.poIssue = null;
    updateData.poRisk = null;
    updateData.poRecommendation = null;
    updateData.poSeverity = null;
    return;
  }

  updateData.poScore = typeof aiData.score === 'number'
    ? aiData.score
    : (aiData.score != null && String(aiData.score).trim() !== ''
        ? parseFloat(String(aiData.score))
        : null);
  updateData.poStatus = rawStatus ? normalizeStatus(rawStatus) : 'Failed';
  updateData.poAnswer = rawAnswer;
  if (aiData.uuid || aiData.id) updateData.aiUuid = String(aiData.uuid || aiData.id);

  if (aiData.issue_risk_recommendation && typeof aiData.issue_risk_recommendation === 'object') {
    const irr = aiData.issue_risk_recommendation as Record<string, string>;
    updateData.poIssue = irr.issue || null;
    updateData.poRisk = irr.risk || null;
    updateData.poRecommendation = irr.recommendation || null;
  } else {
    updateData.poIssue = String(aiData.issue || '') || null;
    updateData.poRisk = String(aiData.risk || '') || null;
    updateData.poRecommendation = String(aiData.recommendation || '') || null;
  }

  const rawSeverity = String(aiData.severity || '').trim();
  updateData.poSeverity = rawSeverity
    ? rawSeverity.charAt(0).toUpperCase() + rawSeverity.slice(1).toLowerCase()
    : null;

  // Fall back to the template question's issue/risk/recommendation/severity when
  // AI marks as unsatisfactory but doesn't provide specific details.
  if (String(updateData.poStatus).toLowerCase() === 'unsatisfactory') {
    if (!updateData.poIssue) updateData.poIssue = questionMeta.issue || null;
    if (!updateData.poRisk) updateData.poRisk = questionMeta.risk || null;
    if (!updateData.poRecommendation) updateData.poRecommendation = questionMeta.recommendation || null;
    if (!updateData.poSeverity) updateData.poSeverity = questionMeta.severity || null;
  }
}

/**
 * Evaluate a single question response via AI
 */
async function evaluateResponse(
  resp: ResponseWithQuestion,
  ctx: EvaluationContext
): Promise<void> {
  const { questionMeta } = resp;

  // Default update data
  const updateData: Record<string, unknown> = {
    aiEvaluatedAt: new Date(),
  };

  try {
    // Every answered question goes through the AI backend — Yes, No and NA
    // alike. Previously NA and No short-circuited without an AI call, so the
    // assessor only ever saw template boilerplate for them; now the backend
    // gets to check the vendor's claim against the ingested evidence in all
    // three cases.
    //
    // Endpoint selection is driven by the artifact type, not by the answer:
    // an image attachment goes to /api/image (which reads the image directly),
    // everything else goes to /api/query (RAG over the ingested documents,
    // scoped by assessment_id + customer_id).
    const prompt = questionMeta.verifaiPrompt || questionMeta.questionText;
    const imagePath = isImageFile(resp.artifactName) && resp.artifactUrl
      ? path.join(process.cwd(), resp.artifactUrl.replace(/^\//, ''))
      : null;
    const useImageEndpoint = !!imagePath && fs.existsSync(imagePath);

    if (imagePath && !useImageEndpoint) {
      // Attachment row exists but the file is gone — don't fail the question,
      // fall through to /api/query so it is still evaluated against the docs.
      console.warn(`[TPRM-AI] Image file not found, falling back to /api/query: ${imagePath}`);
    }

    let aiData: Record<string, unknown>;

    if (useImageEndpoint) {
      const imageFormData = new FormData();
      const buffer = fs.readFileSync(imagePath!);
      const blob = new Blob([buffer]);
      imageFormData.append('image', blob, resp.artifactName || 'image.png');

      const result = await aiRequest(
        `${AI_ENDPOINTS.TPRM_IMAGE}?prompt=${encodeURIComponent(prompt)}`,
        { method: 'POST', body: imageFormData },
        ctx,
        {
          domainName: questionMeta.domainName || undefined,
          questionTitle: questionMeta.questionText.substring(0, 100),
          documentName: resp.artifactName || undefined,
        }
      );
      aiData = result.data;
    } else {
      const result = await aiRequest(
        AI_ENDPOINTS.TPRM_QUERY,
        {
          method: 'POST',
          body: JSON.stringify({
            question: prompt,
            assessment_id: ctx.assessmentId,
            customer_id: ctx.customerCode,
          }),
        },
        ctx,
        {
          domainName: questionMeta.domainName || undefined,
          questionTitle: questionMeta.questionText.substring(0, 100),
        }
      );
      aiData = result.data;
    }

    // The backend's verdict is the verdict. The vendor's own answer no longer
    // overrides it — a "No" whose ingested evidence actually shows the control
    // in place comes back Satisfactory, and an "NA" the backend disagrees with
    // comes back Unsatisfactory. Satisfactory / Unsatisfactory / Not_Applicable
    // are all whatever /api/query (or /api/image) returned.
    applyAIResult(updateData, aiData, questionMeta);
  } catch (error) {
    console.error(`[TPRM-AI] Error evaluating question ${questionMeta.id}:`, error);
    updateData.poStatus = 'Failed';
    updateData.poAnswer = 'AI evaluation could not be completed for this question. Please re-evaluate.';

    // AI evaluation failures are not logged to activity logs
  }

  // Update the response in DB
  await prisma.tPRMAssessmentResponse.update({
    where: { id: resp.id },
    data: updateData,
  });
}

/**
 * Resolve the evaluation context for an assessment, wipe any previous AI
 * verdicts, write an audit-log line, and fire `runAIEvaluation`.
 *
 * Both entry points — the AM submit handler and the assessor's rerun-ai route —
 * go through here so a submission-triggered run is byte-for-byte the same run
 * the assessor would have got from "Re-evaluate AI". The clearing step matters
 * on the submit path too: a returned/resubmitted assessment still carries the
 * previous run's poIssue/poRisk/poRecommendation, and any question that is no
 * longer evaluated (answer changed to blank, `validateThroughAI` turned off)
 * would otherwise keep showing a verdict from the superseded answer.
 *
 * Returns false only when the assessment/customer/vendor rows can't be
 * resolved; the evaluation itself is fire-and-forget and reports through
 * `aiEvaluationStatus`.
 */
export async function startAIEvaluation(opts: {
  assessmentId: string;
  customerAccountId: string;
  logMessage: string;
}): Promise<boolean> {
  const { assessmentId, customerAccountId, logMessage } = opts;

  const assessment = await prisma.tPRMAssessment.findFirst({
    where: { id: assessmentId, customerAccountId },
    select: { vendorId: true },
  });
  if (!assessment) {
    console.warn(`[TPRM-AI] startAIEvaluation — assessment ${assessmentId} not found`);
    return false;
  }

  const [customerAccount, vendor] = await Promise.all([
    prisma.customerAccount.findUnique({
      where: { id: customerAccountId },
      select: { code: true },
    }),
    prisma.tPRMVendor.findUnique({
      where: { id: assessment.vendorId },
      select: { vendorCode: true, engagementId: true },
    }),
  ]);

  if (!customerAccount || !vendor) {
    console.warn(`[TPRM-AI] startAIEvaluation — missing customer/vendor for assessment ${assessmentId}`);
    return false;
  }

  // Clear previous AI verdicts so partially-stale results can't survive the run.
  await prisma.tPRMAssessmentResponse.updateMany({
    where: { assessmentId, customerAccountId },
    data: {
      poScore: null,
      poStatus: null,
      poAnswer: null,
      poIssue: null,
      poRisk: null,
      poRecommendation: null,
      poSeverity: null,
      aiEvaluatedAt: null,
      aiUuid: null,
    },
  });

  await prisma.tPRMAssessmentLog.create({
    data: { customerAccountId, assessmentId, logMessage, logDate: new Date() },
  }).catch(() => {});

  runAIEvaluation({
    assessmentId,
    customerAccountId,
    customerCode: customerAccount.code,
    vendorCode: vendor.vendorCode,
    engagementId: vendor.engagementId || assessmentId,
  }).catch(err => {
    console.error(`[TPRM-AI] Fire-and-forget evaluation error for ${assessmentId}:`, err);
  });

  console.log(`[TPRM-AI] startAIEvaluation — launched for ${assessmentId} (vendor=${vendor.vendorCode})`);
  return true;
}

/**
 * Main AI evaluation function - runs asynchronously after assessment submission.
 * Designed to be called fire-and-forget from the submit handler.
 */
export async function runAIEvaluation(ctx: EvaluationContext): Promise<void> {
  console.log(`[TPRM-AI] Starting AI evaluation for assessment ${ctx.assessmentId}`);

  try {
    // Mark as Pending
    await updateAIStatus(ctx.assessmentId, 'Pending');

    // Load all responses with their question metadata
    const responses = await prisma.tPRMAssessmentResponse.findMany({
      where: {
        assessmentId: ctx.assessmentId,
        customerAccountId: ctx.customerAccountId,
      },
    });

    if (responses.length === 0) {
      console.log('[TPRM-AI] No responses found, marking as Completed');
      await updateAIStatus(ctx.assessmentId, 'Completed');
      return;
    }

    // Load the assessment to get the questionnaire template
    const assessment = await prisma.tPRMAssessment.findUnique({
      where: { id: ctx.assessmentId },
      select: { questionnaireTemplate: true },
    });

    // Load question metadata from the template
    let questionMetaMap = new Map<string, QuestionMeta>();

    if (assessment?.questionnaireTemplate) {
      // `questionnaireTemplate` may hold several comma-separated template names
      // (the initiation UI joins multi-selected templates with ", "). Matching
      // with a single exact-match findFirst returned null for any multi-template
      // assessment, leaving questionMetaMap empty — so "No" answers never got
      // their Issue/Risk/Recommendation copied from the template. Split the
      // names and match every one, mirroring the GET routes.
      const templateNames = assessment.questionnaireTemplate
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      const templates = await prisma.tPRMQuestionnaireTemplate.findMany({
        where: {
          customerAccountId: ctx.customerAccountId,
          templateName: { in: templateNames },
        },
        include: {
          masterQuestionLinks: {
            include: {
              question: {
                include: {
                  domain: { select: { name: true } },
                  children: {
                    select: {
                      id: true,
                      questionText: true,
                      verifaiPrompt: true,
                      validateThroughAI: true,
                      issue: true,
                      risk: true,
                      recommendation: true,
                      severity: true,
                      domainId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      for (const template of templates) {
        for (const link of template.masterQuestionLinks) {
          const q = link.question;
          questionMetaMap.set(q.id, {
            id: q.id,
            questionText: q.questionText,
            verifaiPrompt: q.verifaiPrompt,
            validateThroughAI: q.validateThroughAI,
            issue: q.issue,
            risk: q.risk,
            recommendation: q.recommendation,
            severity: q.severity,
            domainName: q.domain?.name || null,
          });

          // Also map children
          for (const child of q.children) {
            // Child inherits parent domain if needed
            questionMetaMap.set(child.id, {
              id: child.id,
              questionText: child.questionText,
              verifaiPrompt: child.verifaiPrompt,
              validateThroughAI: child.validateThroughAI,
              issue: child.issue,
              risk: child.risk,
              recommendation: child.recommendation,
              severity: child.severity,
              domainName: q.domain?.name || null,
            });
          }
        }
      }
    }

    // Build enriched response list
    const responsesWithQuestions: ResponseWithQuestion[] = responses
      .filter(r => r.response) // Only process responses with an answer
      .map(r => ({
        id: r.id,
        questionId: r.questionId,
        response: r.response,
        artifactUrl: r.artifactUrl,
        artifactName: r.artifactName,
        questionMeta: questionMetaMap.get(r.questionId) || {
          id: r.questionId,
          questionText: '',
          verifaiPrompt: null,
          validateThroughAI: false,
          issue: null,
          risk: null,
          recommendation: null,
          severity: null,
          domainName: null,
        },
      }));

    // --- Phase 1: Ingest documents ---
    await updateAIStatus(ctx.assessmentId, 'Ingesting');

    // Deliberately NOT wrapped in try/catch. Ingest failures — no
    // job_id, poll timeout, whole-job-failed — throw from
    // ingestDocuments precisely so the outer catch below routes the
    // run to Failed. A prior version swallowed these here and let
    // Phase 2 run against an empty index, which the AI backend then
    // answered with generic Satisfactory verdicts (Yogesh's ticket).
    await ingestDocuments(responsesWithQuestions, ctx);

    // --- Phase 2: Evaluate each response ---
    await updateAIStatus(ctx.assessmentId, 'Evaluating');

    for (const resp of responsesWithQuestions) {
      await evaluateResponse(resp, ctx);
    }

    // --- Phase 3: Mark as completed ---
    await updateAIStatus(ctx.assessmentId, 'Completed');

    console.log(`[TPRM-AI] AI evaluation completed for assessment ${ctx.assessmentId}`);
  } catch (error) {
    console.error(`[TPRM-AI] Fatal error in AI evaluation for assessment ${ctx.assessmentId}:`, error);
    await updateAIStatus(
      ctx.assessmentId,
      'Failed',
      error instanceof Error ? error.message : 'Unknown error'
    ).catch(() => {});
  }
}

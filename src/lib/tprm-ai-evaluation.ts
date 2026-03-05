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
  try {
    data = JSON.parse(responseText);
  } catch {
    console.error(`[TPRM-AI] Non-JSON response from ${endpoint}: ${responseText.substring(0, 200)}`);
  }

  console.log(`[TPRM-AI] ${endpoint} => ${response.status} (${latency}ms)`);

  // Log to TPRMAssessmentLog
  await prisma.tPRMAssessmentLog.create({
    data: {
      customerAccountId: ctx.customerAccountId,
      assessmentId: ctx.assessmentId,
      domainName: logDetails.domainName || null,
      questionNo: logDetails.questionNo || null,
      questionTitle: logDetails.questionTitle || null,
      logDate: new Date(),
      logMessage: `AI API ${endpoint} => ${response.status} (${latency}ms)`,
      apiUrl: url,
      documentName: logDetails.documentName || null,
    },
  }).catch(err => console.error('[TPRM-AI] Failed to write log:', err));

  if (!response.ok) {
    throw new Error(`AI API ${endpoint} returned ${response.status}: ${JSON.stringify(data)}`);
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
}

/**
 * Ingest non-image artifacts for the assessment
 */
async function ingestDocuments(
  responsesWithFiles: ResponseWithQuestion[],
  ctx: EvaluationContext
): Promise<void> {
  // Collect non-image files
  const filesToIngest: { filePath: string; fileName: string }[] = [];

  for (const resp of responsesWithFiles) {
    if (!resp.artifactUrl || !resp.artifactName) continue;
    if (isImageFile(resp.artifactName)) continue; // Images handled in query phase

    // artifactUrl is a relative path like /uploads/tprm/...
    const absolutePath = path.join(process.cwd(), resp.artifactUrl.replace(/^\//, ''));
    if (fs.existsSync(absolutePath)) {
      filesToIngest.push({ filePath: absolutePath, fileName: resp.artifactName });
    } else {
      console.warn(`[TPRM-AI] File not found: ${absolutePath}`);
    }
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

  await aiRequest(
    AI_ENDPOINTS.TPRM_INGEST,
    { method: 'POST', body: formData },
    ctx,
    { documentName: filesToIngest.map(f => f.fileName).join(', ') }
  );
}

/**
 * Evaluate a single question response via AI
 */
async function evaluateResponse(
  resp: ResponseWithQuestion,
  ctx: EvaluationContext
): Promise<void> {
  const { questionMeta } = resp;
  const answer = resp.response?.trim() || '';

  // Default update data
  const updateData: Record<string, unknown> = {
    aiEvaluatedAt: new Date(),
  };

  try {
    // --- NA → Not applicable, no AI needed ---
    if (answer === 'NA') {
      updateData.poScore = 0;
      updateData.poStatus = 'Not_Applicable';
      updateData.poAnswer = null;
      updateData.poIssue = null;
      updateData.poRisk = null;
      updateData.poRecommendation = null;
      updateData.poSeverity = null;
    }
    // --- No → Unsatisfactory, copy template fields ---
    else if (answer === 'No') {
      updateData.poScore = 0;
      updateData.poStatus = 'Unsatisfactory';
      updateData.poAnswer = null;
      updateData.poIssue = questionMeta.issue || null;
      updateData.poRisk = questionMeta.risk || null;
      updateData.poRecommendation = questionMeta.recommendation || null;
      updateData.poSeverity = questionMeta.severity || null;
    }
    // --- Yes + no AI validation → Not applicable ---
    else if (answer === 'Yes' && !questionMeta.validateThroughAI) {
      updateData.poScore = 0;
      updateData.poStatus = 'Not_Applicable';
      updateData.poAnswer = null;
      updateData.poIssue = null;
      updateData.poRisk = null;
      updateData.poRecommendation = null;
      updateData.poSeverity = null;
    }
    // --- Yes + AI validation + image artifact → api/image ---
    else if (answer === 'Yes' && questionMeta.validateThroughAI && isImageFile(resp.artifactName)) {
      const prompt = questionMeta.verifaiPrompt || questionMeta.questionText;
      const absolutePath = path.join(process.cwd(), (resp.artifactUrl || '').replace(/^\//, ''));

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Image file not found: ${absolutePath}`);
      }

      const imageFormData = new FormData();
      const buffer = fs.readFileSync(absolutePath);
      const blob = new Blob([buffer]);
      imageFormData.append('file', blob, resp.artifactName || 'image.png');

      const endpoint = `${AI_ENDPOINTS.TPRM_IMAGE}?prompt=${encodeURIComponent(prompt)}`;

      const result = await aiRequest(
        endpoint,
        { method: 'POST', body: imageFormData },
        ctx,
        {
          domainName: questionMeta.domainName || undefined,
          questionTitle: questionMeta.questionText.substring(0, 100),
          documentName: resp.artifactName || undefined,
        }
      );

      // Parse image API response
      const aiData = result.data;
      updateData.poScore = typeof aiData.score === 'number' ? aiData.score : parseFloat(String(aiData.score || '0'));
      updateData.poStatus = String(aiData.status || 'Satisfactory');
      updateData.poAnswer = String(aiData.answer || aiData.response || '');
      updateData.poIssue = null;
      updateData.poRisk = null;
      updateData.poRecommendation = null;
      updateData.poSeverity = null;
    }
    // --- Yes + AI validation + no image → api/query ---
    else if (answer === 'Yes' && questionMeta.validateThroughAI) {
      const prompt = questionMeta.verifaiPrompt || questionMeta.questionText;

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

      // Parse query API response
      const aiData = result.data;
      updateData.poScore = typeof aiData.score === 'number' ? aiData.score : parseFloat(String(aiData.score || '0'));
      updateData.poStatus = String(aiData.status || 'Satisfactory');
      updateData.poAnswer = String(aiData.answer || aiData.response || '');
      updateData.aiUuid = String(aiData.uuid || aiData.id || '');

      // Parse combined issue_risk_recommendation if present
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

      updateData.poSeverity = String(aiData.severity || '') || null;
    }
  } catch (error) {
    console.error(`[TPRM-AI] Error evaluating question ${questionMeta.id}:`, error);
    updateData.poStatus = 'Failed';
    updateData.poAnswer = error instanceof Error ? error.message : 'AI evaluation failed';

    // Log the error
    await prisma.tPRMAssessmentLog.create({
      data: {
        customerAccountId: ctx.customerAccountId,
        assessmentId: ctx.assessmentId,
        domainName: questionMeta.domainName || null,
        questionTitle: questionMeta.questionText.substring(0, 100),
        logDate: new Date(),
        logMessage: `AI evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    }).catch(() => {});
  }

  // Update the response in DB
  await prisma.tPRMAssessmentResponse.update({
    where: { id: resp.id },
    data: updateData,
  });
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
      const template = await prisma.tPRMQuestionnaireTemplate.findFirst({
        where: {
          customerAccountId: ctx.customerAccountId,
          templateName: assessment.questionnaireTemplate,
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

      if (template) {
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

    try {
      await ingestDocuments(responsesWithQuestions, ctx);
    } catch (error) {
      console.error('[TPRM-AI] Ingest phase error (continuing with evaluation):', error);
      // Log but don't fail the whole evaluation
      await prisma.tPRMAssessmentLog.create({
        data: {
          customerAccountId: ctx.customerAccountId,
          assessmentId: ctx.assessmentId,
          logDate: new Date(),
          logMessage: `Document ingest warning: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      }).catch(() => {});
    }

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

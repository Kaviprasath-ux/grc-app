/**
 * Self-Reflective RAG — AI evaluates its own answer quality and retries if needed
 *
 * Phase 2D: After generating an answer, a separate LLM call evaluates:
 * 1. Does the answer actually address the user's question?
 * 2. Is it grounded in the provided context (no hallucination)?
 * 3. Is it complete and useful?
 *
 * If quality is below threshold, the system retries with improved strategies:
 * - Strategy 1: Reformulate the query and re-search KB
 * - Strategy 2: Expand search (lower threshold, more results)
 * - Strategy 3: Combine KB + keyword search results
 *
 * The best answer across all attempts is returned.
 */

import OpenAI from "openai";
import { searchKB, type KBSearchResult } from "./kb-embeddings";
import { generateAnswer, type GeneratedAnswer } from "./answer-generator";
import {
  searchKnowledgeBase,
  type SearchOptions,
  type ProductFlags,
} from "@/lib/help-search";
import { helpArticles } from "@/data/help-knowledge-base";

// ==================== CONFIGURATION ====================

const EVAL_MODEL = "gpt-4o-mini";
/** Minimum quality score (0-10) to accept an answer without retry */
const QUALITY_THRESHOLD = 6;
/** Maximum retry attempts */
const MAX_RETRIES = 2;

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ==================== TYPES ====================

export interface AnswerEvaluation {
  /** Quality score 0-10 */
  score: number;
  /** Whether the answer addresses the question */
  relevance: boolean;
  /** Whether the answer is grounded in context (no hallucination) */
  grounded: boolean;
  /** Whether the answer is complete */
  complete: boolean;
  /** Brief reason for the score */
  reason: string;
  /** Suggested reformulated query if score is low */
  suggestedQuery?: string;
}

export interface ReflectiveAnswer extends GeneratedAnswer {
  /** Number of attempts taken */
  attempts: number;
  /** Evaluation of the final answer */
  evaluation?: AnswerEvaluation;
  /** Strategy used for the winning answer */
  strategy: "initial" | "reformulate" | "expand" | "combine";
  /** Total tokens used across all attempts (generation + evaluation) */
  totalTokensUsed: number;
}

// ==================== EVALUATION ====================

const EVAL_SYSTEM_PROMPT = `You are an answer quality evaluator for a GRC (Governance, Risk, and Compliance) help assistant.
Evaluate the given answer against the user's question and the source context.

Score from 0-10 based on:
- Relevance (does it answer what was asked?)
- Groundedness (is it based on the context, not hallucinated?)
- Completeness (does it cover the key points?)
- Usefulness (would the user find this helpful?)

A score of 7+ means the answer is good.
A score of 4-6 means it partially answers but could be better.
A score below 4 means it doesn't address the question.

If the answer says "not available in the knowledge base" but the question IS about a GRC feature, score it low and suggest a reformulated query that might find better results.

Output ONLY valid JSON:
{
  "score": 7,
  "relevance": true,
  "grounded": true,
  "complete": true,
  "reason": "Brief explanation",
  "suggestedQuery": "optional reformulated query"
}`;

/**
 * Evaluate answer quality using a separate LLM call.
 */
async function evaluateAnswer(
  userQuery: string,
  answer: string,
  contextSummary: string
): Promise<{ evaluation: AnswerEvaluation; tokensUsed: number }> {
  const client = getOpenAI();

  const response = await client.chat.completions.create({
    model: EVAL_MODEL,
    messages: [
      { role: "system", content: EVAL_SYSTEM_PROMPT },
      {
        role: "user",
        content: `User question: "${userQuery}"

Context sources provided:
${contextSummary}

Generated answer:
"${answer.substring(0, 1500)}"

Evaluate this answer:`,
      },
    ],
    max_completion_tokens: 200,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "{}";
  const tokensUsed = response.usage?.total_tokens || 0;

  try {
    const parsed = JSON.parse(raw) as AnswerEvaluation;
    return {
      evaluation: {
        score: Math.min(10, Math.max(0, parsed.score || 0)),
        relevance: parsed.relevance ?? false,
        grounded: parsed.grounded ?? false,
        complete: parsed.complete ?? false,
        reason: parsed.reason || "No reason provided",
        suggestedQuery: parsed.suggestedQuery,
      },
      tokensUsed,
    };
  } catch {
    // If parsing fails, assume medium quality
    return {
      evaluation: {
        score: 5,
        relevance: true,
        grounded: true,
        complete: false,
        reason: "Evaluation parsing failed",
      },
      tokensUsed,
    };
  }
}

// ==================== RETRY STRATEGIES ====================

/**
 * Strategy 1: Reformulate the query using the evaluator's suggestion.
 */
async function strategyReformulate(
  suggestedQuery: string,
  userRoles: string[],
  productFlags: ProductFlags,
  conversationHistory: { role: "user" | "bot"; content: string }[],
  moduleContext: string
): Promise<{ answer: GeneratedAnswer; kbResults: KBSearchResult[] } | null> {
  const kbResults = await searchKB(suggestedQuery, userRoles, productFlags);
  if (kbResults.length === 0) return null;

  const answer = await generateAnswer(suggestedQuery, kbResults, conversationHistory, moduleContext);
  return { answer, kbResults };
}

/**
 * Strategy 2: Expand search — lower threshold, more results.
 */
async function strategyExpand(
  query: string,
  userRoles: string[],
  productFlags: ProductFlags,
  conversationHistory: { role: "user" | "bot"; content: string }[],
  moduleContext: string
): Promise<{ answer: GeneratedAnswer; kbResults: KBSearchResult[] } | null> {
  // Search with more results (top 8 instead of 5)
  const kbResults = await searchKB(query, userRoles, productFlags, 8);
  if (kbResults.length === 0) return null;

  const answer = await generateAnswer(query, kbResults, conversationHistory, moduleContext);
  return { answer, kbResults };
}

/**
 * Strategy 3: Combine KB vector results with Phase 1 keyword results.
 */
async function strategyCombine(
  query: string,
  userRoles: string[],
  productFlags: ProductFlags,
  existingKBResults: KBSearchResult[],
  conversationHistory: { role: "user" | "bot"; content: string }[],
  moduleContext: string
): Promise<{ answer: GeneratedAnswer; kbResults: KBSearchResult[] } | null> {
  // Get keyword search results
  const keywordOptions: SearchOptions = {
    roleFilter: userRoles,
    productFlags,
    maxResults: 3,
  };
  const keywordResults = searchKnowledgeBase(query, helpArticles, keywordOptions);

  if (keywordResults.length === 0 && existingKBResults.length === 0) return null;

  // Convert keyword results to KBSearchResult format and merge
  const keywordAsKB: KBSearchResult[] = keywordResults.map((r) => ({
    articleKey: r.article.id,
    module: r.article.module,
    category: r.article.category,
    question: r.article.question,
    content: `${r.article.answer}\n${r.article.steps?.join("\n") || ""}`,
    similarity: r.score / 100, // Convert 0-100 to 0-1
  }));

  // Merge and deduplicate by articleKey
  const seen = new Set(existingKBResults.map((r) => r.articleKey));
  const combined = [...existingKBResults];
  for (const kr of keywordAsKB) {
    if (!seen.has(kr.articleKey)) {
      combined.push(kr);
      seen.add(kr.articleKey);
    }
  }

  // Sort by similarity and take top 6
  combined.sort((a, b) => b.similarity - a.similarity);
  const topCombined = combined.slice(0, 6);

  if (topCombined.length === 0) return null;

  const answer = await generateAnswer(query, topCombined, conversationHistory, moduleContext);
  return { answer, kbResults: topCombined };
}

// ==================== PUBLIC API ====================

/**
 * Generate an answer with self-reflection and retry.
 *
 * Flow:
 * 1. Generate initial answer from KB results
 * 2. Evaluate answer quality
 * 3. If quality < threshold, retry with different strategies
 * 4. Return the best answer across all attempts
 */
export async function generateReflectiveAnswer(
  userQuery: string,
  kbResults: KBSearchResult[],
  userRoles: string[],
  productFlags: ProductFlags,
  conversationHistory: { role: "user" | "bot"; content: string }[] = [],
  moduleContext: string = "GRC"
): Promise<ReflectiveAnswer> {
  let totalTokensUsed = 0;
  let bestAnswer: GeneratedAnswer | null = null;
  let bestScore = -1;
  let bestStrategy: ReflectiveAnswer["strategy"] = "initial";
  let bestEval: AnswerEvaluation | undefined;
  let attempts = 0;

  // --- Attempt 1: Initial answer ---
  attempts++;
  const initialAnswer = await generateAnswer(userQuery, kbResults, conversationHistory, moduleContext);
  totalTokensUsed += initialAnswer.tokensUsed;
  bestAnswer = initialAnswer;

  // Build context summary for evaluation
  const contextSummary = kbResults
    .slice(0, 3)
    .map((r) => `- ${r.question} (${Math.round(r.similarity * 100)}% match)`)
    .join("\n");

  // Evaluate initial answer
  const { evaluation: initialEval, tokensUsed: evalTokens } = await evaluateAnswer(
    userQuery,
    initialAnswer.content,
    contextSummary
  );
  totalTokensUsed += evalTokens;
  bestScore = initialEval.score;
  bestEval = initialEval;

  console.log(
    `[SelfReflect] Attempt 1 — score: ${initialEval.score}/10, reason: ${initialEval.reason}`
  );

  // If quality is good enough, return immediately
  if (initialEval.score >= QUALITY_THRESHOLD) {
    // Override confidence with eval-based score (more accurate than similarity-based)
    let evalConfidence: "high" | "medium" | "low";
    if (initialEval.score >= 7) evalConfidence = "high";
    else if (initialEval.score >= 4) evalConfidence = "medium";
    else evalConfidence = "low";

    return {
      ...initialAnswer,
      confidence: evalConfidence,
      attempts,
      evaluation: initialEval,
      strategy: "initial",
      totalTokensUsed,
    };
  }

  // --- Retry strategies ---
  const strategies: {
    name: ReflectiveAnswer["strategy"];
    fn: () => Promise<{ answer: GeneratedAnswer; kbResults: KBSearchResult[] } | null>;
  }[] = [];

  // Strategy 1: Reformulate (if evaluator suggested a query)
  if (initialEval.suggestedQuery) {
    strategies.push({
      name: "reformulate",
      fn: () =>
        strategyReformulate(
          initialEval.suggestedQuery!,
          userRoles,
          productFlags,
          conversationHistory,
          moduleContext
        ),
    });
  }

  // Strategy 2: Expand search
  strategies.push({
    name: "expand",
    fn: () => strategyExpand(userQuery, userRoles, productFlags, conversationHistory, moduleContext),
  });

  // Strategy 3: Combine KB + keyword
  strategies.push({
    name: "combine",
    fn: () =>
      strategyCombine(userQuery, userRoles, productFlags, kbResults, conversationHistory, moduleContext),
  });

  // Try strategies until we get a good answer or exhaust retries
  for (const strategy of strategies) {
    if (attempts >= MAX_RETRIES + 1) break;

    attempts++;
    console.log(`[SelfReflect] Attempt ${attempts} — strategy: ${strategy.name}`);

    try {
      const result = await strategy.fn();
      if (!result) continue;

      totalTokensUsed += result.answer.tokensUsed;

      // Evaluate retry answer
      const retryContext = result.kbResults
        .slice(0, 3)
        .map((r) => `- ${r.question} (${Math.round(r.similarity * 100)}% match)`)
        .join("\n");

      const { evaluation: retryEval, tokensUsed: retryEvalTokens } = await evaluateAnswer(
        userQuery,
        result.answer.content,
        retryContext
      );
      totalTokensUsed += retryEvalTokens;

      console.log(
        `[SelfReflect] Attempt ${attempts} — score: ${retryEval.score}/10, reason: ${retryEval.reason}`
      );

      // Keep the best answer
      if (retryEval.score > bestScore) {
        bestAnswer = result.answer;
        bestScore = retryEval.score;
        bestStrategy = strategy.name;
        bestEval = retryEval;
      }

      // If we got a good answer, stop
      if (retryEval.score >= QUALITY_THRESHOLD) break;
    } catch (error) {
      console.error(`[SelfReflect] Strategy ${strategy.name} failed:`, error);
    }
  }

  // Update confidence based on evaluation score
  let confidence: "high" | "medium" | "low";
  if (bestScore >= 7) confidence = "high";
  else if (bestScore >= 4) confidence = "medium";
  else confidence = "low";

  return {
    ...bestAnswer!,
    confidence,
    attempts,
    evaluation: bestEval,
    strategy: bestStrategy,
    totalTokensUsed,
  };
}

/**
 * AI Chat API Route — Main chatbot endpoint
 *
 * Handles user chat messages with full guardrail pipeline:
 * Layer 1: Input validation (injection, rate limiting)
 * Layer 2: PII scanning (detect & redact)
 * Layer 3: Query routing (KB search / data query / general chat)
 * Layer 4: KB RAG search + LLM answer generation
 * Layer 5: Output sanitization
 * Layer 6: Audit logging
 */

import { NextResponse } from "next/server";
import { withAuthOnly, getCustomerAccountId, type AuthenticatedRequest } from "@/lib/api-auth";
import { validateInput } from "@/lib/chatbot/guardrails/input-guard";
import { detectPII, redactPII } from "@/lib/chatbot/guardrails/pii-scanner";
import { validateOutput } from "@/lib/chatbot/guardrails/output-guard";
import { logChatbotInteraction, checkSuspiciousActivity } from "@/lib/chatbot/guardrails/audit-logger";
import { routeQuery, getGeneralChatResponse } from "@/lib/chatbot/query-router";
import { searchKB, isKBSeeded, seedKBEmbeddings } from "@/lib/chatbot/kb-embeddings";
import { getNoResultsResponse } from "@/lib/chatbot/answer-generator";
import { processDataQuery } from "@/lib/chatbot/data-query-engine";
import { processAgentUpdate, executeConfirmedUpdate } from "@/lib/chatbot/agent-update-engine";
import { generateReflectiveAnswer } from "@/lib/chatbot/self-reflect";
import type { ProductFlags } from "@/lib/help-search";
import {
  searchKnowledgeBase,
  type SearchOptions,
} from "@/lib/help-search";
import { helpArticles } from "@/data/help-knowledge-base";

// ==================== TYPES ====================

interface ChatRequest {
  query: string;
  conversationHistory?: { role: "user" | "bot"; content: string }[];
  agentMode?: boolean;
  confirmUpdateId?: string;
}

// ==================== HELPERS ====================

const AUDIT_ROLES = new Set(["AuditHead", "Auditor", "Auditor", "Auditee"]);
const ADMIN_ROLES = new Set(["GRCAdministrator", "CustomerAdministrator"]);

function buildProductFlags(session: AuthenticatedRequest["user"]): ProductFlags {
  const roles = session.roles || [];
  const isAuditUser = roles.some((r) => AUDIT_ROLES.has(r));
  const isAuditOnly = isAuditUser && roles.length > 0 && roles.every((r) => AUDIT_ROLES.has(r));

  return {
    isGrcAdded: (session as Record<string, unknown>).isGrcAdded as boolean ?? true,
    isTprmAdded: (session as Record<string, unknown>).isTprmAdded as boolean ?? false,
    isAuditUser,
    isAuditOnly,
  };
}

// ==================== DATA QUERY SIGNAL DETECTION ====================

const DATA_SIGNALS = [
  /\b(how many|count|total|number of)\b/i,
  /\b(which|what)\b.+\b(department|most|least|highest|lowest|top)\b/i,
  /\b(list|show me|give me|tell me about|get me)\b/i,
  /\b(group by|grouped by|by department|by category|by status|by rating|by severity)\b/i,
  /\b(who is the|who are the)\b.+\b(owner|assignee|custodian|approver)\b/i,
  /\b(i want to know|i need to see|i need to know|can you tell me)\b/i,
];

const ENTITY_NAMES = /\b(risk|risks|control|controls|vendor|vendors|asset|assets|finding|findings|audit|audits|engagement|engagements|policy|policies|evidence|framework|requirement|department|departments|user|users|process|processes)\b/i;

const KB_PHRASES = [
  /\b(how do I|how to|how can I|steps to|guide me|walk me through)\b/i,
  /\b(what is a |what does .+ mean|explain what|define )\b/i,
  /\b(where can I find|where is the page|navigate to|go to )\b/i,
];

/**
 * Check if a query looks like it wants actual data (not help/guidance).
 * Used as a safety net when the LLM router misclassifies.
 */
function looksLikeDataQuery(query: string): boolean {
  // If query has explicit KB phrases, don't override
  if (KB_PHRASES.some((p) => p.test(query))) return false;
  // Must have both a data signal word AND an entity name
  return DATA_SIGNALS.some((p) => p.test(query)) && ENTITY_NAMES.test(query);
}

// ==================== ROUTE HANDLER ====================

export const POST = withAuthOnly(
  async (req, _context, session) => {
    const startTime = Date.now();
    const customerAccountId = getCustomerAccountId(session);
    const userId = session.id;
    const userRoles = session.roles || [];
    const primaryRole = userRoles[0] || "User";
    const isAdmin = userRoles.some((r) => ADMIN_ROLES.has(r));
    const productFlags = buildProductFlags(session);

    let query = "";
    let intent = "unknown";
    let blocked = false;
    let blockReason: string | undefined;
    let piiDetected = false;
    let responseContent = "";
    let tokensUsed = 0;

    try {
      const body = (await req.json()) as ChatRequest;
      query = (body.query || "").trim();
      const conversationHistory = body.conversationHistory || [];
      const agentMode = body.agentMode || false;
      const confirmUpdateId = body.confirmUpdateId;

      if (agentMode) {
        console.log("[AI Chat] Agent mode is ON");
      }

      // Handle update confirmation (user clicked "Yes" on a pending update)
      if (confirmUpdateId) {
        const updateResult = await executeConfirmedUpdate(confirmUpdateId, userId);
        responseContent = updateResult.content;
        tokensUsed = updateResult.tokensUsed;
        intent = "agent_update";

        return NextResponse.json({
          answer: responseContent,
          sources: [],
          confidence: "high",
          intent,
          isAgentUpdate: true,
          executed: updateResult.executed || false,
        });
      }

      if (!query) {
        return NextResponse.json({ error: "Query is required" }, { status: 400 });
      }

      // ═══════════════════════════════════════════════════════════════
      // LAYER 1: INPUT GUARDRAILS
      // ═══════════════════════════════════════════════════════════════
      const inputResult = validateInput(query, userId, isAdmin);
      if (!inputResult.allowed) {
        blocked = true;
        blockReason = inputResult.reason;
        intent = "blocked";
        responseContent = inputResult.userMessage || "Your request could not be processed.";

        return NextResponse.json({
          answer: responseContent,
          sources: [],
          confidence: "low",
          blocked: true,
        });
      }

      // Check suspicious activity history
      const suspiciousCheck = await checkSuspiciousActivity(userId, customerAccountId);
      if (suspiciousCheck.suspicious) {
        blocked = true;
        blockReason = "suspicious_activity";
        intent = "blocked";
        responseContent = "Your account has been temporarily restricted due to unusual activity. Please try again later or contact the administrator.";

        return NextResponse.json({
          answer: responseContent,
          sources: [],
          confidence: "low",
          blocked: true,
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // LAYER 2: PII SCANNING
      // ═══════════════════════════════════════════════════════════════
      const piiResult = detectPII(query);
      piiDetected = piiResult.found;

      if (piiResult.highSeverityCount > 0) {
        // Block high-severity PII (credit cards, SSNs, etc.)
        blocked = true;
        blockReason = "high_severity_pii";
        intent = "blocked";
        responseContent = "Your message contains sensitive personal information (like card numbers or ID numbers). Please remove it and try again. I don't need personal data to help you.";

        return NextResponse.json({
          answer: responseContent,
          sources: [],
          confidence: "low",
          blocked: true,
        });
      }

      // For medium/low PII, redact before processing but continue
      let processedQuery = query;
      if (piiDetected) {
        const { redacted } = redactPII(query);
        processedQuery = redacted;
      }

      // ═══════════════════════════════════════════════════════════════
      // LAYER 3: QUERY ROUTING
      // ═══════════════════════════════════════════════════════════════
      const routeResult = await routeQuery(processedQuery, conversationHistory, agentMode);
      intent = routeResult.intent;

      // Safety net: override kb_search → data_query when query has strong data signals
      // This catches cases where the LLM misclassifies data questions as help questions
      if (intent === "kb_search" && looksLikeDataQuery(processedQuery)) {
        console.log(`[AI Chat] OVERRIDE: kb_search → data_query for: "${processedQuery}"`);
        intent = "data_query";
      }

      console.log(`[AI Chat] Routed to: ${intent} (confidence: ${routeResult.confidence}, agentMode: ${agentMode})`);

      // --- Agent Update (when agent mode is ON) ---
      if (intent === "agent_update" && agentMode) {
        const agentResult = await processAgentUpdate(
          processedQuery, customerAccountId, userId, userRoles, conversationHistory
        );
        responseContent = agentResult.content;
        tokensUsed = agentResult.tokensUsed;

        const agentOutputResult = validateOutput(responseContent);
        responseContent = agentOutputResult.sanitizedResponse;

        return NextResponse.json({
          answer: responseContent,
          sources: [],
          confidence: "high",
          intent,
          isAgentUpdate: true,
          pendingUpdateId: agentResult.pendingUpdate?.id,
        });
      }

      // --- General Chat ---
      if (intent === "general_chat") {
        responseContent = getGeneralChatResponse(processedQuery);

        return NextResponse.json({
          answer: responseContent,
          sources: [],
          confidence: "high",
          intent,
        });
      }

      // --- Data Query (NLP-to-SQL) ---
      if (intent === "data_query") {
        const dataResult = await processDataQuery(processedQuery, customerAccountId, userRoles, conversationHistory);
        responseContent = dataResult.content;
        tokensUsed = dataResult.tokensUsed;

        // Apply output guardrails to data query responses too
        const dataOutputResult = validateOutput(responseContent);
        responseContent = dataOutputResult.sanitizedResponse;

        return NextResponse.json({
          answer: responseContent,
          sources: [],
          confidence: dataResult.confidence,
          intent,
          isDataQuery: true,
        });
      }

      // ═══════════════════════════════════════════════════════════════
      // LAYER 4: KB RAG SEARCH + ANSWER GENERATION
      // ═══════════════════════════════════════════════════════════════

      // Check if KB is seeded, if not seed it (first-time setup)
      const seeded = await isKBSeeded();
      if (!seeded) {
        console.log("[AI Chat] KB not seeded, seeding now...");
        await seedKBEmbeddings();
      }

      // Search KB with vector similarity
      const kbResults = await searchKB(processedQuery, userRoles, productFlags);

      let answer;
      if (kbResults.length === 0) {
        // Fallback: try Phase 1 keyword search
        const fallbackOptions: SearchOptions = {
          roleFilter: userRoles,
          productFlags,
          maxResults: 3,
        };
        const fallbackResults = searchKnowledgeBase(processedQuery, helpArticles, fallbackOptions);

        if (fallbackResults.length > 0) {
          // Use the top keyword result directly (Phase 1 style)
          const topArticle = fallbackResults[0].article;
          responseContent = topArticle.answer;

          return NextResponse.json({
            answer: responseContent,
            article: topArticle, // Include structured article for rich UI display
            sources: [{ articleKey: topArticle.id, question: topArticle.question, similarity: 0.5 }],
            confidence: "medium",
            intent,
            fallback: true,
          });
        }

        // No results from either search
        answer = getNoResultsResponse();
      } else {
        // Generate AI answer with self-reflection (evaluates quality, retries if needed)
        answer = await generateReflectiveAnswer(
          processedQuery,
          kbResults,
          userRoles,
          productFlags,
          conversationHistory
        );
      }

      responseContent = answer.content;
      tokensUsed = "totalTokensUsed" in answer ? (answer as { totalTokensUsed: number }).totalTokensUsed : answer.tokensUsed;

      // ═══════════════════════════════════════════════════════════════
      // LAYER 5: OUTPUT GUARDRAILS
      // ═══════════════════════════════════════════════════════════════
      const outputResult = validateOutput(responseContent);
      responseContent = outputResult.sanitizedResponse;

      return NextResponse.json({
        answer: responseContent,
        sources: answer.sources,
        confidence: answer.confidence,
        intent,
      });
    } catch (error) {
      console.error("[AI Chat] Error:", error);
      responseContent = "An error occurred while processing your question. Please try again.";

      return NextResponse.json(
        {
          answer: responseContent,
          sources: [],
          confidence: "low",
          error: true,
        },
        { status: 500 }
      );
    } finally {
      // ═══════════════════════════════════════════════════════════════
      // LAYER 6: AUDIT LOGGING (always runs, even on error)
      // ═══════════════════════════════════════════════════════════════
      const latencyMs = Date.now() - startTime;

      if (query) {
        void logChatbotInteraction({
          customerAccountId,
          userId,
          userRole: primaryRole,
          query,
          intent,
          responsePreview: responseContent,
          piiDetected,
          blocked,
          blockReason,
          guardrailFlags: { piiDetected, blocked, blockReason },
          tokensUsed,
          latencyMs,
        });
      }
    }
  }
);

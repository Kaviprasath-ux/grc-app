/**
 * Query Router — Classifies user intent using LLM-based classification
 *
 * Determines whether a query should go to:
 * - kb_search: Help/how-to questions → RAG pipeline
 * - data_query: Database questions → NLP-to-SQL pipeline
 * - general_chat: Greetings, thanks → Simple response
 *
 * Uses fast regex for obvious greetings (no API call needed),
 * then LLM (gpt-4o-mini) for all other queries to understand
 * natural language intent regardless of phrasing.
 */

import OpenAI from "openai";
import { QUERYABLE_MODELS } from "./schema-metadata";

// ==================== TYPES ====================

export type QueryIntent = "kb_search" | "data_query" | "general_chat" | "agent_update";

export interface RouterResult {
  intent: QueryIntent;
  confidence: number; // 0-1
}

// ==================== CONFIGURATION ====================

const ROUTER_MODEL = "gpt-4o-mini";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ==================== FAST-PATH: GREETING DETECTION ====================

const GENERAL_CHAT_PATTERNS = [
  /^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|howdy)\b/i,
  /^(thanks?|thank\s+you|thx|ty)\b/i,
  /^(ok|okay|sure|got\s+it|understood|alright)\b/i,
  /^(bye|goodbye|see\s+you|cheers)\b/i,
  /^(yes|no|yep|nope|yeah|nah)\b$/i,
];

// ==================== LLM INTENT CLASSIFICATION ====================

function buildRouterPrompt(agentMode: boolean = false): string {
  // Build a compact list of queryable entities for context
  const entities = QUERYABLE_MODELS.map(
    (m) => `${m.displayName} (aliases: ${m.aliases.join(", ")})`
  ).join("\n");

  return `You are an intent classifier for a GRC (Governance, Risk, and Compliance) application chatbot. Classify each user message into exactly ONE intent.

INTENTS:

1. **data_query** — The user wants to retrieve, count, list, filter, compare, or get statistics about ACTUAL DATA from the system's database.
   Examples: "how many risks do we have", "show controls for IT", "I need to see all vendors", "give me controls", "what are our open risks", "controls in finance department", "risks with high rating", "requirements under GDPR", "total assets", "which department has the most findings"

   The system can query these entities:
${entities}

   ANY question that asks about quantities, lists, statuses, or details of these entities from the database is a data_query — regardless of how the user phrases it.

2. **kb_search** — The user wants HELP, GUIDANCE, or EXPLANATIONS about how to use the GRC application. They want to learn HOW to do something, WHAT a feature is, WHERE to find something, or understand a PROCESS/WORKFLOW.
   Examples: "how do I create a risk", "what is a risk assessment", "where can I find evidence", "explain the audit workflow", "what permissions do I need", "how to upload documents", "what is the difference between risk response strategies"

3. **general_chat** — Simple greetings, thanks, acknowledgments, or non-GRC conversation.
   Examples: "hi", "thanks", "ok got it", "bye"

KEY DISTINCTION:
- "what are our risks" → data_query (wants to see actual risk records)
- "what is a risk" → kb_search (wants to understand the concept)
- "controls for IT department" → data_query (wants actual control records)
- "how to create a control" → kb_search (wants process guidance)
- "give me controls" → data_query (wants actual data)
- "I need to see IT controls" → data_query (wants actual data)
- "requirements for GDPR" → data_query (wants actual requirement records)
- "how to add a requirement" → kb_search (wants help with the process)

FOLLOW-UP CONTEXT: Conversation history may be included. If the user asks a follow-up about a previously discussed entity (e.g. "what is its status", "show me the functional grouping of this", "who owns it"), classify based on what they are asking about — if the previous context was about database records, the follow-up is also a data_query.
${agentMode ? `
4. **agent_update** — The user wants to CHANGE, UPDATE, MODIFY, or SET a field value on an existing record. Agent mode is ENABLED.
   Examples: "change the owner of risk RSK-001 to John Doe", "update the description of this control", "set priority of AUD003 to High", "change the assignee to Sarah", "update vendor contact email"

   KEY: If the user says "change", "update", "set", "modify", "assign", "reassign", or any variation that implies MODIFYING data, classify as agent_update.
` : ""}
Output ONLY valid JSON: {"intent": "data_query"|"kb_search"|"general_chat"${agentMode ? '|"agent_update"' : ""}, "confidence": 0.0-1.0}`;
}

// ==================== CONVERSATION HISTORY TYPE ====================

export interface ConversationMessage {
  role: "user" | "bot";
  content: string;
}

/**
 * Classify intent using LLM — understands any natural language phrasing.
 * Includes recent conversation history so follow-up questions are correctly classified.
 */
async function classifyWithLLM(
  query: string,
  conversationHistory: ConversationMessage[] = [],
  agentMode: boolean = false
): Promise<RouterResult> {
  const client = getOpenAI();

  // Build messages with conversation context for follow-up resolution
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: buildRouterPrompt(agentMode) },
  ];

  // Include last few conversation turns so the LLM can resolve "this", "it", etc.
  const recentHistory = conversationHistory.slice(-4);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Current query
  messages.push({ role: "user", content: query });

  const response = await client.chat.completions.create({
    model: ROUTER_MODEL,
    messages,
    max_completion_tokens: 50,
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "{}";

  try {
    const parsed = JSON.parse(raw) as { intent?: string; confidence?: number };
    const intent = parsed.intent as QueryIntent;

    // Validate intent is one of the valid options
    if (!["kb_search", "data_query", "general_chat", "agent_update"].includes(intent)) {
      return { intent: "kb_search", confidence: 0.5 };
    }

    return {
      intent,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
    };
  } catch {
    // If LLM response fails to parse, default to kb_search
    return { intent: "kb_search", confidence: 0.5 };
  }
}

// ==================== PUBLIC API ====================

/**
 * Route a user query to the appropriate pipeline.
 *
 * Fast-path: Regex for obvious greetings (no API call).
 * Everything else: LLM-based classification for accurate intent detection.
 * Conversation history is included so follow-ups like "show me its status"
 * are correctly classified as data_query (not kb_search).
 */
export async function routeQuery(
  query: string,
  conversationHistory: ConversationMessage[] = [],
  agentMode: boolean = false
): Promise<RouterResult> {
  const trimmed = query.trim();

  // Fast-path: Check general chat patterns (no API call needed for greetings)
  for (const pattern of GENERAL_CHAT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { intent: "general_chat", confidence: 0.95 };
    }
  }

  // For everything else, use LLM-based classification
  try {
    return await classifyWithLLM(trimmed, conversationHistory, agentMode);
  } catch (error) {
    console.error("[QueryRouter] LLM classification failed:", error);
    // Fallback: treat as kb_search (safest default)
    return { intent: "kb_search", confidence: 0.5 };
  }
}

/**
 * Generate a simple response for general chat messages.
 */
export function getGeneralChatResponse(query: string): string {
  const lower = query.toLowerCase().trim();

  if (/^(hi|hello|hey|greetings|howdy)/i.test(lower)) {
    return "Hello! I'm the GRC Help Assistant. I can help you with questions about risks, controls, compliance, audits, and more. What would you like to know?";
  }

  if (/^(thanks?|thank\s+you|thx|ty)/i.test(lower)) {
    return "You're welcome! Let me know if you have any other questions.";
  }

  if (/^(bye|goodbye|see\s+you)/i.test(lower)) {
    return "Goodbye! Feel free to come back anytime you need help.";
  }

  if (/^(ok|okay|sure|got\s+it|understood|alright)/i.test(lower)) {
    return "Great! Let me know if there's anything else I can help with.";
  }

  return "I'm here to help with GRC-related questions. What would you like to know?";
}

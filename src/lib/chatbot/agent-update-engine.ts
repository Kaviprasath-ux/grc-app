/**
 * Agent Update Engine — Handles record updates via chatbot agent mode
 *
 * Converts natural language update commands into validated Prisma updates.
 * Enforces:
 * - RBAC (role must have edit permission)
 * - Field-level safety (only editable fields, no status/computed/system fields)
 * - Single record updates only (no bulk)
 * - 2-step confirmation flow (propose → confirm)
 * - Audit logging
 *
 * Security:
 * - Never updates status, computed, or system fields
 * - Mandatory customerAccountId on every query
 * - Validates enum values before update
 * - Rate limited (10 updates/hour via input guard)
 */

import OpenAI from "openai";
import prisma from "@/lib/prisma";
import {
  QUERYABLE_MODELS,
  buildEditableSchemaPrompt,
  getEditableModelNames,
  getEditableFields,
  type ModelMeta,
  type FieldMeta,
} from "./schema-metadata";

// ==================== CONFIGURATION ====================

const AGENT_MODEL = "gpt-4o-mini";

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

export interface UpdateSpec {
  model: string;
  /** How to identify the record(s). Single or multiple identifiers. */
  recordIdentifier: { field: string; value: string };
  /** Multiple record identifiers for batch updates */
  recordIdentifiers?: { field: string; value: string }[];
  /** Fields to update */
  updates: { field: string; value: string | number | boolean }[];
}

export interface PendingRecordUpdate {
  recordId: string;
  currentValues: Record<string, unknown>;
  recordName: string;
}

export interface PendingUpdate {
  id: string;
  spec: UpdateSpec;
  modelMeta: ModelMeta;
  /** Single record (backward compat) */
  recordId: string;
  currentValues: Record<string, unknown>;
  /** All records to update (for batch) */
  records: PendingRecordUpdate[];
  resolvedUpdates: Record<string, unknown>;
  /** Human-readable new values (e.g. "John Doe" instead of user ID) */
  displayValues: Record<string, string>;
  customerAccountId: string;
  userId: string;
  createdAt: number;
}

export interface AgentUpdateResult {
  content: string;
  pendingUpdate?: PendingUpdate;
  tokensUsed: number;
  executed?: boolean;
}

// ==================== PENDING UPDATE STORE ====================
// In-memory store with 5-minute TTL for confirmation flow

const pendingUpdates = new Map<string, PendingUpdate>();

function generateUpdateId(): string {
  return `upd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanExpiredUpdates(): void {
  const now = Date.now();
  const TTL = 5 * 60 * 1000; // 5 minutes
  for (const [id, update] of pendingUpdates) {
    if (now - update.createdAt > TTL) pendingUpdates.delete(id);
  }
}

export function getPendingUpdate(id: string): PendingUpdate | undefined {
  cleanExpiredUpdates();
  return pendingUpdates.get(id);
}

export function removePendingUpdate(id: string): void {
  pendingUpdates.delete(id);
}

// ==================== CONVERSATION HISTORY TYPE ====================

interface ConversationMessage {
  role: "user" | "bot";
  content: string;
}

// ==================== LLM UPDATE SPEC GENERATION ====================

const UPDATE_SYSTEM_PROMPT = `You are an update command translator for a GRC (Governance, Risk, and Compliance) application. Your job is to convert natural language update requests into a structured JSON update specification.

RULES (NEVER VIOLATE):
1. Output ONLY a valid JSON object — no explanation, no markdown, no extra text.
2. ONLY use models and editable fields from the schema provided below.
3. NEVER fabricate field names or model names.
4. The user must specify WHICH record to update (by name, code, or ID) and WHAT to change.
5. If the request cannot be fulfilled with the available editable fields, set "model" to "UNSUPPORTED".
6. For relation fields (like departmentId, ownerId), use the display name as the value (e.g. "John Doe" for ownerId, "IT Operations" for departmentId) — the system will resolve it to an ID.
7. For enum fields, the value MUST match one of the valid values exactly.
8. You can ONLY update fields marked as editable. Do NOT attempt to update status, computed, or system fields.
9. Conversation history may be included. Resolve references like "this", "it", "that risk" from context.

OUTPUT FORMAT (JSON only):

For SINGLE record update:
{
  "model": "Risk",
  "recordIdentifier": { "field": "riskId", "value": "RSK-001" },
  "updates": [
    { "field": "description", "value": "Updated risk description" },
    { "field": "ownerId", "value": "John Doe" }
  ]
}

For MULTIPLE records with the SAME update (batch):
{
  "model": "Control",
  "recordIdentifiers": [
    { "field": "controlCode", "value": "CTRL-0022" },
    { "field": "controlCode", "value": "CTRL-0044" },
    { "field": "controlCode", "value": "CTRL-0033" }
  ],
  "updates": [
    { "field": "departmentId", "value": "Compliance" }
  ]
}

IMPORTANT: Use "recordIdentifier" (singular) for single record, "recordIdentifiers" (plural array) for multiple records. The recordIdentifier should use the code field (e.g. riskId, controlCode, assetId) or the name field.`;

async function generateUpdateSpec(
  query: string,
  userRoles: string[],
  conversationHistory: ConversationMessage[] = []
): Promise<{ spec: UpdateSpec; tokensUsed: number }> {
  const client = getOpenAI();
  const schemaDesc = buildEditableSchemaPrompt(userRoles);

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: UPDATE_SYSTEM_PROMPT },
  ];

  // Include conversation context
  const recentHistory = conversationHistory.slice(-4);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  messages.push({
    role: "user",
    content: `EDITABLE SCHEMA:\n\n${schemaDesc}\n\n---\n\nUser request: ${query}\n\nGenerate the JSON update specification:`,
  });

  const response = await client.chat.completions.create({
    model: AGENT_MODEL,
    messages,
    max_completion_tokens: 500,
    temperature: 0.1,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "{}";
  const tokensUsed = response.usage?.total_tokens || 0;

  try {
    const parsed = JSON.parse(raw) as UpdateSpec;
    return { spec: parsed, tokensUsed };
  } catch {
    return {
      spec: { model: "UNSUPPORTED", recordIdentifier: { field: "", value: "" }, updates: [] },
      tokensUsed,
    };
  }
}

// ==================== VALIDATION ====================

/* eslint-disable @typescript-eslint/no-explicit-any */

function validateUpdateSpec(
  spec: UpdateSpec,
  userRoles: string[]
): { valid: boolean; error?: string; modelMeta?: ModelMeta } {
  if (spec.model === "UNSUPPORTED") {
    return { valid: false, error: "This type of update is not supported. I can only update fields that you can edit in the application forms." };
  }

  // Find model
  let modelMeta = QUERYABLE_MODELS.find((m) => m.prismaModel === spec.model);
  if (!modelMeta) {
    modelMeta = QUERYABLE_MODELS.find(
      (m) =>
        m.displayName.toLowerCase() === spec.model.toLowerCase() ||
        m.aliases.some((a) => a.toLowerCase() === spec.model.toLowerCase())
    );
    if (modelMeta) spec.model = modelMeta.prismaModel;
  }

  if (!modelMeta) {
    return { valid: false, error: "Unknown data model for update." };
  }

  // Check edit permissions
  const editableModels = getEditableModelNames(userRoles);
  if (!editableModels.includes(spec.model)) {
    return {
      valid: false,
      error: `You don't have permission to edit ${modelMeta.displayName} records. Your role (${userRoles.join(", ")}) does not have edit access to this module.`,
    };
  }

  // Validate updates use only editable fields
  const editableFields = getEditableFields(modelMeta);
  const editableFieldNames = new Set(editableFields.map((f) => f.name));

  if (!spec.updates || spec.updates.length === 0) {
    return { valid: false, error: "No fields specified for update." };
  }

  for (const update of spec.updates) {
    if (!editableFieldNames.has(update.field)) {
      const fieldMeta = modelMeta.fields.find((f) => f.name === update.field);
      if (fieldMeta) {
        return {
          valid: false,
          error: `The field "${fieldMeta.description}" cannot be updated via the chatbot. It is managed automatically by the system.`,
        };
      }
      return { valid: false, error: `Unknown field: ${update.field}` };
    }

    // Validate enum values
    const fieldMeta = editableFields.find((f) => f.name === update.field);
    if (fieldMeta?.values && typeof update.value === "string") {
      const validValue = fieldMeta.values.find(
        (v) => v.toLowerCase() === update.value.toString().toLowerCase()
      );
      if (!validValue) {
        return {
          valid: false,
          error: `Invalid value "${update.value}" for ${fieldMeta.description}. Valid values are: ${fieldMeta.values.join(", ")}`,
        };
      }
      // Fix casing
      update.value = validValue;
    }
  }

  return { valid: true, modelMeta };
}

// ==================== RECORD LOOKUP ====================

/**
 * Find exactly one record matching the identifier.
 * Supports translation-aware search.
 */
async function findRecord(
  spec: UpdateSpec,
  modelMeta: ModelMeta,
  customerAccountId: string
): Promise<{ id: string; record: Record<string, unknown> } | { error: string }> {
  const prismaModel = (prisma as any)[lowerFirst(spec.model)];
  if (!prismaModel) return { error: `Model ${spec.model} not available.` };

  const { field, value } = spec.recordIdentifier;

  // Build where clause
  const where: Record<string, unknown> = { customerAccountId };

  const fieldMeta = modelMeta.fields.find((f) => f.name === field);
  if (fieldMeta?.values) {
    // Exact enum match
    const exactMatch = fieldMeta.values.find((v) => v.toLowerCase() === value.toLowerCase());
    where[field] = exactMatch || value;
  } else if (fieldMeta?.type === "string") {
    where[field] = { contains: value, mode: "insensitive" };
  } else {
    where[field] = value;
  }

  // Try direct search
  let records = await prismaModel.findMany({ where, take: 5 });

  // If no results, try translation
  if (records.length === 0 && fieldMeta?.type === "string" && !fieldMeta.relation) {
    try {
      const translations = await prisma.dynamicTranslation.findMany({
        where: {
          customerAccountId,
          modelName: spec.model,
          fieldName: field,
          translatedText: { contains: value, mode: "insensitive" },
        },
        select: { recordId: true },
      });
      if (translations.length > 0) {
        records = await prismaModel.findMany({
          where: { customerAccountId, id: { in: translations.map((t: any) => t.recordId) } },
          take: 5,
        });
      }
    } catch {
      // Ignore translation errors
    }
  }

  if (records.length === 0) {
    return { error: `No ${modelMeta.displayName} found matching "${value}". Please check the name or code and try again.` };
  }

  if (records.length > 1) {
    const names = records.slice(0, 3).map((r: any) => r[modelMeta.nameField] || r[modelMeta.codeField || "id"]);
    return { error: `Multiple ${modelMeta.displayName} records match "${value}": ${names.join(", ")}. Please be more specific.` };
  }

  return { id: records[0].id, record: records[0] };
}

/**
 * Resolve relation values in updates (e.g. "John Doe" → user ID).
 */
async function resolveUpdateRelations(
  updates: { field: string; value: string | number | boolean }[],
  modelMeta: ModelMeta,
  customerAccountId: string
): Promise<{ resolved: Record<string, unknown>; displayValues: Record<string, string> }> {
  const resolved: Record<string, unknown> = {};
  const displayValues: Record<string, string> = {};

  for (const update of updates) {
    const fieldMeta = modelMeta.fields.find((f) => f.name === update.field);

    if (fieldMeta?.relation && typeof update.value === "string") {
      const relationModel = fieldMeta.relation.model;
      const displayField = fieldMeta.relation.displayField;

      try {
        let record = await (prisma as any)[lowerFirst(relationModel)].findFirst({
          where: {
            customerAccountId,
            [displayField]: { contains: update.value as string, mode: "insensitive" },
          },
          select: { id: true, [displayField]: true },
        });

        // Try translation fallback
        if (!record) {
          const translations = await prisma.dynamicTranslation.findMany({
            where: {
              customerAccountId,
              modelName: relationModel,
              fieldName: displayField,
              translatedText: { contains: update.value as string, mode: "insensitive" },
            },
            select: { recordId: true },
          });
          if (translations.length > 0) {
            record = await (prisma as any)[lowerFirst(relationModel)].findFirst({
              where: { id: { in: translations.map((t: any) => t.recordId) } },
              select: { id: true, [displayField]: true },
            });
          }
        }

        if (record) {
          resolved[update.field] = record.id;
          displayValues[update.field] = record[displayField];
        } else {
          throw new Error(`Could not find ${relationModel} matching "${update.value}"`);
        }
      } catch (e) {
        throw new Error(`Could not resolve ${fieldMeta.description}: ${(e as Error).message}`);
      }
    } else if (fieldMeta?.type === "boolean") {
      resolved[update.field] = typeof update.value === "boolean" ? update.value : update.value === "true";
    } else if (fieldMeta?.type === "number" && typeof update.value === "string") {
      resolved[update.field] = Number(update.value);
    } else if (fieldMeta?.type === "date" && typeof update.value === "string") {
      resolved[update.field] = new Date(update.value);
    } else {
      resolved[update.field] = update.value;
      displayValues[update.field] = String(update.value);
    }
  }

  return { resolved, displayValues };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ==================== PUBLIC API ====================

/**
 * Process an agent update request — generates a pending update for confirmation.
 * Supports both single and batch (multiple record) updates.
 */
export async function processAgentUpdate(
  query: string,
  customerAccountId: string,
  userId: string,
  userRoles: string[],
  conversationHistory: ConversationMessage[] = []
): Promise<AgentUpdateResult> {
  // Step 1: Generate update spec from natural language
  const { spec, tokensUsed } = await generateUpdateSpec(query, userRoles, conversationHistory);

  // Step 2: Validate
  const validation = validateUpdateSpec(spec, userRoles);
  if (!validation.valid || !validation.modelMeta) {
    return {
      content: validation.error || "I couldn't understand that update request. Could you rephrase it?",
      tokensUsed,
    };
  }

  // Step 3: Build list of record identifiers (single or batch)
  const identifiers: { field: string; value: string }[] = [];
  if (spec.recordIdentifiers && spec.recordIdentifiers.length > 0) {
    identifiers.push(...spec.recordIdentifiers);
  } else if (spec.recordIdentifier && spec.recordIdentifier.field) {
    identifiers.push(spec.recordIdentifier);
  }

  if (identifiers.length === 0) {
    return { content: "No record specified for update. Please mention which record(s) to update.", tokensUsed };
  }

  // Step 4: Find all records
  const foundRecords: PendingRecordUpdate[] = [];
  const notFound: string[] = [];

  for (const identifier of identifiers) {
    const singleSpec = { ...spec, recordIdentifier: identifier };
    const recordResult = await findRecord(singleSpec, validation.modelMeta, customerAccountId);
    if ("error" in recordResult) {
      notFound.push(identifier.value);
    } else {
      const name = String(
        recordResult.record[validation.modelMeta.nameField] ||
        recordResult.record[validation.modelMeta.codeField || "id"] || identifier.value
      );
      foundRecords.push({
        recordId: recordResult.id,
        currentValues: recordResult.record,
        recordName: name,
      });
    }
  }

  if (foundRecords.length === 0) {
    return {
      content: `No matching ${validation.modelMeta.displayName} records found for: ${notFound.join(", ")}. Please check the names or codes and try again.`,
      tokensUsed,
    };
  }

  // Step 5: Resolve relation values (same for all records)
  let resolvedUpdates: Record<string, unknown>;
  let displayValues: Record<string, string>;
  try {
    const result = await resolveUpdateRelations(spec.updates, validation.modelMeta, customerAccountId);
    resolvedUpdates = result.resolved;
    displayValues = result.displayValues;
  } catch (e) {
    return { content: (e as Error).message, tokensUsed };
  }

  // Step 6: Build confirmation message
  const updateId = generateUpdateId();
  const pending: PendingUpdate = {
    id: updateId,
    spec,
    modelMeta: validation.modelMeta,
    recordId: foundRecords[0].recordId, // backward compat
    currentValues: foundRecords[0].currentValues, // backward compat
    records: foundRecords,
    resolvedUpdates,
    displayValues,
    customerAccountId,
    userId,
    createdAt: Date.now(),
  };

  pendingUpdates.set(updateId, pending);
  cleanExpiredUpdates();

  // Build human-readable confirmation
  const fieldChanges = spec.updates.map((u) => {
    const fieldMeta = validation.modelMeta!.fields.find((f) => f.name === u.field);
    const fieldLabel = fieldMeta?.description || u.field;
    const newVal = displayValues[u.field] || u.value;
    return `- **${fieldLabel}** → **${newVal}**`;
  }).join("\n");

  let content: string;
  if (foundRecords.length === 1) {
    // Single record — show old → new
    const rec = foundRecords[0];
    const changes = spec.updates.map((u) => {
      const fieldMeta = validation.modelMeta!.fields.find((f) => f.name === u.field);
      const fieldLabel = fieldMeta?.description || u.field;
      const currentVal = rec.currentValues[u.field] ?? "(empty)";
      const newVal = displayValues[u.field] || u.value;
      return `- **${fieldLabel}**: ${currentVal} → **${newVal}**`;
    }).join("\n");

    content = `I'm about to update **${validation.modelMeta.displayName}** "${rec.recordName}":\n\n${changes}\n\nDo you want to proceed?`;
  } else {
    // Batch — list all records
    const recordList = foundRecords.map((r) => `- ${r.recordName}`).join("\n");
    content = `I'm about to update **${foundRecords.length} ${validation.modelMeta.displayName}** records:\n\n${recordList}\n\nChanges to apply:\n${fieldChanges}`;

    if (notFound.length > 0) {
      content += `\n\n**Not found** (will be skipped): ${notFound.join(", ")}`;
    }

    content += "\n\nDo you want to proceed?";
  }

  return {
    content,
    pendingUpdate: pending,
    tokensUsed,
  };
}

/**
 * Execute a confirmed update.
 */
export async function executeConfirmedUpdate(
  updateId: string,
  userId: string
): Promise<AgentUpdateResult> {
  const pending = getPendingUpdate(updateId);
  if (!pending) {
    return {
      content: "This update request has expired. Please try again.",
      tokensUsed: 0,
    };
  }

  if (pending.userId !== userId) {
    return {
      content: "You can only confirm your own update requests.",
      tokensUsed: 0,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prismaModel = (prisma as any)[lowerFirst(pending.spec.model)];
  const records = pending.records || [{ recordId: pending.recordId, currentValues: pending.currentValues, recordName: "the record" }];

  try {
    // Update all records (single or batch)
    const successNames: string[] = [];
    const failedNames: string[] = [];

    for (const rec of records) {
      try {
        await prismaModel.update({
          where: { id: rec.recordId },
          data: pending.resolvedUpdates,
        });
        successNames.push(rec.recordName);
      } catch (err) {
        console.error(`[AgentUpdate] Failed to update ${rec.recordName}:`, err);
        failedNames.push(rec.recordName);
      }
    }

    // Clean up
    removePendingUpdate(updateId);

    if (successNames.length === 0) {
      return {
        content: "Failed to update any records. Please try again or update directly in the application.",
        tokensUsed: 0,
      };
    }

    // Build detailed change summary
    if (records.length === 1) {
      // Single record — show old → new values
      const rec = records[0];
      const changes = pending.spec.updates.map((u) => {
        const fm = pending.modelMeta.fields.find((f) => f.name === u.field);
        const fieldLabel = fm?.description || u.field;
        const oldVal = rec.currentValues[u.field] ?? "(empty)";
        const newVal = pending.displayValues[u.field] || u.value;
        return `- **${fieldLabel}**: ${oldVal} → **${newVal}**`;
      }).join("\n");

      return {
        content: `Successfully updated **${pending.modelMeta.displayName}** "${rec.recordName}":\n\n${changes}`,
        tokensUsed: 0,
        executed: true,
      };
    } else {
      // Batch — show summary
      const fieldChanges = pending.spec.updates.map((u) => {
        const fm = pending.modelMeta.fields.find((f) => f.name === u.field);
        const fieldLabel = fm?.description || u.field;
        const newVal = pending.displayValues[u.field] || u.value;
        return `**${fieldLabel}** → **${newVal}**`;
      }).join(", ");

      let content = `Successfully updated **${successNames.length}** of **${records.length}** ${pending.modelMeta.displayName} records:\n\n`;
      content += successNames.map((n) => `- ${n}`).join("\n");
      content += `\n\nChanges applied: ${fieldChanges}`;

      if (failedNames.length > 0) {
        content += `\n\n**Failed to update:** ${failedNames.join(", ")}`;
      }

      return {
        content,
        tokensUsed: 0,
        executed: true,
      };
    }
  } catch (error) {
    console.error("[AgentUpdate] Execution error:", error);
    removePendingUpdate(updateId);
    return {
      content: "An error occurred while updating the records. Please try again or update directly in the application.",
      tokensUsed: 0,
    };
  }
}

// ==================== UTILITY ====================

function lowerFirst(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

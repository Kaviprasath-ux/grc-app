/**
 * Chatbot Audit Logger — Logs all chatbot interactions for compliance & security monitoring
 *
 * Layer 5: Every interaction is logged with PII redaction.
 * Supports suspicious activity detection and alerting.
 */

import prisma from "@/lib/prisma";
import { redactPII } from "./pii-scanner";

// ==================== TYPES ====================

export interface ChatbotLogEntry {
  customerAccountId: string;
  userId: string;
  userRole: string;
  query: string;
  intent: string;
  responsePreview?: string;
  piiDetected: boolean;
  blocked: boolean;
  blockReason?: string;
  guardrailFlags?: Record<string, unknown>;
  tokensUsed?: number;
  latencyMs?: number;
}

// ==================== PUBLIC API ====================

/**
 * Log a chatbot interaction. PII is automatically redacted from the query.
 */
export async function logChatbotInteraction(entry: ChatbotLogEntry): Promise<void> {
  try {
    // Redact PII from the query before storing
    const { redacted: queryRedacted } = redactPII(entry.query);

    // Redact PII from response preview
    let responseRedacted = entry.responsePreview || "";
    if (responseRedacted) {
      const { redacted } = redactPII(responseRedacted);
      responseRedacted = redacted.substring(0, 300); // Limit preview length
    }

    await prisma.chatbotAuditLog.create({
      data: {
        customerAccountId: entry.customerAccountId,
        userId: entry.userId,
        userRole: entry.userRole,
        query: entry.query.substring(0, 2000), // Limit stored query length
        queryRedacted,
        intent: entry.intent,
        guardrailFlags: entry.guardrailFlags ? JSON.parse(JSON.stringify(entry.guardrailFlags)) : undefined,
        responsePreview: responseRedacted || null,
        piiDetected: entry.piiDetected,
        blocked: entry.blocked,
        blockReason: entry.blockReason || null,
        tokensUsed: entry.tokensUsed || 0,
        latencyMs: entry.latencyMs || 0,
      },
    });
  } catch (error) {
    // Never let logging failures break the chatbot
    console.error("[ChatbotAudit] Failed to log interaction:", error);
  }
}

/**
 * Check if a user has suspicious activity patterns.
 * Returns true if the user should be temporarily blocked.
 */
export async function checkSuspiciousActivity(
  userId: string,
  customerAccountId: string
): Promise<{ suspicious: boolean; reason?: string }> {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Count blocked attempts in the last hour
    const blockedCount = await prisma.chatbotAuditLog.count({
      where: {
        userId,
        customerAccountId,
        createdAt: { gte: oneHourAgo },
        blocked: true,
      },
    });

    if (blockedCount >= 10) {
      return {
        suspicious: true,
        reason: `User had ${blockedCount} blocked attempts in the last hour`,
      };
    }

    // Count PII detections in the last hour
    const piiCount = await prisma.chatbotAuditLog.count({
      where: {
        userId,
        customerAccountId,
        createdAt: { gte: oneHourAgo },
        piiDetected: true,
      },
    });

    if (piiCount >= 5) {
      return {
        suspicious: true,
        reason: `User submitted PII ${piiCount} times in the last hour`,
      };
    }

    return { suspicious: false };
  } catch (error) {
    console.error("[ChatbotAudit] Failed to check suspicious activity:", error);
    return { suspicious: false }; // Fail open — don't block on logging errors
  }
}

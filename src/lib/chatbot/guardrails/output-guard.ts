/**
 * Output Guardrails — Validate and sanitize LLM responses before showing to user
 *
 * Layer 4: Final safety check on AI-generated content.
 */

import { sanitizeOutput } from "./pii-scanner";

// ==================== BLOCKED OUTPUT PATTERNS ====================

const BLOCKED_OUTPUT_PATTERNS = [
  // Raw credentials or secrets
  /(?:password|secret|token|api[_-]?key)\s*[:=]\s*[^\s\[\]]{8,}/gi,
  // Database connection strings
  /(?:postgres|mysql|mongodb|redis):\/\/[^\s]+/gi,
  // Base64-encoded potential secrets (long base64 strings)
  /(?:Bearer|Basic)\s+[A-Za-z0-9+/=]{40,}/g,
];

// ==================== TYPES ====================

export interface OutputGuardResult {
  safe: boolean;
  sanitizedResponse: string;
  issues: string[];
}

// ==================== PUBLIC API ====================

/**
 * Validate and sanitize LLM response before returning to user.
 */
export function validateOutput(response: string): OutputGuardResult {
  const issues: string[] = [];

  // 1. Run PII sanitizer
  let sanitized = sanitizeOutput(response);

  // 2. Check for blocked output patterns
  for (const pattern of BLOCKED_OUTPUT_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(sanitized)) {
      issues.push("blocked_content_detected");
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    }
  }

  // 3. Check response length (prevent token stuffing attacks)
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000) + "\n\n[Response truncated for safety]";
    issues.push("response_truncated");
  }

  // 4. Check for empty/useless responses
  if (sanitized.trim().length < 5) {
    sanitized = "I couldn't generate a helpful response. Please try rephrasing your question.";
    issues.push("empty_response");
  }

  return {
    safe: issues.length === 0,
    sanitizedResponse: sanitized,
    issues,
  };
}

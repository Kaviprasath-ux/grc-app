/**
 * PII Scanner — Detect and Redact Personally Identifiable Information
 *
 * Layer 2: Scans user input and LLM output for PII.
 * Redacts sensitive data before it reaches OpenAI or the user.
 */

// ==================== PII PATTERNS ====================

interface PIIPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
  severity: "high" | "medium" | "low";
}

const PII_PATTERNS: PIIPattern[] = [
  // HIGH SEVERITY — Sensitive PII
  {
    name: "credit_card",
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "[CARD_REDACTED]",
    severity: "high",
  },
  {
    name: "ssn",
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: "[SSN_REDACTED]",
    severity: "high",
  },
  {
    name: "aadhaar",
    pattern: /\b\d{4}[-\s]\d{4}[-\s]\d{4}\b/g, // Requires dashes/spaces to avoid false positives
    replacement: "[ID_REDACTED]",
    severity: "high",
  },
  {
    name: "passport",
    pattern: /\b[A-Z]{1,2}\d{7,8}\b/g,
    replacement: "[PASSPORT_REDACTED]",
    severity: "high",
  },
  {
    name: "api_key",
    pattern: /\b(sk-[a-zA-Z0-9]{20,}|AKIA[A-Z0-9]{16}|ghp_[a-zA-Z0-9]{36})\b/g,
    replacement: "[API_KEY_REDACTED]",
    severity: "high",
  },
  {
    name: "password_value",
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*\S+/gi,
    replacement: "password: [REDACTED]",
    severity: "high",
  },
  {
    name: "connection_string",
    pattern: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s]+/gi,
    replacement: "[CONNECTION_STRING_REDACTED]",
    severity: "high",
  },

  // MEDIUM SEVERITY — Direct PII
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL_REDACTED]",
    severity: "medium",
  },
  {
    name: "phone",
    pattern: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
    replacement: "[PHONE_REDACTED]",
    severity: "medium",
  },
  {
    name: "ip_address",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    replacement: "[IP_REDACTED]",
    severity: "medium",
  },

  // LOW SEVERITY — Potential PII (contextual)
  {
    name: "bank_account_contextual",
    pattern: /(?:account\s*(?:no|number|#)\s*[:=]?\s*)\d{8,18}/gi,
    replacement: "account number: [REDACTED]",
    severity: "low",
  },
];

// ==================== TYPES ====================

export interface PIIDetection {
  found: boolean;
  matches: PIIMatch[];
  highSeverityCount: number;
  mediumSeverityCount: number;
}

export interface PIIMatch {
  type: string;
  severity: "high" | "medium" | "low";
  position: number;
}

// ==================== PUBLIC API ====================

/**
 * Scan text for PII patterns. Returns detection results without modifying the text.
 */
export function detectPII(text: string): PIIDetection {
  const matches: PIIMatch[] = [];

  for (const piiPattern of PII_PATTERNS) {
    // Reset regex lastIndex for global patterns
    piiPattern.pattern.lastIndex = 0;
    let match;
    while ((match = piiPattern.pattern.exec(text)) !== null) {
      matches.push({
        type: piiPattern.name,
        severity: piiPattern.severity,
        position: match.index,
      });
    }
  }

  return {
    found: matches.length > 0,
    matches,
    highSeverityCount: matches.filter((m) => m.severity === "high").length,
    mediumSeverityCount: matches.filter((m) => m.severity === "medium").length,
  };
}

/**
 * Redact PII from text — replaces detected PII with placeholder tokens.
 * Use this before sending text to OpenAI or logging.
 */
export function redactPII(text: string): { redacted: string; piiFound: boolean; redactionCount: number } {
  let redacted = text;
  let redactionCount = 0;

  for (const piiPattern of PII_PATTERNS) {
    piiPattern.pattern.lastIndex = 0;
    const before = redacted;
    redacted = redacted.replace(piiPattern.pattern, piiPattern.replacement);
    if (redacted !== before) {
      // Count how many replacements were made
      piiPattern.pattern.lastIndex = 0;
      const matches = before.match(piiPattern.pattern);
      redactionCount += matches ? matches.length : 0;
    }
  }

  return {
    redacted,
    piiFound: redactionCount > 0,
    redactionCount,
  };
}

/**
 * Sanitize LLM output — remove any PII that leaked into the response.
 * Also removes system prompt leakage and credential exposure.
 */
export function sanitizeOutput(response: string): string {
  let sanitized = response;

  // 1. Redact standard PII patterns
  const { redacted } = redactPII(sanitized);
  sanitized = redacted;

  // 2. Block system prompt leakage
  sanitized = sanitized.replace(
    /(?:system\s+prompt|my\s+instructions\s+(?:are|say)|I\s+was\s+(?:told|instructed)\s+to)\s*[:].*/gi,
    "[internal details hidden]"
  );

  // 3. Remove any raw JSON/SQL that might have leaked
  sanitized = sanitized.replace(
    /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*?(?:FROM|INTO|SET)\s+\w+/gi,
    "[query hidden]"
  );

  return sanitized;
}

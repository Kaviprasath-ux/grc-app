/**
 * Input Guardrails — Prompt Injection Detection & Intent Validation
 *
 * Layer 1: Blocks malicious prompts before they reach the LLM.
 * Uses regex patterns for known injection techniques + optional LLM-based validation.
 */

// ==================== INJECTION PATTERNS ====================

const INJECTION_PATTERNS: { pattern: RegExp; category: string }[] = [
  // Direct instruction override
  { pattern: /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions|rules|prompts)/i, category: "instruction_override" },
  { pattern: /you\s+are\s+now\s+(in\s+)?(admin|root|system|debug)\s+mode/i, category: "privilege_escalation" },
  { pattern: /forget\s+(all\s+)?(your|previous)\s+(rules|instructions)/i, category: "instruction_override" },
  { pattern: /override\s+(system|security|safety)/i, category: "privilege_escalation" },
  { pattern: /act\s+as\s+(if\s+)?(you\s+have\s+)?(no|without)\s+(restrictions|limits|rules)/i, category: "jailbreak" },
  { pattern: /disregard\s+(all|any|your)\s+(previous|prior|safety)/i, category: "instruction_override" },
  { pattern: /new\s+instructions?\s*:/i, category: "instruction_override" },

  // SQL injection via natural language
  { pattern: /SELECT\s+\*\s+FROM/i, category: "sql_injection" },
  { pattern: /DROP\s+TABLE/i, category: "sql_injection" },
  { pattern: /DELETE\s+FROM/i, category: "sql_injection" },
  { pattern: /INSERT\s+INTO/i, category: "sql_injection" },
  { pattern: /UPDATE\s+.*\s+SET/i, category: "sql_injection" },
  { pattern: /UNION\s+SELECT/i, category: "sql_injection" },
  { pattern: /;\s*DROP\s/i, category: "sql_injection" },
  { pattern: /'\s*OR\s+'?1'?\s*=\s*'?1/i, category: "sql_injection" },

  // Data exfiltration attempts
  { pattern: /show\s+(me\s+)?(all\s+)?passwords/i, category: "data_exfiltration" },
  { pattern: /list\s+(all\s+)?(user\s+)?(credentials|passwords|secrets)/i, category: "data_exfiltration" },
  { pattern: /what\s+is\s+the\s+(admin|root|system)\s+password/i, category: "data_exfiltration" },
  { pattern: /show\s+(me\s+)?(the\s+)?api\s+keys?/i, category: "data_exfiltration" },
  { pattern: /database\s+(connection|url|string|credentials)/i, category: "data_exfiltration" },
  { pattern: /environment\s+variables?/i, category: "data_exfiltration" },
  { pattern: /\.env\s+file/i, category: "data_exfiltration" },
  { pattern: /show\s+(me\s+)?(all\s+)?user\s+emails/i, category: "data_exfiltration" },
  { pattern: /list\s+(all\s+)?users?\s+(with|and)\s+(their\s+)?(emails?|phones?|passwords?)/i, category: "data_exfiltration" },
  { pattern: /dump\s+(the\s+)?(database|users?|table)/i, category: "data_exfiltration" },
  { pattern: /export\s+(all\s+)?(user|customer)\s+data/i, category: "data_exfiltration" },

  // Jailbreak patterns
  { pattern: /DAN\s+mode/i, category: "jailbreak" },
  { pattern: /developer\s+mode\s+(enabled|on|activated)/i, category: "jailbreak" },
  { pattern: /pretend\s+(you\s+)?(are|can|have)\s+(no\s+)?(restrictions|limits|an?\s+unrestricted)/i, category: "jailbreak" },
  { pattern: /you\s+can\s+do\s+anything\s+now/i, category: "jailbreak" },
  { pattern: /bypass\s+(the\s+)?(safety|security|filter|content)/i, category: "jailbreak" },

  // System prompt extraction
  { pattern: /what\s+(is|are)\s+your\s+(system\s+)?instructions/i, category: "prompt_extraction" },
  { pattern: /show\s+(me\s+)?your\s+(system\s+)?prompt/i, category: "prompt_extraction" },
  { pattern: /repeat\s+(your\s+)?(system|initial)\s+(prompt|instructions|message)/i, category: "prompt_extraction" },
  { pattern: /what\s+were\s+you\s+told\s+to\s+do/i, category: "prompt_extraction" },
];

// ==================== BLOCKED TOPICS ====================

const BLOCKED_TOPICS: { pattern: RegExp; message: string }[] = [
  { pattern: /how\s+to\s+(hack|exploit|breach|attack)/i, message: "I cannot provide information about hacking or exploiting systems." },
  { pattern: /(create|make|build)\s+(a\s+)?(virus|malware|ransomware|exploit)/i, message: "I cannot assist with creating malicious software." },
  { pattern: /how\s+to\s+(bypass|circumvent|evade)\s+(security|firewall|antivirus)/i, message: "I cannot help with bypassing security measures." },
];

// ==================== RATE LIMITING ====================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = {
  maxQueriesPerHour: 30,
  maxQueriesPerHourAdmin: 60,
  windowMs: 60 * 60 * 1000, // 1 hour
};

// ==================== PUBLIC API ====================

export interface InputGuardResult {
  allowed: boolean;
  reason?: string;
  category?: string;
  userMessage?: string; // Safe message to show the user
}

/**
 * Check user input for prompt injection, data exfiltration, and blocked topics.
 * Returns { allowed: true } if safe, or { allowed: false, reason, userMessage } if blocked.
 */
export function checkInputGuardrails(query: string): InputGuardResult {
  const trimmed = query.trim();

  // Empty/too short queries
  if (trimmed.length < 2) {
    return { allowed: false, reason: "query_too_short", userMessage: "Please enter a longer question." };
  }

  // Too long queries (potential prompt stuffing)
  if (trimmed.length > 2000) {
    return { allowed: false, reason: "query_too_long", userMessage: "Your question is too long. Please keep it under 2000 characters." };
  }

  // Check injection patterns
  for (const { pattern, category } of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: `injection_detected:${category}`,
        category,
        userMessage: "I can only help with GRC-related questions about risks, controls, compliance, and audit. I cannot access credentials, system internals, or user personal data.",
      };
    }
  }

  // Check blocked topics
  for (const { pattern, message } of BLOCKED_TOPICS) {
    if (pattern.test(trimmed)) {
      return {
        allowed: false,
        reason: "blocked_topic",
        category: "blocked_topic",
        userMessage: message,
      };
    }
  }

  return { allowed: true };
}

/**
 * Rate limiter — checks if user has exceeded query limits.
 */
export function checkRateLimit(userId: string, isAdmin: boolean): InputGuardResult {
  const now = Date.now();
  const limit = isAdmin ? RATE_LIMIT.maxQueriesPerHourAdmin : RATE_LIMIT.maxQueriesPerHour;

  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60000);
    return {
      allowed: false,
      reason: "rate_limit_exceeded",
      category: "rate_limit",
      userMessage: `You've reached the query limit (${limit}/hour). Please try again in ${minutesLeft} minutes.`,
    };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Combined input check — runs all input guardrails.
 */
export function validateInput(
  query: string,
  userId: string,
  isAdmin: boolean
): InputGuardResult {
  // 1. Check rate limit
  const rateResult = checkRateLimit(userId, isAdmin);
  if (!rateResult.allowed) return rateResult;

  // 2. Check input guardrails (injection, exfiltration, blocked topics)
  const inputResult = checkInputGuardrails(query);
  if (!inputResult.allowed) return inputResult;

  return { allowed: true };
}

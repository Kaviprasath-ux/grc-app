/**
 * Logging helper that redacts known-sensitive keys before printing.
 *
 * Wraps any object/array — recursively walks it and replaces values whose
 * key matches the sensitive-key list with "[REDACTED]". Used in auth,
 * payment, and file-upload paths where accidental logging of a credential
 * has the worst blast radius.
 *
 * For routes that log structured context, prefer:
 *   safeLog.info("user signed in", { userId, ip, payload: req.body });
 * over:
 *   console.log("user signed in", req.body);
 *
 * The redactor is conservative — it only redacts the value, never the key —
 * so the log still tells you which fields were present.
 */

const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /pwd/i,
  /secret/i,
  /token/i,
  /^auth$/i, // exact match — avoids redacting "author", "authenticated"
  /authorization/i,
  /api[-_]?key/i,
  /private[-_]?key/i,
  /access[-_]?key/i,
  /^cookie$/i,
  /set-cookie/i,
  /session/i,
  /credit[-_]?card/i,
  /\bcvv\b/i,
  /\bssn\b/i,
  /^bearer$/i,
];

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6; // refuse to walk arbitrarily deep — circular references etc.

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(key));
}

function redact(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return "[REDACTED:too-deep]";
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;
  if (input instanceof Date) return input;
  if (Buffer.isBuffer(input)) return `[Buffer ${input.length}B]`;

  if (Array.isArray(input)) {
    return input.map((v) => redact(v, depth + 1));
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (isSensitiveKey(k)) {
      out[k] = REDACTED;
    } else {
      out[k] = redact(v, depth + 1);
    }
  }
  return out;
}

/**
 * Drop-in replacement for `console.log` / `console.error` etc. that
 * applies redaction to every argument that's an object or array.
 */
export const safeLog = {
  info(message: string, ...args: unknown[]): void {
    console.log(message, ...args.map((a) => redact(a)));
  },
  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args.map((a) => redact(a)));
  },
  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args.map((a) => redact(a)));
  },
  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(message, ...args.map((a) => redact(a)));
    }
  },
};

/**
 * Standalone redactor for callers that want to scrub an object before
 * passing it to a third-party logger (Sentry, Datadog) or storing it.
 */
export function redactSensitiveKeys<T>(value: T): T {
  return redact(value) as T;
}

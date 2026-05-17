/**
 * Simple in-memory rate limiter for API endpoints.
 *
 * For production at scale, consider using Redis-based rate limiting.
 * This implementation is suitable for moderate traffic.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSecs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSecs?: number;
}

/**
 * Check if a request should be rate limited.
 *
 * @param key - Unique identifier (e.g., IP address, email)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 *
 * Dev-mode bypass: in non-production NODE_ENV, rate limiting is skipped so
 * that repeated testing (signup, login retries during local dev / UAT smoke
 * tests) isn't blocked by the production-strength caps. The bypass can be
 * forced off by setting RATE_LIMIT_FORCE=true (useful if you want to test the
 * rate-limit response shape locally).
 */
const RATE_LIMIT_BYPASS_IN_DEV =
  process.env.NODE_ENV !== "production" && process.env.RATE_LIMIT_FORCE !== "true";

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSecs * 1000;

  if (RATE_LIMIT_BYPASS_IN_DEV) {
    return {
      success: true,
      remaining: config.maxRequests,
      resetAt: now + windowMs,
    };
  }

  const entry = store.get(key);

  // No existing entry or window expired - create new
  if (!entry || entry.resetAt < now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetAt,
    };
  }

  // Within window - check limit
  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterSecs: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  // Increment count
  entry.count++;
  store.set(key, entry);

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

/**
 * Get client IP from request headers.
 * Handles proxies (X-Forwarded-For, X-Real-IP).
 */
export function getClientIp(headers: Headers): string {
  // Check common proxy headers
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the first IP (original client)
    return forwarded.split(",")[0].trim();
  }

  const realIp = headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  // Vercel-specific
  const vercelIp = headers.get("x-vercel-forwarded-for");
  if (vercelIp) {
    return vercelIp.split(",")[0].trim();
  }

  // Fallback
  return "unknown";
}

// Pre-configured rate limiters for common use cases
export const RATE_LIMITS = {
  /** Signup: 5 attempts per 15 minutes per IP */
  SIGNUP: { maxRequests: 5, windowSecs: 15 * 60 },
  /** Login: 10 attempts per 15 minutes per IP */
  LOGIN: { maxRequests: 10, windowSecs: 15 * 60 },
  /** API general: 100 requests per minute per IP */
  API_GENERAL: { maxRequests: 100, windowSecs: 60 },
  /** Webhook: 1000 requests per minute (high volume) */
  WEBHOOK: { maxRequests: 1000, windowSecs: 60 },
} as const;

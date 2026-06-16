/**
 * Support Ticketing — deterministic ticket classifier (item 2).
 *
 * Given a ticket's subject/description/category and the tenant's routing
 * rules, this decides the priority, severity, tier, target department and the
 * SLA deadlines. It is a pure function (no DB access) so it is cheap, testable
 * and predictable — the API route fetches the rules and passes them in.
 *
 * Precedence:
 *   1. Built-in P1 keyword hit  → force P1/Critical (SOW §6 critical examples).
 *   2. Matching routing rule    → seed tier/priority/department, plus the
 *      rule's own keywords can also force P1.
 *   3. Fallback                 → L1 / P3 / Medium.
 */

import {
  SLA_TARGETS,
  PRIORITY_TO_SEVERITY,
  isTicketPriority,
  isTicketTier,
  type TicketPriority,
  type TicketSeverity,
  type TicketTier,
} from './constants';

export interface RoutingRuleInput {
  category: string;
  defaultTier: string;
  defaultPriority: string;
  assignToDepartmentId?: string | null;
  keywords?: string | null; // JSON array string
  isActive: boolean;
}

export interface ClassifyInput {
  subject: string;
  description?: string | null;
  category?: string | null;
}

export interface ClassifyResult {
  priority: TicketPriority;
  severity: TicketSeverity;
  tier: TicketTier;
  departmentId: string | null;
  slaAckDeadline: Date;
  slaResolveDeadline: Date;
  matchedRuleCategory: string | null;
  p1KeywordHit: boolean;
}

/**
 * Built-in critical keywords that always escalate to P1, regardless of rules.
 * Drawn from the SOW §6 "Critical" examples (outage, check-in failure, payment
 * gateway down, security breach).
 */
const BUILTIN_P1_KEYWORDS = [
  'outage',
  'down',
  'cannot check in',
  "can't check in",
  'check-in failure',
  'check in failure',
  'payment gateway',
  'payment failure',
  'data breach',
  'security breach',
  'unauthorized access',
  'pms unavailable',
  'pms down',
];

function parseKeywords(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.filter((k) => typeof k === 'string').map((k) => k.toLowerCase());
  } catch {
    // Fall back to comma-separated if not valid JSON.
    return raw
      .split(',')
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
}

function anyKeywordMatches(haystack: string, keywords: string[]): boolean {
  return keywords.some((k) => k.length > 0 && haystack.includes(k));
}

/**
 * Classify a ticket. `now` is injected so deadline math is deterministic and
 * testable (defaults to current time).
 */
export function classifyTicket(
  input: ClassifyInput,
  rules: RoutingRuleInput[],
  now: Date = new Date(),
): ClassifyResult {
  const haystack = `${input.subject} ${input.description ?? ''}`.toLowerCase();

  // 1. Built-in critical keyword detection.
  const p1KeywordHit = anyKeywordMatches(haystack, BUILTIN_P1_KEYWORDS);

  // 2. Match a routing rule by category (active rules only).
  const rule =
    input.category != null
      ? rules.find((r) => r.isActive && r.category.toLowerCase() === input.category!.toLowerCase())
      : undefined;

  let priority: TicketPriority = 'P3';
  let tier: TicketTier = 'L1';
  let departmentId: string | null = null;
  let matchedRuleCategory: string | null = null;

  if (rule) {
    matchedRuleCategory = rule.category;
    if (isTicketPriority(rule.defaultPriority)) priority = rule.defaultPriority;
    if (isTicketTier(rule.defaultTier)) tier = rule.defaultTier;
    departmentId = rule.assignToDepartmentId ?? null;

    // Rule-defined keywords can also bump to P1.
    if (anyKeywordMatches(haystack, parseKeywords(rule.keywords))) {
      priority = 'P1';
    }
  }

  // Built-in P1 keyword always wins (most severe).
  if (p1KeywordHit) {
    priority = 'P1';
    // A P1 from a critical keyword should not sit at L1 — push to L2 minimum.
    if (tier === 'L1') tier = 'L2';
  }

  const severity = PRIORITY_TO_SEVERITY[priority];
  const { ackMinutes, resolveMinutes } = SLA_TARGETS[priority];
  const slaAckDeadline = new Date(now.getTime() + ackMinutes * 60_000);
  const slaResolveDeadline = new Date(now.getTime() + resolveMinutes * 60_000);

  return {
    priority,
    severity,
    tier,
    departmentId,
    slaAckDeadline,
    slaResolveDeadline,
    matchedRuleCategory,
    p1KeywordHit,
  };
}

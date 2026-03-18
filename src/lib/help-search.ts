/**
 * Client-side search engine for Help Chatbot knowledge base.
 * Pure TypeScript — zero external dependencies.
 *
 * Filtering hierarchy:
 * 1. Product scope (isGrcAdded / isTprmAdded / audit roles) — hard boundary between GRC, TPRM, and Audit
 * 2. Audit-only detection — users with only audit roles see Internal Audit content, not GRC modules
 * 3. Role filter — further narrows within the allowed product scope
 */

import type { HelpArticle, HelpModule, HelpModuleInfo, ProductScope } from "@/data/help-knowledge-base";
import { helpModules as allModules } from "@/data/help-knowledge-base";

export interface ScoredResult {
  article: HelpArticle;
  score: number;
}

/**
 * Audit-specific roles. Users with ONLY these roles are "audit-only" and
 * should see only Internal Audit content, not Organization/Compliance/Risk/Assets.
 */
const AUDIT_ROLES = new Set([
  "AuditHead",
  "Auditor",
  "Auditor",
  "Auditee",
]);

/**
 * Product flags from the user's session (mirrors CustomerAccount flags)
 * plus audit role awareness.
 */
export interface ProductFlags {
  isGrcAdded: boolean;
  isTprmAdded: boolean;
  /** User has at least one audit role (AuditHead/Auditor/Auditor/Auditee) */
  isAuditUser: boolean;
  /** User has ONLY audit roles — should not see GRC modules like Org/Compliance/Risk/Assets */
  isAuditOnly: boolean;
}

// Common English stop words to ignore during tokenization
const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "to", "of", "in",
  "for", "on", "with", "at", "by", "from", "as", "into", "through",
  "during", "before", "after", "above", "below", "between", "under",
  "again", "further", "then", "once", "here", "there", "when", "where",
  "why", "how", "all", "both", "each", "few", "more", "most", "other",
  "some", "such", "no", "nor", "not", "only", "own", "same", "so",
  "than", "too", "very", "just", "because", "but", "and", "or", "if",
  "while", "about", "up", "out", "off", "over", "it", "its", "this",
  "that", "these", "those", "i", "me", "my", "we", "our", "you", "your",
  "he", "him", "his", "she", "her", "they", "them", "their", "what",
  "which", "who", "whom",
]);

/**
 * Normalize text: lowercase, strip punctuation, collapse whitespace.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Tokenize text into meaningful words, removing stop words.
 */
export function tokenize(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Levenshtein edit distance for fuzzy matching.
 */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

// ─── Product scope check ──────────────────────────────────────────────

/**
 * Check whether an article's productScope is visible to a user with the given flags.
 *
 * - "both"  → always visible
 * - "grc"   → visible when isGrcAdded=true AND user is NOT audit-only
 * - "audit" → visible when isGrcAdded=true AND user has an audit role
 * - "tprm"  → visible only when isTprmAdded=true
 *
 * This ensures:
 * - AuditHead (audit-only): sees "audit" + "both" only
 * - CustomerAdmin + AuditHead: sees "grc" + "audit" + "both"
 * - Regular GRC user (no audit role): sees "grc" + "both"
 * - TPRM user: sees "tprm" + "both"
 */
function isArticleVisibleForProduct(
  scope: ProductScope,
  flags: ProductFlags
): boolean {
  if (scope === "both") return true;
  if (scope === "grc") return flags.isGrcAdded && !flags.isAuditOnly;
  if (scope === "audit") return flags.isGrcAdded && flags.isAuditUser;
  if (scope === "tprm") return flags.isTprmAdded;
  return true;
}

/**
 * Same check but for HelpModuleInfo.
 */
function isModuleVisibleForProduct(
  mod: HelpModuleInfo,
  flags: ProductFlags
): boolean {
  return isArticleVisibleForProduct(mod.productScope, flags);
}

// ─── Core filter used by every public function ────────────────────────

/**
 * Master article filter. Every function that returns articles goes through this.
 */
function filterArticles(
  articles: HelpArticle[],
  options: {
    productFlags: ProductFlags;
    roleFilter?: string[];
    moduleFilter?: HelpModule;
  }
): HelpArticle[] {
  return articles.filter((article) => {
    // 1. Product scope — hard boundary
    if (!isArticleVisibleForProduct(article.productScope, options.productFlags)) {
      return false;
    }
    // 2. Module filter (for category browsing)
    if (options.moduleFilter && article.module !== options.moduleFilter) {
      return false;
    }
    // 3. Role filter — article-level role restriction
    if (article.roles && article.roles.length > 0 && options.roleFilter) {
      return article.roles.some((r) => options.roleFilter!.includes(r));
    }
    return true;
  });
}

// ─── Public API ───────────────────────────────────────────────────────

export interface SearchOptions {
  moduleFilter?: HelpModule;
  roleFilter?: string[];
  productFlags: ProductFlags;
  maxResults?: number;
}

/**
 * Multi-strategy search across the knowledge base.
 *
 * Scoring strategies:
 * 1. Exact phrase match on question/alternates → +100
 * 2. Token overlap (Jaccard-like) → up to +50
 * 3. Keyword intersection → up to +30
 * 4. Fuzzy match (Levenshtein ≤ 2) → +10 per match
 */
export function searchKnowledgeBase(
  query: string,
  articles: HelpArticle[],
  options: SearchOptions
): ScoredResult[] {
  const normalizedQuery = normalize(query);
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) return [];

  const maxResults = options.maxResults ?? 5;

  // Pre-filter by product scope + role + module
  const eligible = filterArticles(articles, options);

  const results = eligible
    .map((article) => {
      let score = 0;

      // Strategy 1: Exact phrase match on question and alternates
      const allQuestions = [article.question, ...article.alternateQuestions];
      for (const q of allQuestions) {
        const nq = normalize(q);
        if (nq.includes(normalizedQuery)) score += 100;
        if (normalizedQuery.includes(nq)) score += 80;
      }

      // Build article token set from questions + keywords
      const articleTokens = new Set<string>();
      for (const q of allQuestions) {
        for (const t of tokenize(q)) articleTokens.add(t);
      }
      for (const kw of article.keywords) {
        articleTokens.add(kw.toLowerCase());
      }

      // Strategy 2: Token overlap (Jaccard-like)
      const intersection = queryTokens.filter((t) => articleTokens.has(t));
      if (queryTokens.length > 0) {
        score += (intersection.length / queryTokens.length) * 50;
      }

      // Strategy 3: Keyword intersection
      const kwSet = new Set(article.keywords.map((k) => k.toLowerCase()));
      const kwMatches = queryTokens.filter((t) => kwSet.has(t));
      if (kwMatches.length > 0) {
        score += (kwMatches.length / article.keywords.length) * 30;
      }

      // Strategy 4: Fuzzy match (Levenshtein ≤ 2) for typo tolerance
      for (const qt of queryTokens) {
        if (qt.length <= 3) continue;
        for (const at of articleTokens) {
          if (at.length <= 3) continue;
          if (levenshtein(qt, at) <= 2) {
            score += 10;
            break;
          }
        }
      }

      return { article, score };
    })
    .filter((r) => r.score > 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return results;
}

/**
 * Get articles by module for category browsing.
 */
export function getArticlesByModule(
  articles: HelpArticle[],
  module: HelpModule,
  productFlags: ProductFlags,
  roleFilter?: string[]
): HelpArticle[] {
  return filterArticles(articles, { productFlags, roleFilter, moduleFilter: module });
}

/**
 * Get suggested articles based on the current page URL.
 */
export function getSuggestionsForPage(
  articles: HelpArticle[],
  pathname: string,
  productFlags: ProductFlags,
  roleFilter?: string[]
): HelpArticle[] {
  const moduleMap: Record<string, HelpModule> = {
    "/organization": "organization",
    "/compliance": "compliance",
    "/risks": "risk-management",
    "/assets": "asset-management",
    "/internal-audit": "internal-audit",
    "/tprm": "tprm",
    "/grc": "grc-admin",
    "/dashboard": "general",
  };

  let targetModule: HelpModule | undefined;
  for (const [prefix, mod] of Object.entries(moduleMap)) {
    if (pathname.startsWith(prefix)) {
      targetModule = mod;
      break;
    }
  }

  if (!targetModule) return [];

  return getArticlesByModule(articles, targetModule, productFlags, roleFilter).slice(0, 5);
}

/**
 * Get visible modules with article counts, filtered by product scope.
 *
 * - TPRM-only user  → sees: General, TPRM, GRC Admin
 * - GRC user        → sees: General, Organization, Compliance, Risk, Asset, GRC Admin (+Audit if audit role)
 * - Audit-only user → sees: General, Internal Audit, GRC Admin
 * - Both            → sees all applicable
 */
export function getVisibleModules(
  articles: HelpArticle[],
  productFlags: ProductFlags,
  roleFilter?: string[]
): (HelpModuleInfo & { count: number })[] {
  // Filter modules by product scope
  const visibleMods = allModules.filter((m) => isModuleVisibleForProduct(m, productFlags));

  // Count articles per visible module
  return visibleMods
    .map((mod) => {
      const count = filterArticles(articles, {
        productFlags,
        roleFilter,
        moduleFilter: mod.id,
      }).length;
      return { ...mod, count };
    })
    .filter((m) => m.count > 0);
}

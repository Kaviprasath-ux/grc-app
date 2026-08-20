/**
 * Compliance-status helpers for TPRM assessment responses.
 *
 * Single source of truth for the effective Satisfactory / Unsatisfactory
 * verdict of a response. Anything that computes compliance % or
 * classifies a response as a "finding" must use this — otherwise the
 * server aggregate, client donut, and domain-summary bars drift.
 *
 * Priority order (first non-empty wins):
 *   1. Assessor override (assessorStatus)
 *   2. AI verdict (poStatus)
 *   3. Rule-based default: "No" answer ⇒ Unsatisfactory
 *
 * The No-⇒-Unsatisfactory default fixes a real bug: the AI Reviewer
 * panel intentionally skips No/NA answers ("AI review is not required
 * when the vendor answered No or N/A"), which left poStatus null on
 * every No answer. The donut then read 100% Satisfactory because null
 * contributed to neither Sat nor Unsat.
 *
 * Yes and NA fall through with no default — Yes without an AI verdict
 * is genuinely unassessed (waiting on AI), and NA is by definition
 * outside the compliance denominator.
 */

export type EffectiveComplianceStatus = 'Satisfactory' | 'Unsatisfactory' | null;

export interface ComplianceInput {
  response?: string | null;
  assessorStatus?: string | null;
  poStatus?: string | null;
}

/**
 * Returns the effective Satisfactory/Unsatisfactory verdict for a
 * response, or null when the response is not counted toward compliance
 * (unanswered, NA with no override, Yes still waiting on AI).
 */
export function effectiveComplianceStatus(r: ComplianceInput): EffectiveComplianceStatus {
  const normalize = (s: string | null | undefined): EffectiveComplianceStatus => {
    const v = (s || '').toLowerCase();
    if (v === 'satisfactory') return 'Satisfactory';
    if (v === 'unsatisfactory') return 'Unsatisfactory';
    return null;
  };

  const override = normalize(r.assessorStatus);
  if (override) return override;

  const ai = normalize(r.poStatus);
  if (ai) return ai;

  const answer = (r.response || '').toLowerCase();
  if (answer === 'no') return 'Unsatisfactory';

  return null;
}

/** True when the response counts as a compliance finding (Unsatisfactory). */
export function isUnsatisfactory(r: ComplianceInput): boolean {
  return effectiveComplianceStatus(r) === 'Unsatisfactory';
}

/** True when the response counts as a compliance pass (Satisfactory). */
export function isSatisfactory(r: ComplianceInput): boolean {
  return effectiveComplianceStatus(r) === 'Satisfactory';
}

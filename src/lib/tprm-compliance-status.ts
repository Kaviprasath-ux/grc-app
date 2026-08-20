/**
 * Compliance-status helpers for TPRM assessment responses.
 *
 * Single source of truth for the effective Satisfactory / Unsatisfactory
 * verdict of a response. Anything that computes compliance % or
 * classifies a response as a "finding" must use this — otherwise the
 * server aggregate, client donut, and domain-summary bars drift.
 *
 * Priority order (first non-empty wins):
 *   1. Assessor override (assessorStatus) — always wins, even over
 *      the No-answer rule (assessor can Satisfy a No-answered question
 *      when a compensating control makes it moot).
 *   2. "No" answer ⇒ Unsatisfactory. Runs BEFORE the AI verdict on
 *      purpose: the vendor admitting "No" is a stronger signal than
 *      an AI that reads evidence and mis-classifies the response as
 *      Satisfactory (observed in the wild — bad AI verdicts on No
 *      answers used to leak through and inflate compliance).
 *   3. AI verdict (poStatus) — applies to Yes/NA answers.
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

  // The No-answer rule runs BEFORE the AI verdict on purpose (see the
  // module docblock). The vendor admitting "No" is a stronger signal
  // than an AI that misreads the evidence and calls it Satisfactory.
  const answer = (r.response || '').toLowerCase();
  if (answer === 'no') return 'Unsatisfactory';

  return normalize(r.poStatus);
}

/** True when the response counts as a compliance finding (Unsatisfactory). */
export function isUnsatisfactory(r: ComplianceInput): boolean {
  return effectiveComplianceStatus(r) === 'Unsatisfactory';
}

/** True when the response counts as a compliance pass (Satisfactory). */
export function isSatisfactory(r: ComplianceInput): boolean {
  return effectiveComplianceStatus(r) === 'Satisfactory';
}

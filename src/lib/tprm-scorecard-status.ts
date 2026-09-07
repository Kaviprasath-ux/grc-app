/**
 * Shared scorecard-config completeness check.
 *
 * The Vendor Scorecard (Continuous Monitoring page + its detail page)
 * relies on four things being set correctly by the TPRM admin. If any
 * of them is missing the security-score number displayed to the
 * assessor is meaningless — the strategic-security-team's ask is that
 * the scorecard page not render at all in that state, and instead
 * prompt the admin to finish the config.
 *
 * Rules (kept in sync with the "Validate Configuration" dialog on the
 * TPRM Configurations page, which used to duplicate this logic):
 *
 *   1. `scoringFormula` is set (AVG / WSA / …).
 *   2. `securityPostureWeight + threatExposureWeight = 100`.
 *   3. At least one mandatory Security Posture factor, and their
 *      weightages sum to 100.
 *   4. At least one mandatory Threat Exposure factor, and their
 *      weightages sum to 100.
 *
 * `errors` is a human-readable list so both the config's own dialog
 * AND the monitoring page's empty-state card can show the same reason
 * strings.
 */

export interface ScorecardConfigLike {
  scoringFormula?: string | null;
  securityPostureWeight?: number | null;
  threatExposureWeight?: number | null;
}

export interface ScorecardFactorLike {
  weightage: number;
  isMandatory: boolean;
  scoreType: string; // "security_posture" | "threat_exposure"
}

export interface ScorecardCompleteness {
  complete: boolean;
  errors: string[];
}

// scoreType values match what the DB stores — PascalCase. Kept in
// sync with the filters on the configurations page (SecurityPosture /
// ThreatExposure).
const SECURITY_POSTURE = 'SecurityPosture';
const THREAT_EXPOSURE = 'ThreatExposure';

/**
 * Pure function — safe to call from a server route or a client
 * component. `t` is an optional translator so callers can localize
 * the error strings; default English is what the existing dialog on
 * the configurations page shows today.
 */
export function validateScorecardConfig(
  config: ScorecardConfigLike | null | undefined,
  factors: ReadonlyArray<ScorecardFactorLike>,
  t: (s: string) => string = (s) => s,
): ScorecardCompleteness {
  const errors: string[] = [];

  if (!config?.scoringFormula) {
    errors.push(t('Scoring formula is not set'));
  }

  const sp = config?.securityPostureWeight ?? 0;
  const te = config?.threatExposureWeight ?? 0;
  if (sp + te !== 100) {
    errors.push(t('Security Posture and Threat Exposure weights must sum to 100%'));
  }

  const spMandatory = factors.filter(f => f.scoreType === SECURITY_POSTURE && f.isMandatory);
  const teMandatory = factors.filter(f => f.scoreType === THREAT_EXPOSURE && f.isMandatory);
  const spTotal = spMandatory.reduce((s, f) => s + f.weightage, 0);
  const teTotal = teMandatory.reduce((s, f) => s + f.weightage, 0);

  if (spMandatory.length === 0) {
    errors.push(t('No mandatory Security Posture factors configured'));
  } else if (spTotal !== 100) {
    errors.push(`${t('Security Posture mandatory weightage must equal 100%')} (${t('current')}: ${spTotal}%)`);
  }

  if (teMandatory.length === 0) {
    errors.push(t('No mandatory Threat Exposure factors configured'));
  } else if (teTotal !== 100) {
    errors.push(`${t('Threat Exposure mandatory weightage must equal 100%')} (${t('current')}: ${teTotal}%)`);
  }

  return { complete: errors.length === 0, errors };
}

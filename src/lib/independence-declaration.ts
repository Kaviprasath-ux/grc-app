/**
 * Shared content for the Internal Audit Independence & Objectivity declarations.
 *
 * These statements/results are the IIA-aligned declaration text. They are shared
 * between the declaration form (independence/page.tsx) and the printable
 * declaration document (independence/[id]/print/page.tsx) so the legal wording
 * can never drift between the two. Strings are English source phrases used as
 * i18n keys — wrap them with `t()` at the point of use.
 */

export type DeclarationType = "Independence" | "Objectivity";

// Fixed declaration statements (from the IIA-aligned declaration forms).
export const DECLARATION_STATEMENTS: Record<string, string[]> = {
  Independence: [
    "I have no personal, financial, or professional interests that could impair my independence.",
    "I have not been involved in operational responsibilities related to the audited area during the past 12 months.",
    "I have no close relationships with personnel working in the audited department that may affect my impartiality.",
    "I will immediately disclose any situation that may arise which could affect my independence.",
  ],
  Objectivity: [
    "I will conduct the audit without bias, conflict of interest, or undue influence.",
    "My conclusions will be based solely on sufficient and appropriate audit evidence.",
    "I will disclose any circumstances that may affect my professional judgment.",
    "I will adhere to the Code of Ethics and Objectivity principles established by The Institute of Internal Auditors.",
  ],
};

// Result options per type: value -> label
export const DECLARATION_RESULTS: Record<string, { value: string; label: string }[]> = {
  Independence: [
    { value: "Confirmed", label: "I confirm full independence" },
    { value: "PotentialImpairment", label: "Potential impairment exists" },
  ],
  Objectivity: [
    { value: "NoThreats", label: "No threats to objectivity identified" },
    { value: "PotentialThreat", label: "Potential threat identified" },
  ],
};

// Intro sentence shown above the statements, per declaration type.
export const DECLARATION_INTRO: Record<string, string> = {
  Independence:
    "I hereby declare that I am independent with respect to the activities, departments, and processes subject to this audit engagement. I confirm that:",
  Objectivity:
    "I confirm that I will perform this audit engagement with full objectivity and professional judgment. I declare that:",
};

/** Resolve a stored result value to its display label (untranslated source phrase). */
export function declarationResultLabel(type: string, value: string | null): string | null {
  if (!value) return null;
  return DECLARATION_RESULTS[type]?.find((r) => r.value === value)?.label ?? value;
}

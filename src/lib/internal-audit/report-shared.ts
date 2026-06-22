/**
 * Shared constants & helpers for the Internal Audit Report.
 *
 * These mirror the standard Internal Audit Report document structure and are
 * used by the on-screen report ([id] page + report list modal) and the PDF
 * download route so all surfaces stay consistent.
 *
 * NOTE: label/description strings here are English phrases that the UI passes
 * through `t()` for i18n. The PDF route renders them as-is (English).
 */

export interface ReportFinding {
  id: string;
  findingId: string;
  finding: string;
  description?: string | null;
  severity: string;
  findingType?: string | null;
  criteria?: string | null;
  condition?: string | null;
  cause?: string | null;
  effect?: string | null;
  recommendation?: string | null;
  responsiblePerson?: string | null;
  targetDate?: string | null;
  status: string;
}

// Overall audit opinion ratings (document: Satisfactory / Needs Improvement / Unsatisfactory)
export const OPINION_RATINGS = ["Satisfactory", "Needs Improvement", "Unsatisfactory"] as const;

// Risk levels used for opinion counts, the summary chart, and the index priority.
// Finding severity (Low/Medium/High/Critical) is collapsed onto these via riskLevelOf().
export const RISK_LEVELS = ["High", "Medium", "Low"] as const;

// Finding type classification (document: Definition of Finding Types)
export const FINDING_TYPES = [
  "Absence of Control",
  "Lack of Operational Effectiveness",
  "Best Practices",
  "Non-Compliance",
] as const;

// Priorities-for-implementation table (document)
export const PRIORITY_DEFINITIONS: { label: string; color: string; dot: string; description: string }[] = [
  { label: "High", color: "Red", dot: "bg-red-500", description: "It needs to be constantly reviewed and monitored, and the process of evaluating control systems must be completed. Senior management should be informed consistently." },
  { label: "Medium", color: "Orange", dot: "bg-orange-400", description: "You need to review regularly to ensure the adequacy and effectiveness of the control systems. Senior management should be informed regularly." },
  { label: "Low", color: "Yellow", dot: "bg-yellow-400", description: "You need to review periodically, keeping in mind monitoring the results of the risk to ensure it doesn't increase over time." },
  { label: "Minor", color: "Green", dot: "bg-green-500", description: "Inspection of the control systems required is not specific, and control measures are evaluated when appropriate. No need for reporting." },
];

// Definition of Finding Types table (document)
export const FINDING_TYPE_DEFINITIONS: { label: string; description: string }[] = [
  { label: "Absence of Control", description: "Absence of control or errors in the design of the existing control procedure." },
  { label: "Lack of Operational Effectiveness", description: "The control procedure does not work as required although it is appropriately designed, or the person responsible does not have the competence and authority to implement the control effectively." },
  { label: "Best Practices", description: "Note to strengthen the internal control environment based on best practices." },
  { label: "Non-Compliance", description: "Findings resulting from non-compliance with legislation, regulations and laws." },
];

/** Collapse a finding severity onto a report risk level (High/Medium/Low). */
export function riskLevelOf(severity: string | null | undefined): string {
  if (severity === "Critical" || severity === "High") return "High";
  if (severity === "Medium") return "Medium";
  return "Low";
}

/** Tailwind badge classes for an opinion rating. */
export function ratingBadgeClass(rating: string): string {
  if (rating === "Satisfactory") return "bg-green-100 text-green-700";
  if (rating === "Unsatisfactory") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700"; // Needs Improvement
}

/** Tailwind badge classes for a risk level. */
export function riskBadgeClass(level: string): string {
  if (level === "High") return "bg-red-100 text-red-700";
  if (level === "Medium") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

/** RGB triplet (0-1) for a risk level — used by the PDF chart. */
export function riskLevelRgb(level: string): [number, number, number] {
  if (level === "High") return [0.86, 0.15, 0.15];
  if (level === "Medium") return [0.96, 0.62, 0.04];
  return [0.06, 0.65, 0.36];
}

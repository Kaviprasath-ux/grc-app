/**
 * Phase 2: Engagement lifecycle stage definitions.
 *
 * Canonical ordered list of audit engagement workflow steps (from the MOF
 * Internal Audit Planning requirements). Shared between the engagement hub UI
 * and the API so stage keys stay consistent.
 *
 * `kind`:
 *   - "reuse" : step is backed by an existing page; the hub links out to it.
 *   - "stub"  : step UI is not built yet (Phase 3); the hub shows a placeholder.
 *
 * `href(id)` builds the route for a reused step from the engagement id.
 */

export type EngagementStageKind = "reuse" | "stub" | "meeting" | "apm" | "announcement";

export type MeetingType = "opening" | "discussion" | "closing";

export interface EngagementStage {
  key: string;
  label: string;
  description: string;
  kind: EngagementStageKind;
  /** Route to the existing page for "reuse" steps. */
  href?: (engagementId: string) => string;
  /** Meeting type for "meeting" steps (renders the shared MoM component). */
  meetingType?: MeetingType;
}

export const ENGAGEMENT_STAGES: EngagementStage[] = [
  {
    key: "announcement",
    label: "Announcement",
    description:
      "Send the formal audit announcement to management with the preliminary information request (PBC) list.",
    kind: "announcement",
  },
  {
    key: "apm",
    label: "Audit Planning Memorandum",
    description:
      "Define audit scope, objectives, methodology and timeline; attach detailed audit program documents.",
    kind: "apm",
  },
  {
    key: "opening-meeting",
    label: "Opening Meeting",
    description:
      "Walk through objectives, scope, timeline and key contacts; capture the Minutes of Meeting.",
    kind: "meeting",
    meetingType: "opening",
  },
  {
    key: "audit-program",
    label: "Audit Program",
    description:
      "Review the audit program overview and prepare workpapers before fieldwork begins.",
    kind: "reuse",
    href: (id) => `/internal-audit/fieldwork/${id}`,
  },
  {
    key: "fieldwork",
    label: "Fieldwork",
    description:
      "Run walkthroughs and control testing, manage workpapers, and collect evidence.",
    kind: "reuse",
    href: (id) => `/internal-audit/fieldwork/${id}`,
  },
  {
    key: "findings",
    label: "Findings",
    description:
      "Record audit findings with criteria, condition, cause, effect and recommendations.",
    kind: "reuse",
    href: (id) => `/internal-audit/fieldwork/${id}`,
  },
  {
    key: "discussion",
    label: "Findings Discussion",
    description:
      "Validate facts, agree on action plans and finalize management responses; capture the Minutes of Meeting.",
    kind: "meeting",
    meetingType: "discussion",
  },
  {
    key: "report",
    label: "Report",
    description:
      "Generate the draft and final audit reports and capture auditee responses.",
    kind: "reuse",
    href: () => `/internal-audit/report`,
  },
  {
    key: "closing-meeting",
    label: "Closing Meeting",
    description:
      "Discuss final observations and action plans; capture the Minutes of Meeting.",
    kind: "meeting",
    meetingType: "closing",
  },
  {
    key: "follow-up",
    label: "Follow-up",
    description:
      "Track implementation of recommendations, due dates and remediation progress.",
    kind: "reuse",
    href: () => `/internal-audit/capa-tracking`,
  },
];

export const ENGAGEMENT_STAGE_KEYS = ENGAGEMENT_STAGES.map((s) => s.key);

export const DEFAULT_ENGAGEMENT_STAGE = ENGAGEMENT_STAGES[0].key;

export type EngagementStageStatus = "completed" | "in_progress";

export type StageProgressMap = Record<string, EngagementStageStatus>;

/** Index of a stage key in the canonical order (-1 if unknown). */
export function stageIndex(key: string): number {
  return ENGAGEMENT_STAGE_KEYS.indexOf(key);
}

/** Next stage key after the given one, or null if it's the last/unknown. */
export function nextStageKey(key: string): string | null {
  const i = stageIndex(key);
  if (i < 0 || i >= ENGAGEMENT_STAGES.length - 1) return null;
  return ENGAGEMENT_STAGES[i + 1].key;
}
